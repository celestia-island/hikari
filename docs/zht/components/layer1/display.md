# Display 展示元件

資料展示相關的基礎元件。

## Badge 徽章

用於展示狀態或數量的徽章元件。

```hikari
rsx! {
    div { style: "display:flex;gap:16px;padding:1rem;align-items:center;",
        div { style: "position:relative;",
            span { style: "font-size:14px;", "Messages" }
            span { style: "position:absolute;top:-8px;right:-12px;background:#ef4444;color:#fff;font-size:10px;min-width:16px;height:16px;border-radius:50%;display:flex;align-items:center;justify-content:center;padding:0 4px;", "5" }
        }
    }
}
```

## Divider 分隔線

用於分隔內容的分隔線元件。

```hikari
rsx! {
    div { style: "padding:1rem;",
        p { style: "margin:0 0 16px;", "Content above" }
        hr { style: "border:none;border-top:1px solid #e2e2ea;margin:0;" }
        p { style: "margin:16px 0 0;", "Content below" }
    }
}
```

## Card 卡片

用於內容分組展示的卡片元件。

```hikari
rsx! {
    div { style: "padding:1rem;border:1px solid #e2e2ea;border-radius:8px;max-width:300px;background:#fff;",
        h3 { style: "margin:0 0 8px;font-size:16px;", "Card Title" }
        p { style: "margin:0;color:#666;font-size:14px;", "Card content goes here." }
    }
}
```
