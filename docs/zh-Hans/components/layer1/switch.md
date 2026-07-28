# Switch 开关组件

Switch 组件提供开关切换功能，支持多种颜色和变体。

## Switch 基础开关

支持多种颜色：Success、Primary、Secondary、Danger、Warning、Info。

```hikari
rsx! {
    div { style: "padding:1rem;display:flex;gap:16px;align-items:center;",
        div { style: "width:40px;height:22px;border-radius:11px;background:#3a6ea5;position:relative;",
            div { style: "position:absolute;right:2px;top:2px;width:18px;height:18px;border-radius:50%;background:#fff;" }
        }
        div { style: "width:40px;height:22px;border-radius:11px;background:#ccc;position:relative;",
            div { style: "position:absolute;left:2px;top:2px;width:18px;height:18px;border-radius:50%;background:#fff;" }
        }
    }
}
```

## Switch 图标变体

带有图标的开关，默认提供 ✓ 和 ✗ 符号。

```hikari
rsx! {
    div { style: "padding:1rem;display:flex;gap:8px;align-items:center;",
        span { style: "font-size:16px;", "🌙" }
        div { style: "width:40px;height:22px;border-radius:11px;background:#3a6ea5;position:relative;",
            div { style: "position:absolute;right:2px;top:2px;width:18px;height:18px;border-radius:50%;background:#fff;" } }
        span { style: "font-size:16px;", "☀" }
    }
}
```

## Switch 文本变体

带有文本标签的开关，自动调整滑杆宽度。

```hikari
rsx! {
    div { style: "padding:1rem;display:flex;gap:8px;align-items:center;",
        span { style: "font-size:14px;color:#666;", "Off" }
        div { style: "width:40px;height:22px;border-radius:11px;background:#3a6ea5;position:relative;",
            div { style: "position:absolute;right:2px;top:2px;width:18px;height:18px;border-radius:50%;background:#fff;" } }
        span { style: "font-size:14px;color:#333;", "On" }
    }
}
```

## Switch 尺寸变体

支持 Small、Medium、Large 三种尺寸。

```hikari
rsx! {
    div { style: "padding:1rem;display:flex;gap:16px;align-items:center;",
        div { style: "width:28px;height:16px;border-radius:8px;background:#3a6ea5;position:relative;",
            div { style: "position:absolute;right:1px;top:1px;width:14px;height:14px;border-radius:50%;background:#fff;" } }
        div { style: "width:40px;height:22px;border-radius:11px;background:#3a6ea5;position:relative;",
            div { style: "position:absolute;right:2px;top:2px;width:18px;height:18px;border-radius:50%;background:#fff;" } }
        div { style: "width:52px;height:28px;border-radius:14px;background:#3a6ea5;position:relative;",
            div { style: "position:absolute;right:2px;top:2px;width:24px;height:24px;border-radius:50%;background:#fff;" } }
    }
}
```

## Progress 进度条

展示操作进度的进度条组件。

```hikari
rsx! {
    div { style: "padding:1rem;",
        div { style: "width:200px;height:6px;background:#e2e2ea;border-radius:3px;overflow:hidden;",
            div { style: "width:60%;height:100%;background:#3a6ea5;border-radius:3px;" }
        }
    }
}
```

## Slider 滑块

用于数值选择的滑块组件。

```hikari
rsx! {
    div { style: "padding:1rem;",
        input { type: "range", min: "0", max: "100", value: "60", style: "width:200px;" }
    }
}
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
| color | `SwitchColor` | `Success` | 选中时的颜色 |
| checked_content | `Option<SwitchContent>` | `None` | 选中时显示的内容 |
| unchecked_content | `Option<SwitchContent>` | `None` | 未选中时显示的内容 |

### SwitchVariant

| 值 | 说明 |
|------|------|
| `Default` | 默认样式（圆点） |
| `Text` | 文本变体 |
| `Icon` | 图标变体 |
| `Custom` | 自定义变体 |

### SwitchColor

| 值 | 说明 |
|------|------|
| `Success` | 成功/开启（葱倩绿，默认） |
| `Primary` | 主色（蓝色） |
| `Secondary` | 次要色（宝蓝） |
| `Danger` | 危险（朱红） |
| `Warning` | 警告（杏黄） |
| `Info` | 信息（靛蓝） |

### SwitchContent

| 值 | 说明 |
|------|------|
| `Text(String)` | 文本内容 |
| `Icon(SwitchIcon)` | 图标内容 |
| `Image(String)` | 图片 URL |

### SwitchIcon

| 值 | 说明 |
|------|------|
| `Check` | 勾选图标 |
| `Close` | 关闭图标 |
| `Plus` | 加号图标 |
| `Minus` | 减号图标 |
| `Custom(&'static str)` | 自定义 SVG path |
