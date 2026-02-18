# Button 按鈕

Button 元件是最基礎的使用者互動元件，支援多種樣式和狀態。

按鈕用於觸發操作或事件，如提交表單、開啟對話框、取消操作或執行刪除操作。

## 按鈕變體

支援 Primary、Secondary、Ghost、Danger 四種變體。

```_hikari_component
pages/components/layer1/button#variants
```

## 停用狀態

按鈕可以被停用，停用狀態下不可點擊。

```_hikari_component
pages/components/layer1/button#disabled
```

## 圖示按鈕尺寸

圖示按鈕支援小(24px)、中(32px)、大(40px)三種尺寸。

```_hikari_component
pages/components/layer1/button#icon-sizes
```

## 圖示按鈕變體

圖示按鈕支援 Ghost、Primary、Secondary、Danger、Success 五種顏色變體。

```_hikari_component
pages/components/layer1/button#icon-variants
```

## API

### Button Props

| 屬性 | 說明 | 類型 | 預設值 |
|------|------|------|--------|
| variant | 按鈕樣式變體 | ButtonVariant | Primary |
| size | 按鈕尺寸 | ButtonSize | Medium |
| disabled | 是否停用 | bool | false |
| children | 按鈕內容 | Element | - |

### IconButton Props

| 屬性 | 說明 | 類型 | 預設值 |
|------|------|------|--------|
| icon | 圖示 | MdiIcon | - |
| size | 按鈕尺寸 | IconButtonSize | Large |
| variant | 顏色變體 | IconButtonVariant | Ghost |
| glow | 是否啟用發光效果 | bool | true |
| disabled | 是否停用 | bool | false |
| onclick | 點擊回調 | EventHandler\<MouseEvent\> | - |
