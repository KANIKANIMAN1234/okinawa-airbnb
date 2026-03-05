## 1. 概要
本資料は、アプリケーションのソースコードをGitHubで管理し、Vercelを通じてWeb上に自動公開（デプロイ）するための手順を定義する。

---

## 2. GitHubリポジトリの作成とファイル更新
コードの保管場所（リポジトリ）を作成します。

1. **GitHubにログイン:** [GitHub](https://github.com/)にアクセス。
2. **新規リポジトリ作成:**
   - 「New repository」をクリック。
   - **Repository name:** `family-budget-app` (任意)
   - **Public/Private:** `Private` を推奨（家族用のため）。
3. **ファイルのアップロード:**
   - `index.html` をリポジトリのメインブランチ（main）にアップロードまたはコミット。
   - *注意: `index.html` 内の `LIFF_ID` と `GAS_URL` が最新の自分のものに書き換わっていることを確認。*



---

## 3. Vercelプロジェクトの構築
GitHubのコードをWebサイトとして公開します。

1. **Vercelにログイン:** [Vercel](https://vercel.com/)にアクセス。GitHubアカウントでサインアップ。
2. **プロジェクトのインポート:**
   - [Add New] ＞ [Project] をクリック。
   - 先ほど作成した `family-budget-app` リポジトリの [Import] ボタンを押す。
3. **ビルド設定:**
   - **Framework Preset:** `Other` (または自動認識される HTML)。
   - **Root Directory:** `./` (そのまま)。
4. **デプロイの実行:**
   - [Deploy] ボタンをクリック。
   - 完了すると「Congratulations!」と表示され、`https://〜.vercel.app` というURLが発行される。



---

## 4. 自動デプロイの確認
1. **コードの修正:** PCで `index.html` の色や文字を少し変更。
2. **Pushの実行:** GitHubに修正を `Commit` して `Push`。
3. **自動反映:** Vercelが自動的に検知して再デプロイを開始する。数分後、スマホのLINEから開いたアプリが更新されていることを確認する。

---

## 5. ドメインのカスタマイズ（任意）
1. Vercelの [Settings] ＞ [Domains] を開く。
2. 自分が覚えやすいURL（例: `inoue-kakeibo.vercel.app`）に変更可能（他のユーザーと重複しない場合）。
   - *注意: URLを変更した場合は、LINE Developers側の「エンドポイントURL」も必ず修正すること。*