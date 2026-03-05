# 宿泊予約アプリ（Vercel フロント）

LIFF で LINE ログインし、カレンダーから空き状況を確認して宿泊予約できる画面です。管理者の LINE でアクセスした場合のみ「設定」タブが表示され、料金・メッセージテンプレート・月次 PDF 用 Drive フォルダID・月締めを編集・実行できます。

## 必要なもの

- LINE Developers で作成した LIFF ID
- GAS でデプロイした「Vercel 用 API」の URL（getAvailability, getPricing, confirmReservation, isAdmin, getTemplate, saveTemplate, getConfig, saveConfig, closeMonth を実装した doPost）

## 設定

1. `config.js` を開き、以下を設定します。
   - **LIFF_ID**: LINE Developers の LIFF で発行した LIFF ID
   - **GAS_API_URL**: GAS の「ウェブアプリ」としてデプロイした URL（Vercel 用。LINE Webhook 用 URL とは別推奨）

2. ローカルで確認する場合  
   - 簡易サーバーで `index.html` を配信（LIFF は HTTPS が前提のため、localhost または Vercel デプロイ先でテスト）

## Vercel プロジェクト作成時の環境変数

Vercel のダッシュボードで **Settings → Environment Variables** に、次の2つを設定します。

| 変数名 | 必須 | 説明 | 例 |
|--------|------|------|-----|
| **LIFF_ID** | ◯ | LINE Developers の LIFF で発行した LIFF ID。LIFF のエンドポイント URL にこの Vercel のデプロイ URL を指定する。 | `1234567890-xxxxxxxx` |
| **GAS_API_URL** | ◯ | GAS の「ウェブアプリ」としてデプロイした URL（Vercel 用 API 用。LINE Webhook 用 URL とは別にデプロイした方）。 | `https://script.google.com/macros/s/xxxxxxxx/exec` |

- **適用環境:** Production / Preview / Development のうち、使う環境にチェックを入れる。
- **環境変数の反映:** 静的 HTML のため、次のいずれかで `config.js` に反映する。
  - **推奨（ビルドで生成）:** Vercel の **Build Command** に `node build-config.js` を指定する。`build-config.js` が環境変数 `LIFF_ID` と `GAS_API_URL` から `config.js` を生成する。**Output Directory** は空のまま（ルートを配信）でよい。
  - **手動:** 環境変数は使わず、リポジトリの `config.js` に直接値を書き、デプロイする（公開リポジトリでは非推奨）。

## Vercel へのデプロイ

1. このフォルダ（001-vercel）を Git リポジトリに含め、Vercel と連携する。
2. 上記のとおり **LIFF_ID** と **GAS_API_URL** を環境変数に登録する（運用・ビルドで使う場合）。
3. 静的デプロイのまま使う場合  
   - リポジトリに含める `config.js` に本番用の値を直接記述する（公開リポジトリの場合は非推奨）。  
   - または `config.js` を `.gitignore` し、デプロイ後に Vercel の「Override」や手動でアップロードする。

## 画面構成

- **予約タブ**: 月カレンダー、チェックイン・チェックアウト選択、宿泊人数、総支払金額、「宿泊を確定させる」ボタン。
- **設定タブ**（管理者のみ）: Drive フォルダID、一泊単価・清掃代・ペット時清掃代、各種 URL、メッセージテンプレート、月締め実行。

## GAS 側で必要な API（action 名）

- `isAdmin` … 管理者判定
- `getAvailability` … 空き日（blockedDates）取得
- `getPricing` … nightlyRate, cleaningFee 取得
- `confirmReservation` … 予約確定
- `getTemplate` / `saveTemplate` … テンプレート取得・保存
- `getConfig` / `saveConfig` … 設定取得・保存（管理者時のみ）
- `closeMonth` … 月締め・PDF 生成・Drive 保存

詳細は `02_app/Doc` 内の仕様書を参照してください。
