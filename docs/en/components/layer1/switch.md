# Switch Components

Switch components provide toggle functionality with multiple colors and variants.

## Switch Basic

Supports multiple colors: Success, Primary, Secondary, Danger, Warning, Info.

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

## Switch Icon Variant

Switch with icons, default provides ✓ and ✗ symbols.

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

## Switch Text Variant

Switch with text labels, automatically adjusts slider width.

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

## Switch Size Variant

Supports Small, Medium, Large sizes.

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

## Progress

Progress bar component for displaying operation progress.

```hikari
rsx! {
    div { style: "padding:1rem;",
        div { style: "width:200px;height:6px;background:#e2e2ea;border-radius:3px;overflow:hidden;",
            div { style: "width:60%;height:100%;background:#3a6ea5;border-radius:3px;" }
        }
    }
}
```

## Slider

Slider component for numeric selection.

```hikari
rsx! {
    div { style: "padding:1rem;",
        input { type: "range", min: "0", max: "100", value: "60", style: "width:200px;" }
    }
}
```

## API

### SwitchProps

| Property | Type | Default | Description |
|------|------|--------|------|
| checked | `bool` | `false` | Whether checked |
| on_change | `EventEmitter<bool>` | - | State change callback |
| disabled | `bool` | `false` | Whether disabled |
| size | `SwitchSize` | `Medium` | Size |
| variant | `SwitchVariant` | `Default` | Variant type |
| color | `SwitchColor` | `Success` | Color when checked |
| checked_content | `Option<SwitchContent>` | `None` | Content when checked |
| unchecked_content | `Option<SwitchContent>` | `None` | Content when unchecked |

### SwitchVariant

| Value | Description |
|------|------|
| `Default` | Default style (dot) |
| `Text` | Text variant |
| `Icon` | Icon variant |
| `Custom` | Custom variant |

### SwitchColor

| Value | Description |
|------|------|
| `Success` | Success/On (green, default) |
| `Primary` | Primary color (blue) |
| `Secondary` | Secondary color (purple) |
| `Danger` | Danger (red) |
| `Warning` | Warning (yellow) |
| `Info` | Info (indigo) |

### SwitchContent

| Value | Description |
|------|------|
| `Text(String)` | Text content |
| `Icon(SwitchIcon)` | Icon content |
| `Image(String)` | Image URL |

### SwitchIcon

| Value | Description |
|------|------|
| `Check` | Check icon |
| `Close` | Close icon |
| `Plus` | Plus icon |
| `Minus` | Minus icon |
| `Custom(&'static str)` | Custom SVG path |
