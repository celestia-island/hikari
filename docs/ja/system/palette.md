# パレットシステム

500以上の歴史的な色を持つ中国传统色システムの実装。

## 目次

- [概要](#概要)
- [色](#色)
- [ClassesBuilder](#classesbuilder-ユーティリティクラスジェネレーター)
- [テーマ](#テーマ)
- [不透明度とブレンド](#不透明度とブレンド)
- [APIリファレンス](#apiリファレンス)

## 概要

`hikari-palette`は以下を提供します：

- **500以上の色** - 完全な中国传统色の定義
- **タイプセーフ** - コンパイル時の色値チェック
- **ユーティリティクラス** - タイプセーフなTailwindスタイルのユーティリティクラスビルダー
- **テーマパレット** - 事前設定されたテーマカラースキーム
- **不透明度サポート** - 色の透明度とブレンド

すべての色定義には以下の特徴があります：

- **文化的遺産** - 中国传统色の名前
- **タイプセーフ** - 列挙型ベースの色定義
- **16進数値** - 標準的な16進数カラーコード
- **カテゴリ** - 色ファミリー別に整理

## 色

### 基本的な使い方

```rust
use hikari_palette::ChineseColor;

// 列挙型バリアントを使用して色にアクセス
let red = ChineseColor::Cinnabar;
let blue = ChineseColor::Azurite;
let yellow = ChineseColor::VineYellow;

println!("赤: {}", red.hex());  // #E94B35
println!("青: {}", blue.hex()); // #00A0E9
println!("黄: {}", yellow.hex()); // #F8B62D
```

### 利用可能な色カテゴリ

#### 赤色系（红色系）

```rust
// 中国传统の赤色
ChineseColor::Cinnabar      // 朱砂 #E94B35 - 朱
ChineseColor::Vermilion     // 朱红 #FF4C00 - 明るい赤橙
ChineseColor::Crimson       // 绯红 #FF3030 - 深い緋色
ChineseColor::PeachBlossom  // 桃红 #F6BEC8 - 桃色
ChineseColor::RoseRed       // 玫瑰红 #C21F30 - バラ色
```

#### 青色系（蓝色系）

```rust
// 中国传统の青色
ChineseColor::Azurite       // 石青 #00A0E9 - 藍銅鉱色
ChineseColor::Indigo        // 靛蓝 #1a237e - インジゴ
ChineseColor::Cyan          // 青色 #00CED1 - シアン
ChineseColor::SkyBlue       // 天蓝 #87CEEB - 空色
ChineseColor::Turquoise     // 绿松石 #40E0D0 - ターコイズ
```

#### 黄色系（黄色系）

```rust
// 中国传统の黄色
ChineseColor::VineYellow    // 藤黄 #F8B62D - 藤黄色
ChineseColor::GooseYellow   // 鹅黄 #FFF176 - 薄黄色
ChineseColor::Golden        // 金色 #FFD700 - 金色
ChineseColor::Amber         // 琥珀 #FFBF00 - 琥珀色
```

#### 緑色系（绿色系）

```rust
// 中国传统の緑色
ChineseColor::ScallionGreen // 葱倩 #4CAF50 - ネギ色
ChineseColor::BambooGreen  // 竹青 #789262 - 竹青色
ChineseColor::Jade          // 玉色 #A0E6DA - 玉色
ChineseColor::Emerald       // 翡翠 #50C878 - エメラルド
```

#### ニュートラル系（中性色系）

```rust
// 中国传统のニュートラル色
ChineseColor::InkBlack      // 墨色 #1A1A2E - 墨色
ChineseColor::MoonWhite     // 月白 #F5F5F5 - 月白色
ChineseColor::LightGray     // 缟色 #E0E0E0 - 薄灰色
ChineseColor::AshGray       // 灰色 #808080 - 灰色
```

### 色のプロパティ

各色は以下を提供します：

```rust
let color = ChineseColor::Azurite;

// 16進数値を取得
let hex = color.hex();  // "#00A0E9"

// RGB値を取得
let rgb = color.rgb();  // (0, 160, 233)

// 色名を取得
let name = color.name();  // "石青"

// 英語名を取得
let english_name = color.english_name();  // "Azurite"
```

## ClassesBuilder

Tailwind CSSのようなクラスのためのタイプセーフなユーティリティクラスジェネレーター。

### 基本的な使い方

```rust
use hikari_palette::{ClassesBuilder, classes::*};

let classes = ClassesBuilder::new()
    .add(Display::Flex)
    .add(FlexDirection::Row)
    .add(Gap::Gap4)
    .build();

// 出力: "hi-flex hi-flex-row hi-gap-4"
```

### 利用可能なユーティリティクラス

#### 表示クラス

```rust
use hikari_palette::classes::Display;

Display::Block      // "hi-block"
Display::Flex       // "hi-flex"
Display::Grid       // "hi-grid"
Display::Hidden     // "hi-hidden"
```

#### フレックスボックスクラス

```rust
use hikari_palette::classes::{FlexDirection, AlignItems, JustifyContent};

FlexDirection::Row        // "hi-flex-row"
FlexDirection::Column     // "hi-flex-column"
AlignItems::Center        // "hi-items-center"
AlignItems::Stretch       // "hi-items-stretch"
JustifyContent::Center    // "hi-justify-center"
JustifyContent::Between   // "hi-justify-between"
```

#### スペーシングクラス

```rust
use hikari_palette::classes::{Padding, Margin, Gap};

Padding::P4        // "hi-p-4"
Padding::Px8       // "hi-px-8"
Margin::M4         // "hi-m-4"
Margin::MyAuto     // "hi-my-auto"
Gap::Gap4          // "hi-gap-4"
```

#### カラークラス

```rust
use hikari_palette::classes::{TextColor, BackgroundColor};

TextColor::Primary       // "hi-text-primary"
TextColor::Secondary     // "hi-text-secondary"
BackgroundColor::Primary // "hi-bg-primary"
BackgroundColor::Surface // "hi-bg-surface"
```

#### タイポグラフィクラス

```rust
use hikari_palette::classes::{FontSize, FontWeight};

FontSize::Base       // "hi-text-base"
FontSize::XL         // "hi-text-xl"
FontSize::2XL        // "hi-text-2xl"
FontWeight::Normal   // "hi-font-normal"
FontWeight::Bold     // "hi-font-bold"
```

#### ボーダークラス

```rust
use hikari_palette::classes::{Border, BorderRadius};

Border::B            // "hi-border"
Border::B2           // "hi-border-2"
BorderRadius::Md     // "hi-rounded-md"
BorderRadius::Full   // "hi-rounded-full"
```

### クラスの組み合わせ

```rust
use hikari_palette::{ClassesBuilder, classes::*};

// 複雑なコンポーネントスタイリング
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

// 出力: "hi-flex hi-items-center hi-justify-center hi-px-4 hi-py-2 hi-rounded-md hi-bg-primary hi-text-white"
```

### タイプセーフの利点

```rust
// ✅ タイプセーフ - コンパイル時チェック
let classes = ClassesBuilder::new()
    .add(Display::Flex)
    .add(FlexDirection::Row)
    .build();

// ❌ コンパイルエラー - タイプミス防止
let classes = ClassesBuilder::new()
    .add(Display::Flx)  // コンパイルエラー！
    .build();
```

## テーマ

事前設定されたテーマパレット。

### Hikariテーマ（ライト）

```rust
use hikari_palette::themes;

let hikari = themes::Hikari::palette();

println!("プライマリ: {}", hikari.primary.hex);   // #00A0E9
println!("セカンダリ: {}", hikari.secondary.hex); // #E94B35
println!("アクセント: {}", hikari.accent.hex);     // #F8B62D
println!("背景: {}", hikari.background.hex); // #FFFFFF
println!("表面: {}", hikari.surface.hex);   // #F5F5F5
```

**カラースキーム**：
- プライマリ：石青 - 新鮮なシアンブルー
- セカンダリ：朱砂 - 活力ある赤橙
- アクセント：藤黄 - 温かみのある黄金色
- 背景：月白 - クリーンな白
- 表面：微妙な色合いの薄灰色

### Tairitsuテーマ（ダーク）

```rust
use hikari_palette::themes;

let tairitsu = themes::Tairitsu::palette();

println!("プライマリ: {}", tairitsu.primary.hex);   // #1a237e
println!("セカンダリ: {}", tairitsu.secondary.hex); // #E94B35
println!("アクセント: {}", tairitsu.accent.hex);     // #FFF176
println!("背景: {}", tairitsu.background.hex); // #0D1117
println!("表面: {}", tairitsu.surface.hex);   // #161B22
```

**カラースキーム**：
- プライマリ：靛蓝 - 深いインディゴブルー
- セカンダリ：朱砂 - 活力ある赤橙
- アクセント：鹅黄 - 明るい淡黄色
- 背景：深いダークグレー
- 表面：わずかに明るいダークグレー

### カスタムテーマ

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

### テーマ構造

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

## 不透明度とブレンド

色の透明度とブレンドユーティリティ。

### 不透明度関数

```rust
use hikari_palette::{ChineseColor, opacity};

let color = ChineseColor::Azurite;
let semi_blue = opacity(color, 0.5);

// 出力: "rgba(0, 160, 233, 0.5)"
```

### ブレンド関数

```rust
use hikari_palette::{ChineseColor, blend};

let color1 = ChineseColor::Azurite;
let color2 = ChineseColor::Cinnabar;
let blended = blend(color1, color2, 0.5);

// 各色を50%ずつブレンド
```

### 色の明るくする

```rust
use hikari_palette::{ChineseColor, lighten};

let color = ChineseColor::InkBlack;
let lighter = lighten(color, 0.2);

// 20%明るくする
```

### 色の暗くする

```rust
use hikari_palette::{ChineseColor, darken};

let color = ChineseColor::MoonWhite;
let darker = darken(color, 0.3);

// 30%暗くする
```

## 統合例

### ThemeProviderとの使用

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
                "テーマ適用テキスト"
            }
        }
    }
}
```

### コンポーネントとの使用

```rust
use hikari_components::Button;
use hikari_palette::ChineseColor;

rsx! {
    Button {
        variant: "primary",
        style: format!("background: {}", ChineseColor::Azurite.hex()),
        "カスタムボタン"
    }
}
```

### ユーティリティクラスとの使用

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
        "カードコンテンツ"
    }
}
```

## APIリファレンス

### ChineseColor

```rust
pub enum ChineseColor {
    // 赤色系
    Cinnabar,      // 朱砂
    Vermilion,     // 朱红
    Crimson,       // 绯红

    // 青色系
    Azurite,       // 石青
    Indigo,        // 靛蓝
    Cyan,          // 青色

    // 黄色系
    VineYellow,    // 藤黄
    GooseYellow,   // 鹅黄

    // 緑色系
    ScallionGreen, // 葱倩
    BambooGreen,   // 竹青
    Jade,          // 玉色

    // ニュートラル系
    InkBlack,      // 墨色
    MoonWhite,     // 月白
    LightGray,     // 缟色

    // ... 500以上の色
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
    // 内部
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

### 色ユーティリティ

```rust
pub fn opacity(color: ChineseColor, alpha: f64) -> String;
pub fn blend(color1: ChineseColor, color2: ChineseColor, factor: f64) -> String;
pub fn lighten(color: ChineseColor, amount: f64) -> String;
pub fn darken(color: ChineseColor, amount: f64) -> String;
```

## 関連システム

- [テーマシステム](./theme.md) - テーマコンテキストとCSS変数
- [コンポーネント](../components/) - パレットを使用するコンポーネントライブラリ
- [ビルダーシステム](./builder.md) - パレット変数を使用したSCSSコンパイル
