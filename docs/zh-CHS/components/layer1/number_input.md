# Number Input 数字输入框

Number Input 组件用于数字输入，支持步进器。

## 基础用法

```_hikari_component
pages/components/layer1/number_input#basic
```

## 带步进器

```_hikari_component
pages/components/layer1/number_input#stepper
```

## API

| 属性 | 说明 | 类型 | 默认值 |
|------|------|------|--------|
| value | 当前值 | i64 | 0 |
| min | 最小值 | Option\<i64\> | None |
| max | 最大值 | Option\<i64\> | None |
| step | 步长 | i64 | 1 |
