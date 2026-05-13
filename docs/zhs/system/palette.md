# Palette 调色板系统

中国传统色彩系统的 Rust 实现，提供 500+ 传统颜色定义、类型安全的工具类系统和主题色板管理。

## 目录

- [概述](#概述)
- [核心功能](#核心功能)
- [Colors 颜色定义](#colors-颜色定义)
- [ClassesBuilder 工具类系统](#classesbuilder-工具类系统)
- [Themes 主题色板](#themes-主题色板)
- [使用示例](#使用示例)
- [API 参考](#api-参考)

## 概述

`hikari-palette` 是 Hikari UI 框架的色彩基础，提供：

- **500+ 中国传统颜色**：完整的历史色彩定义，包含 hex、RGB、CMYK 值
- **类型安全的工具类**：编译时检查的 CSS 类名，避免拼写错误
- **预定义主题色板**：Hikari（浅色）和 Tairitsu（深色）主题
- **透明度支持**：颜色混合和透明度处理
- **文化深度**：每个颜色都带有历史典故和名称由来

## 核心功能

### Colors 颜色定义

提供 500+ 中国传统颜色的完整定义，按色系组织：

- **红色系 (28色)**：朱砂、绯红、胭脂、丹等
- **黄色系 (28色)**：藤黄、鹅黄、栀子、杏黄等
- **绿色系 (30色)**：葱倩、竹青、碧色、翡翠等
- **青色系 (30色)**：石青、靛蓝、天青、湖蓝等
- **紫色系 (20色)**：紫罗兰、丁香、藕荷、紫藤等
- **黑色系 (25色)**：墨色、玄色、皂色、乌黑等
- **白色系 (20色)**：月白、缟色、霜色、雪白等
- **灰色系 (20色)**：银色、苍色、烟色、灰等

### ClassesBuilder 工具类系统

类型安全的 CSS 工具类构建器，提供：

- **层级化组织**：Display、Layout、Spacing、Sizing、Typography 等
- **IDE 自动补全**：完整的类型提示
- **编译时检查**：避免类名拼写错误
- **`hi-` 前缀**：自动添加前缀避免冲突

### Themes 主题色板

预定义的主题配置：

- **Hikari（光）**：浅色主题，主色石青、次色朱砂、强调色藤黄
- **Tairitsu**：深色主题，主色靛蓝、次色朱砂、强调色鹅黄

## Colors 颜色定义

### 基础用法

```rust
use hikari_palette::{朱砂, 石青, 藤黄};

// 使用颜色常量
let red = 朱砂;
let blue = 石青;
let yellow = 藤黄;

// 获取颜色值
println!("朱砂: {}", red.hex);  // #E94B35
println!("RGB: {:?}", red.rgb); // (233, 75, 53)
println!("名称: {}", red.name);  // 朱砂
```

### 颜色结构

每个颜色包含完整的元数据：

```rust
pub struct ChineseColor {
    /// 颜色名称（中文）
    pub name: &'static str,
    /// 英文别名
    pub english: &'static str,
    /// HEX 颜色值
    pub hex: &'static str,
    /// RGB 元组
    pub rgb: (u8, u8, u8),
    /// CMYK 元组
    pub cmyk: (u8, u8, u8, u8),
    /// 历史典故
    pub history: &'static str,
}
```

### 透明度处理

```rust
use hikari_palette::{opacity, rgba, 朱砂};

// 添加透明度
let semi_red = opacity(朱砂, 0.5);
// 输出: "rgba(233, 75, 53, 0.5)"

// 转换为 RGBA
let rgba_str = rgba(朱砂, 0.8);
// 输出: "rgba(233, 75, 53, 0.8)"
```

### 颜色分类

所有颜色按色系分类组织：

```rust
// 红色系
use hikari_palette::colors::red::*;

// 黄色系
use hikari_palette::colors::yellow::*;

// 绿色系
use hikari_palette::colors::green::*;

// 青色系
use hikari_palette::colors::cyan::*;

// 紫色系
use hikari_palette::colors::purple::*;

// 黑色系
use hikari_palette::colors::black::*;

// 白色系
use hikari_palette::colors::white::*;

// 灰色系
use hikari_palette::colors::gray::*;
```

## ClassesBuilder 工具类系统

### 基础用法

```rust
use hikari_palette::{ClassesBuilder, classes::*};

// 构建类名字符串
let classes = ClassesBuilder::new()
    .add(Display::Flex)
    .add(FlexDirection::Row)
    .add(Gap::Gap4)
    .add(Padding::P4)
    .build();

// 输出: "hi-flex hi-flex-row hi-gap-4 hi-p-4"
```

### Display 类

控制元素的显示属性：

```rust
use hikari_palette::classes::Display;

let classes = ClassesBuilder::new()
    .add(Display::Block)      // hi-block
    .add(Display::Inline)     // hi-inline
    .add(Display::Flex)       // hi-flex
    .add(Display::Grid)       // hi-grid
    .add(Display::Hidden)     // hi-hidden
    .build();
```

### Layout 类

布局相关工具类：

```rust
use hikari_palette::classes::*;

let classes = ClassesBuilder::new()
    // Flexbox
    .add(FlexDirection::Row)     // hi-flex-row
    .add(FlexDirection::Col)     // hi-flex-col
    .add(JustifyContent::Center) // hi-justify-center
    .add(AlignItems::Center)     // hi-items-center
    // Position
    .add(Position::Relative)     // hi-relative
    .add(Position::Absolute)     // hi-absolute
    .add(Position::Fixed)        // hi-fixed
    .build();
```

### Spacing 类

间距工具类：

```rust
use hikari_palette::classes::*;

let classes = ClassesBuilder::new()
    // Padding
    .add(Padding::P0)    // hi-p-0
    .add(Padding::P2)    // hi-p-2
    .add(Padding::P4)    // hi-p-4
    .add(Padding::Px4)   // hi-px-4
    .add(Padding::Py2)   // hi-py-2
    // Margin
    .add(Margin::M0)     // hi-m-0
    .add(Margin::M2)     // hi-m-2
    .add(Margin::M4)     // hi-m-4
    // Gap
    .add(Gap::Gap2)      // hi-gap-2
    .add(Gap::Gap4)      // hi-gap-4
    .build();
```

### Typography 类

文字排版工具类：

```rust
use hikari_palette::classes::*;

let classes = ClassesBuilder::new()
    // Font size
    .add(FontSize::Xs)    // hi-text-xs
    .add(FontSize::Sm)    // hi-text-sm
    .add(FontSize::Base)  // hi-text-base
    .add(FontSize::Lg)    // hi-text-lg
    .add(FontSize::Xl)    // hi-text-xl
    // Font weight
    .add(FontWeight::Medium)  // hi-font-medium
    .add(FontWeight::Bold)    // hi-font-bold
    // Text align
    .add(TextAlign::Center)   // hi-text-center
    .add(TextAlign::Left)     // hi-text-left
    .build();
```

### Colors 类

颜色工具类：

```rust
use hikari_palette::classes::*;

let classes = ClassesBuilder::new()
    // Text colors
    .add(TextColor::Primary)    // hi-text-primary
    .add(TextColor::Secondary)  // hi-text-secondary
    .add(TextColor::White)      // hi-text-white
    // Background colors
    .add(BgColor::Primary)      // hi-bg-primary
    .add(BgColor::White)        // hi-bg-white
    .add(BgColor::Black)        // hi-bg-black
    .build();
```

### Effects 类

特效工具类：

```rust
use hikari_palette::classes::*;

let classes = ClassesBuilder::new()
    // Shadow
    .add(Shadow::Sm)    // hi-shadow-sm
    .add(Shadow::Md)    // hi-shadow-md
    .add(Shadow::Lg)    // hi-shadow-lg
    // Border radius
    .add(Radius::Sm)    // hi-radius-sm
    .add(Radius::Md)    // hi-radius-md
    .add(Radius::Lg)    // hi-radius-lg
    .build();
```

### Transitions 类

过渡动画工具类：

```rust
use hikari_palette::classes::*;

let classes = ClassesBuilder::new()
    // Transition properties
    .add(Transition::All)        // hi-transition-all
    .add(Transition::Colors)     // hi-transition-colors
    // Duration
    .add(Duration::Duration150)  // hi-duration-150
    .add(Duration::Duration300)  // hi-duration-300
    // Easing
    .add(Easing::EaseInOut)      // hi-ease-in-out
    .build();
```

## Themes 主题色板

### 主题结构

每个主题包含完整的颜色定义：

```rust
pub struct Palette {
    /// 主色
    pub primary: ChineseColor,
    /// 次色
    pub secondary: ChineseColor,
    /// 强调色
    pub accent: ChineseColor,
    /// 成功色
    pub success: ChineseColor,
    /// 警告色
    pub warning: ChineseColor,
    /// 危险色
    pub danger: ChineseColor,
    /// 背景色
    pub background: ChineseColor,
    /// 表面色
    pub surface: ChineseColor,
    /// 边框色
    pub border: ChineseColor,
    /// 主文本色
    pub text_primary: ChineseColor,
    /// 次文本色
    pub text_secondary: ChineseColor,
}
```

### Hikari 主题

浅色主题，清新的配色：

```rust
use hikari_palette::themes::Hikari;

let theme = Hikari::palette();

// 主色：石青 (#1759A8)
println!("主色: {}", theme.primary.hex);

// 次色：朱砂 (#E94B35)
println!("次色: {}", theme.secondary.hex);

// 强调色：藤黄 (#F8B62D)
println!("强调色: {}", theme.accent.hex);
```

### Tairitsu 主题

深色主题，适合夜间使用：

```rust
use hikari_palette::themes::Tairitsu;

let theme = Tairitsu::palette();

// 主色：靛蓝 (#1a237e)
println!("主色: {}", theme.primary.hex);

// 次色：朱砂 (#E94B35)
println!("次色: {}", theme.secondary.hex);

// 强调色：鹅黄 (#FFF176)
println!("强调色: {}", theme.accent.hex);
```

### 自定义主题

创建自定义主题配置：

```rust
use hikari_palette::{ChineseColor, Palette};

let custom_theme = Palette {
    primary: ChineseColor::石青,
    secondary: ChineseColor::朱砂,
    accent: ChineseColor::藤黄,
    success: ChineseColor::葱倩,
    warning: ChineseColor::鹅黄,
    danger: ChineseColor::朱砂,
    background: ChineseColor::月白,
    surface: ChineseColor::缟色,
    border: ChineseColor::银色,
    text_primary: ChineseColor::墨色,
    text_secondary: ChineseColor::苍色,
};
```

## 使用示例

### 在 Dioxus 组件中使用

```rust
use dioxus::prelude::*;
use hikari_palette::{ClassesBuilder, classes::*};

#[component]
fn MyComponent() -> Element {
    let container_classes = ClassesBuilder::new()
        .add(Display::Flex)
        .add(FlexDirection::Column)
        .add(Gap::Gap4)
        .add(Padding::P6)
        .build();

    rsx! {
        div { class: "{container_classes}",
            h1 { "欢迎使用 Hikari" }
            p { "传统与现代的完美融合" }
        }
    }
}
```

### 响应式类名

```rust
use hikari_palette::{ClassesBuilder, classes::*};

let responsive_classes = ClassesBuilder::new()
    .add(Display::Flex)
    .add(FlexDirection::Col)        // 移动端垂直
    // 桌面端改为水平
    .build();
```

### 条件类名

```rust
use hikari_palette::{ClassesBuilder, classes::*};

fn get_button_classes(is_disabled: bool, is_loading: bool) -> String {
    let mut builder = ClassesBuilder::new()
        .add(Display::Inline)
        .add(Padding::Px4)
        .add(Padding::Py2);

    if is_disabled {
        builder = builder.add(Opacity::Opacity50);
    }

    if is_loading {
        builder = builder.add(Cursor::Wait);
    }

    builder.build()
}
```

### 组合使用

```rust
use hikari_palette::{ClassesBuilder, classes::*};

// 组合多个工具类
let card_classes = ClassesBuilder::new()
    // 布局
    .add(Display::Flex)
    .add(FlexDirection::Column)
    // 间距
    .add(Padding::P6)
    .add(Gap::Gap4)
    // 颜色
    .add(BgColor::Surface)
    .add(TextColor::Primary)
    // 效果
    .add(Radius::Lg)
    .add(Shadow::Md)
    // 过渡
    .add(Transition::All)
    .add(Duration::Duration300)
    .build();

// 输出: "hi-flex hi-flex-col hi-p-6 hi-gap-4 hi-bg-surface hi-text-primary hi-radius-lg hi-shadow-md hi-transition-all hi-duration-300"
```

## API 参考

### 类型定义

#### `ChineseColor`

单个中国传统颜色的定义。

```rust
pub struct ChineseColor {
    pub name: &'static str,
    pub english: &'static str,
    pub hex: &'static str,
    pub rgb: (u8, u8, u8),
    pub cmyk: (u8, u8, u8, u8),
    pub history: &'static str,
}
```

#### `Palette`

主题色板配置。

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

#### `ClassesBuilder`

工具类构建器。

```rust
pub struct ClassesBuilder {
    classes: Vec<String>,
}

impl ClassesBuilder {
    pub fn new() -> Self;
    pub fn add(mut self, class: impl UtilityClass) -> Self;
    pub fn add_optional(mut self, class: Option<impl UtilityClass>) -> Self;
    pub fn add_many(mut self, classes: Vec<impl UtilityClass>) -> Self;
    pub fn extend(mut self, classes: Vec<String>) -> Self;
    pub fn build(self) -> String;
}
```

#### `UtilityClass`

工具类的基础 trait。

```rust
pub trait UtilityClass {
    fn as_suffix(&self) -> &'static str;
    fn as_class(&self) -> String;
    fn as_classes(&self) -> Vec<String>;
}
```

### 辅助函数

#### `opacity`

为颜色添加透明度。

```rust
pub fn opacity(color: ChineseColor, alpha: f64) -> String
```

#### `rgba`

转换颜色为 RGBA 字符串。

```rust
pub fn rgba(color: ChineseColor, alpha: f64) -> String
```

### 主题实现

#### `Hikari`

浅色主题。

```rust
pub struct Hikari;

impl Hikari {
    pub fn palette() -> Palette;
}
```

#### `Tairitsu`

深色主题。

```rust
pub struct Tairitsu;

impl Tairitsu {
    pub fn palette() -> Palette;
}
```

## 设计理念

### 文化自信

使用中国传统颜色名称，每个颜色都承载着历史文化：

- **朱砂**：古代书画颜料，象征吉祥
- **石青**：矿物颜料，沉稳大气
- **藤黄**：植物颜料，明快温暖
- **月白**：淡雅的白色，如月光般柔和

### 类型安全

通过 Rust 的类型系统保证：

- **编译时检查**：避免拼写错误
- **IDE 支持**：自动补全和重构
- **重构安全**：修改会自动传播

### 性能优先

- **零成本抽象**：编译时优化
- **零运行时开销**：所有计算在编译时完成
- **最小化代码体积**：只包含使用的颜色

## 下一步

- [Theme 主题系统](./theme.md) - 使用 Palette 配置主题
- [Components 组件](../components/) - 使用颜色的 UI 组件
- [Classes 工具类参考](./classes.md) - 完整的工具类列表
