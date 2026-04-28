# Switch Components

Switch components provide toggle functionality with multiple colors and variants.

## Switch Basic

Supports multiple colors: Success, Primary, Secondary, Danger, Warning, Info.

```_hikari_component
pages/components/layer1/switch#switch
```

## Switch Icon Variant

Switch with icons, default provides ✓ and ✗ symbols.

```_hikari_component
pages/components/layer1/switch#icon
```

## Switch Text Variant

Switch with text labels, automatically adjusts slider width.

```_hikari_component
pages/components/layer1/switch#text
```

## Switch Size Variant

Supports Small, Medium, Large sizes.

```_hikari_component
pages/components/layer1/switch#sizes
```

## Progress

Progress bar component for displaying operation progress.

```_hikari_component
pages/components/layer1/switch#progress
```

## Slider

Slider component for numeric selection.

```_hikari_component
pages/components/layer1/switch#slider
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
