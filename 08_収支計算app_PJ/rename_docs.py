import os
import shutil

# ベースパス
base_path = r"d:\Dropbox\01_Obsidian_vault\02_Work\08_収支計算app_PJ\02_app\Doc"

# ファイル名のマッピング
rename_map = [
    ("家族収支管理アプリ 要求仕様書 (v6.5.0).md", "00_家族収支管理アプリ 要求仕様書 (v6.5.0).md"),
    ("システム仕様書：家族収支管理アプリ (v6.5.0).md", "01_システム仕様書：家族収支管理アプリ (v6.5.0).md"),
    ("画面設計書：家族収支管理アプリ (v6.5.0).md", "02_画面設計書：家族収支管理アプリ (v6.5.0).md"),
    ("データベース仕様書：家族収支管理アプリ (v6.5.0).md", "03_データベース仕様書：家族収支管理アプリ (v6.5.0).md"),
    ("外部連携仕様書：家族収支管理アプリ (v6.5.0).md", "04_外部連携仕様書：家族収支管理アプリ (v6.5.0).md"),
    ("詳細設計書：家族収支管理アプリ (v6.5.0).md", "05_詳細設計書：家族収支管理アプリ (v6.5.0).md"),
    ("実装コード詳細設計書：家族収支管理アプリ (v6.5.0).md", "06_実装コード詳細設計書：家族収支管理アプリ (v6.5.0).md"),
    ("code.gs.md", "07_code.gs.md"),
    ("LINE公式アカウントおよびLIFF設定作業手順書 (v1.0).md", "08_LINE公式アカウントおよびLIFF設定作業手順書 (v1.0).md"),
    ("Google Workspace バックエンド構築作業手順書 (v1.0).md", "09_Google Workspace バックエンド構築作業手順書 (v1.0).md"),
    ("GitHub & Vercel 連携デプロイ手順書 (v1.0).md", "10_GitHub & Vercel 連携デプロイ手順書 (v1.0).md"),
    ("テスト仕様書：家族収支管理アプリ (v6.5.0).md", "11_テスト仕様書：家族収支管理アプリ (v6.5.0).md"),
    ("デバッグ・ログ確認手順書 (v1.0).md", "12_デバッグ・ログ確認手順書 (v1.0).md"),
    ("運用保守マニュアル：家族収支管理アプリ (v6.5.0).md", "13_運用保守マニュアル：家族収支管理アプリ (v6.5.0).md")
]

# ファイル名を変更
for old_name, new_name in rename_map:
    old_path = os.path.join(base_path, old_name)
    new_path = os.path.join(base_path, new_name)
    
    if os.path.exists(old_path):
        shutil.move(old_path, new_path)
        print(f"✓ Renamed: {old_name} -> {new_name}")
    else:
        print(f"✗ Not found: {old_name}")

print("\n完了しました！")
