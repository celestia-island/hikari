# نظرة عامة على بنية النظام

يعتمد إطار عمل هيكاري تصميماً معيارياً، يتكون من حزم مستقلة متعددة، كل منها مسؤول عن مجالات وظيفية محددة.

## الأنظمة الأساسية

### 1. نظام اللوحة (hikari-palette)

تنفيذ Rust لنظام الألوان الصينية التقليدية.

**المسؤوليات**:
- يوفر أكثر من 500 تعريف لون صيني تقليدي
- إدارة لوحات السمات
- مولد فئات الأدوات
- العتامة ومزج الألوان

**الميزات الأساسية**:
```rust
use hikari_palette::{ChineseColor, opacity};

// استخدام الألوان التقليدية
let red = ChineseColor::Cinnabar;
let blue = ChineseColor::Azurite;

// معالجة العتامة
let semi_red = opacity(red, 0.5);

// نظام السمات
let theme = Hikari::default();
println!("الأساسي: {}", theme.primary.hex());
```

**فلسفة التصميم**:
- **الثقة الثقافية**: استخدام أسماء الألوان التقليدية
- **أمان الأنواع**: فحص قيم الألوان في وقت الترجمة
- **أداء عالٍ**: تجريدات بدون تكلفة

### 2. نظام السمات (hikari-theme)

سياق السمة ونظام حقن الأنماط.

**المسؤوليات**:
- مكون مزود السمة
- إدارة سياق السمة
- توليد متغيرات CSS
- تبديل السمات

**الميزات الأساسية**:
```rust
use hikari_theme::ThemeProvider;

rsx! {
    ThemeProvider { palette: "hikari" } {
        // محتوى التطبيق
        App {}
    }
}
```

**السمات المدعومة**:
- **هيكاري (فاتح)** - سمة فاتحة
  - الأساسي: الأزوريت (#00A0E9)
  - الثانوي: القرمزي (#E94B35)
  - التمييز: الأصفر الكرمة (#F8B62D)

- **تايريتسو** - سمة داكنة
  - الأساسي: النيلي (#1a237e)
  - الثانوي: القرمزي (#E94B35)
  - التمييز: الأصفر الإوز (#FFF176)

### 3. نظام الرسوم المتحركة (hikari-animation)

نظام رسوم متحركة تصريحي عالي الأداء.

**المسؤوليات**:
- باني الرسوم المتحركة
- سياق الرسوم المتحركة
- دوال التسهيل
- رسوم متحركة مسبقة

**الميزات الأساسية**:
```rust
use hikari_animation::{AnimationBuilder, AnimationContext};
use hikari_animation::style::CssProperty;

// رسوم متحركة ثابتة
AnimationBuilder::new(&elements)
    .add_style("button", CssProperty::Opacity, "0.8")
    .apply_with_transition("300ms", "ease-in-out");

// رسوم متحركة ديناميكية (متابعة الفأرة)
AnimationBuilder::new(&elements)
    .add_style_dynamic("button", CssProperty::Transform, |ctx| {
        let x = ctx.mouse_x();
        let y = ctx.mouse_y();
        format!("translate({}px, {}px)", x, y)
    })
    .apply_with_transition("150ms", "ease-out");
```

**مكونات البنية**:
- **builder** - واجهة برمجة باني الرسوم المتحركة
- **context** - سياق الرسوم المتحركة أثناء التشغيل
- **style** - عمليات CSS آمنة للأنواع
- **easing** - أكثر من 30 دالة تسهيل
- **tween** - نظام الاستيفاء
- **timeline** - تحكم الجدول الزمني
- **presets** - رسوم متحركة مسبقة (تلاشي، انزلاق، تكبير)
- **spotlight** - تأثير البقعة الضوئية

**ميزات الأداء**:
- تحسين WASM
- تحديثات debounce
- تكامل requestAnimationFrame
- تقليل إعادة التدفق وإعادة الرسم

### 4. نظام الأيقونات (hikari-icons)

نظام إدارة وعرض الأيقونات.

**المسؤوليات**:
- تعريفات تعداد الأيقونات
- توليد محتوى SVG
- متغيرات حجم الأيقونات
- تكامل Lucide Icons

**الميزات الأساسية**:
```rust
use hikari_icons::{Icon, LucideIcon};

rsx! {
    Icon {
        icon: LucideIcon::Search,
        size: 24,
        color: "var(--hi-primary)"
    }
}
```

**مصادر الأيقونات**:
- Lucide Icons (أكثر من 1000 أيقونة)
- أيقونات مخصصة قابلة للتوسعة
- دعم أحجام متعددة

### 5. مكتبة المكونات (hikari-components)

مكتبة مكونات واجهة مستخدم كاملة.

**المسؤوليات**:
- مكونات واجهة المستخدم الأساسية
- مكونات التخطيط
- سجل الأنماط
- خطافات مستجيبة

**فئات المكونات**:

1. **المكونات الأساسية** (ميزة: "basic")
   - زر، حقل إدخال، بطاقة، شارة

2. **مكونات التغذية الراجعة** (ميزة: "feedback")
   - تنبيه، إشعار، تلميح، بقعة ضوئية

3. **مكونات التنقل** (ميزة: "navigation")
   - قائمة، تبويبات، مسار التنقل

4. **مكونات التخطيط** (متاحة دائماً)
   - تخطيط، رأس، جانب، محتوى، تذييل

5. **مكونات البيانات** (ميزة: "data")
   - جدول، شجرة، ترقيم الصفحات

**التصميم المعياري**:
```
hikari-components/
├── basic/          # المكونات الأساسية
├── feedback/       # مكونات التغذية الراجعة
├── navigation/     # مكونات التنقل
├── layout/         # مكونات التخطيط
├── data/           # مكونات البيانات
├── hooks.rs        # خطافات React
├── styled.rs       # سمات الأنماط
└── theme_provider.rs  # مزود السمة
```

**نظام الأنماط**:
- مصدر SCSS
- فئات أدوات آمنة للأنواع
- عزل الأنماط على مستوى المكون
- تكامل متغيرات CSS

### 6. نظام البناء (hikari-builder)

توليد الكود في وقت الترجمة وتجميع SCSS.

**المسؤوليات**:
- تجميع SCSS (باستخدام Grass)
- اكتشاف المكونات
- توليد الكود
- تجميع الموارد

**عملية البناء**:
```
1. البحث عن دليل جذر مساحة العمل
   ↓
2. فحص ملفات SCSS
   ↓
3. توليد ثوابت Rust
   ↓
4. تجميع حزمة SCSS
   ↓
5. الإخراج إلى public/
```

**الاستخدام**:
```rust
// build.rs
fn main() {
    hikari_builder::build().expect("فشل البناء");
}
```

**الملفات المولدة**:
- `packages/builder/src/generated/components.rs` - ثوابت المكونات
- `public/styles/bundle.css` - CSS المجمّع

### 7. خدمة العرض (hikari-render-service)

العرض من جانب الخادم وخدمة الأصول الثابتة.

**المسؤوليات**:
- عرض قوالب HTML
- سجل الأنماط
- باني المسارات
- خدمة الأصول الثابتة
- تكامل Axum

**الميزات الأساسية**:
```rust
use hikari_render_service::HikariRenderServicePlugin;

let app = HikariRenderServicePlugin::new()
    .component_style_registry(registry)
    .static_assets("./dist", "/static")
    .add_route("/api/health", get(health_check))
    .build()?;
```

**وحدات البنية**:
- **html** - خدمة HTML
- **registry** - سجل الأنماط
- **router** - باني المسارات
- **static_files** - خدمة الملفات الثابتة
- **styles_service** - حقن الأنماط
- **plugin** - نظام الإضافات

### 8. مكتبة المكونات الإضافية (hikari-extra-components)

مكونات واجهة مستخدم متقدمة لسيناريوهات التفاعل المعقدة.

**المسؤوليات**:
- مكونات أدوات متقدمة
- تفاعلات السحب والتكبير
- لوحات قابلة للطي
- تكامل الرسوم المتحركة

**المكونات الأساسية**:

1. **Collapsible** - لوحة قابلة للطي
   - رسوم متحركة للانزلاق للداخل/الخارج يسار/يمين
   - عرض قابل للتكوين
   - رد اتصال حالة التوسيع

2. **DragLayer** - طبقة السحب
   - قيود الحدود
   - ردود اتصال أحداث السحب
   - z-index مخصص

3. **ZoomControls** - عناصر تحكم التكبير
   - دعم اختصارات لوحة المفاتيح
   - نطاق تكبير قابل للتكوين
   - خيارات تموضع متعددة

**الميزات الأساسية**:
```rust
use hikari_extra_components::{Collapsible, DragLayer, ZoomControls};

// لوحة قابلة للطي
Collapsible {
    title: "الإعدادات".to_string(),
    expanded: true,
    position: CollapsiblePosition::Right,
    div { "المحتوى" }
}

// طبقة السحب
DragLayer {
    initial_x: 100.0,
    initial_y: 100.0,
    constraints: DragConstraints {
        min_x: Some(0.0),
        max_x: Some(500.0),
        ..Default::default()
    },
    div { "اسحبني" }
}

// عناصر تحكم التكبير
ZoomControls {
    zoom: 1.0,
    on_zoom_change: move |z| println!("التكبير: {}", z)
}
```

## مبادئ البنية

### 1. التصميم المعياري

كل حزمة مستقلة ويمكن استخدامها بشكل منفصل:

```toml
# استخدام اللوحة فقط
[dependencies]
hikari-palette = "0.1"

# استخدام المكونات والسمة
[dependencies]
hikari-components = "0.1"
hikari-theme = "0.1"

# استخدام نظام الرسوم المتحركة
[dependencies]
hikari-animation = "0.1"
```

### 2. البنية الطبقية

```
┌─────────────────────────────────────┐
│      طبقة التطبيق (examples/)        │
├─────────────────────────────────────┤
│    طبقة المكونات (hikari-components)  │
├─────────────────────────────────────┤
│  طبقة النظام (theme, animation, icons)│
├─────────────────────────────────────┤
│   طبقة الأساس (palette, builder)     │
└─────────────────────────────────────┘
```

### 3. تدفق البيانات أحادي الاتجاه

```
إجراء المستخدم ← معالج الحدث ← تحديث الحالة ← إعادة عرض واجهة المستخدم
```

### 4. أمان الأنواع

جميع واجهات برمجة التطبيقات آمنة للأنواع:
- فحص في وقت الترجمة
- إكمال تلقائي في IDE
- أمان إعادة البناء

### 5. الأداء أولاً

- تحسين WASM
- التمرير الافتراضي
- Debouncing/throttling
- تقليل التلاعب بـ DOM

## عملية البناء

### وضع التطوير
```bash
cargo run
```

### بناء الإنتاج
```bash
# 1. بناء كود Rust
cargo build --release

# 2. نظام البناء يجمع SCSS تلقائياً
# 3. توليد حزمة CSS
# 4. تجميع الأصول الثابتة
```

### بناء WASM
```bash
trunk build --release
```

## التبعيات

```
hikari-components
├── hikari-palette
├── hikari-theme
├── hikari-animation
└── hikari-icons

hikari-extra-components
├── hikari-palette
├── hikari-theme
└── hikari-animation

hikari-render-service
├── hikari-components
└── axum

hikari-builder
└── grass (مترجم SCSS)
```

## القابلية للتوسعة

### إضافة مكونات مخصصة

```rust
use hikari_components::{StyledComponent, StyleRegistry};

pub struct MyComponent;

impl StyledComponent for MyComponent {
    fn register_styles(registry: &mut StyleRegistry) {
        registry.register("my-component", include_str!("my-component.scss"));
    }
}
```

### إضافة سمات مخصصة

```rust
use hikari_palette::ThemePalette;

struct CustomTheme;

impl CustomTheme {
    pub fn palette() -> ThemePalette {
        ThemePalette {
            primary: "#FF0000",
            secondary: "#00FF00",
            // ...
        }
    }
}
```

### إضافة رسوم متحركة مسبقة مخصصة

```rust
use hikari_animation::{AnimationBuilder, AnimationContext};

pub fn fade_in(
    builder: AnimationBuilder,
    element: &str,
    duration: u32,
) -> AnimationBuilder {
    builder
        .add_style(element, CssProperty::Opacity, "0")
        .add_style(element, CssProperty::Opacity, "1")
        .apply_with_transition(&format!("{}ms", duration), "ease-out")
}
```

## تحسين الأداء

### 1. تحسين CSS
- SCSS مجمّع إلى CSS محسّن
- إزالة الأنماط غير المستخدمة (tree-shaking)
- تصغير CSS للإنتاج

### 2. تحسين WASM
- تحسين `wasm-opt`
- تحميل وحدات WASM الكسول
- تحسين الذاكرة الخطية

### 3. تحسين وقت التشغيل
- التمرير الافتراضي (قوائم البيانات الكبيرة)
- تحديثات رسوم متحركة debounce
- requestAnimationFrame

### 4. تحسين البناء
- تجميع متوازي
- تجميع تزايدي
- تخزين مؤقت للثنائيات

## استراتيجية الاختبار

### اختبارات الوحدة
كل وحدة لديها اختبارات وحدة كاملة:

```rust
#[cfg(test)]
mod tests {
    #[test]
    fn test_color_conversion() {
        let color = ChineseColor::Cinnabar;
        assert_eq!(color.hex(), "#E94B35");
    }
}
```

### اختبارات التكامل
تخدم التطبيقات النموذجية في `examples/` كاختبارات تكامل

### اختبار الانحدار البصري
استخدام Percy أو أدوات مشابهة لاختبار لقطات واجهة المستخدم

## الخطوات التالية

- اقرأ [توثيق المكونات](../components/) للمكونات المحددة
- اعرض [توثيق API](https://docs.rs/hikari-components) لتفاصيل API
- تصفح [الكود النموذجي](../../examples/) لتعلم أفضل الممارسات
