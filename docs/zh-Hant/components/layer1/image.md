# Image 圖片

Image 元件用於展示圖片，支援載入狀態和錯誤處理。

## 基礎用法

```hikari
rsx! {
    div { style: "padding:1rem;",
        img { src: "https://via.placeholder.com/200x120", alt: "Sample", style: "border-radius:8px;max-width:100%;" }
    }
}
```

## 載入佔位

```hikari
rsx! {
    div { style: "padding:1rem;",
        div { style: "width:200px;height:120px;background:#f0f0f0;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#999;", "No Image" }
    }
}
```

## API

| 屬性 | 說明 | 類型 | 預設值 |
|------|------|------|--------|
| src | 圖片位址 | String | - |
| alt | 替代文字 | String | - |
| width | 寬度 | Option\<String\> | None |
| height | 高度 | Option\<String\> | None |
