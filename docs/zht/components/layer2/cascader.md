# Cascader 級聯選擇

級聯選擇器用於多級資料選擇。

## 基礎用法

```hikari
rsx! {
    div { style: "padding:1rem;",
        select { style: "padding:6px 12px;border:1px solid #ccc;border-radius:4px;font-size:14px;",
            option { "Province / City / District" }
        }
    }
}
```

## API

| 屬性 | 說明 | 類型 | 預設值 |
|------|------|------|--------|
| options | 選項資料 | Vec\<CascaderOption\> | - |
| value | 目前值 | Option\<String\> | None |
| on_change | 變化回調 | EventHandler\<String\> | - |
