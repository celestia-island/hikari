# Switch 開關元件

Switch 元件提供開關切換功能，支援多種顏色和變體。

## Switch 基礎開關

支援多種顏色：Success、Primary、Secondary、Danger、Warning、Info。

```_hikari_component
pages/components/layer1/switch#switch
```

## Switch 圖標變體

帶有圖標的開關，預設提供 ✓ 和 ✗ 符號。

```_hikari_component
pages/components/layer1/switch#icon
```

## Switch 文字變體

帶有文字標籤的開關，自動調整滑桿寬度。

```_hikari_component
pages/components/layer1/switch#text
```

## Switch 尺寸變體

支援 Small、Medium、Large 三種尺寸。

```_hikari_component
pages/components/layer1/switch#sizes
```

## Progress 進度條

展示操作進度的進度條元件。

```_hikari_component
pages/components/layer1/switch#progress
```

## Slider 滑塊

用於數值選擇的滑塊元件。

```_hikari_component
pages/components/layer1/switch#slider
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
| `Warning` | 警告（鵝黃） |
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
