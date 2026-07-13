# データコンポーネント

データ表示関連の複合コンポーネント。

## テーブル

```hikari
rsx! {
    div { style: "padding:1rem;",
        table { style: "border-collapse:collapse;width:100%;font-size:14px;",
            thead { tr { th { style: "border:1px solid #e2e2ea;padding:8px;text-align:left;background:#f7f7fa;", "Name" }
                         th { style: "border:1px solid #e2e2ea;padding:8px;text-align:left;background:#f7f7fa;", "Age" } } }
            tbody { tr { td { style: "border:1px solid #e2e2ea;padding:8px;", "Alice" }
                         td { style: "border:1px solid #e2e2ea;padding:8px;", "30" } }
                    tr { td { style: "border:1px solid #e2e2ea;padding:8px;", "Bob" }
                         td { style: "border:1px solid #e2e2ea;padding:8px;", "25" } } }
        }
    }
}
```

## ツリー

```hikari
rsx! {
    div { style: "padding:1rem;font-size:14px;",
        div { style: "padding:4px 0;cursor:pointer;", "▼ Folder 1" }
        div { style: "padding:4px 0 4px 20px;color:#666;", "  File A" }
        div { style: "padding:4px 0 4px 20px;color:#666;", "  File B" }
        div { style: "padding:4px 0;cursor:pointer;", "▶ Folder 2" }
    }
}
```

## ページネーション

```hikari
rsx! {
    div { style: "padding:1rem;display:flex;gap:4px;align-items:center;font-size:14px;",
        button { style: "padding:4px 10px;border:1px solid #ccc;border-radius:4px;cursor:pointer;", "‹" }
        span { style: "padding:4px 10px;background:#3a6ea5;color:#fff;border-radius:4px;", "1" }
        button { style: "padding:4px 10px;border:1px solid #ccc;border-radius:4px;cursor:pointer;", "2" }
        button { style: "padding:4px 10px;border:1px solid #ccc;border-radius:4px;cursor:pointer;", "3" }
        button { style: "padding:4px 10px;border:1px solid #ccc;border-radius:4px;cursor:pointer;", "›" }
    }
}
```
