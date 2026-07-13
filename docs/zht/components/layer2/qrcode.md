# QRCode 二維碼

二維碼生成元件。

## 基礎用法

```hikari
rsx! {
    div { style: "padding:1rem;",
        div { style: "width:100px;height:100px;background:#000;display:grid;grid-template-columns:repeat(10,1fr);",
            div { style: "background:#fff;aspect-ratio:1;", "" }
        }
    }
}
```

## API

| 屬性 | 說明 | 類型 | 預設值 |
|------|------|------|--------|
| value | 二維碼內容 | String | - |
| size | 尺寸 | u32 | 128 |
