# Search 搜尋

Search 元件用於搜尋輸入。

## 基礎用法

```_hikari_component
pages/components/layer1/search#basic
```

## 語音輸入

支援語音輸入功能，點擊麥克風圖標開始錄音。

```_hikari_component
pages/components/layer1/search#voice
```

## API

| 屬性 | 說明 | 類型 | 預設值 |
|------|------|------|--------|
| placeholder | 佔位文字 | String | "搜尋..." |
| on_search | 搜尋回調 | Option\<EventHandler\<String\>\> | None |
| voice_input | 啟用語音輸入 | bool | false |
