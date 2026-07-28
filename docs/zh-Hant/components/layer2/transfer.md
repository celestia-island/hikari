# Transfer 穿梭框

穿梭框用於雙欄資料選擇。

## 基礎用法

```hikari
rsx! {
    div { style: "padding:1rem;display:flex;gap:8px;align-items:center;",
        div { style: "width:120px;border:1px solid #e2e2ea;border-radius:4px;padding:8px;font-size:14px;",
            div { style: "padding:4px 0;cursor:pointer;", "☐ Item 1" }
            div { style: "padding:4px 0;cursor:pointer;color:#999;", "☑ Item 2" }
        }
        div { style: "display:flex;flex-direction:column;gap:4px;",
            button { style: "padding:4px 8px;border:1px solid #ccc;border-radius:4px;cursor:pointer;", "→" }
            button { style: "padding:4px 8px;border:1px solid #ccc;border-radius:4px;cursor:pointer;", "←" }
        }
        div { style: "width:120px;border:1px solid #e2e2ea;border-radius:4px;padding:8px;font-size:14px;",
            div { style: "padding:4px 0;", "Item 2" }
        }
    }
}
```

## API

| 屬性 | 說明 | 類型 | 預設值 |
|------|------|------|--------|
| source | 來源資料 | Vec\<TransferItem\> | - |
| target | 目標資料 | Vec\<String\> | - |
