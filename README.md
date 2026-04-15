# X Article to Markdown

X（旧Twitter）の投稿ページを Markdown に変換して保存する Chrome 拡張機能です。

## 概要

- 対象 URL: `https://x.com/<user>/status/<tweet_id>`
- 投稿本文・投稿者情報・投稿日時・投稿 URL を抽出
- `Front Matter付与` オプションで YAML Front Matter 付き Markdown を出力可能
- `画像をローカル保存` オプションで画像を `images/` 配下に保存し、Markdown では相対パス参照に対応
- クリップボードコピー / `.md` ダウンロードに対応

詳細仕様は `docs/x-article-to-markdown-extension-spec.md` を参照してください。

## セットアップ

```bash
npm install
```

## 開発コマンド

```bash
npm run build   # dist/ を生成
npm run watch   # 監視ビルド
npm run lint    # TypeScript 型チェック
```

## 使い方（開発版）

1. `npm run build` を実行して `dist/` を作成
2. Chrome で `chrome://extensions` を開く
3. 右上の「デベロッパーモード」を ON
4. 「パッケージ化されていない拡張機能を読み込む」で `dist/` を指定
5. X の投稿ページで拡張ポップアップから Markdown を生成

### 出力オプション

- `Front Matter付与`: 記事管理ツール（例: 静的サイトジェネレーターやメモ基盤）で扱いやすい YAML Front Matter を先頭に追加します。
- `画像をローカル保存`: 画像をローカル保存し、Markdown の画像リンクを `images/<tweet_id>-<index>.<ext>` 形式の相対パスにします。  
  無効時は画像 URL をそのまま参照します。

## ドキュメント

- 開発マニュアル: `docs/development-manual.md`
- 配布ユーザーマニュアル（dist ZIP）: `docs/user-manual-distribution.md`
- 要件・設計仕様: `docs/x-article-to-markdown-extension-spec.md`

## ライセンス

`LICENSE` を参照してください。
