# Timeline 時間軸

時間軸元件用於展示事件序列。

## 基礎用法

```hikari
rsx! {
    div { style: "padding:1rem;border-left:2px solid #3a6ea5;margin-left:8px;",
        div { style: "padding:0 0 16px 16px;position:relative;",
            div { style: "position:absolute;left:-9px;top:4px;width:12px;height:12px;border-radius:50%;background:#3a6ea5;", "" }
            div { style: "font-weight:600;font-size:14px;", "Event 1" }
            div { style: "color:#999;font-size:12px;", "2024-01-01" }
        }
        div { style: "padding:0 0 0 16px;position:relative;",
            div { style: "position:absolute;left:-9px;top:4px;width:12px;height:12px;border-radius:50%;background:#3a6ea5;", "" }
            div { style: "font-weight:600;font-size:14px;", "Event 2" }
            div { style: "color:#999;font-size:12px;", "2024-06-01" }
        }
    }
}
```

## API

| 屬性 | 說明 | 類型 | 預設值 |
|------|------|------|--------|
| items | 時間軸項目 | Vec\<TimelineItem\> | - |
