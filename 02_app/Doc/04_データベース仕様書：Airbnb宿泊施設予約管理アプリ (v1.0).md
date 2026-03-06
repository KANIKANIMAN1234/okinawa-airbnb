# データベース仕様書：Airbnb宿泊施設予約管理アプリ (v1.0)

## 1. データベース概要
本システムでは、Googleスプレッドシートをデータベースとして利用する。各シートをテーブルとみなし、ゲストの識別は **LINE User ID** を主キー・外部キーとして用いて問い合わせ・予約と紐付ける。

---

## 2. テーブル（シート）定義一覧

| 物理名（シート名） | 論理名 | 用途 |
| :--- | :--- | :--- |
| **inquiries** | 問い合わせ履歴テーブル | ゲストからのメッセージ内容・受信日時・LINE User ID を保存 |
| **reservations** | 予約テーブル | 予約のチェックイン・チェックアウト・金額・確定日時・ゲストLINE User ID 等 |
| **guests** | ゲストマスタ | LINE User ID・表示名・初回登録日 等 |
| **templates** | 通知テンプレート | 1週間前メッセージ本文など、編集可能な通知文面 |
| **config** | 設定マスタ | 管理者LINE User ID、清掃代、チェックイン時刻、PDF/YouTube URL 等 |

---

## 3. 各テーブル詳細設計

### 3.1 問い合わせ履歴テーブル（inquiries）

| 列 | 論理名 | 物理名 | データ型 | 必須 | 制約・備考 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| A | 受信日時 | receivedAt | Date/Time | ◯ | GASで記録時点の `new Date()` を付与 |
| B | LINE User ID | lineUserId | String | ◯ | 送信者の userId（ゲスト識別） |
| C | 表示名 | displayName | String | △ | LINEのdisplayName（取得できる場合） |
| D | メッセージ本文 | messageText | String | ◯ | テキストメッセージの内容 |
| E | メッセージID | messageId | String | △ | LINEのメッセージID（重複防止等） |
| F | 管理者通知済 | notifiedToAdmin | String | △ | "1" 等、管理者へ通知済みフラグ |

### 3.2 予約テーブル（reservations）

| 列 | 論理名 | 物理名 | データ型 | 必須 | 制約・備考 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| A | 予約ID | reservationId | String | ◯ | 一意（行番号またはUUID等） |
| B | ゲストLINE User ID | guestLineUserId | String | ◯ | ゲスト識別（guests と紐付け） |
| C | チェックイン日 | checkInDate | String (Date) | ◯ | YYYY-MM-DD |
| D | チェックアウト日 | checkOutDate | String (Date) | ◯ | YYYY-MM-DD |
| E | 宿泊人数 | numberOfGuests | Number | △ | カレンダー画面で選択した人数。料金計算に使う場合は config のルールに従う |
| F | 宿泊料金 | amount | Number | ◯ | 数値（1泊単価×泊数など） |
| G | 清掃代 | cleaningFee | Number | ◯ | 固定 10000 等 |
| H | ステータス | status | String | ◯ | "希望" / "確定" / "キャンセル" 等 |
| I | 確定日時 | confirmedAt | Date/Time | △ | 確定した日時 |
| J | 登録日時 | createdAt | Date/Time | ◯ | 行追加日時 |
| K | 備考 | memo | String | - | 管理者用メモ |

### 3.3 ゲストマスタ（guests）

| 列 | 論理名 | 物理名 | データ型 | 必須 | 制約・備考 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| A | LINE User ID | lineUserId | String | ◯ | 主キー、一意 |
| B | 表示名 | displayName | String | △ | LINEの表示名 |
| C | 登録日 | registeredAt | Date/Time | ◯ | 初回メッセージまたは初回登録日時 |

### 3.4 通知テンプレート（templates）

| 列 | 論理名 | 物理名 | データ型 | 必須 | 制約・備考 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| A | テンプレートキー | templateKey | String | ◯ | 例: "oneWeekBefore"（1週間前） |
| B | 本文 | body | String | ◯ | 送信するメッセージ本文。Vercel管理者画面で編集 |
| C | 更新日時 | updatedAt | Date/Time | △ | 最終更新日時 |

### 3.5 設定マスタ（config）

| 列 | 論理名 | 物理名 | データ型 | 必須 | 制約・備考 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| A | 設定キー | configKey | String | ◯ | 例: "adminLineUserId", "cleaningFee", "nightlyRate", "airbnbIcalUrl", "checkInGuidePdfUrl", "doorVideoYoutubeUrl" |
| B | 設定値 | configValue | String | ◯ | 管理者のLINE User ID、金額、URL 等 |

**カレンダー・予約・管理者設定の config キー例:**

| configKey | 説明 | 例 | 編集権限 |
| :--- | :--- | :--- | :--- |
| **airbnbIcalUrl** | Airbnb の iCal カレンダーURL（読み取り用）。空き状況の取得元。 | `https://www.airbnb.jp/calendar/ical/...` | 管理者のみ |
| **nightlyRate** | 1泊あたりの宿泊料金（円）。総額 = nightlyRate × 泊数 + 清掃代 | `15000` | 管理者のみ |
| **cleaningFee** | 清掃代（円） | `10000` | 管理者のみ |
| **cleaningFeeWithPet** | ペット宿泊ありの場合の清掃代（円） | `15000` | 管理者のみ |
| **checkInGuidePdfUrl** | チェックイン3日前に送るPDFのURL | `https://...` | 管理者のみ |
| **doorVideoYoutubeUrl** | 玄関ドアの開け方動画（YouTube等）のURL | `https://...` | 管理者のみ |
| **driveFolderId** | 月間売上 PDF を保存する Google Drive のフォルダID | `1RkQ9GF9teR76ufQ4lUvra2Nx90S3cR-Q` | **管理者のLINEでアクセスした時のみ設定可** |
| **cleanerLineGroupId** | 清掃員用 LINE グループ／オープンチャットのグループID。予約確定時にここへ通知を送る | `Cxxxx...` | 管理者のみ |
| **adminLineUserId** | 管理者（井上）の LINE User ID。Vercel の管理者判定・通知送信先に使用 | `Uxxxx...` | 初回設定・要運用 |

**templates シートで管理するメッセージ（管理者のみ編集）:**

| templateKey（例） | 説明 |
| :--- | :--- |
| **oneWeekBefore** | 宿泊1週間前の案内メッセージ |
| **reservationConfirm** | 予約確定時にゲストに送る御礼メッセージ |
| **restaurantGuide** | 周辺のおすすめレストラン案内文 |
| **replyMessage** | 問い合わせ等への返信用テンプレート |
| **garbage_disposal** | ゴミ捨て方法（リッチメニュー用） |

---

## 4. Airbnb iCal との連携
* **読み取り:** `config` の `airbnbIcalUrl` に登録した URL を GAS から取得し、iCal（.ics）をパースして予約済み日を抽出する。当システムのカレンダー画面では、この「予約済み日」を除いた日を「空き」として表示する。
* **書き込み:** Airbnb の iCal はエクスポート（読み取り）専用のため、当システムから直接 Airbnb に予約を書き込むことはできない。確定予約は reservations に保存し、管理者が Airbnb 管理画面で該当期間を手動ブロックする運用、または将来 Airbnb API で反映する拡張を想定する。

---

## 5. 外部ストレージ・ファイル参照
* **チェックインガイドPDF:** URLを `config` シートの `checkInGuidePdfUrl` で保持。GASからそのURLをゲストに送信する。
* **玄関ドア動画（YouTube）:** URLを `config` シートの `doorVideoYoutubeUrl` で保持。チェックイン当日のお昼の通知で送信する。
* **月間売上 PDF:** 各月締め時に、確定予約を集計して PDF を生成し、**Google Drive** の `config.driveFolderId` で指定したフォルダに保存する。フォルダID は管理者の LINE でアクセスした時のみ Vercel 画面で設定・変更可能。
* **施設写真:** 管理者がアップロードした写真は、**Google Drive** の `photosFolderId`（スクリプトプロパティ）で指定したフォルダに保存される。写真のURL・表示順・説明文は `photos` シートで管理。画像表示には Google Drive のサムネイルURL（`https://drive.google.com/thumbnail?id=FILEID&sz=w1000`）を使用。

---

## 5.1 photos シート（施設写真管理）

| 列名 | データ型 | 説明 | 例 |
| :--- | :--- | :--- | :--- |
| **photoId** | 文字列 | 写真の一意識別子 | P1234567890123 |
| **imageUrl** | 文字列（URL） | Google Drive サムネイルURL | https://drive.google.com/thumbnail?id=xxx&sz=w1000 |
| **displayOrder** | 数値 | 表示順序（昇順） | 0, 1, 2, ... |
| **caption** | 文字列 | 写真の説明文（オプション） | リビングルーム |

**運用:**
- 管理者のみが写真のアップロード・並び替え・削除が可能。
- 全ユーザーが写真ギャラリーを閲覧可能。
- ドラッグ&ドロップで並び替え後、「並び順を保存」ボタンで `displayOrder` を更新。

---

## 6. データ整合性・バリデーション
1. **問い合わせ:** 同一 `messageId` の重複保存を避ける（既に存在する場合はスキップまたは上書き方針を定義）。
2. **予約:** `checkOutDate` は `checkInDate` より後であること。日付は YYYY-MM-DD 形式で統一。
3. **テンプレート:** `templateKey` は "oneWeekBefore" 等、決められたキーのみ使用。保存時に改行・文字数はLINEの制限内に収める。
4. **config:** `adminLineUserId` は1件のみ保持する想定。取得時は先頭行またはキー検索で取得。

---

## 7. パフォーマンス・運用
* 問い合わせ・予約が増えた場合は、古いデータを別シートにアーカイブする運用を検討する。
* 時間駆動で「今日送信すべき通知」を検索する際は、`reservations` の `checkInDate` / `checkOutDate` と当日日付を比較する。データ量が増えた場合は対象行のみ取得するようクエリを最適化する。
