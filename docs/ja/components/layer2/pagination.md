# ページネーション

ページネーションコンポーネントは、データのページ分割に使用されます。

## 基本的な使い方

```hikari
rsx! {
    div { style: "padding:1rem;display:flex;gap:4px;align-items:center;font-size:14px;",
        button { style: "padding:4px 10px;border:1px solid #ccc;border-radius:4px;cursor:pointer;", "‹" }
        span { style: "padding:4px 10px;background:#3a6ea5;color:#fff;border-radius:4px;", "1" }
        button { style: "padding:4px 10px;border:1px solid #ccc;border-radius:4px;cursor:pointer;", "2" }
        button { style: "padding:4px 10px;border:1px solid #ccc;border-radius:4px;cursor:pointer;", "›" }
    }
}
```

## API

| プロパティ | 説明 | 型 | デフォルト値 |
|----------|-------------|------|---------|
| total | 合計数 | usize | 0 |
| page_size | 1ページあたりの項目数 | usize | 10 |
| current | 現在のページ | usize | 1 |
