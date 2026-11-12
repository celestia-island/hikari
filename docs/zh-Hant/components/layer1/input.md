# Input 輸入框

Input 組件是基礎的表單輸入組件，支援多種狀態和自訂樣式。

## 三層級配置

Input 組件支援三層級 CSS 變數配置架構：

- **Layer1 (基礎層級)**: 透過主題定義全域預設值
- **Layer2 (組件層級)**: 透過 `input-vars.scss` 定義組件變數
- **Custom (執行時)**: 透過組件屬性動態覆蓋

## 基礎用法

```hikari
rsx! {
    div { style: "padding:1rem;",
        input { type: "text", placeholder: "Basic input", style: "padding:8px 12px;border:1px solid #d9d9d9;border-radius:6px;font-size:14px;width:240px;" }
    }
}
```

## 停用狀態

輸入框可以被停用，停用狀態下不可編輯。

```hikari
rsx! {
    div { style: "padding:1rem;",
        input { type: "text", placeholder: "Disabled", disabled: true, style: "padding:8px 12px;border:1px solid #d9d9d9;border-radius:6px;font-size:14px;width:240px;background:#f5f5f5;color:#999;" }
    }
}
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

## 金額輸入

`HkMoneyInput` 是感知幣種的金額輸入框。它的模型是**規範十進位文字**——僅數字、至多一個 `.`、無千分位分隔符、無貨幣符號（`""`、`"12"`、`"1.5"`、`"-0.25"`）；`""` 表示「未設定／沿用」，絕不會被強制轉成 `0`。

輸入過程中**絕不重寫輸入框**：可見文字始終等於你鍵入的內容；規範化值在輸入時發出；顯示格式（千分位與幣種精度）只在**失焦**時套用；**聚焦**時再還原為可編輯文字。因此鍵入的 `1.5` 不會在打字過程中變成 `5`。

```hikari:tsx
<HkMoneyInput
  label="單價"
  currency={{ code: "USD", symbol: "$", decimals: 2 }}
  min={0}
  modelValue={price}
  onUpdate:modelValue={(next: string) => (price = next)}
/>
```

`maxDecimals` 預設取 `currency.decimals`；費率（每百萬單價可能需要 4–6 位）可明確提高。`min` / `max` 只**提示**本地化區間訊息——越界金額永遠不會被悄悄截斷。貨幣符號以裝飾性前綴渲染在輸入框內，元素是帶 `inputmode="decimal"` 的普通文字框，`error` / `aria-invalid` / `aria-describedby` 由元件自動接線。

| 屬性 | 說明 | 類型 | 預設值 |
|------|------|------|--------|
| modelValue | 規範十進位文字 | string | "" |
| currency | 幣種（符號、代碼、小數位） | HkCurrency | — |
| maxDecimals | 小數位預算（失焦精度與捨入） | number | currency.decimals |
| min / max | 建議區間，僅提示不截斷 | number | — |
| label / error / required / disabled | 欄位外殼 | string / string / bool / bool | — |
| size | 尺寸檔位 | "sm" \| "md" \| "lg" | "md" |

## 幣種

`HkCurrency` 是共享值型別：`{ code, symbol?, name?, decimals }`。配套工具函式從套件桶匯出，宿主無須掛載元件即可格式化金額：`formatMoney`、`parseMoney`、`canonicalMoneyText`、`currencyDisplayName`、`normalizeCurrency`、`isValidCurrency`、`currencySymbol`。

```hikari:tsx
formatMoney(1234.5, { code: "USD", decimals: 2 }); // "1,234.50"
parseMoney("1,234.50", 2);                          // 1234.5
currencyDisplayName("USD", "en");                   // "US Dollar"
```

`formatMoney` 刻意與語系無關（千分位 `,`、小數點 `.`），因此格式化後的字串總能解析回同一個數；本地化的部分是幣種**名稱**——先取 `Intl.DisplayNames`，再取呼叫端的備援值，最後回落為代碼。

```hikari:tsx
<HkCurrencySelect
  label="結算幣種"
  currencies={currencies}
  groups={[{ key: "common", label: "常用", codes: ["USD", "EUR"] }]}
  modelValue={code}
  onUpdate:modelValue={(next: string) => (code = next)}
/>
```

`HkCurrencySelect` 的每一列都帶有符號、代碼與本地化名稱，搜尋同時比對三者；展開面重用共享下拉面板（桌面浮層／手機底部彈層），與選擇器元件完全一致。
