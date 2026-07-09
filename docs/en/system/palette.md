# Palette System

Traditional Chinese color system implementation with 660+ historical colors.

## Table of Contents

- [Overview](#overview)
- [Colors](#colors)
- [ClassesBuilder](#classesbuilder-utility-class-generator)
- [Themes](#themes)
- [Opacity & Blending](#opacity--blending)
- [API Reference](#api-reference)

## Overview

`hikari-palette` provides:

- **660+ Colors** - Complete traditional Chinese color definitions
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
use hikari_palette::Color;

// Access colors using enum variants
let green = Color::苍翠;
let pink = Color::粉红;
let yellow = Color::姜黄;

println!("Green (苍翠): {}", green.hex());  // #519A73
println!("Pink (粉红): {}", pink.hex()); // #FFB3A7
println!("Yellow (姜黄): {}", yellow.hex()); // #FFC773
```

### Available Color Categories

#### Green Series (绿色系)

```rust
// Traditional green colors
Color::苍翠      // 苍翠 #519A73 - Verdant green
Color::Vermilion     // 朱红 #FF4C00 - Bright red-orange
Color::Crimson       // 绯红 #FF3030 - Deep crimson
Color::PeachBlossom  // 桃红 #F6BEC8 - Peach pink
Color::RoseRed       // 玫瑰红 #C21F30 - Rose red
```

#### Blue Series (蓝色系)

```rust
// Traditional blue colors
Color::IndigoBlue // 靛蓝 #144A74 - Indigo blue
Color::鷃蓝        // 鷃蓝 #144A74 - Indigo blue
Color::Cyan          // 青色 #00CED1 - Cyan
Color::SkyBlue       // 天蓝 #87CEEB - Sky blue
Color::Turquoise     // 绿松石 #40E0D0 - Turquoise
```

#### Yellow Series (黄色系)

```rust
// Traditional yellow colors
Color::姜黄    // 姜黄 #FFC773 - Gamboge yellow
Color::姜黄   // 姜黄 #FFC773 - Light yellow
Color::Golden        // 金色 #FFD700 - Gold
Color::Amber         // 琥珀 #FFBF00 - Amber
```

#### Green Series (绿色系)

```rust
// Traditional green colors
Color::ScallionGreen // 葱倩 #4CAF50 - Scallion green
Color::BambooGreen  // 竹青 #789262 - Bamboo green
Color::Jade          // 玉色 #A0E6DA - Jade green
Color::Emerald       // 翡翠 #50C878 - Emerald green
```

#### Neutral Series (中性色系)

```rust
// Traditional neutral colors
Color::InkBlack      // 墨色 #1A1A2E - Ink black
Color::MoonWhite     // 月白 #F5F5F5 - Moon white
Color::LightGray     // 缟色 #E0E0E0 - Light gray
Color::AshGray       // 灰色 #808080 - Ash gray
```

### Color Properties

Each color provides:

```rust
let color = Color::粉红;

// Get hex value
let hex = color.hex();  // "#FFB3A7"

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

println!("Primary: {}", hikari.primary.hex());   // #FFB3A7
println!("Secondary: {}", hikari.secondary.hex()); // #519A73
println!("Accent: {}", hikari.accent.hex());     // #FFC773
println!("Background: {}", hikari.background.hex()); // #FFFFFF
println!("Surface: {}", hikari.surface.hex());   // #F5F5F5
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

println!("Primary: {}", tairitsu.primary.hex());   // #144A74
println!("Secondary: {}", tairitsu.secondary.hex()); // #519A73
println!("Accent: {}", tairitsu.accent.hex());     // #FFC773
println!("Background: {}", tairitsu.background.hex()); // #161823
println!("Surface: {}", tairitsu.surface.hex());   // rgb(32,35,54)
```

**Color Scheme**:
- Primary: Indigo (靛蓝) - Deep indigo blue
- Secondary: Cinnabar (朱砂) - Energetic red-orange
- Accent: Goose Yellow (鹅黄) - Bright pale yellow
- Background: Deep dark gray
- Surface: Slightly lighter dark gray

### Custom Theme

```rust
use hikari_palette::{ThemePalette, Color};

let custom = ThemePalette {
    primary: Color::Crimson,
    secondary: Color::姜黄,
    accent: Color::粉红,
    background: Color::InkBlack,
    surface: Color::MoonWhite,
    success: Color::ScallionGreen,
    warning: Color::姜黄,
    danger: Color::苍翠,
};
```

### Theme Structure

```rust
pub struct ThemePalette {
    pub primary: Color,
    pub secondary: Color,
    pub accent: Color,
    pub background: Color,
    pub surface: Color,
    pub success: Color,
    pub warning: Color,
    pub danger: Color,
    pub text_primary: Color,
    pub text_secondary: Color,
    pub border: Color,
}
```

## Opacity & Blending

Color transparency and blending utilities.

### Opacity Function

```rust
use hikari_palette::{Color, opacity};

let color = Color::粉红;
let semi_blue = opacity(color, 0.5);

// Output: "rgba(0, 160, 233, 0.5)"
```

### Blend Function

```rust
use hikari_palette::{Color, blend};

let color1 = Color::粉红;
let color2 = Color::苍翠;
let blended = blend(color1, color2, 0.5);

// Blends 50% of each color
```

### Color Lightening

```rust
use hikari_palette::{Color, lighten};

let color = Color::InkBlack;
let lighter = lighten(color, 0.2);

// Lightens by 20%
```

### Color Darkening

```rust
use hikari_palette::{Color, darken};

let color = Color::MoonWhite;
let darker = darken(color, 0.3);

// Darkens by 30%
```

## Integration Examples

### With ThemeProvider

```rust
use hikari_theme::ThemeProvider;
use hikari_palette::themes;

#[component]
fn App() -> Element {
    let hikari = themes::Hikari::palette();

    rsx! {
        ThemeProvider { initial_palette: "hikari".to_string() }
            div {
                style: "color: {hikari.primary.hex()}",
                "Themed text"
            }
        }
    }
}
```

### With Components

```rust
use hikari_components::Button;
use hikari_palette::Color;

rsx! {
    Button {
        variant: "primary",
        style: format!("background: {}", Color::粉红.hex()),
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

### Color

```rust
pub enum Color {
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

    // ... 660+ more colors
}

impl Color {
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
    pub primary: Color,
    pub secondary: Color,
    pub accent: Color,
    pub background: Color,
    pub surface: Color,
    pub success: Color,
    pub warning: Color,
    pub danger: Color,
    pub text_primary: Color,
    pub text_secondary: Color,
    pub border: Color,
}
```

### Color Utilities

```rust
pub fn opacity(color: Color, alpha: f64) -> String;
pub fn blend(color1: Color, color2: Color, factor: f64) -> String;
pub fn lighten(color: Color, amount: f64) -> String;
pub fn darken(color: Color, amount: f64) -> String;
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
let color = Color::粉红;

// ❌ Avoid - String-based
let color = "#FFB3A7";
```

### 2. Leverage Theme Palettes

```rust
// ✅ Good - Use theme palette
let palette = themes::Hikari::palette();
let primary = palette.primary;

// ❌ Avoid - Hardcoded colors
let primary = "#FFB3A7";
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
let button_color = Color::粉红;
let error_color = Color::苍翠;
```

## Related Systems

- [Theme System](./theme.md) - Theme context and CSS variables
- [Components](../components/) - Component library using palettes

## Resources

- [Traditional Chinese Colors](https://zh.wikipedia.org/wiki/%E4%B8%AD%E5%9B%BD%E4%BC%A0%E7%BB%9F%E9%A2%9C%E8%89%B2)
- [Five Color Theory](https://zh.wikipedia.org/wiki/%E4%BA%94%E8%A1%8C%E8%89%B2%E7%90%86%E8%AE%BA)
- [Color in Chinese Culture](https://zh.wikipedia.org/wiki/%E4%B8%AD%E5%9B%BD%E6%96%87%E5%8C%96%E4%B8%AD%E7%9A%84%E9%A2%9C%E8%89%B2)
