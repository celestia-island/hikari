# Empty 空狀態

Empty 元件用於展示空資料狀態。

## 基礎用法

```hikari
rsx! {
    div { style: "padding:2rem;text-align:center;color:#999;",
        p { style: "font-size:14px;margin:0;", "No data available" }
    }
}
```

## API

| 屬性 | 說明 | 類型 | 預設值 |
|------|------|------|--------|
| description | 描述文字 | Option\<String\> | None |
