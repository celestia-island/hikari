# コメント

コメントコンポーネントは、コメント内容を表示するために使用されます。

## 基本的な使い方

```hikari
rsx! {
    div { style: "padding:1rem;border:1px solid #e2e2ea;border-radius:8px;max-width:400px;",
        div { style: "display:flex;align-items:center;gap:8px;margin-bottom:8px;",
            div { style: "width:32px;height:32px;border-radius:50%;background:#3a6ea5;color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;", "A" }
            span { style: "font-weight:600;font-size:14px;", "Alice" }
            span { style: "color:#999;font-size:12px;margin-left:auto;", "2h ago" }
        }
        p { style: "margin:0;color:#333;font-size:14px;", "This is a great component!" }
    }
}
```

## API

| プロパティ | 説明 | 型 | デフォルト値 |
|----------|-------------|------|---------|
| author | 作成者名 | String | - |
| avatar | アバターURL | Option\<String\> | None |
| content | コメント内容 | Element | - |
| datetime | 日時 | Option\<String\> | None |
