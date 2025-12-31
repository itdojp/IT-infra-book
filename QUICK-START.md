# Quick Start（執筆・開発者向け）

このリポジトリの内容をローカルでプレビューするための最小手順です。

## 前提

- Node.js（`npm` 実行のため）
- Ruby と Bundler（`docs/Gemfile` を参照）

## セットアップ

```bash
git clone https://github.com/itdojp/IT-infra-book.git
cd IT-infra-book

npm ci

cd docs
bundle install
cd ..
```

## ローカルプレビュー（推奨）

```bash
npm start
```

起動後に表示される URL で閲覧できます（`docs/_config.yml` の `baseurl` 設定によりパスが付与される場合があります）。

## ビルド

```bash
npm run build
```

## どこを編集するか

- 公開ページのソース: `docs/`
