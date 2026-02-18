# Number Input 數字輸入框

Number Input 元件用於數字輸入，支援步進器。

## 基礎用法

```_hikari_component
pages/components/layer1/number_input#basic
```

## 帶步進器

```_hikari_component
pages/components/layer1/number_input#stepper
```

## API

| 屬性 | 說明 | 類型 | 預設值 |
|------|------|------|--------|
| value | 目前值 | i64 | 0 |
| min | 最小值 | Option\<i64\> | None |
| max | 最大值 | Option\<i64\> | None |
| step | 步長 | i64 | 1 |
