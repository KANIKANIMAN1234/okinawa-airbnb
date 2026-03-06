# 詳細設計書：Airbnb宿泊施設予約管理アプリ (v1.0)

## 1. モジュール構成
本システムは、(1) LINE Webhook／時間駆動／**iCal 取得・予約API**を担当するGASバックエンド、(2) 管理者画面および**カレンダー予約画面**を提供するVercelフロントエンド、(3) データ永続化を行うGoogleスプレッドシート、(4) **Airbnb iCal**（読み取りのみ）の4要素で構成する。

---

## 2. GAS バックエンドロジック

### 2.1 Webhook エントリポイント（doPost）
1. **受信:** `e.postData.contents` を取得。LINE Webhook のペイロードは JSON。
2. **署名検証:** `X-Line-Signature` と Channel Secret で HMAC-SHA256 を計算し比較。失敗時は 403 を返して終了。
3. **イベント解析:** `events` 配列をループ。`type === "message"` かつ `message.type === "text"` を対象とする。
4. **送信者判定:** `event.source.userId` を取得。これが `config` の管理者LINE User ID と一致する場合は「管理者からのメッセージ」として別処理（必要なら返信やログのみ）。一致しない場合は「ゲスト」として以下を実行。
5. **問い合わせ保存:** inquiries シートに [受信日時, userId, displayName（取得可能なら）, message.text, message.id, 通知済フラグ] を appendRow。
6. **ゲストマスタ更新:** guests シートに該当 userId が無ければ追加（lineUserId, displayName, 登録日時）。
7. **管理者通知:** LINE Messaging API の push で、管理者の userId 宛に「ゲストからの問い合わせ」およびメッセージ本文（または要約）を送信。
8. **応答:** `ContentService.createTextOutput("").setMimeType(ContentService.MimeType.TEXT)` で 200 を返す（LINEには body は空で可）。

### 2.2 管理者画面用 API（doPost、action で分岐）
1. **リクエスト解析:** `JSON.parse(e.postData.contents)` で `action` と `data` を取得。
2. **getTemplate:** `data.key === "oneWeekBefore"` のとき、templates シートから該当キーの `body` を読み、`{ status: "success", result: { body: "..." } }` を返す。
3. **saveTemplate:** `data.key` と `data.body` を受け取り、templates シートの該当キー行を更新（またはなければ追加）。`updatedAt` を現在日時にする。返却は `{ status: "success" }`。
4. **getAvailability:** config から `airbnbIcalUrl` を取得。`UrlFetchApp.fetch(airbnbIcalUrl)` で iCal テキストを取得し、VEVENT の DTSTART/DTEND をパースして「予約済み日」の YYYY-MM-DD 配列を生成。`{ status: "success", result: { blockedDates: [...] } }` を返す。オプションで year/month または start/end で対象期間を絞る。
5. **getPricing:** config から `nightlyRate` と `cleaningFee`（または `cleaningFee` 固定 10000）を読み、`{ status: "success", result: { nightlyRate, cleaningFee } }` を返す。
6. **confirmReservation:** `data` から lineUserId, displayName, checkIn, checkOut, numberOfGuests, totalAmount を取得。再度 getAvailability と同様に iCal を取得し、checkIn〜checkOut の期間がブロック日と重複していないか確認。重複していれば `{ status: "error", message: "選択された期間は既に予約が入っています" }` を返す。重複がなければ reservations に新規行を追加（status: "確定", confirmedAt: 現在日時）、guests に未登録なら追加。ゲストの LINE に御礼メッセージ、管理者の LINE に「予約が入りました（ゲスト名・日程・人数・金額）」を push。`{ status: "success", result: { reservationId } }` を返す。
7. **CORS:** レスポンスに `ContentService.MimeType.JSON` を指定。必要なら `doOptions` で Access-Control-Allow-Origin を返す。

### 2.3 時間駆動トリガー（日次バッチ想定）
1. **実行タイミング:** 毎日 1回（例: 午前0時または午前6時）。GASの「トリガー」で「時間駆動」を設定。
2. **処理内容:**
   - 当日の日付を取得。
   - **7日前通知:** reservations から `checkInDate` が「今日+7日」の確定予約を検索。各予約の `guestLineUserId` に対し、templates の "oneWeekBefore" の `body` を push で送信。
   - **3日前通知:** `checkInDate` が「今日+3日」の予約のゲストに、config の `checkInGuidePdfUrl` を送信。
   - **チェックイン当日・お昼:** `checkInDate` が今日の予約のゲストに、config の `doorVideoYoutubeUrl` を送信。
   - **チェックイン当日・16時頃:** 同上ゲストに「チェックイン完了できましたか？」等の固定文またはテンプレートを送信。
   - **チェックアウト前日・お昼:** `checkOutDate` が「今日+1日」の予約のゲストに「明日チェックアウト・お忘れ物注意・清掃協力」のメッセージを送信。
3. **送信制御:** 同じゲストに同日複数回送らないよう、送信済みフラグを reservations や別ログシートに持つか、または「1日1回のバッチで各条件に1回だけ送る」で重複を避ける。

### 2.4 iCal パースロジック（getAvailability 内）
* **入力:** config の `airbnbIcalUrl` から取得した .ics のテキスト。
* **形式:** iCalendar (RFC 5545)。`BEGIN:VEVENT` ～ `END:VEVENT` のブロック内に `DTSTART` と `DTEND` がある。日付は `DTSTART;VALUE=DATE:20250501` または `DTSTART:20250501T150000Z` 等形式。
* **処理:** 各 VEVENT について DTSTART/DTEND を解釈し、その期間に含まれる全日付（YYYY-MM-DD）を「予約済み日」として配列に追加。重複を除いた blockedDates 配列を返す。対象期間（year/month または start/end）が指定されていれば、その範囲内の日付のみ返す。

### 2.5 予約確定時の処理（手動またはカレンダー画面）
* **LINE 経由:** 管理者がゲストとやり取りし「予約確定」としたタイミングで、reservations の該当行の `status` を "確定" に更新し、`confirmedAt` を記録。
* **カレンダー画面経由:** 上記 2.2 の confirmReservation で、新規行を status "確定" で追加。いずれもゲスト・管理者へ LINE 通知する。
* ゲストに push で「予約が確定しました」＋周辺おすすめレストラン案内を送信。
* 管理者のLINE User ID 宛に「予約確定：ゲスト○○、チェックイン○月○日〜○月○日」のような通知を push する。

---

## 3. Vercel フロントエンドロジック

### 3.1 初期表示（window.onload または DOMContentLoaded）
1. ページ読み込み後、GASの getTemplate API を呼び出す（fetch POST、body: `{ action: "getTemplate", data: { key: "oneWeekBefore" } }`）。
2. レスポンスの `result.body` を `textarea` の value にセットする。
3. エラー時は「テンプレートの取得に失敗しました」を表示。

### 3.2 保存処理（保存ボタン onclick）
1. `textarea` の値を取得。空や超過文字数はバリデーション（任意）。
2. 保存ボタンを disabled にする。
3. GASの saveTemplate API を呼び出す（body: `{ action: "saveTemplate", data: { key: "oneWeekBefore", body: textareaの値 } }`）。
4. `status === "success"` なら「保存しました」を表示し、ボタンを再度有効化。
5. `status === "error"` なら `message` を表示し、ボタンを有効化。

### 3.3 環境変数
* `GAS_API_URL`: GASのWebアプリURL。fetch のエンドポイントに使用する。

### 3.4 カレンダー予約画面のフロントロジック
1. **初期化:** LIFF を初期化し、未ログインなら `liff.login()`。ログイン後 `liff.getProfile()` で lineUserId, displayName を取得。
2. **空き取得:** `getAvailability` を呼び、blockedDates を受け取る。表示する月の全日から blockedDates を除いた日を「空き」としてカレンダーに表示（予約済みはグレーアウト等）。
3. **料金取得:** `getPricing` で nightlyRate, cleaningFee を取得。チェックイン・チェックアウト選択後、泊数 = (checkOut - checkIn) の日数。総額 = nightlyRate × 泊数 + cleaningFee を計算して表示。
4. **確定:** 「宿泊を確定させる」押下で、lineUserId, displayName, checkIn, checkOut, numberOfGuests, totalAmount を `confirmReservation` に送信。成功時は「予約が確定しました」表示と御礼LINE・管理者通知。失敗時はエラーメッセージ表示。

---

## 4. データフロー一覧

| トリガー | 処理 | データの流れ |
| :--- | :--- | :--- |
| ゲストがLINEでメッセージ送信 | Webhook | LINE → GAS → inquiries 保存、guests 更新、管理者へ push |
| 管理者がVercelでテンプレート編集して保存 | 保存ボタン | Vercel → GAS (saveTemplate) → templates シート更新 |
| 時間駆動（日次） | バッチ | GAS が reservations / templates / config を参照 → 条件に合うゲストに push |
| 予約確定 | 手動／半自動 | reservations 更新 → ゲスト・管理者へ push |
| カレンダー表示 | ページ表示・月切り替え | Vercel → GAS (getAvailability) → iCal 取得・パース → blockedDates 返却 → 空き日表示 |
| カレンダー予約確定 | 「宿泊を確定させる」押下 | Vercel → GAS (confirmReservation) → 空き再確認 → reservations 保存 → ゲスト・管理者へ push |

---

## 5. エラー処理
* **Webhook:** 例外が発生しても catch で握り、200 を返す。エラー内容はログまたはスプレッドシートの「エラーログ」シートに追記する。
* **管理者画面API:** try-catch で囲み、エラー時は `{ status: "error", message: "..." }` を返す。
* **時間駆動:** 1件失敗しても他は続行する。失敗した予約ID・ゲストIDはログに残す。

---

## 6. 定数・設定値（GAS内）
* `SPREADSHEET_ID`: 対象スプレッドシートのID。
* `CHANNEL_ACCESS_TOKEN`: LINE Messaging API の Channel Access Token（スクリプトプロパティ推奨）。
* `CHANNEL_SECRET`: Webhook 署名検証用（スクリプトプロパティ推奨）。
* 管理者LINE User ID、清掃代（10000）、**1泊料金（nightlyRate）**、**Airbnb iCal URL（airbnbIcalUrl）**、PDF/YouTube URL は config シートから読み込む。
