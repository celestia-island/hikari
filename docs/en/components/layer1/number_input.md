# Number Input

Number Input component for numeric input with stepper support.

## Basic Usage

```_hikari_component
pages/components/layer1/number_input#basic
```

## Sizes

Three sizes available: Small, Medium (default), and Large.

```_hikari_component
pages/components/layer1/number_input#sizes
```

## Disabled State

```_hikari_component
pages/components/layer1/number_input#disabled
```

## Stepper with Range

You can set minimum value, maximum value, and step size.

```_hikari_component
pages/components/layer1/number_input#stepper
```

## API

| Property | Description | Type | Default |
|----------|-------------|------|---------|
| value | Current value | i64 | 0 |
| on_change | Value change callback | EventHandler<i64> | - |
| min | Minimum value | Option<i64> | None |
| max | Maximum value | Option<i64> | None |
| step | Step size | i64 | 1 |
| disabled | Whether disabled | bool | false |
| size | Size variant | NumberInputSize | Medium |
| class | Custom class name | String | "" |
| style | Custom style | String | "" |

### NumberInputSize

- `Small` - Small size (24px)
- `Medium` - Medium size (32px, default)
- `Large` - Large size (40px)
