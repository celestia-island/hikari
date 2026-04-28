# Palette System

Traditional Chinese color system implementation with 500+ historical colors.

## Table of Contents

- [Overview](#overview)
- [Colors](#colors)
- [ClassesBuilder](#classesbuilder-utility-class-generator)
- [Themes](#themes)
- [Opacity & Blending](#opacity--blending)
- [API Reference](#api-reference)

## Overview

`hikari-palette` provides:

- **500+ Colors** - Complete traditional Chinese color definitions
- **Type-Safe** - Compile-time color value checking
- **Utility Classes** - Type-safe Tailwind-style utility class builder
- **Theme Palettes** - Pre-configured theme color schemes
- **Opacity Support** - Color transparency and blending

All color definitions feature:

- **Cultural Heritage** - Traditional Chinese color names
- **Type Safety** - Enum-based color definitions
- **Hex Values** - Standard hex color codes
- **Categories** - Organized by color families

## Colors

### Basic Usage

```rust
use hikari_palette::ChineseColor;

// Access colors using enum variants
let red = ChineseColor::Cinnabar;
let blue = ChineseColor::Azurite;
let yellow = ChineseColor::VineYellow;

println!("Red: {}", red.hex());  // #E94B35
println!("Blue: {}", blue.hex()); // #00A0E9
println!("Yellow: {}", yellow.hex()); // #F8B62D
```

### Available Color Categories

#### Red Series (红色系)

```rust
// Traditional red colors
ChineseColor::Cinnabar      // 朱砂 #E94B35 - Vermilion
ChineseColor::Vermilion     // 朱红 #FF4C00 - Bright red-orange
ChineseColor::Crimson       // 绯红 #FF3030 - Deep crimson
ChineseColor::PeachBlossom  // 桃红 #F6BEC8 - Peach pink
ChineseColor::RoseRed       // 玫瑰红 #C21F30 - Rose red
```

#### Blue Series (蓝色系)

```rust
// Traditional blue colors
ChineseColor::Azurite       // 石青 #00A0E9 - Azurite blue
ChineseColor::Indigo        // 靛蓝 #1a237e - Indigo blue
ChineseColor::Cyan          // 青色 #00CED1 - Cyan
ChineseColor::SkyBlue       // 天蓝 #87CEEB - Sky blue
ChineseColor::Turquoise     // 绿松石 #40E0D0 - Turquoise
```

#### Yellow Series (黄色系)

```rust
// Traditional yellow colors
ChineseColor::VineYellow    // 藤黄 #F8B62D - Gamboge yellow
ChineseColor::GooseYellow   // 鹅黄 #FFF176 - Light yellow
ChineseColor::Golden        // 金色 #FFD700 - Gold
ChineseColor::Amber         // 琥珀 #FFBF00 - Amber
```

#### Green Series (绿色系)

```rust
// Traditional green colors
ChineseColor::ScallionGreen // 葱倩 #4CAF50 - Scallion green
ChineseColor::BambooGreen  // 竹青 #789262 - Bamboo green
ChineseColor::Jade          // 玉色 #A0E6DA - Jade green
ChineseColor::Emerald       // 翡翠 #50C878 - Emerald green
```

#### Neutral Series (中性色系)

```rust
// Traditional neutral colors
ChineseColor::InkBlack      // 墨色 #1A1A2E - Ink black
ChineseColor::MoonWhite     // 月白 #F5F5F5 - Moon white
ChineseColor::LightGray     // 缟色 #E0E0E0 - Light gray
ChineseColor::AshGray       // 灰色 #808080 - Ash gray
```

### Color Properties

Each color provides:

```rust
let color = ChineseColor::Azurite;

// Get hex value
let hex = color.hex();  // "#00A0E9"

// Get RGB values
let rgb = color.rgb();  // (0, 160, 233)

// Get color name
let name = color.name();  // "石青"

// Get English name
let english_name = color.english_name();  // "Azurite"
```

## ClassesBuilder

Type-safe utility class generator for Tailwind CSS-like classes.

### Basic Usage

```rust
use hikari_palette::{ClassesBuilder, classes::*};

let classes = ClassesBuilder::new()
    .add(Display::Flex)
    .add(FlexDirection::Row)
    .add(Gap::Gap4)
    .build();

// Output: "hi-flex hi-flex-row hi-gap-4"
```

### Available Utility Classes

#### Display Classes

```rust
use hikari_palette::classes::Display;

Display::Block      // "hi-block"
Display::Flex       // "hi-flex"
Display::Grid       // "hi-grid"
Display::Hidden     // "hi-hidden"
```

#### Flexbox Classes

```rust
use hikari_palette::classes::{FlexDirection, AlignItems, JustifyContent};

FlexDirection::Row        // "hi-flex-row"
FlexDirection::Column     // "hi-flex-column"
AlignItems::Center        // "hi-items-center"
AlignItems::Stretch       // "hi-items-stretch"
JustifyContent::Center    // "hi-justify-center"
JustifyContent::Between   // "hi-justify-between"
```

#### Spacing Classes

```rust
use hikari_palette::classes::{Padding, Margin, Gap};

Padding::P4        // "hi-p-4"
Padding::Px8       // "hi-px-8"
Margin::M4         // "hi-m-4"
Margin::MyAuto     // "hi-my-auto"
Gap::Gap4          // "hi-gap-4"
```

#### Color Classes

```rust
use hikari_palette::classes::{TextColor, BackgroundColor};

TextColor::Primary       // "hi-text-primary"
TextColor::Secondary     // "hi-text-secondary"
BackgroundColor::Primary // "hi-bg-primary"
BackgroundColor::Surface // "hi-bg-surface"
```

#### Typography Classes

```rust
use hikari_palette::classes::{FontSize, FontWeight};

FontSize::Base       // "hi-text-base"
FontSize::XL         // "hi-text-xl"
FontSize::2XL        // "hi-text-2xl"
FontWeight::Normal   // "hi-font-normal"
FontWeight::Bold     // "hi-font-bold"
```

#### Border Classes

```rust
use hikari_palette::classes::{Border, BorderRadius};

Border::B            // "hi-border"
Border::B2           // "hi-border-2"
BorderRadius::Md     // "hi-rounded-md"
BorderRadius::Full   // "hi-rounded-full"
```

### Combining Classes

```rust
use hikari_palette::{ClassesBuilder, classes::*};

// Complex component styling
let button_classes = ClassesBuilder::new()
    .add(Display::Flex)
    .add(AlignItems::Center)
    .add(JustifyContent::Center)
    .add(Padding::Px4)
    .add(Padding::Py2)
    .add(BorderRadius::Md)
    .add(BackgroundColor::Primary)
    .add(TextColor::White)
    .build();

// Output: "hi-flex hi-items-center hi-justify-center hi-px-4 hi-py-2 hi-rounded-md hi-bg-primary hi-text-white"
```

### Type Safety Benefits

```rust
// ✅ Type-safe - compile-time checking
let classes = ClassesBuilder::new()
    .add(Display::Flex)
    .add(FlexDirection::Row)
    .build();

// ❌ Would not compile - typo protection
let classes = ClassesBuilder::new()
    .add(Display::Flx)  // Compile error!
    .build();
```

## Themes

Pre-configured theme palettes.

### Hikari Theme (Light)

```rust
use hikari_palette::themes;

let hikari = themes::Hikari::palette();

println!("Primary: {}", hikari.primary.hex);   // #00A0E9
println!("Secondary: {}", hikari.secondary.hex); // #E94B35
println!("Accent: {}", hikari.accent.hex);     // #F8B62D
println!("Background: {}", hikari.background.hex); // #FFFFFF
println!("Surface: {}", hikari.surface.hex);   // #F5F5F5
```

**Color Scheme**:
- Primary: Azurite (石青) - Fresh cyan-blue
- Secondary: Cinnabar (朱砂) - Energetic red-orange
- Accent: Vine Yellow (藤黄) - Warm golden yellow
- Background: Moon White (月白) - Clean white
- Surface: Light gray with subtle tint

### Tairitsu Theme (Dark)

```rust
use hikari_palette::themes;

let tairitsu = themes::Tairitsu::palette();

println!("Primary: {}", tairitsu.primary.hex);   // #1a237e
println!("Secondary: {}", tairitsu.secondary.hex); // #E94B35
println!("Accent: {}", tairitsu.accent.hex);     // #FFF176
println!("Background: {}", tairitsu.background.hex); // #0D1117
println!("Surface: {}", tairitsu.surface.hex);   // #161B22
```

**Color Scheme**:
- Primary: Indigo (靛蓝) - Deep indigo blue
- Secondary: Cinnabar (朱砂) - Energetic red-orange
- Accent: Goose Yellow (鹅黄) - Bright pale yellow
- Background: Deep dark gray
- Surface: Slightly lighter dark gray

### Custom Theme

```rust
use hikari_palette::{ThemePalette, ChineseColor};

let custom = ThemePalette {
    primary: ChineseColor::Crimson,
    secondary: ChineseColor::VineYellow,
    accent: ChineseColor::Azurite,
    background: ChineseColor::InkBlack,
    surface: ChineseColor::MoonWhite,
    success: ChineseColor::ScallionGreen,
    warning: ChineseColor::GooseYellow,
    danger: ChineseColor::Cinnabar,
};
```

### Theme Structure

```rust
pub struct ThemePalette {
    pub primary: ChineseColor,
    pub secondary: ChineseColor,
    pub accent: ChineseColor,
    pub background: ChineseColor,
    pub surface: ChineseColor,
    pub success: ChineseColor,
    pub warning: ChineseColor,
    pub danger: ChineseColor,
    pub text_primary: ChineseColor,
    pub text_secondary: ChineseColor,
    pub border: ChineseColor,
}
```

## Opacity & Blending

Color transparency and blending utilities.

### Opacity Function

```rust
use hikari_palette::{ChineseColor, opacity};

let color = ChineseColor::Azurite;
let semi_blue = opacity(color, 0.5);

// Output: "rgba(0, 160, 233, 0.5)"
```

### Blend Function

```rust
use hikari_palette::{ChineseColor, blend};

let color1 = ChineseColor::Azurite;
let color2 = ChineseColor::Cinnabar;
let blended = blend(color1, color2, 0.5);

// Blends 50% of each color
```

### Color Lightening

```rust
use hikari_palette::{ChineseColor, lighten};

let color = ChineseColor::InkBlack;
let lighter = lighten(color, 0.2);

// Lightens by 20%
```

### Color Darkening

```rust
use hikari_palette::{ChineseColor, darken};

let color = ChineseColor::MoonWhite;
let darker = darken(color, 0.3);

// Darkens by 30%
```

## Integration Examples

### With ThemeProvider

```rust
use dioxus::prelude::*;
use hikari_theme::ThemeProvider;
use hikari_palette::themes;

#[component]
fn App() -> Element {
    let hikari = themes::Hikari::palette();

    rsx! {
        ThemeProvider { palette: "hikari".to_string() }
            div {
                style: "color: {hikari.primary.hex}",
                "Themed text"
            }
        }
    }
}
```

### With Components

```rust
use hikari_components::Button;
use hikari_palette::ChineseColor;

rsx! {
    Button {
        variant: "primary",
        style: format!("background: {}", ChineseColor::Azurite.hex()),
        "Custom Button"
    }
}
```

### With Utility Classes

```rust
use hikari_palette::{ClassesBuilder, classes::*};

let card_classes = ClassesBuilder::new()
    .add(BackgroundColor::Surface)
    .add(BorderRadius::Lg)
    .add(Padding::P6)
    .add(Shadow::Lg)
    .build();

rsx! {
    div {
        class: "{card_classes}",
        "Card content"
    }
}
```

## API Reference

### ChineseColor

```rust
pub enum ChineseColor {
    // Red series
    Cinnabar,      // 朱砂
    Vermilion,     // 朱红
    Crimson,       // 绯红

    // Blue series
    Azurite,       // 石青
    Indigo,        // 靛蓝
    Cyan,          // 青色

    // Yellow series
    VineYellow,    // 藤黄
    GooseYellow,   // 鹅黄

    // Green series
    ScallionGreen, // 葱倩
    BambooGreen,   // 竹青
    Jade,          // 玉色

    // Neutral series
    InkBlack,      // 墨色
    MoonWhite,     // 月白
    LightGray,     // 缟色

    // ... 500+ more colors
}

impl ChineseColor {
    pub fn hex(&self) -> String;
    pub fn rgb(&self) -> (u8, u8, u8);
    pub fn name(&self) -> &'static str;
    pub fn english_name(&self) -> &'static str;
}
```

### ClassesBuilder

```rust
pub struct ClassesBuilder {
    // internal
}

impl ClassesBuilder {
    pub fn new() -> Self;
    pub fn add(mut self, class: impl Class) -> Self;
    pub fn build(self) -> String;
}
```

### ThemePalette

```rust
pub struct ThemePalette {
    pub primary: ChineseColor,
    pub secondary: ChineseColor,
    pub accent: ChineseColor,
    pub background: ChineseColor,
    pub surface: ChineseColor,
    pub success: ChineseColor,
    pub warning: ChineseColor,
    pub danger: ChineseColor,
    pub text_primary: ChineseColor,
    pub text_secondary: ChineseColor,
    pub border: ChineseColor,
}
```

### Color Utilities

```rust
pub fn opacity(color: ChineseColor, alpha: f64) -> String;
pub fn blend(color1: ChineseColor, color2: ChineseColor, factor: f64) -> String;
pub fn lighten(color: ChineseColor, amount: f64) -> String;
pub fn darken(color: ChineseColor, amount: f64) -> String;
```

## Design Philosophy

### Cultural Significance

Each traditional Chinese color carries cultural and historical meaning:

- **Cinnabar (朱砂)**: Used in imperial seals, represents power and authority
- **Azurite (石青)**: Used in traditional painting, represents elegance
- **Vine Yellow (藤黄)**: Traditional painting pigment, warmth and vitality
- **Ink Black (墨色)**: Calligraphy ink, represents knowledge and depth
- **Moon White (月白)**: Pale blue-white, represents purity

### Color Harmony

Traditional Chinese color combinations follow specific harmony rules:

- **Complementary**: Red + Green (朱砂 + 竹青)
- **Analogous**: Blue + Cyan (石青 + 青色)
- **Triadic**: Red + Yellow + Blue (朱砂 + 藤黄 + 石青)

## Best Practices

### 1. Use Enum for Type Safety

```rust
// ✅ Good - Type-safe
let color = ChineseColor::Azurite;

// ❌ Avoid - String-based
let color = "#00A0E9";
```

### 2. Leverage Theme Palettes

```rust
// ✅ Good - Use theme palette
let palette = themes::Hikari::palette();
let primary = palette.primary;

// ❌ Avoid - Hardcoded colors
let primary = "#00A0E9";
```

### 3. Use Utility Classes

```rust
// ✅ Good - Type-safe utilities
let classes = ClassesBuilder::new()
    .add(Display::Flex)
    .add(Gap::Gap4)
    .build();

// ✅ Acceptable - String-based (less type-safe)
let classes = "hi-flex hi-gap-4";
```

### 4. Semantic Color Naming

```rust
// ✅ Good - Semantic usage
let button_color = theme.palette.primary;
let error_color = theme.palette.danger;

// ❌ Avoid - Direct color references
let button_color = ChineseColor::Azurite;
let error_color = ChineseColor::Cinnabar;
```

## Related Systems

- [Theme System](./theme.md) - Theme context and CSS variables
- [Components](../components/) - Component library using palettes
- [Builder System](./builder.md) - SCSS compilation with palette variables

## Resources

- [Traditional Chinese Colors](https://zh.wikipedia.org/wiki/%E4%B8%AD%E5%9B%BD%E4%BC%A0%E7%BB%9F%E9%A2%9C%E8%89%B2)
- [Five Color Theory](https://zh.wikipedia.org/wiki/%E4%BA%94%E8%A1%8C%E8%89%B2%E7%90%86%E8%AE%BA)
- [Color in Chinese Culture](https://zh.wikipedia.org/wiki/%E4%B8%AD%E5%9B%BD%E6%96%87%E5%8C%96%E4%B8%AD%E7%9A%84%E9%A2%9C%E8%89%B2)
