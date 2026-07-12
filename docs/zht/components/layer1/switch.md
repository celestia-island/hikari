# Switch 開關元件

Switch 元件提供開關切換功能，支援多種顏色和變體。

## Switch 基礎開關

支援多種顏色：Success、Primary、Secondary、Danger、Warning、Info。

```hikari
rsx! {
    div { style: "padding:1rem;display:flex;gap:16px;align-items:center;",
        div { style: "width:40px;height:22px;border-radius:11px;background:#3a6ea5;position:relative;",
            div { style: "position:absolute;right:2px;top:2px;width:18px;height:18px;border-radius:50%;background:#fff;" }
        }
        div { style: "width:40px;height:22px;border-radius:11px;background:#ccc;position:relative;",
            div { style: "position:absolute;left:2px;top:2px;width:18px;height:18px;border-radius:50%;background:#fff;" }
        }
    }
}
```

## Switch 圖標變體

帶有圖標的開關，預設提供 ✓ 和 ✗ 符號。

```hikari
rsx! {
    div { style: "padding:1rem;display:flex;gap:8px;align-items:center;",
        span { style: "font-size:16px;", "🌙" }
        div { style: "width:40px;height:22px;border-radius:11px;background:#3a6ea5;position:relative;",
            div { style: "position:absolute;right:2px;top:2px;width:18px;height:18px;border-radius:50%;background:#fff;" } }
        span { style: "font-size:16px;", "☀" }
    }
}
```

## Switch 文字變體

帶有文字標籤的開關，自動調整滑桿寬度。

```hikari
rsx! {
    div { style: "padding:1rem;display:flex;gap:8px;align-items:center;",
        span { style: "font-size:14px;color:#666;", "Off" }
        div { style: "width:40px;height:22px;border-radius:11px;background:#3a6ea5;position:relative;",
            div { style: "position:absolute;right:2px;top:2px;width:18px;height:18px;border-radius:50%;background:#fff;" } }
        span { style: "font-size:14px;color:#333;", "On" }
    }
}
```

## Switch 尺寸變體

支援 Small、Medium、Large 三種尺寸。

```hikari
rsx! {
    div { style: "padding:1rem;display:flex;gap:16px;align-items:center;",
        div { style: "width:28px;height:16px;border-radius:8px;background:#3a6ea5;position:relative;",
            div { style: "position:absolute;right:1px;top:1px;width:14px;height:14px;border-radius:50%;background:#fff;" } }
        div { style: "width:40px;height:22px;border-radius:11px;background:#3a6ea5;position:relative;",
            div { style: "position:absolute;right:2px;top:2px;width:18px;height:18px;border-radius:50%;background:#fff;" } }
        div { style: "width:52px;height:28px;border-radius:14px;background:#3a6ea5;position:relative;",
            div { style: "position:absolute;right:2px;top:2px;width:24px;height:24px;border-radius:50%;background:#fff;" } }
    }
}
```

## Progress 進度條

展示操作進度的進度條元件。

```hikari
rsx! {
    div { style: "padding:1rem;",
        div { style: "width:200px;height:6px;background:#e2e2ea;border-radius:3px;overflow:hidden;",
            div { style: "width:60%;height:100%;background:#3a6ea5;border-radius:3px;" }
        }
    }
}
```

## Slider 滑塊

用於數值選擇的滑塊元件。

```hikari
rsx! {
    div { style: "padding:1rem;",
        input { type: "range", min: "0", max: "100", value: "60", style: "width:200px;" }
    }
}
```

## API

### SwitchProps

| 屬性 | 類型 | 預設值 | 說明 |
|------|------|--------|------|
| checked | `bool` | `false` | 是否選中 |
| on_change | `EventEmitter<bool>` | - | 狀態變化回調 |
| disabled | `bool` | `false` | 是否禁用 |
| size | `SwitchSize` | `Medium` | 尺寸 |
| variant | `SwitchVariant` | `Default` | 變體類型 |
| color | `SwitchColor` | `Success` | 選中時的顏色 |
| checked_content | `Option<SwitchContent>` | `None` | 選中時顯示的內容 |
| unchecked_content | `Option<SwitchContent>` | `None` | 未選中時顯示的內容 |

### SwitchVariant

| 值 | 說明 |
|------|------|
| `Default` | 預設樣式（圓點） |
| `Text` | 文字變體 |
| `Icon` | 圖標變體 |
| `Custom` | 自訂變體 |

### SwitchColor

| 值 | 說明 |
|------|------|
| `Success` | 成功/開啟（蔥倩綠，預設） |
| `Primary` | 主色（藍色） |
| `Secondary` | 次要色（寶藍） |
| `Danger` | 危險（朱紅） |
| `Warning` | 警告（杏黃） |
| `Info` | 資訊（靛藍） |

### SwitchContent

| 值 | 說明 |
|------|------|
| `Text(String)` | 文字內容 |
| `Icon(SwitchIcon)` | 圖標內容 |
| `Image(String)` | 圖片 URL |

### SwitchIcon

| 值 | 說明 |
|------|------|
| `Check` | 勾選圖標 |
| `Close` | 關閉圖標 |
| `Plus` | 加號圖標 |
| `Minus` | 減號圖標 |
| `Custom(&'static str)` | 自訂 SVG path |
