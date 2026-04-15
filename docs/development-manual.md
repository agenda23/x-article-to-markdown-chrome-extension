# 開発マニュアル

## 1. 目的

このドキュメントは、`X Article to Markdown` のローカル開発を行う開発者向けに、セットアップ・実装・検証・リリース前確認の手順をまとめたものです。

## 2. 前提環境

- Node.js 18 以上（推奨: LTS）
- npm
- Google Chrome
- Git

## 3. 初期セットアップ

```bash
npm install
```

依存関係を導入後、以下コマンドでビルド可能であることを確認します。

```bash
npm run build
```

## 4. 開発時の主要コマンド

```bash
npm run build   # 単発ビルド（dist/ を生成）
npm run watch   # ファイル変更を監視して再ビルド
npm run lint    # TypeScript 型チェック
```

## 5. ディレクトリ構成

- `src/content/`: X ページ上で動作する抽出ロジック
- `src/popup/`: 拡張ポップアップ UI
- `src/background/`: Service Worker（ダウンロード・メッセージ処理）
- `src/core/`: Markdown 変換、画像処理などの共通ロジック
- `src/types/`: 型定義
- `scripts/build.mjs`: ビルドスクリプト
- `dist/`: Chrome に読み込む成果物

## 6. ローカルでの拡張読み込み

1. `npm run build` で `dist/` を生成
2. Chrome の `chrome://extensions` を開く
3. 「デベロッパーモード」を ON
4. 「パッケージ化されていない拡張機能を読み込む」をクリック
5. プロジェクトの `dist/` ディレクトリを選択

コード更新後は、必要に応じて拡張カードのリロードを実行してください。

## 7. 実装ガイドライン

- Manifest V3 前提で実装する
- 対象 URL は `x.com/*/status/*` に限定する
- X の DOM 変更に備え、セレクタはフォールバックを持たせる
- 抽出ロジックと整形ロジックを分離する
- 権限は最小化する（`activeTab`, `scripting`, `downloads`, `https://x.com/*`）

詳細仕様は `docs/x-article-to-markdown-extension-spec.md` を参照してください。

## 8. オプション機能の実装方針

### 8.1 Front Matter付与

- ON の場合、Markdown 先頭に YAML Front Matter を付与する。
- 最低限含める情報（例）:
  - `title`
  - `author`
  - `authorHandle`
  - `date`（ISO 8601）
  - `sourceUrl`
  - `tweetId`
- OFF の場合は、従来の本文先頭（`# X Post Export`）から出力する。

### 8.2 画像をローカル保存

- ON の場合、画像をローカルに保存し、Markdown の画像参照を相対パスにする。
- 推奨命名規則:
  - 画像: `images/<tweet_id>-<index>.<ext>`
- OFF の場合、Markdown にはリモート画像 URL をそのまま出力する。
- 画像保存に一部失敗した場合は、失敗分のみ通知し Markdown 出力は継続する。

## 9. テスト観点（手動）

- 単体投稿（画像なし / 画像あり）
- 日本語・英語・絵文字混在投稿
- 長文投稿
- ログイン状態・未ログイン状態
- 対象外 URL でのエラーメッセージ表示
- `Front Matter付与` ON/OFF で出力差分が正しい
- `画像をローカル保存` ON/OFF で画像参照形式が正しい

## 10. 配布準備チェック

配布用 ZIP を作る前に、以下を確認します。

- `npm run lint` が成功する
- `npm run build` が成功し、最新の `dist/` が生成される
- Chrome で `dist/` を読み込み、基本機能が動作する
- 不要ファイル（ログ、開発メモ等）が `dist/` に含まれていない

ユーザー向けの導入手順は `docs/user-manual-distribution.md` を参照してください。
