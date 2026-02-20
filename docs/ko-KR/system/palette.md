# Palette 시스템

500개 이상의 역사적 색상을 포함한 전통 중국 색상 시스템 구현입니다.

## 목차

- [개요](#개요)
- [색상](#색상)
- [ClassesBuilder](#classesbuilder-유틸리티-클래스-생성기)
- [테마](#테마)
- [불투명도 및 혼합](#불투명도-및-혼합)
- [API 참조](#api-참조)

## 개요

`hikari-palette`가 제공하는 기능:

- **500개 이상의 색상** - 전통 중국 색상 정의 완전히 포함
- **타입 안전** - 컴파일 타임 색상 값 검사
- **유틸리티 클래스** - 타입 안전한 Tailwind 스타일 유틸리티 클래스 빌더
- **테마 팔레트** - 사전 구성된 테마 색상 스킴
- **불투명도 지원** - 색상 투명도 및 혼합

모든 색상 정의의 특징:

- **문화적 유산** - 전통 중국 색상 이름
- **타입 안전** - Enum 기반 색상 정의
- **Hex 값** - 표준 hex 색상 코드
- **카테고리** - 색상 계열별로 구성

## 색상

### 기본 사용법

```rust
use hikari_palette::ChineseColor;

// Enum 변형을 사용하여 색상 접근
let red = ChineseColor::Cinnabar;
let blue = ChineseColor::Azurite;
let yellow = ChineseColor::VineYellow;

println!("빨강: {}", red.hex());  // #E94B35
println!("파랑: {}", blue.hex()); // #00A0E9
println!("노랑: {}", yellow.hex()); // #F8B62D
```

### 사용 가능한 색상 카테고리

#### 빨간색 계열 (红色系)

```rust
// 전통 빨간색
ChineseColor::Cinnabar      // 주사 #E94B35 - 진사
ChineseColor::Vermilion     // 주홍 #FF4C00 - 밝은 빨강-주황
ChineseColor::Crimson       // 비홍 #FF3030 - 진홍색
ChineseColor::PeachBlossom  // 도홍 #F6BEC8 - 복숭아 분홍
ChineseColor::RoseRed       // 매홍 #C21F30 - 장미 빨강
```

#### 파란색 계열 (蓝色系)

```rust
// 전통 파란색
ChineseColor::Azurite       // 석청 #00A0E9 - 청록색 파랑
ChineseColor::Indigo        // 남색 #1a237e - 인디고 파랑
ChineseColor::Cyan          // 청색 #00CED1 - 시안
ChineseColor::SkyBlue       // 청록 #87CEEB - 하늘색
ChineseColor::Turquoise     // 녹송석 #40E0D0 - 터콰이즈
```

#### 노란색 계열 (黄色系)

```rust
// 전통 노란색
ChineseColor::VineYellow    // 등황 #F8B62D - 덩굴 노랑
ChineseColor::GooseYellow   // 아황 #FFF176 - 거위 노랑
ChineseColor::Golden        // 금색 #FFD700 - 금색
ChineseColor::Amber         // 호박 #FFBF00 - 호박색
```

#### 녹색 계열 (绿色系)

```rust
// 전통 녹색
ChineseColor::ScallionGreen // 총천 #4CAF50 - 파 녹색
ChineseColor::BambooGreen  // 죽청 #789262 - 대나무 녹색
ChineseColor::Jade          // 옥색 #A0E6DA - 비취 녹색
ChineseColor::Emerald       // 비취 #50C878 - 에메랄드 녹색
```

#### 중성색 계열 (中性色系)

```rust
// 전통 중성색
ChineseColor::InkBlack      // 묵색 #1A1A2E - 먹 검정
ChineseColor::MoonWhite     // 월백 #F5F5F5 - 달 흰색
ChineseColor::LightGray     // 고색 #E0E0E0 - 밝은 회색
ChineseColor::AshGray       // 회색 #808080 - 잿회색
```

### 색상 속성

각 색상이 제공하는 것:

```rust
let color = ChineseColor::Azurite;

// Hex 값 얻기
let hex = color.hex();  // "#00A0E9"

// RGB 값 얻기
let rgb = color.rgb();  // (0, 160, 233)

// 색상 이름 얻기
let name = color.name();  // "석청"

// 영어 이름 얻기
let english_name = color.english_name();  // "Azurite"
```

## ClassesBuilder

Tailwind CSS 스타일 클래스를 위한 타입 안전 유틸리티 클래스 생성기입니다.

### 기본 사용법

```rust
use hikari_palette::{ClassesBuilder, classes::*};

let classes = ClassesBuilder::new()
    .add(Display::Flex)
    .add(FlexDirection::Row)
    .add(Gap::Gap4)
    .build();

// 출력: "hi-flex hi-flex-row hi-gap-4"
```

### 사용 가능한 유틸리티 클래스

#### Display 클래스

```rust
use hikari_palette::classes::Display;

Display::Block      // "hi-block"
Display::Flex       // "hi-flex"
Display::Grid       // "hi-grid"
Display::Hidden     // "hi-hidden"
```

#### Flexbox 클래스

```rust
use hikari_palette::classes::{FlexDirection, AlignItems, JustifyContent};

FlexDirection::Row        // "hi-flex-row"
FlexDirection::Column     // "hi-flex-column"
AlignItems::Center        // "hi-items-center"
AlignItems::Stretch       // "hi-items-stretch"
JustifyContent::Center    // "hi-justify-center"
JustifyContent::Between   // "hi-justify-between"
```

#### Spacing 클래스

```rust
use hikari_palette::classes::{Padding, Margin, Gap};

Padding::P4        // "hi-p-4"
Padding::Px8       // "hi-px-8"
Margin::M4         // "hi-m-4"
Margin::MyAuto     // "hi-my-auto"
Gap::Gap4          // "hi-gap-4"
```

#### Color 클래스

```rust
use hikari_palette::classes::{TextColor, BackgroundColor};

TextColor::Primary       // "hi-text-primary"
TextColor::Secondary     // "hi-text-secondary"
BackgroundColor::Primary // "hi-bg-primary"
BackgroundColor::Surface // "hi-bg-surface"
```

#### Typography 클래스

```rust
use hikari_palette::classes::{FontSize, FontWeight};

FontSize::Base       // "hi-text-base"
FontSize::XL         // "hi-text-xl"
FontSize::2XL        // "hi-text-2xl"
FontWeight::Normal   // "hi-font-normal"
FontWeight::Bold     // "hi-font-bold"
```

#### Border 클래스

```rust
use hikari_palette::classes::{Border, BorderRadius};

Border::B            // "hi-border"
Border::B2           // "hi-border-2"
BorderRadius::Md     // "hi-rounded-md"
BorderRadius::Full   // "hi-rounded-full"
```

### 클래스 조합

```rust
use hikari_palette::{ClassesBuilder, classes::*};

// 복잡한 컴포넌트 스타일링
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

// 출력: "hi-flex hi-items-center hi-justify-center hi-px-4 hi-py-2 hi-rounded-md hi-bg-primary hi-text-white"
```

### 타입 안전의 이점

```rust
// ✅ 타입 안전 - 컴파일 타임 검사
let classes = ClassesBuilder::new()
    .add(Display::Flex)
    .add(FlexDirection::Row)
    .build();

// ❌ 컴파일되지 않음 - 오타 보호
let classes = ClassesBuilder::new()
    .add(Display::Flx)  // 컴파일 에러!
    .build();
```

## 테마

사전 구성된 테마 팔레트입니다.

### Hikari 테마 (라이트)

```rust
use hikari_palette::themes;

let hikari = themes::Hikari::palette();

println!("Primary: {}", hikari.primary.hex);   // #00A0E9
println!("Secondary: {}", hikari.secondary.hex); // #E94B35
println!("Accent: {}", hikari.accent.hex);     // #F8B62D
println!("Background: {}", hikari.background.hex); // #FFFFFF
println!("Surface: {}", hikari.surface.hex);   // #F5F5F5
```

**색상 스킴**:
- Primary: Azurite (석청) - 신선한 청록색-파랑
- Secondary: Cinnabar (주사) - 활기찬 빨강-주황
- Accent: Vine Yellow (등황) - 따뜻한 금빛 노랑
- Background: Moon White (월백) - 깨끗한 흰색
- Surface: 미세한 색조가 있는 밝은 회색

### Tairitsu 테마 (다크)

```rust
use hikari_palette::themes;

let tairitsu = themes::Tairitsu::palette();

println!("Primary: {}", tairitsu.primary.hex);   // #1a237e
println!("Secondary: {}", tairitsu.secondary.hex); // #E94B35
println!("Accent: {}", tairitsu.accent.hex);     // #FFF176
println!("Background: {}", tairitsu.background.hex); // #0D1117
println!("Surface: {}", tairitsu.surface.hex);   // #161B22
```

**색상 스킴**:
- Primary: Indigo (남색) - 깊은 인디고 파랑
- Secondary: Cinnabar (주사) - 활기찬 빨강-주황
- Accent: Goose Yellow (아황) - 밝은 연노랑
- Background: 깊은 짙은 회색
- Surface: 약간 밝은 짙은 회색

### 커스텀 테마

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

### 테마 구조

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

## 불투명도 및 혼합

색상 투명도 및 혼합 유틸리티입니다.

### 불투명도 함수

```rust
use hikari_palette::{ChineseColor, opacity};

let color = ChineseColor::Azurite;
let semi_blue = opacity(color, 0.5);

// 출력: "rgba(0, 160, 233, 0.5)"
```

### 혼합 함수

```rust
use hikari_palette::{ChineseColor, blend};

let color1 = ChineseColor::Azurite;
let color2 = ChineseColor::Cinnabar;
let blended = blend(color1, color2, 0.5);

// 각 색상의 50%를 혼합
```

### 색상 밝게 하기

```rust
use hikari_palette::{ChineseColor, lighten};

let color = ChineseColor::InkBlack;
let lighter = lighten(color, 0.2);

// 20% 밝게 함
```

### 색상 어둡게 하기

```rust
use hikari_palette::{ChineseColor, darken};

let color = ChineseColor::MoonWhite;
let darker = darken(color, 0.3);

// 30% 어둡게 함
```

## 통합 예제

### ThemeProvider와 함께 사용

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
                "테마가 적용된 텍스트"
            }
        }
    }
}
```

### 컴포넌트와 함께 사용

```rust
use hikari_components::Button;
use hikari_palette::ChineseColor;

rsx! {
    Button {
        variant: "primary",
        style: format!("background: {}", ChineseColor::Azurite.hex()),
        "커스텀 버튼"
    }
}
```

### 유틸리티 클래스와 함께 사용

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
        "카드 콘텐츠"
    }
}
```

## API 참조

### ChineseColor

```rust
pub enum ChineseColor {
    // 빨간색 계열
    Cinnabar,      // 주사
    Vermilion,     // 주홍
    Crimson,       // 비홍

    // 파란색 계열
    Azurite,       // 석청
    Indigo,        // 남색
    Cyan,          // 청색

    // 노란색 계열
    VineYellow,    // 등황
    GooseYellow,   // 아황

    // 녹색 계열
    ScallionGreen, // 총천
    BambooGreen,   // 죽청
    Jade,          // 옥색

    // 중성색 계열
    InkBlack,      // 묵색
    MoonWhite,     // 월백
    LightGray,     // 고색

    // ... 500개 이상의 색상
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
    // 내부
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

### 색상 유틸리티

```rust
pub fn opacity(color: ChineseColor, alpha: f64) -> String;
pub fn blend(color1: ChineseColor, color2: ChineseColor, factor: f64) -> String;
pub fn lighten(color: ChineseColor, amount: f64) -> String;
pub fn darken(color: ChineseColor, amount: f64) -> String;
```

## 디자인 철학

### 문화적 의미

각 전통 중국 색상은 문화적, 역사적 의미를 담고 있습니다:

- **Cinnabar (주사)**: 제국의 인장에 사용, 권력과 권위를 상징
- **Azurite (석청)**: 전통 회화에 사용, 우아함을 상징
- **Vine Yellow (등황)**: 전통 회화 안료, 온기와 활력
- **Ink Black (묵색)**: 서예 먹, 지식과 깊이를 상징
- **Moon White (월백)**: 창백한 파랑-흰색, 순수함을 상징

### 색상 조화

전통 중국 색상 조합은 특정 조화 규칙을 따릅니다:

- **보색**: 빨강 + 녹색 (주사 + 죽청)
- **유사색**: 파랑 + 시안 (석청 + 청색)
- **삼색**: 빨강 + 노랑 + 파랑 (주사 + 등황 + 석청)

## 모범 사례

### 1. 타입 안전을 위해 Enum 사용

```rust
// ✅ 좋음 - 타입 안전
let color = ChineseColor::Azurite;

// ❌ 피하세요 - 문자열 기반
let color = "#00A0E9";
```

### 2. 테마 팔레트 활용

```rust
// ✅ 좋음 - 테마 팔레트 사용
let palette = themes::Hikari::palette();
let primary = palette.primary;

// ❌ 피하세요 - 하드코딩된 색상
let primary = "#00A0E9";
```

### 3. 유틸리티 클래스 사용

```rust
// ✅ 좋음 - 타입 안전 유틸리티
let classes = ClassesBuilder::new()
    .add(Display::Flex)
    .add(Gap::Gap4)
    .build();

// ✅ 허용됨 - 문자열 기반 (덜 타입 안전)
let classes = "hi-flex hi-gap-4";
```

### 4. 의미적 색상 명명

```rust
// ✅ 좋음 - 의미적 사용
let button_color = theme.palette.primary;
let error_color = theme.palette.danger;

// ❌ 피하세요 - 직접 색상 참조
let button_color = ChineseColor::Azurite;
let error_color = ChineseColor::Cinnabar;
```

## 관련 시스템

- [테마 시스템](./theme.md) - 테마 컨텍스트 및 CSS 변수
- [컴포넌트](../components/) - 팔레트를 사용하는 컴포넌트 라이브러리
- [Builder 시스템](./builder.md) - 팔레트 변수를 사용한 SCSS 컴파일

## 리소스

- [전통 중국 색상](https://zh.wikipedia.org/wiki/%E4%B8%AD%E5%9B%BD%E4%BC%A0%E7%BB%9F%E9%A2%9C%E8%89%B2)
- [오색 이론](https://zh.wikipedia.org/wiki/%E4%BA%94%E8%A1%8C%E8%89%B2%E7%90%86%E8%AE%BA)
- [중국 문화의 색상](https://zh.wikipedia.org/wiki/%E4%B8%AD%E5%9B%BD%E6%96%87%E5%8C%96%E4%B8%AD%E7%9A%84%E9%A2%9C%E8%89%B2)
