# Button 按鈕

Button 元件是最基礎的使用者互動元件，支援多種樣式和狀態。

按鈕用於觸發操作或事件，如提交表單、開啟對話框、取消操作或執行刪除操作。

## 按鈕變體

支援 Primary、Secondary、Ghost、Danger 四種變體。

```hikari
rsx! {
    div { style: "display:flex;gap:8px;padding:1rem;flex-wrap:wrap;",
        button { style: "padding:6px 16px;border:none;border-radius:4px;background:#3a6ea5;color:#fff;cursor:pointer;", "Primary" }
        button { style: "padding:6px 16px;border:1px solid #ccc;border-radius:4px;background:#fff;color:#333;cursor:pointer;", "Secondary" }
        button { style: "padding:6px 16px;border:none;border-radius:4px;background:transparent;color:#3a6ea5;cursor:pointer;", "Ghost" }
        button { style: "padding:6px 16px;border:none;border-radius:4px;background:#ef4444;color:#fff;cursor:pointer;", "Danger" }
    }
}
```

## 停用狀態

按鈕可以被停用，停用狀態下不可點擊。

```hikari
rsx! {
    div { style: "display:flex;gap:8px;padding:1rem;",
        button { style: "padding:6px 16px;border:none;border-radius:4px;background:#3a6ea5;color:#fff;", "Normal" }
        button { disabled: true, style: "padding:6px 16px;border:none;border-radius:4px;background:#ccc;color:#999;cursor:not-allowed;", "Disabled" }
    }
}
```

## 圖示按鈕尺寸

圖示按鈕支援小(24px)、中(32px)、大(40px)三種尺寸。

```hikari
rsx! {
    div { style: "display:flex;gap:12px;padding:1rem;align-items:center;",
        button { style: "width:24px;height:24px;border:1px solid #ccc;border-radius:4px;background:#fff;cursor:pointer;", "" }
        button { style: "width:32px;height:32px;border:1px solid #ccc;border-radius:4px;background:#fff;cursor:pointer;", "" }
        button { style: "width:40px;height:40px;border:1px solid #ccc;border-radius:4px;background:#fff;cursor:pointer;", "" }
    }
}
```

## 圖示按鈕變體

圖示按鈕支援 Ghost、Primary、Secondary、Danger、Success 五種顏色變體。

```hikari
rsx! {
    div { style: "display:flex;gap:8px;padding:1rem;",
        button { style: "width:32px;height:32px;border:none;border-radius:4px;background:transparent;color:#666;cursor:pointer;", "G" }
        button { style: "width:32px;height:32px;border:none;border-radius:4px;background:#3a6ea5;color:#fff;cursor:pointer;", "P" }
        button { style: "width:32px;height:32px;border:1px solid #ccc;border-radius:4px;background:#fff;color:#333;cursor:pointer;", "S" }
        button { style: "width:32px;height:32px;border:none;border-radius:4px;background:#ef4444;color:#fff;cursor:pointer;", "D" }
        button { style: "width:32px;height:32px;border:none;border-radius:4px;background:#22c55e;color:#fff;cursor:pointer;", "✓" }
    }
}
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
