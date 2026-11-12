# Input 输入框

Input 组件是基础的表单输入组件，支持多种状态和自定义样式。

## 三层级配置

Input 组件支持三层级 CSS 变量配置架构：

- **Layer1 (基础层级)**: 通过主题定义全局默认值
- **Layer2 (组件层级)**: 通过 `input-vars.scss` 定义组件变量
- **Custom (运行时)**: 通过组件属性动态覆盖

## 基础用法

```hikari
rsx! {
    div { style: "padding:1rem;",
        input { type: "text", placeholder: "Basic input", style: "padding:8px 12px;border:1px solid #d9d9d9;border-radius:6px;font-size:14px;width:240px;" }
    }
}
```

## 禁用状态

输入框可以被禁用，禁用状态下不可编辑。

```hikari
rsx! {
    div { style: "padding:1rem;",
        input { type: "text", placeholder: "Disabled", disabled: true, style: "padding:8px 12px;border:1px solid #d9d9d9;border-radius:6px;font-size:14px;width:240px;background:#f5f5f5;color:#999;" }
    }
}
```

## 数字输入

`type="number"`（Vue 运行时也可用 `variant="number"`）会用共享的 lucide 上下箭头列——与 [Number Input](./number_input.md) 相同的控件——替换浏览器原生的步进按钮：单击按 `step` 步进，长按连续步进，`min` / `max` / `step` 属性对指针步进的约束与对原生键盘步进的约束完全一致。字段本身仍是原生 `type="number"` 输入框——方向键与表单校验不受影响。

```hikari
<HInput type="number" modelValue={value} onUpdate:modelValue={(v: string) => (value = v)} min={60} max={240} step={10} placeholder="Hang" />
```

## 自定义颜色

通过 Custom 层属性可以动态覆盖输入框颜色。

```rust
Input {
    placeholder: "Custom styled input",
    text_color: Some("#ff0000".to_string()),        // 自定义文字颜色
    border_color: Some("#ff4f00".to_string()),       // 自定义边框颜色
    background_color: Some("rgba(255, 255, 255, 0.1)".to_string()), // 自定义背景颜色
}
```

## CSS 变量覆盖

通过 `css_vars` 属性可以批量覆盖 CSS 变量。

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

## 动画集成

通过 `animation_id` 属性可以与 AnimationBuilder 集成实现动画效果。

```rust
Input {
    placeholder: "Animated Input",
    animation_id: Some("animated-input".to_string()),
}

// 使用 AnimationBuilder 控制动画
AnimationBuilder::new()
    .style("--hi-input-border-color", "rgb(255, 79, 0)")
    .style("--hi-input-shadow-focus", "0 0 0 2px rgba(255, 79, 0, 0.3)")
    .duration(300)
    .apply_to_element("animated-input");
```

## API

### Input Props

| 属性 | 说明 | 类型 | 默认值 |
|------|------|------|--------|
| size | 输入框尺寸 | InputSize | Medium |
| disabled | 是否禁用 | bool | false |
| readonly | 是否只读 | bool | false |
| placeholder | 占位文本 | Option\<String\> | None |
| value | 输入值 | Option\<String\> | None |
| input_type | 输入类型 | Option\<String\> | "text" |
| autofocus | 是否自动聚焦 | bool | false |
| class | 自定义 CSS 类 | String | "" |
| prefix_icon | 前缀图标 | Option\<Element\> | None |
| suffix_icon | 后缀图标 | Option\<Element\> | None |
| oninput | 输入回调 | Option\<EventHandler\<String\>\> | None |
| onfocus | 聚焦回调 | Option\<EventHandler\<FocusEvent\>\> | None |
| onblur | 失焦回调 | Option\<EventHandler\<FocusEvent\>\> | None |
| onkeydown | 按键回调 | Option\<EventHandler\<KeyboardEvent\>\> | None |
| glow | 是否启用发光效果 | bool | true |
| glow_blur | 发光模糊强度 | GlowBlur | Medium |
| glow_intensity | 发光强度 | GlowIntensity | Soft |
| glow_color | 发光颜色 | GlowColor | Ghost |
| **Custom 层属性** | | | |
| text_color | 自定义文字颜色 | Option\<String\> | None |
| placeholder_color | 自定义占位符颜色 | Option\<String\> | None |
| border_color | 自定义边框颜色 | Option\<String\> | None |
| background_color | 自定义背景颜色 | Option\<String\> | None |
| animation_id | AnimationBuilder 动画 ID | Option\<String\> | None |
| css_vars | CSS 变量批量覆盖 | Option\<Vec\<(&'static str, String)\>\> | None |

## CSS 变量参考

### Input CSS 变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| --hi-input-text-color | 文字颜色 | var(--hi-color-text-primary) |
| --hi-input-text-color-disabled | 禁用文字颜色 | var(--hi-color-text-disabled) |
| --hi-input-placeholder-color | 占位符颜色 | var(--hi-color-text-secondary) |
| --hi-input-placeholder-opacity | 占位符透明度 | 0.6 |
| --hi-input-bg | 背景颜色 | transparent |
| --hi-input-bg-disabled | 禁用背景 | rgba(255, 255, 255, 0.5) |
| --hi-input-border-color | 边框颜色 | var(--hi-color-border) |
| --hi-input-border-color-focus | 焦点边框颜色 | var(--hi-color-primary) |
| --hi-input-border-color-disabled | 禁用边框颜色 | var(--hi-border-color-disabled) |
| --hi-input-border-color-error | 错误边框颜色 | var(--hi-color-danger) |
| --hi-input-shadow-focus | 焦点阴影 | 0 0 0 2px var(--hi-color-primary) |
| --hi-input-radius | 圆角 | var(--hi-radius-md) |
| --hi-input-padding-x | 水平内边距 | 0.75rem |
| --hi-input-padding-y | 垂直内边距 | 0.5rem |
| --hi-input-font-size | 字体大小 | var(--hi-font-size-sm) |

## 金额输入

`HkMoneyInput` 是感知币种的金额输入框。它的模型是**规范十进制文本**——仅数字、至多一个 `.`、无千分位分隔符、无货币符号（`""`、`"12"`、`"1.5"`、`"-0.25"`）；`""` 表示「未设置 / 沿用」，绝不会被强制转换为 `0`。

输入过程中**绝不重写输入框**：可见文本始终等于你键入的内容；规范化值在输入时发出；显示格式（千分位与币种精度）只在**失焦**时应用；**聚焦**时再还原为可编辑文本。因此键入的 `1.5` 不会在敲字过程中被截成 `5`。

```hikari:tsx
<HkMoneyInput
  label="单价"
  currency={{ code: "USD", symbol: "$", decimals: 2 }}
  min={0}
  modelValue={price}
  onUpdate:modelValue={(next: string) => (price = next)}
/>
```

`maxDecimals` 默认取 `currency.decimals`；费率（每百万单价可能需要 4–6 位）可显式提高。`min` / `max` 只**提示**本地化区间信息——越界金额永远不会被悄悄截断。货币符号作为装饰性前缀渲染在输入框内，元素是带 `inputmode="decimal"` 的普通文本框，`error` / `aria-invalid` / `aria-describedby` 由组件自动接线。

| 属性 | 说明 | 类型 | 默认值 |
|------|------|------|--------|
| modelValue | 规范十进制文本 | string | "" |
| currency | 币种（符号、代码、小数位） | HkCurrency | — |
| maxDecimals | 小数位预算（失焦精度与舍入） | number | currency.decimals |
| min / max | 建议区间，仅提示不截断 | number | — |
| label / error / required / disabled | 字段外壳 | string / string / bool / bool | — |
| size | 尺寸档位 | "sm" \| "md" \| "lg" | "md" |

## 币种

`HkCurrency` 是共享值类型：`{ code, symbol?, name?, decimals }`。配套工具函数从包桶导出，宿主无需挂载组件即可格式化金额：`formatMoney`、`parseMoney`、`canonicalMoneyText`、`currencyDisplayName`、`normalizeCurrency`、`isValidCurrency`、`currencySymbol`。

```hikari:tsx
formatMoney(1234.5, { code: "USD", decimals: 2 }); // "1,234.50"
parseMoney("1,234.50", 2);                          // 1234.5
currencyDisplayName("USD", "en");                   // "US Dollar"
```

`formatMoney` 刻意与语言环境无关（千分位 `,`、小数点 `.`），因此格式化后的字符串总能解析回同一个数；本地化的部分是币种**名称**——先取 `Intl.DisplayNames`，再取调用方的回退值，最后回落为代码。

```hikari:tsx
<HkCurrencySelect
  label="结算币种"
  currencies={currencies}
  groups={[{ key: "common", label: "常用", codes: ["USD", "EUR"] }]}
  modelValue={code}
  onUpdate:modelValue={(next: string) => (code = next)}
/>
```

`HkCurrencySelect` 的每一行都带有符号、代码与本地化名称，搜索同时匹配三者；展开面复用共享下拉面板（桌面浮层 / 手机底部弹层），与选择器组件完全一致。
