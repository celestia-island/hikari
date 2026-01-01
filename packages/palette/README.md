# hikari-palette

A comprehensive color palette system featuring 500+ traditional Chinese colors with rich historical context and modern type-safe Rust constants.

## Overview

`hikari-palette` provides:

- **500+ Traditional Chinese Colors** - Authentic historical colors from Chinese art, culture, and nature
- **Rich Metadata** - Each color includes hex, RGB, CMYK values, and historical notes
- **Type-Safe Constants** - Use Chinese identifiers directly in your Rust code
- **Pre-defined Palettes** - Ready-to-use color schemes for different design systems
- **Serde Support** - Full serialization/deserialization support

## Design Philosophy

This crate uses **"Scheme C-Plus"** - Chinese constant names with English API design:

```rust
// Chinese constant names (cultural authenticity)
let primary = 石青;
let secondary = 朱砂;

// English API (interoperability)
println!("{}: {}", primary.name, primary.hex);
```

This approach balances cultural authenticity with technical practicality, made possible by Rust 1.52+'s support for Unicode identifiers.

## Installation

Add to your `Cargo.toml`:

```toml
[dependencies]
hikari-palette = "0.1.0"
```

## Usage

### Basic Color Usage

```rust
use hikari_palette::{石青, 朱砂, 藤黄, 月白};

fn main() {
    let primary = 石青;
    let secondary = 朱砂;

    println!("Primary color: {}", primary.name);
    println!("Hex: {}", primary.hex);
    println!("RGB: {:?}", primary.rgb);

    // Output:
    // Primary color: 石青
    // Hex: #1759A8
    // RGB: (23, 89, 168)
}
```

### Color Metadata

Each `ChineseColor` contains rich metadata:

```rust
use hikari_palette::{朱砂};

fn display_color_info(color: ChineseColor) {
    println!("Name: {}", color.name);
    println!("Hex: {}", color.hex);
    println!("RGB: {:?}", color.rgb);

    if let Some(cmyk) = color.cmyk {
        println!("CMYK: {:?}", cmyk);
    }

    if let Some(note) = color.historical_note {
        println!("Historical: {}", note);
    }

    println!("Category: {:?}", color.category);
}
```

### Pre-defined Palettes

```rust
use hikari_palette::{primary_palette, fui_dark_palette, arknights_palette};

// Primary theme (default)
let palette = primary_palette();
println!("Primary: {}", palette.primary.hex);
println!("Background: {}", palette.background.hex);

// FUI Dark theme
let dark = fui_dark_palette();

// Arknights theme
let arknights = arknights_palette();
```

### Creating Custom Palettes

```rust
use hikari_palette::{Palette, 石青, 朱砂, 藤黄, 葱倩};

let custom = Palette {
    primary: 石青,
    secondary: 朱砂,
    accent: 藤黄,
    success: 葱倩,
    // ... other fields
    ..Default::default()
};
```

## Color Categories

Colors are organized into categories:

- **Red** (赤色系): 朱砂, 丹雘, 银红, ...
- **Orange** (橙色系): 藤黄, 鹅黄, 杏黄, ...
- **Green** (绿色系): 葱倩, 竹青, 豆碧, ...
- **Cyan/Blue** (青色系): 石青, 靛蓝, 群碧, ...
- **Purple** (紫色系): 紫檀, 丁香, 牡丹, ...
- **White** (白色系): 月白, 云白, ...
- **Black** (黑色系): 墨色, 玄色, ...
- **Gray** (灰色系): 缟色, 黛色, 铁灰, 烟灰, ...

## Color Reference

### Primary Colors

| Color Name | Chinese | Hex | Usage |
|------------|---------|-----|-------|
| Stone Cyan | 石青 | #1759A8 | Primary brand color |
| Cinnabar | 朱砂 | #FF4C00 | Secondary accent |
| Vine Yellow | 藤黄 | #FFB800 | Highlights |
| Indigo | 靛蓝 | #1A237E | Deep accents |

### Neutral Colors

| Color Name | Chinese | Hex | Usage |
|------------|---------|-----|-------|
| Moon White | 月白 | #D6ECF0 | Text, backgrounds |
| Ink Black | 墨色 | #333333 | Dark backgrounds |
| Silk Gray | 缟色 | #8B954F | Borders, dividers |
| Dark Gray | 黛色 | #404050 | Subtle text |

### Functional Colors

| Color Name | Chinese | Hex | Usage |
|------------|---------|-----|-------|
| Scallion Green | 葱倩 | #5CBF91 | Success states |
| Goosling Yellow | 鹅黄 | #FBC02D | Warnings |
| Cinnabar | 朱砂 | #FF4C00 | Error, danger |

## Historical Context

Many colors include historical notes:

```rust
use hikari_palette::{石青};

if let Some(note) = 石青.historical_note {
    println!("{}", note);
    // Output: 中国画传统颜料，源于蓝铜矿石
}
```

This provides educational value and helps you choose colors with cultural significance.

## Serde Integration

Full serialization support:

```rust
use hikari_palette::{ChineseColor, 石青};
use serde_json;

#[derive(Serialize, Deserialize)]
struct Theme {
    primary: ChineseColor,
    secondary: ChineseColor,
}

let theme = Theme {
    primary: 石青,
    secondary: 朱砂,
};

let json = serde_json::to_string(&theme)?;
```

## API Reference

### `ChineseColor` struct

```rust
pub struct ChineseColor {
    pub name: &'static str,           // Chinese name
    pub hex: &'static str,            // Hex color code
    pub rgb: (u8, u8, u8),           // RGB values
    pub cmyk: Option<(u8, u8, u8, u8)>, // CMYK values
    pub category: ColorCategory,      // Color category
    pub historical_note: Option<&'static str>, // Historical context
}
```

### `Palette` struct

```rust
pub struct Palette {
    pub primary: ChineseColor,
    pub secondary: ChineseColor,
    pub accent: ChineseColor,
    pub success: ChineseColor,
    pub warning: ChineseColor,
    pub danger: ChineseColor,
    pub background: ChineseColor,
    pub surface: ChineseColor,
    pub border: ChineseColor,
    pub text_primary: ChineseColor,
    pub text_secondary: ChineseColor,
}
```

### Pre-defined Palettes

- `primary_palette()` - Default primary theme
- `fui_dark_palette()` - FUI dark sci-fi theme
- `arknights_palette()` - Arknights-inspired theme
- `fresh_palette()` - Light, fresh theme

## Examples

### Color Utility Functions

```rust
use hikari_palette::{石青, ColorCategory};

fn is_blue(color: ChineseColor) -> bool {
    matches!(color.category, ColorCategory::Blue)
}

assert!(is_blue(石青));
```

### Color Interpolation (pseudo-code)

```rust
use hikari_palette::{月白, 墨色};

// You can implement color manipulation using the RGB values
fn interpolate(c1: ChineseColor, c2: ChineseColor, t: f32) -> (u8, u8, u8) {
    (
        (c1.rgb.0 as f32 + (c2.rgb.0 as f32 - c1.rgb.0 as f32) * t) as u8,
        (c1.rgb.1 as f32 + (c2.rgb.1 as f32 - c1.rgb.1 as f32) * t) as u8,
        (c1.rgb.2 as f32 + (c2.rgb.2 as f32 - c1.rgb.2 as f32) * t) as u8,
    )
}
```

## Integration with hikari-theme

`hikari-palette` integrates seamlessly with `hikari-theme`:

```rust
use hikari_palette::primary_palette;
use hikari_theme::ThemeProvider;

// In your Dioxus app
rsx! {
    ThemeProvider {
        palette: "primary".to_string(),
        // Uses colors from primary_palette()
    }
}
```

## Contributing

We welcome contributions! If you'd like to add more traditional Chinese colors, please:

1. Ensure historical accuracy
2. Provide RGB values
3. Include CMYK if available
4. Add historical notes
5. Cite sources

## License

MIT OR Apache-2.0

## Acknowledgments

Color data inspired by [ChineseColors](https://github.com/zhaoolee/ChineseColors) and traditional Chinese color theory.
