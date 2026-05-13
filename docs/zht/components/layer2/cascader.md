# Cascader 級聯選擇

級聯選擇器用於多級資料選擇。

## 基礎用法

```_hikari_component
pages/components/layer2/cascader#basic
```

## API

| 屬性 | 說明 | 類型 | 預設值 |
|------|------|------|--------|
| options | 選項資料 | Vec\<CascaderOption\> | - |
| value | 目前值 | Option\<String\> | None |
| on_change | 變化回調 | EventHandler\<String\> | - |
