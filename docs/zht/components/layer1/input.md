# Input 輸入框

Input 組件是基礎的表單輸入組件，支援多種狀態和自訂樣式。

## 三層級配置

Input 組件支援三層級 CSS 變數配置架構：

- **Layer1 (基礎層級)**: 透過主題定義全域預設值
- **Layer2 (組件層級)**: 透過 `input-vars.scss` 定義組件變數
- **Custom (執行時)**: 透過組件屬性動態覆蓋

## 基礎用法

```_hikari_component
pages/components/layer1/input#basic
```

## 停用狀態

輸入框可以被停用，停用狀態下不可編輯。

```_hikari_component
pages/components/layer1/input#disabled
```

## 自訂顏色

透過 Custom 層屬性可以動態覆蓋輸入框顏色。

```rust
Input {
    placeholder: "Custom styled input",
    text_color: Some("#ff0000".to_string()),        // 自訂文字顏色
    border_color: Some("#ff4f00".to_string()),       // 自訂邊框顏色
    background_color: Some("rgba(255, 255, 255, 0.1)".to_string()), // 自訂背景顏色
}
```

## CSS 變數覆蓋

透過 `css_vars` 屬性可以批次覆蓋 CSS 變數。

```rust
Input {
    placeholder: "CSS Variables Override",
    css_vars: Some(vec![
        ("--hi-input-radius", "16px".to_string()),
        ("--hi-input-border-color-focus", "#22c55e".to_string()),
        ("--hi-input-shadow-focus", "0 0 0 2px rgba(34, 197, 94, 0.3)".to_string()),
    ]),
}
```

## 動畫整合

透過 `animation_id` 屬性可以與 AnimationBuilder 整合實現動畫效果。

```rust
Input {
    placeholder: "Animated Input",
    animation_id: Some("animated-input".to_string()),
}

// 使用 AnimationBuilder 控制動畫
AnimationBuilder::new()
    .style("--hi-input-border-color", "rgb(255, 79, 0)")
    .style("--hi-input-shadow-focus", "0 0 0 2px rgba(255, 79, 0, 0.3)")
    .duration(300)
    .apply_to_element("animated-input");
```

## API

### Input Props

| 屬性 | 說明 | 類型 | 預設值 |
|------|------|------|--------|
| size | 輸入框尺寸 | InputSize | Medium |
| disabled | 是否停用 | bool | false |
| readonly | 是否唯讀 | bool | false |
| placeholder | 占位文字 | Option\<String\> | None |
| value | 輸入值 | Option\<String\> | None |
| input_type | 輸入類型 | Option\<String\> | "text" |
| autofocus | 是否自動聚焦 | bool | false |
| class | 自訂 CSS 類別 | String | "" |
| prefix_icon | 前綴圖示 | Option\<Element\> | None |
| suffix_icon | 後綴圖示 | Option\<Element\> | None |
| oninput | 輸入回呼 | Option\<EventHandler\<String\>\> | None |
| onfocus | 聚焦回呼 | Option\<EventHandler\<FocusEvent\>\> | None |
| onblur | 失焦回呼 | Option\<EventHandler\<FocusEvent\>\> | None |
| onkeydown | 按鍵回呼 | Option\<EventHandler\<KeyboardEvent\>\> | None |
| glow | 是否啟用發光效果 | bool | true |
| glow_blur | 發光模糊強度 | GlowBlur | Medium |
| glow_intensity | 發光強度 | GlowIntensity | Soft |
| glow_color | 發光顏色 | GlowColor | Ghost |
| **Custom 層屬性** | | | |
| text_color | 自訂文字顏色 | Option\<String\> | None |
| placeholder_color | 自訂占位符顏色 | Option\<String\> | None |
| border_color | 自訂邊框顏色 | Option\<String\> | None |
| background_color | 自訂背景顏色 | Option\<String\> | None |
| animation_id | AnimationBuilder 動畫 ID | Option\<String\> | None |
| css_vars | CSS 變數批次覆蓋 | Option\<Vec\<(&'static str, String)\>\> | None |

## CSS 變數參考

### Input CSS 變數

| 變數名稱 | 說明 | 預設值 |
|----------|------|--------|
| --hi-input-text-color | 文字顏色 | var(--hi-color-text-primary) |
| --hi-input-text-color-disabled | 停用文字顏色 | var(--hi-color-text-disabled) |
| --hi-input-placeholder-color | 占位符顏色 | var(--hi-color-text-secondary) |
| --hi-input-placeholder-opacity | 占位符透明度 | 0.6 |
| --hi-input-bg | 背景顏色 | transparent |
| --hi-input-bg-disabled | 停用背景 | rgba(255, 255, 255, 0.5) |
| --hi-input-border-color | 邊框顏色 | var(--hi-color-border) |
| --hi-input-border-color-focus | 焦點邊框顏色 | var(--hi-color-primary) |
| --hi-input-border-color-disabled | 停用邊框顏色 | var(--hi-border-color-disabled) |
| --hi-input-border-color-error | 錯誤邊框顏色 | var(--hi-color-danger) |
| --hi-input-shadow-focus | 焦點陰影 | 0 0 0 2px var(--hi-color-primary) |
| --hi-input-radius | 圓角 | var(--hi-radius-md) |
| --hi-input-padding-x | 水平內距 | 0.75rem |
| --hi-input-padding-y | 垂直內距 | 0.5rem |
| --hi-input-font-size | 字型大小 | var(--hi-font-size-sm) |
