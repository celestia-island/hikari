# Number Input 數字輸入框

Number Input 組件用於數字輸入，支持步進器。

## 基礎用法

```_hikari_component
pages/components/layer1/number_input#basic
```

## 尺寸規格

支持三種尺寸：小、中（預設）、大。

```_hikari_component
pages/components/layer1/number_input#sizes
```

## 禁用狀態

```_hikari_component
pages/components/layer1/number_input#disabled
```

## 步進器與範圍限制

可以設定最小值、最大值和步長。

```_hikari_component
pages/components/layer1/number_input#stepper
```

## API

| 屬性 | 說明 | 類型 | 預設值 |
|------|------|------|--------|
| value | 當前值 | i64 | 0 |
| on_change | 值變化回調 | EventHandler<i64> | - |
| min | 最小值 | Option<i64> | None |
| max | 最大值 | Option<i64> | None |
| step | 步長 | i64 | 1 |
| disabled | 是否禁用 | bool | false |
| size | 尺寸大小 | NumberInputSize | Medium |
| class | 自定義類名 | String | "" |
| style | 自定義樣式 | String | "" |

### NumberInputSize

- `Small` - 小尺寸 (24px)
- `Medium` - 中尺寸 (32px，預設)
- `Large` - 大尺寸 (40px)
