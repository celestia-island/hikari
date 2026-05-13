# Number Input 数字输入框

Number Input 组件用于数字输入，支持步进器。

## 基础用法

```_hikari_component
pages/components/layer1/number_input#basic
```

## 尺寸规格

支持三种尺寸：小、中（默认）、大。

```_hikari_component
pages/components/layer1/number_input#sizes
```

## 禁用状态

```_hikari_component
pages/components/layer1/number_input#disabled
```

## 步进器与范围限制

可以设置最小值、最大值和步长。

```_hikari_component
pages/components/layer1/number_input#stepper
```

## API

| 属性 | 说明 | 类型 | 默认值 |
|------|------|------|--------|
| value | 当前值 | i64 | 0 |
| on_change | 值变化回调 | EventHandler<i64> | - |
| min | 最小值 | Option<i64> | None |
| max | 最大值 | Option<i64> | None |
| step | 步长 | i64 | 1 |
| disabled | 是否禁用 | bool | false |
| size | 尺寸大小 | NumberInputSize | Medium |
| class | 自定义类名 | String | "" |
| style | 自定义样式 | String | "" |

### NumberInputSize

- `Small` - 小尺寸 (24px)
- `Medium` - 中尺寸 (32px，默认)
- `Large` - 大尺寸 (40px)
