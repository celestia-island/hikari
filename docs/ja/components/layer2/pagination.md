# ページネーション

ページネーションコンポーネントは、データのページ分割に使用されます。

## 基本的な使い方

```_hikari_component
pages/components/layer2/pagination#basic
```

## API

| プロパティ | 説明 | 型 | デフォルト値 |
|----------|-------------|------|---------|
| total | 合計数 | usize | 0 |
| page_size | 1ページあたりの項目数 | usize | 10 |
| current | 現在のページ | usize | 1 |
