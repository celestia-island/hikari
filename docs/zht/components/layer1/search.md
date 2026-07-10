# Search 搜尋

搜尋輸入元件。

## 基礎用法

```hikari
rsx! {
    div { style: "padding:1rem;",
        input { type: "search", placeholder: "Search...", style: "padding:8px 12px 8px 36px;border:1px solid #d9d9d9;border-radius:6px;font-size:14px;width:240px;" }
    }
}
```

## 帶建議

帶建議下拉的搜尋。

```hikari
rsx! {
    div { style: "padding:1rem;position:relative;width:240px;",
        input { type: "search", placeholder: "Search...", value: "ru", style: "padding:8px 12px;border:1px solid #3a6ea5;border-radius:6px;font-size:14px;width:100%;" }
        div { style: "margin-top:4px;border:1px solid #e2e2ea;border-radius:6px;box-shadow:0 4px 12px rgba(0,0,0,0.08);",
            div { style: "padding:8px 12px;font-size:14px;background:#f0f7ff;cursor:pointer;", "Rust" }
            div { style: "padding:8px 12px;font-size:14px;cursor:pointer;", "Ruby" }
        }
    }
}
```

## API

| 屬性 | 說明 | 類型 | 預設值 |
|------|------|------|--------|
| placeholder | 佔位文字 | String | "搜尋..." |
| on_search | 搜尋回調 | Option\<EventHandler\<String\>\> | None |
| suggestions | 建議列表 | Vec\<String> | [] |
| allow_clear | 顯示清除按鈕 | bool | true |
| loading | 顯示載入狀態 | bool | false |
