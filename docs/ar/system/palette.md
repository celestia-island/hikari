# نظام لوحة الألوان

تنفيذ نظام الألوان الصينية التقليدية مع أكثر من 500 لون تاريخي.

## جدول المحتويات

- [نظرة عامة](#نظرة-عامة)
- [الألوان](#الألوان)
- [ClassesBuilder (مولد الفئات)](#classesbuilder-مولد-الفئات)
- [السمات](#السمات)
- [الشفافية والمزج](#الشفافية-والمزج)
- [مرجع واجهة البرمجة](#مرجع-واجهة-البرمجة)

## نظرة عامة

يوفر `hikari-palette`:

- **أكثر من 500 لون** - تعريفات الألوان الصينية التقليدية الكاملة
- **آمن للنوع** - فحص قيم الألوان وقت الترجمة
- **فئات الأدوات** - مولد فئات أدوات آمن للنوع بأسلوب Tailwind
- **لوحات السمات** - أنظمة ألوان السمات المُعدة مسبقًا
- **دعم الشفافية** - شفافية اللون والمزج

تتميز جميع تعريفات الألوان بـ:

- **التراث الثقافي** - أسماء الألوان الصينية التقليدية
- **أمان النوع** - تعريفات الألوان القائمة على التعداد
- **قيم Hex** - رموز ألوان Hex القياسية
- **الفئات** - منظمة حسب عائلات الألوان

## الألوان

### الاستخدام الأساسي

```rust
use hikari_palette::ChineseColor;

// الوصول إلى الألوان باستخدام متغيرات التعداد
let red = ChineseColor::Cinnabar;
let blue = ChineseColor::Azurite;
let yellow = ChineseColor::VineYellow;

println!("الأحمر: {}", red.hex());  // #E94B35
println!("الأزرق: {}", blue.hex()); // #00A0E9
println!("الأصفر: {}", yellow.hex()); // #F8B62D
```

### فئات الألوان المتاحة

#### سلسلة الأحمر (红色系)

```rust
// الألوان الحمراء التقليدية
ChineseColor::Cinnabar      // 朱砂 #E94B35 - الزنجفر
ChineseColor::Vermilion     // 朱红 #FF4C00 - أحمر برتقالي ساطع
ChineseColor::Crimson       // 绯红 #FF3030 - قرمزي داكن
ChineseColor::PeachBlossom  // 桃红 #F6BEC8 - وردي الخوخ
ChineseColor::RoseRed       // 玫瑰红 #C21F30 - أحمر وردي
```

#### سلسلة الأزرق (蓝色系)

```rust
// الألوان الزرقاء التقليدية
ChineseColor::Azurite       // 石青 #00A0E9 - أزرق اللازورد
ChineseColor::Indigo        // 靛蓝 #1a237e - أزرق نيلي
ChineseColor::Cyan          // 青色 #00CED1 - سماوي
ChineseColor::SkyBlue       // 天蓝 #87CEEB - أزرق سماوي
ChineseColor::Turquoise     // 绿松石 #40E0D0 - فيروزي
```

#### سلسلة الأصفر (黄色系)

```rust
// الألوان الصفراء التقليدية
ChineseColor::VineYellow    // 藤黄 #F8B62D - أصفر الكامبوج
ChineseColor::GooseYellow   // 鹅黄 #FFF176 - أصفر فاتح
ChineseColor::Golden        // 金色 #FFD700 - ذهبي
ChineseColor::Amber         // 琥珀 #FFBF00 - عنبري
```

#### سلسلة الأخضر (绿色系)

```rust
// الألوان الخضراء التقليدية
ChineseColor::ScallionGreen // 葱倩 #4CAF50 - أخضر البصل
ChineseColor::BambooGreen  // 竹青 #789262 - أخضر الخيزران
ChineseColor::Jade          // 玉色 #A0E6DA - أخضر اليشم
ChineseColor::Emerald       // 翡翠 #50C878 - أخضر زمرد
```

#### سلسلة المحايد (中性色系)

```rust
// الألوان المحايدة التقليدية
ChineseColor::InkBlack      // 墨色 #1A1A2E - أسود الحبر
ChineseColor::MoonWhite     // 月白 #F5F5F5 - أبيض قمري
ChineseColor::LightGray     // 缟色 #E0E0E0 - رمادي فاتح
ChineseColor::AshGray       // 灰色 #808080 - رمادي رماد
```

### خصائص اللون

يوفر كل لون:

```rust
let color = ChineseColor::Azurite;

// الحصول على قيمة hex
let hex = color.hex();  // "#00A0E9"

// الحصول على قيم RGB
let rgb = color.rgb();  // (0, 160, 233)

// الحصول على اسم اللون
let name = color.name();  // "石青"

// الحصول على الاسم الإنجليزي
let english_name = color.english_name();  // "Azurite"
```

## ClassesBuilder

مولد فئات الأدوات الآمن للنوع لفئات تشبه Tailwind CSS.

### الاستخدام الأساسي

```rust
use hikari_palette::{ClassesBuilder, classes::*};

let classes = ClassesBuilder::new()
    .add(Display::Flex)
    .add(FlexDirection::Row)
    .add(Gap::Gap4)
    .build();

// الناتج: "hi-flex hi-flex-row hi-gap-4"
```

### فئات الأدوات المتاحة

#### فئات العرض

```rust
use hikari_palette::classes::Display;

Display::Block      // "hi-block"
Display::Flex       // "hi-flex"
Display::Grid       // "hi-grid"
Display::Hidden     // "hi-hidden"
```

#### فئات Flexbox

```rust
use hikari_palette::classes::{FlexDirection, AlignItems, JustifyContent};

FlexDirection::Row        // "hi-flex-row"
FlexDirection::Column     // "hi-flex-column"
AlignItems::Center        // "hi-items-center"
AlignItems::Stretch       // "hi-items-stretch"
JustifyContent::Center    // "hi-justify-center"
JustifyContent::Between   // "hi-justify-between"
```

#### فئات التباعد

```rust
use hikari_palette::classes::{Padding, Margin, Gap};

Padding::P4        // "hi-p-4"
Padding::Px8       // "hi-px-8"
Margin::M4         // "hi-m-4"
Margin::MyAuto     // "hi-my-auto"
Gap::Gap4          // "hi-gap-4"
```

#### فئات الألوان

```rust
use hikari_palette::classes::{TextColor, BackgroundColor};

TextColor::Primary       // "hi-text-primary"
TextColor::Secondary     // "hi-text-secondary"
BackgroundColor::Primary // "hi-bg-primary"
BackgroundColor::Surface // "hi-bg-surface"
```

#### فئات الخط

```rust
use hikari_palette::classes::{FontSize, FontWeight};

FontSize::Base       // "hi-text-base"
FontSize::XL         // "hi-text-xl"
FontSize::2XL        // "hi-text-2xl"
FontWeight::Normal   // "hi-font-normal"
FontWeight::Bold     // "hi-font-bold"
```

#### فئات الحدود

```rust
use hikari_palette::classes::{Border, BorderRadius};

Border::B            // "hi-border"
Border::B2           // "hi-border-2"
BorderRadius::Md     // "hi-rounded-md"
BorderRadius::Full   // "hi-rounded-full"
```

### دمج الفئات

```rust
use hikari_palette::{ClassesBuilder, classes::*};

// تنسيق مكون معقد
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

// الناتج: "hi-flex hi-items-center hi-justify-center hi-px-4 hi-py-2 hi-rounded-md hi-bg-primary hi-text-white"
```

### فوائد أمان النوع

```rust
// ✅ آمن للنوع - فحص وقت الترجمة
let classes = ClassesBuilder::new()
    .add(Display::Flex)
    .add(FlexDirection::Row)
    .build();

// ❌ لن يترجم - حماية من الأخطاء المطبعية
let classes = ClassesBuilder::new()
    .add(Display::Flx)  // خطأ في الترجمة!
    .build();
```

## السمات

لوحات السمات المُعدة مسبقًا.

### سمة Hikari (فاتح)

```rust
use hikari_palette::themes;

let hikari = themes::Hikari::palette();

println!("الأساسي: {}", hikari.primary.hex);   // #00A0E9
println!("الثانوي: {}", hikari.secondary.hex); // #E94B35
println!("المميز: {}", hikari.accent.hex);     // #F8B62D
println!("الخلفية: {}", hikari.background.hex); // #FFFFFF
println!("السطح: {}", hikari.surface.hex);   // #F5F5F5
```

**مخطط الألوان**:
- الأساسي: اللازورد (石青) - أزرق سماوي منعش
- الثانوي: الزنجفر (朱砂) - أحمر برتقالي نشط
- المميز: أصفر الكروم (藤黄) - أصفر ذهبي دافئ
- الخلفية: أبيض قمري (月白) - أبيض نظيف
- السطح: رمادي فاتح مع صبغة خفيفة

### سمة Tairitsu (داكن)

```rust
use hikari_palette::themes;

let tairitsu = themes::Tairitsu::palette();

println!("الأساسي: {}", tairitsu.primary.hex);   // #1a237e
println!("الثانوي: {}", tairitsu.secondary.hex); // #E94B35
println!("المميز: {}", tairitsu.accent.hex);     // #FFF176
println!("الخلفية: {}", tairitsu.background.hex); // #0D1117
println!("السطح: {}", tairitsu.surface.hex);   // #161B22
```

**مخطط الألوان**:
- الأساسي: النيلي (靛蓝) - أزرق نيلي داكن
- الثانوي: الزنجفر (朱砂) - أحمر برتقالي نشط
- المميز: أصفر الإوز (鹅黄) - أصفر باهت ساطع
- الخلفية: رمادي داكن عميق
- السطح: رمادي داكن أفتح قليلاً

### سمة مخصصة

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

### هيكل السمة

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

## الشفافية والمزج

أدوات شفافية اللون والمزج.

### دالة الشفافية

```rust
use hikari_palette::{ChineseColor, opacity};

let color = ChineseColor::Azurite;
let semi_blue = opacity(color, 0.5);

// الناتج: "rgba(0, 160, 233, 0.5)"
```

### دالة المزج

```rust
use hikari_palette::{ChineseColor, blend};

let color1 = ChineseColor::Azurite;
let color2 = ChineseColor::Cinnabar;
let blended = blend(color1, color2, 0.5);

// يمزج 50% من كل لون
```

### تفتيح اللون

```rust
use hikari_palette::{ChineseColor, lighten};

let color = ChineseColor::InkBlack;
let lighter = lighten(color, 0.2);

// يفتح بنسبة 20%
```

### تغميق اللون

```rust
use hikari_palette::{ChineseColor, darken};

let color = ChineseColor::MoonWhite;
let darker = darken(color, 0.3);

// يغمق بنسبة 30%
```

## أمثلة التكامل

### مع ThemeProvider

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
                "نص مُنسق"
            }
        }
    }
}
```

### مع المكونات

```rust
use hikari_components::Button;
use hikari_palette::ChineseColor;

rsx! {
    Button {
        variant: "primary",
        style: format!("background: {}", ChineseColor::Azurite.hex()),
        "زر مخصص"
    }
}
```

### مع فئات الأدوات

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
        "محتوى البطاقة"
    }
}
```

## مرجع واجهة البرمجة

### ChineseColor

```rust
pub enum ChineseColor {
    // سلسلة الأحمر
    Cinnabar,      // 朱砂
    Vermilion,     // 朱红
    Crimson,       // 绯红

    // سلسلة الأزرق
    Azurite,       // 石青
    Indigo,        // 靛蓝
    Cyan,          // 青色

    // سلسلة الأصفر
    VineYellow,    // 藤黄
    GooseYellow,   // 鹅黄

    // سلسلة الأخضر
    ScallionGreen, // 葱倩
    BambooGreen,   // 竹青
    Jade,          // 玉色

    // سلسلة المحايد
    InkBlack,      // 墨色
    MoonWhite,     // 月白
    LightGray,     // 缟色

    // ... أكثر من 500 لون
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
    // داخلي
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

### أدوات الألوان

```rust
pub fn opacity(color: ChineseColor, alpha: f64) -> String;
pub fn blend(color1: ChineseColor, color2: ChineseColor, factor: f64) -> String;
pub fn lighten(color: ChineseColor, amount: f64) -> String;
pub fn darken(color: ChineseColor, amount: f64) -> String;
```

## فلسفة التصميم

### الأهمية الثقافية

يحمل كل لون صيني تقليدي معنى ثقافيًا وتاريخيًا:

- **الزنجفر (朱砂)**: يُستخدم في الأختام الإمبراطورية، يمثل القوة والسلطة
- **اللازورد (石青)**: يُستخدم في الرسم التقليدي، يمثل الأناقة
- **أصفر الكروم (藤黄)**: صبغة الرسم التقليدي، الدفء والحيوية
- **أسود الحبر (墨色)**: حبر الخط العربي، يمثل المعرفة والعمق
- **أبيض قمري (月白)**: أزرق أبيض باهت، يمثل النقاء

## أفضل الممارسات

### 1. استخدم التعداد لأمان النوع

```rust
// ✅ جيد - آمن للنوع
let color = ChineseColor::Azurite;

// ❌ تجنب - قائم على السلسلة
let color = "#00A0E9";
```

### 2. استفد من لوحات السمات

```rust
// ✅ جيد - استخدم لوحة السمة
let palette = themes::Hikari::palette();
let primary = palette.primary;

// ❌ تجنب - ألوان مشفرة
let primary = "#00A0E9";
```

### 3. استخدم فئات الأدوات

```rust
// ✅ جيد - أدوات آمنة للنوع
let classes = ClassesBuilder::new()
    .add(Display::Flex)
    .add(Gap::Gap4)
    .build();

// ✅ مقبول - قائم على السلسلة (أقل أمانًا للنوع)
let classes = "hi-flex hi-gap-4";
```

### 4. التسمية الدلالية للألوان

```rust
// ✅ جيد - استخدام دلالي
let button_color = theme.palette.primary;
let error_color = theme.palette.danger;

// ❌ تجنب - مراجع ألوان مباشرة
let button_color = ChineseColor::Azurite;
let error_color = ChineseColor::Cinnabar;
```

## الأنظمة ذات الصلة

- [نظام السمات](./theme.md) - سياق السمة ومتغيرات CSS
- [المكونات](../components/) - مكتبة المكونات التي تستخدم اللوحات
- [نظام البناء](./builder.md) - تجميع SCSS مع متغيرات اللوحة

## الموارد

- [الألوان الصينية التقليدية](https://zh.wikipedia.org/wiki/%E4%B8%AD%E5%9B%BD%E4%BC%A0%E7%BB%9F%E9%A2%9C%E8%89%B2)
- [نظرية الألوان الخمسة](https://zh.wikipedia.org/wiki/%E4%BA%94%E8%A1%8C%E8%89%B2%E7%90%86%E8%AE%BA)
- [الألوان في الثقافة الصينية](https://zh.wikipedia.org/wiki/%E4%B8%AD%E5%9B%BD%E6%96%87%E5%8C%96%E4%B8%AD%E7%9A%84%E9%A2%9C%E8%89%B2)
