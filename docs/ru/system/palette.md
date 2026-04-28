# Система палитры

Реализация традиционной китайской цветовой системы с более чем 500 историческими цветами.

## Содержание

- [Обзор](#обзор)
- [Цвета](#цвета)
- [ClassesBuilder (генератор служебных классов)](#classesbuilder-генератор-служебных-классов)
- [Темы](#темы)
- [Прозрачность и смешивание](#прозрачность-и-смешивание)
- [Справочник API](#справочник-api)

## Обзор

`hikari-palette` предоставляет:

- **500+ Цветов** - Полные определения традиционных китайских цветов
- **Типобезопасность** - Проверка значений цветов во время компиляции
- **Служебные классы** - Типобезопасный генератор классов в стиле Tailwind
- **Тематические палитры** - Преднастроенные цветовые схемы темы
- **Поддержка прозрачности** - Прозрачность и смешивание цветов

Все определения цветов включают:

- **Культурное наследие** - Традиционные китайские названия цветов
- **Типобезопасность** - Определения цветов на основе перечислений
- **Hex-значения** - Стандартные шестнадцатеричные коды цветов
- **Категории** - Организация по семействам цветов

## Цвета

### Базовое использование

```rust
use hikari_palette::ChineseColor;

// Доступ к цветам через варианты перечисления
let red = ChineseColor::Cinnabar;
let blue = ChineseColor::Azurite;
let yellow = ChineseColor::VineYellow;

println!("Красный: {}", red.hex());  // #E94B35
println!("Синий: {}", blue.hex()); // #00A0E9
println!("Жёлтый: {}", yellow.hex()); // #F8B62D
```

### Доступные категории цветов

#### Серия красных (红色系)

```rust
// Традиционные красные цвета
ChineseColor::Cinnabar      // 朱砂 #E94B35 - Киноварь
ChineseColor::Vermilion     // 朱红 #FF4C00 - Яркий красно-оранжевый
ChineseColor::Crimson       // 绯红 #FF3030 - Глубокий малиновый
ChineseColor::PeachBlossom  // 桃红 #F6BEC8 - Персиковый розовый
ChineseColor::RoseRed       // 玫瑰红 #C21F30 - Розово-красный
```

#### Серия синих (蓝色系)

```rust
// Традиционные синие цвета
ChineseColor::Azurite       // 石青 #00A0E9 - Азуритовый синий
ChineseColor::Indigo        // 靛蓝 #1a237e - Индиго
ChineseColor::Cyan          // 青色 #00CED1 - Циан
ChineseColor::SkyBlue       // 天蓝 #87CEEB - Небесно-голубой
ChineseColor::Turquoise     // 绿松石 #40E0D0 - Бирюзовый
```

#### Серия жёлтых (黄色系)

```rust
// Традиционные жёлтые цвета
ChineseColor::VineYellow    // 藤黄 #F8B62D - Гамбожий жёлтый
ChineseColor::GooseYellow   // 鹅黄 #FFF176 - Светло-жёлтый
ChineseColor::Golden        // 金色 #FFD700 - Золотой
ChineseColor::Amber         // 琥珀 #FFBF00 - Янтарный
```

#### Серия зелёных (绿色系)

```rust
// Традиционные зелёные цвета
ChineseColor::ScallionGreen // 葱倩 #4CAF50 - Луковый зелёный
ChineseColor::BambooGreen  // 竹青 #789262 - Бамбуковый зелёный
ChineseColor::Jade          // 玉色 #A0E6DA - Нефритовый
ChineseColor::Emerald       // 翡翠 #50C878 - Изумрудный
```

#### Серия нейтральных (中性色系)

```rust
// Традиционные нейтральные цвета
ChineseColor::InkBlack      // 墨色 #1A1A2E - Чернила
ChineseColor::MoonWhite     // 月白 #F5F5F5 - Лунно-белый
ChineseColor::LightGray     // 缟色 #E0E0E0 - Светло-серый
ChineseColor::AshGray       // 灰色 #808080 - Пепельно-серый
```

### Свойства цвета

Каждый цвет предоставляет:

```rust
let color = ChineseColor::Azurite;

// Получить hex-значение
let hex = color.hex();  // "#00A0E9"

// Получить RGB-значения
let rgb = color.rgb();  // (0, 160, 233)

// Получить название цвета
let name = color.name();  // "石青"

// Получить английское название
let english_name = color.english_name();  // "Azurite"
```

## ClassesBuilder

Типобезопасный генератор служебных классов в стиле Tailwind CSS.

### Базовое использование

```rust
use hikari_palette::{ClassesBuilder, classes::*};

let classes = ClassesBuilder::new()
    .add(Display::Flex)
    .add(FlexDirection::Row)
    .add(Gap::Gap4)
    .build();

// Результат: "hi-flex hi-flex-row hi-gap-4"
```

### Доступные служебные классы

#### Классы отображения

```rust
use hikari_palette::classes::Display;

Display::Block      // "hi-block"
Display::Flex       // "hi-flex"
Display::Grid       // "hi-grid"
Display::Hidden     // "hi-hidden"
```

#### Классы Flexbox

```rust
use hikari_palette::classes::{FlexDirection, AlignItems, JustifyContent};

FlexDirection::Row        // "hi-flex-row"
FlexDirection::Column     // "hi-flex-column"
AlignItems::Center        // "hi-items-center"
AlignItems::Stretch       // "hi-items-stretch"
JustifyContent::Center    // "hi-justify-center"
JustifyContent::Between   // "hi-justify-between"
```

#### Классы отступов

```rust
use hikari_palette::classes::{Padding, Margin, Gap};

Padding::P4        // "hi-p-4"
Padding::Px8       // "hi-px-8"
Margin::M4         // "hi-m-4"
Margin::MyAuto     // "hi-my-auto"
Gap::Gap4          // "hi-gap-4"
```

#### Классы цветов

```rust
use hikari_palette::classes::{TextColor, BackgroundColor};

TextColor::Primary       // "hi-text-primary"
TextColor::Secondary     // "hi-text-secondary"
BackgroundColor::Primary // "hi-bg-primary"
BackgroundColor::Surface // "hi-bg-surface"
```

#### Классы типографики

```rust
use hikari_palette::classes::{FontSize, FontWeight};

FontSize::Base       // "hi-text-base"
FontSize::XL         // "hi-text-xl"
FontSize::2XL        // "hi-text-2xl"
FontWeight::Normal   // "hi-font-normal"
FontWeight::Bold     // "hi-font-bold"
```

#### Классы границ

```rust
use hikari_palette::classes::{Border, BorderRadius};

Border::B            // "hi-border"
Border::B2           // "hi-border-2"
BorderRadius::Md     // "hi-rounded-md"
BorderRadius::Full   // "hi-rounded-full"
```

### Комбинирование классов

```rust
use hikari_palette::{ClassesBuilder, classes::*};

// Сложное стилизование компонента
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

// Результат: "hi-flex hi-items-center hi-justify-center hi-px-4 hi-py-2 hi-rounded-md hi-bg-primary hi-text-white"
```

### Преимущества типобезопасности

```rust
// ✅ Типобезопасно - проверка во время компиляции
let classes = ClassesBuilder::new()
    .add(Display::Flex)
    .add(FlexDirection::Row)
    .build();

// ❌ Не скомпилируется - защита от опечаток
let classes = ClassesBuilder::new()
    .add(Display::Flx)  // Ошибка компиляции!
    .build();
```

## Темы

Преднастроенные тематические палитры.

### Тема Hikari (Светлая)

```rust
use hikari_palette::themes;

let hikari = themes::Hikari::palette();

println!("Основной: {}", hikari.primary.hex);   // #00A0E9
println!("Вторичный: {}", hikari.secondary.hex); // #E94B35
println!("Акцентный: {}", hikari.accent.hex);     // #F8B62D
println!("Фон: {}", hikari.background.hex); // #FFFFFF
println!("Поверхность: {}", hikari.surface.hex);   // #F5F5F5
```

**Цветовая схема**:
- Основной: Азурит (石青) - Свежий цианово-синий
- Вторичный: Киноварь (朱砂) - Энергичный красно-оранжевый
- Акцентный: Гамбожий жёлтый (藤黄) - Тёплый золотисто-жёлтый
- Фон: Лунно-белый (月白) - Чистый белый
- Поверхность: Светло-серый с лёгким оттенком

### Тема Tairitsu (Тёмная)

```rust
use hikari_palette::themes;

let tairitsu = themes::Tairitsu::palette();

println!("Основной: {}", tairitsu.primary.hex);   // #1a237e
println!("Вторичный: {}", tairitsu.secondary.hex); // #E94B35
println!("Акцентный: {}", tairitsu.accent.hex);     // #FFF176
println!("Фон: {}", tairitsu.background.hex); // #0D1117
println!("Поверхность: {}", tairitsu.surface.hex);   // #161B22
```

**Цветовая схема**:
- Основной: Индиго (靛蓝) - Глубокий индиго-синий
- Вторичный: Киноварь (朱砂) - Энергичный красно-оранжевый
- Акцентный: Гусиный жёлтый (鹅黄) - Яркий бледно-жёлтый
- Фон: Глубокий тёмно-серый
- Поверхность: Немного более светлый тёмно-серый

### Пользовательская тема

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

### Структура темы

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

## Прозрачность и смешивание

Утилиты прозрачности и смешивания цветов.

### Функция прозрачности

```rust
use hikari_palette::{ChineseColor, opacity};

let color = ChineseColor::Azurite;
let semi_blue = opacity(color, 0.5);

// Результат: "rgba(0, 160, 233, 0.5)"
```

### Функция смешивания

```rust
use hikari_palette::{ChineseColor, blend};

let color1 = ChineseColor::Azurite;
let color2 = ChineseColor::Cinnabar;
let blended = blend(color1, color2, 0.5);

// Смешивает 50% каждого цвета
```

### Осветление цвета

```rust
use hikari_palette::{ChineseColor, lighten};

let color = ChineseColor::InkBlack;
let lighter = lighten(color, 0.2);

// Осветляет на 20%
```

### Затемнение цвета

```rust
use hikari_palette::{ChineseColor, darken};

let color = ChineseColor::MoonWhite;
let darker = darken(color, 0.3);

// Затемняет на 30%
```

## Примеры интеграции

### С ThemeProvider

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
                "Тематический текст"
            }
        }
    }
}
```

### С компонентами

```rust
use hikari_components::Button;
use hikari_palette::ChineseColor;

rsx! {
    Button {
        variant: "primary",
        style: format!("background: {}", ChineseColor::Azurite.hex()),
        "Пользовательская кнопка"
    }
}
```

### Со служебными классами

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
        "Содержимое карточки"
    }
}
```

## Справочник API

### ChineseColor

```rust
pub enum ChineseColor {
    // Серия красных
    Cinnabar,      // 朱砂
    Vermilion,     // 朱红
    Crimson,       // 绯红

    // Серия синих
    Azurite,       // 石青
    Indigo,        // 靛蓝
    Cyan,          // 青色

    // Серия жёлтых
    VineYellow,    // 藤黄
    GooseYellow,   // 鹅黄

    // Серия зелёных
    ScallionGreen, // 葱倩
    BambooGreen,   // 竹青
    Jade,          // 玉色

    // Серия нейтральных
    InkBlack,      // 墨色
    MoonWhite,     // 月白
    LightGray,     // 缟色

    // ... ещё 500+ цветов
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
    // внутреннее
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

### Утилиты цвета

```rust
pub fn opacity(color: ChineseColor, alpha: f64) -> String;
pub fn blend(color1: ChineseColor, color2: ChineseColor, factor: f64) -> String;
pub fn lighten(color: ChineseColor, amount: f64) -> String;
pub fn darken(color: ChineseColor, amount: f64) -> String;
```

## Философия дизайна

### Культурное значение

Каждый традиционный китайский цвет несёт культурное и историческое значение:

- **Киноварь (朱砂)**: Использовалась в императорских печатях, символизирует власть и авторитет
- **Азурит (石青)**: Использовался в традиционной живописи, символизирует элегантность
- **Гамбожий жёлтый (藤黄)**: Традиционный пигмент для живописи, теплота и жизненная сила
- **Чернильный чёрный (墨色)**: Чернила для каллиграфии, символизирует знание и глубину
- **Лунно-белый (月白)**: Бледный голубовато-белый, символизирует чистоту

### Цветовая гармония

Традиционные китайские цветовые комбинации следуют определённым правилам гармонии:

- **Дополнительные**: Красный + Зелёный (朱砂 + 竹青)
- **Аналоговые**: Синий + Циан (石青 + 青色)
- **Триадные**: Красный + Жёлтый + Синий (朱砂 + 藤黄 + 石青)

## Лучшие практики

### 1. Используйте перечисления для типобезопасности

```rust
// ✅ Хорошо - Типобезопасно
let color = ChineseColor::Azurite;

// ❌ Избегайте - На основе строк
let color = "#00A0E9";
```

### 2. Используйте тематические палитры

```rust
// ✅ Хорошо - Используйте тематическую палитру
let palette = themes::Hikari::palette();
let primary = palette.primary;

// ❌ Избегайте - Жёстко заданные цвета
let primary = "#00A0E9";
```

### 3. Используйте служебные классы

```rust
// ✅ Хорошо - Типобезопасные утилиты
let classes = ClassesBuilder::new()
    .add(Display::Flex)
    .add(Gap::Gap4)
    .build();

// ✅ Приемлемо - На основе строк (менее типобезопасно)
let classes = "hi-flex hi-gap-4";
```

### 4. Семантическое именование цветов

```rust
// ✅ Хорошо - Семантическое использование
let button_color = theme.palette.primary;
let error_color = theme.palette.danger;

// ❌ Избегайте - Прямые ссылки на цвета
let button_color = ChineseColor::Azurite;
let error_color = ChineseColor::Cinnabar;
```

## Связанные системы

- [Система тем](./theme.md) - Контекст темы и CSS-переменные
- [Компоненты](../components/) - Библиотека компонентов, использующая палитры
- [Система сборки](./builder.md) - Компиляция SCSS с переменными палитры

## Ресурсы

- [Традиционные китайские цвета](https://zh.wikipedia.org/wiki/%E4%B8%AD%E5%9B%BD%E4%BC%A0%E7%BB%9F%E9%A2%9C%E8%89%B2)
- [Теория пяти цветов](https://zh.wikipedia.org/wiki/%E4%BA%94%E8%A1%8C%E8%89%B2%E7%90%86%E8%AE%BA)
- [Цвет в китайской культуре](https://zh.wikipedia.org/wiki/%E4%B8%AD%E5%9B%BD%E6%96%87%E5%8C%96%E4%B8%AD%E7%9A%84%E9%A2%9C%E8%89%B2)
