# Switch 开关组件

Switch 组件提供开关切换功能，支持多种变体。

## Switch 基础开关

基础的开关切换组件，使用 Glow 鼠标跟随高亮效果。

```_hikari_component
pages/components/layer1/switch#switch
```

## Switch 图标变体

带有图标的开关，默认提供 ✓ 和 ✗ 符号。

```_hikari_component
pages/components/layer1/switch#icon
```

## Switch 文本变体

带有文本标签的开关，自动调整滑杆宽度。

```_hikari_component
pages/components/layer1/switch#text
```

## Switch 尺寸变体

支持 Small、Medium、Large 三种尺寸。

```_hikari_component
pages/components/layer1/switch#sizes
```

## Progress 进度条

展示操作进度的进度条组件。

```_hikari_component
pages/components/layer1/switch#progress
```

## Slider 滑块

用于数值选择的滑块组件。

```_hikari_component
pages/components/layer1/switch#slider
```

## API

### SwitchProps

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| checked | `bool` | `false` | 是否选中 |
| on_change | `EventEmitter<bool>` | - | 状态变化回调 |
| disabled | `bool` | `false` | 是否禁用 |
| size | `SwitchSize` | `Medium` | 尺寸 |
| variant | `SwitchVariant` | `Default` | 变体类型 |
| checked_content | `Option<SwitchContent>` | `None` | 选中时显示的内容 |
| unchecked_content | `Option<SwitchContent>` | `None` | 未选中时显示的内容 |

### SwitchVariant

- `Default` - 默认样式（圆点）
- `Text` - 文本变体
- `Icon` - 图标变体
- `Custom` - 自定义变体

### SwitchContent

- `Text(String)` - 文本内容
- `Icon(SwitchIcon)` - 图标内容
- `Image(String)` - 图片 URL

### SwitchIcon

- `Check` - 勾选图标
- `Close` - 关闭图标
- `Plus` - 加号图标
- `Minus` - 减号图标
- `Custom(&'static str)` - 自定义 SVG path
