# Palette 調色板系統

中國傳統色彩系統實作，包含 500+ 歷史顏色。

## 目錄

- [概述](#概述)
- [Colors 顏色](#colors-顏色)
- [ClassesBuilder 工具類生成器](#classesbuilder-工具類生成器)
- [Themes 主題](#themes-主題)
- [Opacity & Blending 透明度和混合](#opacity--blending-透明度和混合)
- [API 參考](#api-參考)

## 概述

`hikari-palette` 提供：

- **500+ 顏色** - 完整的中國傳統色彩定義
- **型別安全** - 編譯時期顏色值檢查
- **工具類** - 型別安全的 Tailwind 風格工具類建構器
- **主題調色板** - 預配置的主題色彩方案
- **透明度支援** - 顏色透明度和混合

所有顏色定義都具備：

- **文化遺產** - 傳統中國顏色名稱
- **型別安全** - 基於枚舉的顏色定義
- **十六進位值** - 標準的十六進位顏色代碼
- **分類** - 按顏色家族組織

## Colors 顏色

### 基礎用法

```rust
use hikari_palette::ChineseColor;

// 使用枚舉變體訪問顏色
let red = ChineseColor::朱砂;
let blue = ChineseColor::石青;
let yellow = ChineseColor::藤黃;

println!("Red: {}", red.hex());  // #E94B35
println!("Blue: {}", blue.hex()); // #00A0E9
println!("Yellow: {}", yellow.hex()); // #F8B62D
```

### 可用顏色分類

#### 紅色系（紅色系）

```rust
// 傳統紅色
ChineseColor::朱砂      // #E94B35 - 朱砂紅
ChineseColor::朱紅      // #FF4C00 - 鮮紅橙
ChineseColor::緋紅      // #FF3030 - 深緋紅
ChineseColor::桃紅      // #F6BEC8 - 桃花粉紅
ChineseColor::玫瑰紅    // #C21F30 - 玫瑰紅
```

#### 藍色系（藍色系）

```rust
// 傳統藍色
ChineseColor::石青      // #00A0E9 - 石青藍
ChineseColor::靛藍      // #1a237e - 靛藍
ChineseColor::青色      // #00CED1 - 青色
ChineseColor::天藍      // #87CEEB - 天藍
ChineseColor::綠松石    // #40E0D0 - 綠松石
```

#### 黃色系（黃色系）

```rust
// 傳統黃色
ChineseColor::藤黃      // #F8B62D - 藤黃
ChineseColor::鵝黃      // #FFF176 - 鵝黃
ChineseColor::金色      // #FFD700 - 金色
ChineseColor::琥珀      // #FFBF00 - 琥珀
```

#### 綠色系（綠色系）

```rust
// 傳統綠色
ChineseColor::葱倩      // #4CAF50 - 葱倩綠
ChineseColor::竹青      // #789262 - 竹青
ChineseColor::玉色      // #A0E6DA - 玉色
ChineseColor::翡翠      // #50C878 - 翡翠綠
```

#### 中性色系（中性色系）

```rust
// 傳統中性色
ChineseColor::墨色      // #1A1A2E - 墨黑
ChineseColor::月白      // #F5F5F5 - 月白
ChineseColor::縞色      // #E0E0E0 - 縞色
ChineseColor::灰色      // #808080 - 灰色
```

### 顏色屬性

每個顏色都提供：

```rust
let color = ChineseColor::石青;

// 獲取十六進位值
let hex = color.hex();  // "#00A0E9"

// 獲取 RGB 值
let rgb = color.rgb();  // (0, 160, 233)

// 獲取顏色名稱
let name = color.name();  // "石青"

// 獲取英文名稱
let english_name = color.english_name();  // "Azurite"
```

## ClassesBuilder 工具類生成器

型別安全的工具類生成器，用於生成 Tailwind CSS 風格的類別。

### 基礎用法

```rust
use hikari_palette::{ClassesBuilder, classes::*};

let classes = ClassesBuilder::new()
    .add(Display::Flex)
    .add(FlexDirection::Row)
    .add(Gap::Gap4)
    .build();

// 輸出: "hi-flex hi-flex-row hi-gap-4"
```

### 可用工具類

#### Display 顯示類

```rust
use hikari_palette::classes::Display;

Display::Block      // "hi-block"
Display::Flex       // "hi-flex"
Display::Grid       // "hi-grid"
Display::Hidden     // "hi-hidden"
```

#### Flexbox 彈性盒類

```rust
use hikari_palette::classes::{FlexDirection, AlignItems, JustifyContent};

FlexDirection::Row        // "hi-flex-row"
FlexDirection::Column     // "hi-flex-column"
AlignItems::Center        // "hi-items-center"
AlignItems::Stretch       // "hi-items-stretch"
JustifyContent::Center    // "hi-justify-center"
JustifyContent::Between   // "hi-justify-between"
```

#### Spacing 間距類

```rust
use hikari_palette::classes::{Padding, Margin, Gap};

Padding::P4        // "hi-p-4"
Padding::Px8       // "hi-px-8"
Margin::M4         // "hi-m-4"
Margin::MyAuto     // "hi-my-auto"
Gap::Gap4          // "hi-gap-4"
```

#### Color 顏色類

```rust
use hikari_palette::classes::{TextColor, BackgroundColor};

TextColor::Primary       // "hi-text-primary"
TextColor::Secondary     // "hi-text-secondary"
BackgroundColor::Primary // "hi-bg-primary"
BackgroundColor::Surface // "hi-bg-surface"
```

#### Typography 排版類

```rust
use hikari_palette::classes::{FontSize, FontWeight};

FontSize::Base       // "hi-text-base"
FontSize::XL         // "hi-text-xl"
FontSize::2XL        // "hi-text-2xl"
FontWeight::Normal   // "hi-font-normal"
FontWeight::Bold     // "hi-font-bold"
```

#### Border 邊框類

```rust
use hikari_palette::classes::{Border, BorderRadius};

Border::B            // "hi-border"
Border::B2           // "hi-border-2"
BorderRadius::Md     // "hi-rounded-md"
BorderRadius::Full   // "hi-rounded-full"
```

### 組合使用類

```rust
use hikari_palette::{ClassesBuilder, classes::*};

// 複雜元件樣式
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

// 輸出: "hi-flex hi-items-center hi-justify-center hi-px-4 hi-py-2 hi-rounded-md hi-bg-primary hi-text-white"
```

### 型別安全優勢

```rust
// ✅ 型別安全 - 編譯時檢查
let classes = ClassesBuilder::new()
    .add(Display::Flex)
    .add(FlexDirection::Row)
    .build();

// ❌ 無法編譯 - 拼寫保護
let classes = ClassesBuilder::new()
    .add(Display::Flx)  // 編譯錯誤!
    .build();
```

## Themes 主題

預配置的主題調色板。

### Hikari 主題（淺色）

```rust
use hikari_palette::themes;

let hikari = themes::Hikari::palette();

println!("Primary: {}", hikari.primary.hex);   // #00A0E9
println!("Secondary: {}", hikari.secondary.hex); // #E94B35
println!("Accent: {}", hikari.accent.hex);     // #F8B62D
println!("Background: {}", hikari.background.hex); // #FFFFFF
println!("Surface: {}", hikari.surface.hex);   // #F5F5F5
```

**色彩方案**:
- Primary: 石青 (Azurite) - 清新青藍
- Secondary: 朱砂 (Cinnabar) - 充滿活力的紅橙
- Accent: 藤黃 (Vine Yellow) - 溫暖的金黃
- Background: 月白 (Moon White) - 潔白的白色
- Surface: 帶有淡色調的淺灰

### Tairitsu 主題（深色）

```rust
use hikari_palette::themes;

let tairitsu = themes::Tairitsu::palette();

println!("Primary: {}", tairitsu.primary.hex);   // #1a237e
println!("Secondary: {}", tairitsu.secondary.hex); // #E94B35
println!("Accent: {}", tairitsu.accent.hex);     // #FFF176
println!("Background: {}", tairitsu.background.hex); // #0D1117
println!("Surface: {}", tairitsu.surface.hex);   // #161B22
```

**色彩方案**:
- Primary: 靛藍 (Indigo) - 深靛藍
- Secondary: 朱砂 (Cinnabar) - 充滿活力的紅橙
- Accent: 鵝黃 (Goose Yellow) - 明亮的淡黃
- Background: 深灰
- Surface: 稍淺的深灰

### 自訂主題

```rust
use hikari_palette::{ThemePalette, ChineseColor};

let custom = ThemePalette {
    primary: ChineseColor::緋紅,
    secondary: ChineseColor::藤黃,
    accent: ChineseColor::石青,
    background: ChineseColor::墨色,
    surface: ChineseColor::月白,
    success: ChineseColor::葱倩,
    warning: ChineseColor::鵝黃,
    danger: ChineseColor::朱砂,
};
```

### 主題結構

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

## Opacity & Blending 透明度和混合

顏色透明度和混合工具。

### Opacity 函數

```rust
use hikari_palette::{ChineseColor, opacity};

let color = ChineseColor::石青;
let semi_blue = opacity(color, 0.5);

// 輸出: "rgba(0, 160, 233, 0.5)"
```

### Blend 混合函數

```rust
use hikari_palette::{ChineseColor, blend};

let color1 = ChineseColor::石青;
let color2 = ChineseColor::朱砂;
let blended = blend(color1, color2, 0.5);

// 混合 50% 的每個顏色
```

### Lighten 提亮

```rust
use hikari_palette::{ChineseColor, lighten};

let color = ChineseColor::墨色;
let lighter = lighten(color, 0.2);

// 提亮 20%
```

### Darken 變暗

```rust
use hikari_palette::{ChineseColor, darken};

let color = ChineseColor::月白;
let darker = darken(color, 0.3);

// 變暗 30%
```

## 整合示例

### 與 ThemeProvider 整合

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
                "主題文字"
            }
        }
    }
}
```

### 與 Components 整合

```rust
use hikari_components::Button;
use hikari_palette::ChineseColor;

rsx! {
    Button {
        variant: "primary",
        style: format!("background: {}", ChineseColor::石青.hex()),
        "自訂按鈕"
    }
}
```

### 與 Utility Classes 整合

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
        "卡片內容"
    }
}
```

## API 參考

### ChineseColor

```rust
pub enum ChineseColor {
    // Red series
    朱砂,      // Cinnabar
    朱紅,     // Vermilion
    緋紅,      // Crimson

    // Blue series
    石青,      // Azurite
    靛藍,       // Indigo
    青色,       // Cyan

    // Yellow series
    藤黃,     // Vine Yellow
    鵝黃,     // Goose Yellow

    // Green series
    葱倩,     // Scallion Green
    竹青,       // Bamboo Green
    玉色,        // Jade

    // Neutral series
    墨色,       // Ink Black
    月白,       // Moon White
    縞色,        // Light Gray

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

## 設計理念

### 文化意義

每個中國傳統顏色都承載著文化和歷史含義：

- **朱砂**: 用於皇室印信，代表權力和威嚴
- **石青**: 用於傳統繪畫，代表優雅
- **藤黃**: 傳統繪畫顏料，溫暖與活力
- **墨色**: 書法墨水，代表知識與深度
- **月白**: 淡藍白色，代表純潔

### 色彩和諧

中國傳統色彩組合遵循特定的和諧原則：

- **互補色**: 紅 + 綠 (朱砂 + 竹青)
- **類似色**: 藍 + 青 (石青 + 青色)
- **三角色**: 紅 + 黃 + 藍 (朱砂 + 藤黃 + 石青)

## 最佳實踐

### 1. 使用 Enum 實現型別安全

```rust
// ✅ 好 - 型別安全
let color = ChineseColor::石青;

// ❌ 避免 - 基於字串
let color = "#00A0E9";
```

### 2. 利用主題調色板

```rust
// ✅ 好 - 使用主題調色板
let palette = themes::Hikari::palette();
let primary = palette.primary;

// ❌ 避免 - 硬編碼顏色
let primary = "#00A0E9";
```

### 3. 使用工具類

```rust
// ✅ 好 - 型別安全的工具類
let classes = ClassesBuilder::new()
    .add(Display::Flex)
    .add(Gap::Gap4)
    .build();

// ✅ 可接受 - 基於字串（型別安全性較低）
let classes = "hi-flex hi-gap-4";
```

### 4. 語義化顏色命名

```rust
// ✅ 好 - 語義化使用
let button_color = theme.palette.primary;
let error_color = theme.palette.danger;

// ❌ 避免 - 直接引用顏色
let button_color = ChineseColor::石青;
let error_color = ChineseColor::朱砂;
```

## 相關系統

- [Theme System](./theme.md) - 主題上下文和 CSS 變數
- [Components](../components/) - 使用調色板的元件庫
- [Builder System](./builder.md) - 使用調色板變數的 SCSS 編譯

## 參考資源

- [中國傳統色](https://zh.wikipedia.org/wiki/%E4%B8%AD%E5%9B%BD%E4%BC%A0%E7%BB%9F%E9%A2%9C%E8%89%B2)
- [五行色理論](https://zh.wikipedia.org/wiki/%E4%BA%94%E8%A1%8C%E8%89%B2%E7%90%86%E8%AE%BA)
- [中國文化中的顏色](https://zh.wikipedia.org/wiki/%E4%B8%AD%E5%9C%8B%E6%96%87%E5%8C%96%E4%B8%AD%E7%9A%84%E9%A1%8F%E8%89%B2)
