# GAS バックエンド（Airbnb 宿泊施設予約管理）

Google Apps Script で LINE Webhook と Vercel 用 API を提供します。

## ファイル構成

| ファイル | 役割 |
|----------|------|
| `Code.gs` | doGet / doPost エントリ。body で LINE Webhook と API を判別 |
| `Config.gs` | スクリプトプロパティ取得（SPREADSHEET_ID, CHANNEL_ACCESS_TOKEN, CHANNEL_SECRET） |
| `Sheets.gs` | スプレッドシート読み書き（inquiries, reservations, guests, templates, config） |
| `LineWebhook.gs` | LINE イベント処理（メッセージ→問い合わせ保存・管理者通知、postback→ゴミ捨て方法等） |
| `LinePush.gs` | LINE Push / Reply API 呼び出し |
| `ICal.gs` | Airbnb iCal 取得・パース（blockedDates 抽出） |
| `Api.gs` | Vercel 用 API（isAdmin, getTemplate, saveTemplate, getConfig, saveConfig, getAvailability, getPricing, confirmReservation, closeMonth） |
| `MonthlyPdf.gs` | 月次売上 PDF 生成・Drive 保存 |
| `DailyNotify.gs` | 時間駆動用（1週間前・3日前・当日・チェックアウト前日の通知） |

## GAS にコードを入れる 2 つの方法

| 方法 | 説明 |
|------|------|
| **方法A: 手動でコピー** | [script.google.com](https://script.google.com) で GAS プロジェクトを開き、このフォルダの各 `.gs` ファイルの内容を、エディタにそのままコピー＆ペーストする。**いちばん簡単で、clasp は不要。** |
| **方法B: clasp で push** | パソコンに **clasp**（GAS 用のコマンドラインツール）を入れ、ターミナルで `clasp push` を実行すると、**ローカル（このフォルダ）のファイルがまとめて GAS のクラウド側にアップロード（push）される**。コードを何度も更新するときに便利。 |

- **「ローカルから push」の意味**: あなたのパソコン（ローカル）にある `003-GAS` フォルダ内のファイルを、インターネット上の GAS プロジェクトに**送り込む（push＝押し込む）**こと。
- **clasp を使わない場合**: 方法A だけで十分です。`appsscript.json` も clasp も気にしなくて大丈夫です。

## appsscript.json の設定

このファイルは GAS プロジェクトのマニフェストです。**方法A（手動コピー）で使う場合は編集不要**です。方法B（clasp）で push するときに一緒に送られます。

| キー | 説明 | 推奨値 |
|------|------|--------|
| `timeZone` | トリガー実行時刻・日付のタイムゾーン | `Asia/Tokyo`（日本時間） |
| `dependencies` | 外部ライブラリ（ライブラリ ID とバージョン） | `{}`（今回未使用） |
| `exceptionLogging` | 例外ログの送信先 | `STACKDRIVER`（Google Cloud のログに出力） |
| `runtimeVersion` | スクリプトの JavaScript ランタイム | `V8`（現行の V8 エンジン推奨） |

- **timeZone**: 時間駆動トリガー（例: 毎朝 6 時）はこのタイムゾーンで実行されます。日本運用なら `Asia/Tokyo` のままで問題ありません。
- **runtimeVersion**: `V8` のままにすると、現代の JavaScript 構文が使えます。古い Rhino に戻したい場合のみ `"runtimeVersion": "DEPRECATED_ES5"` に変更します。

編集する場合は、JSON の文法（カンマ・引用符）を崩さないようにしてください。

## セットアップ

### 1. スクリプトプロパティ

GAS エディタで **プロジェクトの設定** → **スクリプト プロパティ** に以下を追加してください。

| プロパティ名 | 値 |
|-------------|-----|
| `SPREADSHEET_ID` | 対象 Google スプレッドシートの ID（URL の `/d/xxxxx/` の xxxxx） |
| `CHANNEL_ACCESS_TOKEN` | LINE Messaging API の Channel Access Token（長期） |
| `CHANNEL_SECRET` | LINE チャネルの Channel Secret（Webhook 署名検証用） |

### 2. デプロイ（2 種類の URL）

- **Web アプリ** としてデプロイし、「次のユーザーとして実行: 自分」、「誰がアクセスできるか: 全員」で **2 回** デプロイします（または 1 回で 1 つの URL だけ使うことも可能）。
- **URL-A（LINE Webhook 用）**: この URL を LINE Developers の「Webhook URL」に設定。POST の body に `events` が含まれるため、自動で Webhook として処理されます。
- **URL-B（Vercel 用）**: この URL を Vercel の環境変数 `GAS_API_URL` に設定。body に `action` が含まれるため、API として処理されます。

同一コードで 1 回だけデプロイし、1 つの URL を LINE と Vercel の両方に設定することもできます。その場合、body の `events` / `action` で判別されます。

### 3. スプレッドシート

`02_app/002-スプレッドシート` の CSV をインポートして、inquiries / reservations / guests / templates / config の各シートを用意してください。config に `adminLineUserId`（管理者の LINE User ID）を設定してください。

### 4. 時間駆動トリガー（任意）

「編集」→「トリガー」で、`runDailyNotify` を「時間駆動型」「日タイマー」「午前 6 時～7 時」などで追加すると、1 週間前・3 日前・当日・チェックアウト前日の通知が自動送信されます。

## API 一覧（Vercel → GAS）

いずれも POST、body: `{ "action": "xxx", "data": { ... } }`、Content-Type: application/json。

| action | 説明 |
|--------|------|
| isAdmin | `data.lineUserId` が config の adminLineUserId と一致するか |
| getTemplate | `data.key` のテンプレート本文を返す |
| saveTemplate | `data.key`, `data.body` でテンプレート保存 |
| getConfig | `data.key` の設定値を返す |
| saveConfig | 管理者のみ。`data.lineUserId`, `data.key`, `data.value` |
| getAvailability | `data.year`, `data.month` または `data.start`, `data.end` で blockedDates を返す |
| getPricing | nightlyRate, cleaningFee を返す |
| confirmReservation | 予約確定（空き確認→保存→ゲスト・管理者・清掃員へ通知） |
| closeMonth | 管理者のみ。指定年月の月次 PDF を Drive に保存 |

## Airbnb iCal カレンダーが反映されないとき

1. **config シートに URL が入っているか確認**  
   - シート名: **config**  
   - **設定キー（A列）:** `airbnbIcalUrl`  
   - **設定値（B列）:** Airbnb の「予約カレンダーをエクスポート」でコピーした iCal の URL（例: `https://www.airbnb.jp/calendar/ical/20183082.ics?t=xxxxx`）  
   - 行が無ければ追加する。既にある場合は B 列の URL が正しいか確認する。

2. **Vercel の管理者画面から設定する場合**  
   - 管理者の LINE でログインし、設定タブを開く。  
   - 「Airbnb iCal URL」や config 用の入力欄があれば、そこに同じ URL を入力して保存する（未実装の場合は config シートを直接編集）。

3. **GAS のコードを更新した場合**  
   - ICal.gs の変更後は「デプロイ」→「新しいデプロイ」で反映する。

4. **Airbnb 側の反映遅延**  
   - iCal の同期は 1〜3 時間遅れることがあります。予約を入れ直した直後は、しばらくしてから再度カレンダーを表示し直す。

## LINE 通知が届かないとき（予約確定後の Push）

1. **CHANNEL_ACCESS_TOKEN**  
   - GAS の「プロジェクトの設定」→「スクリプト プロパティ」に `CHANNEL_ACCESS_TOKEN`（LINE チャネルの長期トークン）が正しく設定されているか確認する。

2. **友だち追加**  
   - Push メッセージは、**公式アカウントを友だち追加しているユーザー**にしか送れません。ゲスト・管理者ともに、該当 LINE アカウントでボットを友だち追加しているか確認する。

3. **実行ログ**  
   - 予約確定後、GAS の「実行数」や「ログ」で `LINE Push 失敗` が出ていないか確認する。失敗時は status や body が Logger に出力される。

4. **画面メッセージ**  
   - 予約は成功しているが「LINEへの御礼メッセージ送信に失敗しました」と表示された場合は、上記 1〜2 を確認する。

## 注意事項

- **CORS**: GAS の Web アプリではレスポンスに任意の HTTP ヘッダを付けられないため、ブラウザから直接 fetch すると CORS で弾かれる場合があります。Vercel のサーバー側（API Route 等）から GAS を呼び出すか、必要に応じて CORS プロキシを検討してください。
- **LINE Webhook 署名**: GAS の doPost ではリクエストヘッダを参照できないため、署名検証は行っていません。厳密に検証したい場合は、Cloud Functions 等で署名検証してから GAS を呼び出す構成にしてください。
