# 外部連携仕様書：Airbnb宿泊施設予約管理アプリ (v1.0)

## 1. 外部連携概要
本システムは、LINE公式アカウント（Messaging API・Webhook・LINE Login / LIFF）、Vercel（管理者画面・カレンダー予約画面）、Google Workspace（GAS・スプレッドシート）、GitHub（ソースコード・Vercelデプロイ連携）、**Airbnb iCal カレンダー**を連携させる。

---

## 2. LINEプラットフォーム連携

### 2.1 LINE Messaging API
* **用途:** ゲスト・管理者へのプッシュメッセージ送信。
* **Channel:** LINE Developers で作成した「Messaging API」用チャネルを使用する。
* **アクセス:** GAS から `UrlFetchApp.fetch` で LINE Messaging API の `https://api.line.me/v2/bot/message/push` 等を呼び出す。Channel Access Token をヘッダーに付与する。

### 2.2 LINE Webhook
* **用途:** ゲストがLINEで送信したメッセージをGASで受信する。
* **設定:** LINE Developers のチャネル設定で「Webhook URL」にGASのWebアプリURL（POSTを受け付けるデプロイ）を指定する。
* **検証:** リクエストヘッダー `X-Line-Signature` の署名を Channel Secret で検証し、正当なLINE Platform からのリクエストであることを確認する。
* **応答:** 処理の成否に関わらず、200 OK を返す（LINEのリトライを防ぐため）。

### 2.3 LINE Login（LIFF）・カレンダー予約画面
* **カレンダー予約画面:** Vercel 上の予約ページを **LIFF** で開くことで、ゲストが LINE ログインした状態でチェックイン・チェックアウト・人数を選択し「宿泊を確定させる」を実行できる。このとき取得した `userId`（LINE User ID）に予約を紐付け、御礼メッセージをその LINE に送信する。
* Webhook でメッセージを受信したゲストと、LIFF でログインしたゲストは、同一の LINE User ID でゲストマスタ・予約と紐付ける。

### 2.4 権限・役割の分離
* **管理者LINE User ID:** `config` シートに保持。問い合わせ着信通知・予約確定通知の送信先とする。
* **ゲスト:** 上記以外の `userId`。問い合わせの保存・予約紐付け・各種案内メッセージの送信先とする。

### 2.5 リッチメニューと自動応答（例：ゴミ捨て方法）
* **想定:** リッチメニューに「ゴミ捨て方法」を配置し、タップ時にゴミ捨て方法の案内を自動で返信する。
* **実装の受け口:** リッチメニューで「postback」アクションを指定し、data に `garbage_disposal` 等の識別子を設定する。ユーザーがタップすると、**同じ LINE Webhook** に `event.type === "postback"` のイベントが届く。
* **処理:** Webhook の doPost 内で、`event.type` に応じて分岐する。`postback` かつ `event.postback.data === "garbage_disposal"` のとき、ゴミ捨て方法の文面（config または templates シートで管理）を取得し、Reply API でそのユーザーに返信する。問い合わせ保存・管理者通知は行わない。
* **「Webhook と混在」について:** メッセージ受信（問い合わせ）と postback（リッチメニュー）は**どちらも LINE が同じ Webhook URL に送るイベント**であり、**1つの Webhook で event.type によって処理を分けるのは標準的な設計**で問題ない。混在を避けるべきなのは、後述の「LINE Webhook 用URL」と「Vercel 用API用URL」を同一エンドポイントにまとめることである。

---

## 3. Google Workspace 連携

### 3.1 Google Apps Script (GAS)

#### 役割
* Webhook受信（メッセージ・postback＝リッチメニュー等）、スプレッドシートの読み書き、LINE API の呼び出し、時間駆動トリガーによる定期実行。
* Vercel からの API 呼び出し（getAvailability, getPricing, confirmReservation, getTemplate, saveTemplate）の受け口。

#### Webhook と API の「混在」を避ける設定方針（推奨）
「Webhook と混在は好ましくない」と言われるのは、主に次の2点を指すことが多い。

| 意味 | 推奨方針 |
| :--- | :--- |
| **LINE のイベントと Vercel からの API を同じ URL で受けない** | **推奨:** LINE Webhook 用の GAS デプロイ（URL-A）と、Vercel 用 API の GAS デプロイ（URL-B）を**分ける**。LINE の「Webhook URL」には URL-A のみを設定し、Vercel の環境変数には URL-B を設定する。これにより、LINE 署名検証は URL-A でのみ行い、URL-B には Vercel 以外が知らないURLとして API を公開する。 |
| **メッセージと postback（リッチメニュー）を同じ Webhook で受けてもよいか** | **問題なし:** 1つの Webhook URL（URL-A）で、`event.type === "message"`（問い合わせ）と `event.type === "postback"`（ゴミ捨て方法タップ等）の**両方を処理してよい**。LINE はチャネルあたり 1 つの Webhook URL しか持てないため、メッセージも postback も同じ URL に届く。処理は doPost 内で `event.type` や `event.postback.data` で分岐し、関数ごとに整理する。 |

**まとめ:**
* **LINE Webhook 用 GAS（URL-A）:** 署名検証のうえ、`message` → 問い合わせ保存・管理者通知、`postback` → ゴミ捨て方法などの自動返信。**ここにリッチメニュー自動応答を追加するのは正しい設計。**
* **Vercel 用 API 用 GAS（URL-B）:** getAvailability, getPricing, confirmReservation, getTemplate, saveTemplate のみ。LINE の Webhook URL には設定しない。
* 同一 GAS プロジェクトで doPost を 1 つにし、リクエストの形で「LINE か API か」を判別して分岐させる方式も可能だが、署名検証の扱いとセキュリティを明確にするため、**URL を 2 つに分ける運用を推奨**する。

#### デプロイ
* **Webhook 用（URL-A）:** 「デプロイ」→「ウェブアプリ」で「全員」に実行し、発行した URL を LINE Developers の「Webhook URL」にのみ設定。
* **API 用（URL-B）:** 同一プロジェクトで別デプロイとしてもう 1 つ URL を発行するか、別 GAS プロジェクトで doPost（action 分岐）を公開。Vercel の環境変数にはこの URL-B を設定。
* **CORS:** URL-B（API 用）に対して、GAS 側で `ContentService.createTextOutput(JSON).setMimeType(ContentService.MimeType.JSON)` を返し、必要に応じて `doOptions` で Preflight に対応する。

### 3.2 Google Sheets
* **Spreadsheet ID:** 1つのスプレッドシートに、inquiries / reservations / guests / templates / config の各シートを用意する。
* **参照:** GAS から `SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName("シート名")` でアクセスする。

### 3.3 Google Drive（月間売上 PDF 保存先）
* **フォルダID:** config の `driveFolderId` に、月間売上 PDF を保存する Google Drive のフォルダID を保存する。
* **設定権限:** このフォルダID は **管理者の LINE でアクセスした時のみ** Vercel の管理者画面で設定・変更できる。ゲストには表示・編集させない。
* **保存処理:** 月締め時（手動ボタンまたは時間駆動）に、GAS で `DriveApp.getFolderById(driveFolderId)` を実行し、生成した PDF を `createFile(blob)` で保存する。ファイル名は例として「月間売上_YYYY年MM月.pdf」。

### 3.4 LINE グループ／オープンチャット（清掃員への予約確定通知）
* **要件:** 予約確定時に、清掃員が参加している LINE オープンチャット（またはグループトーク）にも自動で予約確定の通知を送りたい。
* **可否:** **可能**。LINE Messaging API の **Push Message** は、送信先（`to`）に **グループID** を指定できる。清掃員用のオープンチャット（またはグループ）に **公式アカウントのボットをメンバーとして追加**し、そのトークで何かメッセージがやり取りされた際に Webhook で届くイベントの `event.source.groupId` からグループID を取得する。この ID を config の `cleanerLineGroupId` に保存する。
* **予約確定時:** confirmReservation 処理の一環で、管理者の LINE への通知に加え、`cleanerLineGroupId` が設定されていれば、同じ内容（または清掃向けの要約）を Push API の `to: cleanerLineGroupId` で送信する。
* **注意:** オープンチャットでグループID が取得・送信可能かは LINE の仕様に依存する。通常のグループトークでは利用可能。オープンチャットでもボットを追加したうえでグループID が取得できる場合に本機能を利用する。

---

## 4. Vercel・GitHub 連携

### 4.1 Vercel
* **用途:** 管理者画面（通知テンプレート編集）のホスティング。
* **ドメイン:** 例）`xxx.vercel.app` またはカスタムドメイン。
* **環境変数:** GASのWebアプリURL等を環境変数に保持し、フロントエンドからAPI呼び出しに使用する。

### 4.2 GitHub
* **用途:** 管理者画面のソースコードのバージョン管理、Vercelへの自動デプロイ（Git連携）。
* **リポジトリ:** プライベートまたはパブリック。Vercelとリポジトリを接続し、main ブランチへのPushでデプロイする設定が一般的。

---

## 5. インターフェース詳細（Vercel ⇔ GAS）

### 5.1 テンプレート取得（GET または POST）
* **目的:** 管理者画面の初期表示時に「1週間前」の現在の文面を取得する。
* **リクエスト例:** `{ "action": "getTemplate", "data": { "key": "oneWeekBefore" } }`
* **レスポンス:** `{ "status": "success", "result": { "body": "現在のメッセージ本文" } }`

### 5.2 テンプレート保存（POST）
* **目的:** 管理者が編集した「1週間前」の文面をスプレッドシートに保存する。
* **リクエスト例:** `{ "action": "saveTemplate", "data": { "key": "oneWeekBefore", "body": "編集したメッセージ本文" } }`
* **レスポンス:** `{ "status": "success" }` または `{ "status": "error", "message": "..." }`

### 5.2a 管理者判定（isAdmin）
* **目的:** Vercel の LIFF で取得した LINE User ID が管理者かどうかを判定し、管理者用設定画面の表示の可否に使う。
* **リクエスト例:** `{ "action": "isAdmin", "data": { "lineUserId": "Uxxxx..." } }`
* **レスポンス:** `{ "status": "success", "result": { "isAdmin": true } }` または `{ "isAdmin": false }`。config の `adminLineUserId` と一致する場合に true。

### 5.2b 設定保存（saveConfig）・取得（getConfig）
* **目的:** 管理者のみが編集する項目（driveFolderId, nightlyRate, cleaningFee, cleaningFeeWithPet, checkInGuidePdfUrl, doorVideoYoutubeUrl, cleanerLineGroupId 等）の保存・取得。リクエスト時に lineUserId を渡し、管理者の場合のみ保存を許可する。
* **保存例:** `{ "action": "saveConfig", "data": { "lineUserId": "Uxxxx", "key": "driveFolderId", "value": "1RkQ9..." } }`

### 5.3 空き状況取得（getAvailability）
* **目的:** カレンダー画面で、Airbnb iCal を元にした「予約済み（ブロック）日」一覧を取得する。フロントはこの一覧を使って空き日のみ選択可能にする。
* **リクエスト例:** `{ "action": "getAvailability", "data": { "year": 2025, "month": 4 } }` または `{ "action": "getAvailability", "data": { "start": "2025-04-01", "end": "2025-06-30" } }`
* **レスポンス:** `{ "status": "success", "result": { "blockedDates": ["2025-04-05", "2025-04-06", ...] } }`（iCal からパースした予約済み日の YYYY-MM-DD 配列）。空き日は「対象期間の全日から blockedDates を除いた日」としてフロントで算出する。

### 5.4 料金設定取得（getPricing）
* **目的:** 1泊単価・清掃代をフロントで総額計算するために取得する。
* **リクエスト例:** `{ "action": "getPricing", "data": {} }`
* **レスポンス:** `{ "status": "success", "result": { "nightlyRate": 15000, "cleaningFee": 10000 } }`

### 5.5 予約確定（confirmReservation）
* **目的:** カレンダー画面で「宿泊を確定させる」押下時に、選択内容を送信し、空き確認のうえ予約を保存。ゲスト・管理者に LINE 通知する。
* **リクエスト例:** `{ "action": "confirmReservation", "data": { "lineUserId": "Uxxxx", "displayName": "ゲスト名", "checkIn": "2025-05-01", "checkOut": "2025-05-03", "numberOfGuests": 2, "totalAmount": 40000 } }`
* **レスポンス（成功）:** `{ "status": "success", "result": { "reservationId": "..." } }`
* **レスポンス（失敗・例: 既に予約済み）:** `{ "status": "error", "message": "選択された期間は既に予約が入っています" }`

### 5.6 通信プロトコル
* **メソッド:** POST（action で上記各処理を切り替え）。
* **Content-Type:** `application/json`
* **文字コード:** UTF-8

---

## 5.7 Airbnb iCal 連携

* **iCal URL の登録:** Airbnb の「予約カレンダーをエクスポート」で取得した URL（例: `https://www.airbnb.jp/calendar/ical/20183082.ics?t=cd7bda003b594bda893633333e18460e`）を、config シートの `airbnbIcalUrl` に保存する。
* **取得:** GAS から `UrlFetchApp.fetch(airbnbIcalUrl)` で iCal テキストを取得。ブラウザから直接 .ics を取得すると CORS で弾かれるため、**必ず GAS 側で取得**し、パースした結果を API でフロントに返す。
* **読み取り専用:** Airbnb の iCal は**エクスポート（読み取り）専用**。当システムから Airbnb に予約を書き込むことはできない。確定した予約は当システムの reservations に保存し、管理者が Airbnb 管理画面で該当期間を手動でブロックする運用、または将来 Airbnb が提供する API で反映する拡張を想定する。

---

## 6. セキュリティ・制約

### 6.1 LINE Webhook 署名検証
* ペイロードと Channel Secret を使って HMAC-SHA256 を計算し、`X-Line-Signature` と比較する。
* 一致しない場合は 403 等を返し、処理を実行しない。

### 6.2 Channel Access Token・Channel Secret
* GAS のスクリプトプロパティまたは `config` シートに保存する。コードに直書きしない。

### 6.3 管理者画面の認証
* 現状は「GASのURLを知っている者のみ」でも可。必要に応じて簡易トークンやパスワードをGAS側で検証する方式を追加する。

### 6.4 流量制限
* LINE Messaging API: 送信メッセージ数に料金・制限あり。無料枠内で設計する。
* GAS: URL Fetch の日次クォータ等を考慮し、時間駆動の実行回数や送信件数を抑える。

---

## 7. 接続確認・疎通テスト

| テスト項目 | 確認内容 | 期待結果 |
| :--- | :--- | :--- |
| Webhook疎通 | LINEでボットにメッセージ送信 | GASが受信し、inquiries に1行追加され、管理者に通知が届く |
| テンプレート保存 | Vercel管理者画面で文面を編集し保存 | templates シートの該当行が更新される |
| 1週間前通知 | チェックインが7日後の予約を用意し、時間駆動を実行 | 該当ゲストに保存したテンプレート文面が送信される |
| 管理者通知 | ゲストが「予約したい」と送信 | 管理者LINEに問い合わせ内容が届く |
| iCal 空き取得 | カレンダー画面で月を表示 | getAvailability でブロック日一覧が返り、空き日のみ選択可能になる |
| 予約確定（Web） | カレンダーで日付・人数選択し「宿泊を確定させる」を押下 | 予約が保存され、ゲスト・管理者・清掃員グループのLINEに通知が届く |
| リッチメニュー「ゴミ捨て方法」 | リッチメニューで「ゴミ捨て方法」をタップ | 同一 Webhook で postback を受信し、ゴミ捨て方法の文面を自動返信する |
| 管理者判定 | LIFF で設定画面を開く | isAdmin で true の場合のみ設定項目を表示 |
| 月締め・PDF | 管理者が「○月を締める」実行、または毎月1日自動 | 対象月の売上を集計し、PDF を Drive の driveFolderId に保存 |
