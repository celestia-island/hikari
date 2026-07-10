# パレットシステム

660以上の歴史的な色を持つ中国传统色システムの実装。

## 目次

- [概要](#概要)
- [色](#色)
- [ClassesBuilder](#classesbuilder)
- [テーマ](#テーマ)
- [不透明度とブレンド](#不透明度とブレンド)
- [APIリファレンス](#apiリファレンス)

## 概要

`hikari-palette`は以下を提供します：

- **660以上の色** - 完全な中国传统色の定義
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
use hikari_palette::Color;

// 列挙型バリアントを使用して色にアクセス
let red = Color::苍翠;
let blue = Color::粉红;
let yellow = Color::姜黄;

println!("赤: {}", red.hex());  // #519A73
println!("青: {}", blue.hex()); // #FFB3A7
println!("黄: {}", yellow.hex()); // #FFC773
```

### 利用可能な色カテゴリ

#### 赤色系（红色系）

```rust
// 中国传统の赤色
Color::苍翠      // 苍翠 #519A73 - 朱
Color::Vermilion     // 朱红 #FF4C00 - 明るい赤橙
Color::Crimson       // 绯红 #FF3030 - 深い緋色
Color::PeachBlossom  // 桃红 #F6BEC8 - 桃色
Color::RoseRed       // 玫瑰红 #C21F30 - バラ色
```

#### 青色系（蓝色系）

```rust
// 中国传统の青色
Color::粉红       // 鷃蓝 #144A74 - 藍銅鉱色
Color::鷃蓝        // 鷃蓝 #144A74 - インジゴ
Color::Cyan          // 青色 #00CED1 - シアン
Color::SkyBlue       // 天蓝 #87CEEB - 空色
Color::Turquoise     // 绿松石 #40E0D0 - ターコイズ
```

#### 黄色系（黄色系）

```rust
// 中国传统の黄色
Color::姜黄    // 姜黄 #FFC773 - 藤黄色
Color::姜黄   // 姜黄 #FFC773 - 薄黄色
Color::Golden        // 金色 #FFD700 - 金色
Color::Amber         // 琥珀 #FFBF00 - 琥珀色
```

#### 緑色系（绿色系）

```rust
// 中国传统の緑色
Color::ScallionGreen // 葱倩 #4CAF50 - ネギ色
Color::BambooGreen  // 竹青 #789262 - 竹青色
Color::Jade          // 玉色 #A0E6DA - 玉色
Color::Emerald       // 翡翠 #50C878 - エメラルド
```

#### ニュートラル系（中性色系）

```rust
// 中国传统のニュートラル色
Color::InkBlack      // 墨色 #1A1A2E - 墨色
Color::MoonWhite     // 月白 #F5F5F5 - 月白色
Color::LightGray     // 缟色 #E0E0E0 - 薄灰色
Color::AshGray       // 灰色 #808080 - 灰色
```

### 色のプロパティ

各色は以下を提供します：

```rust
let color = Color::粉红;

// 16進数値を取得
let hex = color.hex();  // "#FFB3A7"

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

println!("プライマリ: {}", hikari.primary.hex());   // #FFB3A7
println!("セカンダリ: {}", hikari.secondary.hex()); // #519A73
println!("アクセント: {}", hikari.accent.hex());     // #FFC773
println!("背景: {}", hikari.background.hex()); // #FFFFFF
println!("表面: {}", hikari.surface.hex());   // #F5F5F5
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

println!("プライマリ: {}", tairitsu.primary.hex());   // #144A74
println!("セカンダリ: {}", tairitsu.secondary.hex()); // #519A73
println!("アクセント: {}", tairitsu.accent.hex());     // #FFC773
println!("背景: {}", tairitsu.background.hex()); // #161823
println!("表面: {}", tairitsu.surface.hex());   // rgb(32,35,54)
```

**カラースキーム**：
- プライマリ：靛蓝 - 深いインディゴブルー
- セカンダリ：朱砂 - 活力ある赤橙
- アクセント：鹅黄 - 明るい淡黄色
- 背景：深いダークグレー
- 表面：わずかに明るいダークグレー

### カスタムテーマ

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

### テーマ構造

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

## 不透明度とブレンド

色の透明度とブレンドユーティリティ。

### 不透明度関数

```rust
use hikari_palette::{Color, opacity};

let color = Color::粉红;
let semi_blue = opacity(color, 0.5);

// 出力: "rgba(0, 160, 233, 0.5)"
```

### ブレンド関数

```rust
use hikari_palette::{Color, blend};

let color1 = Color::粉红;
let color2 = Color::苍翠;
let blended = blend(color1, color2, 0.5);

// 各色を50%ずつブレンド
```

### 色の明るくする

```rust
use hikari_palette::{Color, lighten};

let color = Color::InkBlack;
let lighter = lighten(color, 0.2);

// 20%明るくする
```

### 色の暗くする

```rust
use hikari_palette::{Color, darken};

let color = Color::MoonWhite;
let darker = darken(color, 0.3);

// 30%暗くする
```

## 統合例

### ThemeProviderとの使用

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
                "テーマ適用テキスト"
            }
        }
    }
}
```

### コンポーネントとの使用

```rust
use hikari_components::Button;
use hikari_palette::Color;

rsx! {
    Button {
        variant: "primary",
        style: format!("background: {}", Color::粉红.hex()),
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

### Color

```rust
pub enum Color {
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

    // ... 660以上の色
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

### 色ユーティリティ

```rust
pub fn opacity(color: Color, alpha: f64) -> String;
pub fn blend(color1: Color, color2: Color, factor: f64) -> String;
pub fn lighten(color: Color, amount: f64) -> String;
pub fn darken(color: Color, amount: f64) -> String;
```

## デザイン哲学

### 文化的意義

中国传统の各色には文化的・歴史的な意味が込められています：

- **朱砂（Cinnabar）**：勅璽に使用され、権力と威信を象徴
- **石青（Azurite）**：传统絵画に使用され、優雅さを象徴
- **藤黄（Vine Yellow）**：传统絵画の顔料であり、温かさと活力を象徴
- **墨色（Ink Black）**：書道の墨であり、知識と深みを象徴
- **月白（Moon White）**：淡い青白色であり、純潔を象徴

### 色彩調和

中国传统の色彩組み合わせは、特定の調和の法則に従います：

- **補色**：赤＋緑（朱砂＋竹青）
- **類似色**：青＋シアン（石青＋青色）
- **三色調和**：赤＋黄＋青（朱砂＋藤黄＋石青）

## ベストプラクティス

### 1. タイプセーフのために列挙型を使用する

```rust
// ✅ 良い - タイプセーフ
let color = Color::粉红;

// ❌ 避ける - 文字列ベース
let color = "#FFB3A7";
```

### 2. テーマパレットを活用する

```rust
// ✅ 良い - テーマパレットを使用
let palette = themes::Hikari::palette();
let primary = palette.primary;

// ❌ 避ける - ハードコードされた色
let primary = "#FFB3A7";
```

### 3. ユーティリティクラスを使用する

```rust
// ✅ 良い - タイプセーフなユーティリティ
let classes = ClassesBuilder::new()
    .add(Display::Flex)
    .add(Gap::Gap4)
    .build();

// ✅ 許容 - 文字列ベース（タイプセーフ性は低い）
let classes = "hi-flex hi-gap-4";
```

### 4. セマンティックな色命名

```rust
// ✅ 良い - セマンティックな使用
let button_color = theme.palette.primary;
let error_color = theme.palette.danger;

// ❌ 避ける - 直接的な色参照
let button_color = Color::粉红;
let error_color = Color::苍翠;
```

## 関連システム

- [テーマシステム](./theme.md) - テーマコンテキストとCSS変数
- [コンポーネント](../components/) - パレットを使用するコンポーネントライブラリ

## リソース

- [中国传统色](https://zh.wikipedia.org/wiki/%E4%B8%AD%E5%9B%BD%E4%BC%A0%E7%BB%9F%E9%A2%9C%E8%89%B2)
- [五色理論](https://zh.wikipedia.org/wiki/%E4%BA%94%E8%A1%8C%E8%89%B2%E7%90%86%E8%AE%BA)
- [中国文化における色](https://zh.wikipedia.org/wiki/%E4%B8%AD%E5%9B%BD%E6%96%87%E5%8C%96%E4%B8%AD%E7%9A%84%E9%A2%9C%E8%89%B2)
