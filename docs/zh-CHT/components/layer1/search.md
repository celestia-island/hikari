# Search 搜尋

搜尋輸入元件。

## 基礎用法

```_hikari_component
pages/components/layer1/search#basic
```

## 帶建議

帶建議下拉的搜尋。

```_hikari_component
pages/components/layer1/search#suggestions
```

## API

| 屬性 | 說明 | 類型 | 預設值 |
|------|------|------|--------|
| placeholder | 佔位文字 | String | "搜尋..." |
| on_search | 搜尋回調 | Option\<EventHandler\<String\>\> | None |
| suggestions | 建議列表 | Vec\<String> | [] |
| allow_clear | 顯示清除按鈕 | bool | true |
| loading | 顯示載入狀態 | bool | false |
