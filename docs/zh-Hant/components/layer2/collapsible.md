# Collapsible 可折疊面板

可折疊的面板元件。

## 基礎用法

```hikari
rsx! {
    div { style: "padding:1rem;border:1px solid #e2e2ea;border-radius:8px;max-width:300px;",
        div { style: "padding:12px;font-weight:600;cursor:pointer;background:#f7f7fa;", "Click to expand ▼" }
        div { style: "padding:12px;color:#666;font-size:14px;", "Collapsible content" }
    }
}
```

## API

| 屬性 | 說明 | 類型 | 預設值 |
|------|------|------|--------|
| title | 標題 | String | - |
| expanded | 是否展開 | bool | false |
