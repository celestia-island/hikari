# نظام الحركة

نظام حركة إعلاني عالي الأداء يدعم القيم الثابتة والقيم الديناميكية والجداول الزمنية المعقدة وأكثر من 30 دالة تسهيل.

## جدول المحتويات

- [نظرة عامة](#نظرة-عامة)
- [الميزات الأساسية](#الميزات-الأساسية)
- [AnimationBuilder](#animationbuilder)
- [Tween](#tween)
- [التسهيل](#التسهيل)
- [الجدول الزمني](#الجدول-الزمني)
- [الإعدادات المسبقة](#الإعدادات-المسبقة)
- [البقعة المضيئة](#البقعة-المضيئة)
- [السياق](#السياق)
- [النمط](#النمط)
- [أمثلة الاستخدام](#أمثلة-الاستخدام)

## نظرة عامة

يوفر `hikari-animation` حلاً كاملاً للحركة:

- **واجهة برمجة إعلانية**: بناء fluent يشبه CSS
- **القيم الديناميكية**: قيم حركة محسوبة وقت التشغيل (مثل تتبع الماوس)
- **أداء عالي**: محسن لـ WASM، تحديثات debounce، requestAnimationFrame
- **آمن للنوع**: خصائص CSS مُحققة وقت الترجمة
- **إعدادات مسبقة غنية**: تلاشي، انزلاق، تكبير وحركات شائعة أخرى

## الميزات الأساسية

### 1. AnimationBuilder

منشئ حركة متقدم يدعم:

- **تحكم متعدد العناصر**: التحكم في عناصر DOM متعددة في وقت واحد
- **القيم الديناميكية**: حساب في الوقت الفعلي بناءً على AnimationContext
- **انتقالات تلقائية**: إدارة انتقال ذكية
- **أمان النوع**: تعداد CssProperty يمنع الأخطاء المطبعية

### 2. نظام Tween

نظام حركة الاستيفاء:

- **استيفاء القيم**: انتقالات رقمية سلسة
- **تسهيل مخصص**: أكثر من 30 دالة تسهيل مدمجة
- **التحكم في الوقت**: التحكم في المدة والتأخير
- **تكرار الحلقة**: دعم التشغيل المتكرر

### 3. دوال التسهيل

مكتبة دوال تسهيل غنية:

- **الأساسية**: Linear، EaseIn، EaseOut، EaseInOut
- **الجيبية**: تسهيل جيبي
- **التربيعية**: تسهيل تربيعي
- **التكعيبية**: تسهيل تكعيبي
- **الرباعية**: تسهيل رباعي
- **الخامسية**: تسهيل خامسي
- **الأُسية**: تسهيل أسي
- **الدائرية**: تسهيل دائري
- **الخلفي**: تأثير التجاوز/الارتداد
- **المرونة**: تأثير مرن
- **الارتداد**: تأثير الارتداد

### 4. الجدول الزمني

التحكم في الجدول الزمني:

- **حركة متسلسلة**: تشغيل حركات متعددة بالتسلسل
- **حركة متوازية**: تشغيل حركات متعددة في وقت واحد
- **تنفيذ مؤجل**: تحكم دقيق في التوقيت
- **مجموعات الحركة**: تنظيم تسلسلات حركة معقدة

### 5. الإعدادات المسبقة

مكتبة حركات مسبقة:

- **التلاشي**: تلاشي للداخل/الخارج
- **الانزلاق**: انزلاق للداخل/الخارج
- **التكبير**: حركة التكبير
- **الدوران**: حركة الدوران
- **القلب**: حركة القلب
- **التكبير والتصغير**: تكبير للداخل/الخارج

### 6. البقعة المضيئة

تأثير البقعة المضيئة:

- **تتبع الماوس**: تأثير التوهج يتبع مؤشر الماوس
- **إضاءة متدرجة**: تدرجات شعاعية سلسة
- **الأداء**: تحديثات debounce، إعادة رسم مقيدة
- **تهيئة تلقائية**: فحص وتهيئة عناصر البقعة المضيئة

## AnimationBuilder

### الاستخدام الأساسي

```rust
use hikari_animation::{AnimationBuilder, AnimationContext};
use hikari_animation::style::CssProperty;
use std::collections::HashMap;

// إنشاء تعيين العناصر
let mut elements = HashMap::new();
elements.insert("button".to_string(), button_element);

// تطبيق أنماطة ثابتة
AnimationBuilder::new(&elements)
    .add_style("button", CssProperty::Opacity, "0.8")
    .add_class("button", "hi-flex")
    .apply();
```

### حركة القيمة الديناميكية

```rust
// تأثير تتبع الماوس
AnimationBuilder::new(&elements)
    .add_style_dynamic("button", CssProperty::Transform, |ctx| {
        let x = ctx.mouse_x();
        let y = ctx.mouse_y();
        format!("translate({}px, {}px)", x, y)
    })
    .apply_with_transition("150ms", "ease-out");
```

### حركة متعددة العناصر

```rust
// التحكم في عناصر متعددة في وقت واحد
let mut elements = HashMap::new();
elements.insert("button".to_string(), button_element);
elements.insert("icon".to_string(), icon_element);

AnimationBuilder::new(&elements)
    .add_style("button", CssProperty::Opacity, "0.8")
    .add_style("icon", CssProperty::Transform, "scale(1.1)")
    .add_class("button", "hi-flex")
    .apply();
```

### حركة الانتقال

```rust
// حركة مع انتقال
AnimationBuilder::new(&elements)
    .add_style("button", CssProperty::Width, "100px")
    .apply_with_transition("300ms", "ease-in-out");

// خصائص انتقال مخصصة
AnimationBuilder::new(&elements)
    .add_style("button", CssProperty::Transform, "rotate(90deg)")
    .apply_with_transition("500ms", "cubic-bezier(0.68, -0.55, 0.265, 1.55)");
```

### مرجع واجهة البرمجة

```rust
impl AnimationBuilder {
    pub fn new(elements: &HashMap<String, Element>) -> Self;

    pub fn add_style(self, element: &str, property: CssProperty, value: &str) -> Self;
    pub fn add_style_dynamic<F>(self, element: &str, property: CssProperty, f: F) -> Self
    where
        F: Fn(&AnimationContext) -> String + 'static;

    pub fn add_class(self, element: &str, class: &str) -> Self;
    pub fn remove_class(self, element: &str, class: &str) -> Self;

    pub fn apply(self);
    pub fn apply_with_transition(self, duration: &str, easing: &str);
}
```

## Tween

الاستيفاء بين القيم بمرور الوقت.

### Tween الأساسي

```rust
use hikari_animation::tween::{Tween, TweenBuilder};

let tween = TweenBuilder::new()
    .from(0.0)
    .to(100.0)
    .duration(1000) // مللي ثانية
    .easing(ease::EaseOut)
    .build();
```

### Tween مع الاستدعاءات

```rust
let tween = TweenBuilder::new()
    .from(0.0)
    .to(1.0)
    .duration(500)
    .on_update(|value| {
        println!("القيمة الحالية: {}", value);
    })
    .on_complete(|| {
        println!("اكتملت الحركة!");
    })
    .build();
```

### Tweens المتسلسلة

```rust
let mut timeline = Timeline::new();

timeline.push(
    TweenBuilder::new()
        .from(0.0)
        .to(100.0)
        .duration(300)
        .build()
);

timeline.push(
    TweenBuilder::new()
        .from(100.0)
        .to(0.0)
        .duration(300)
        .delay(200)
        .build()
);

timeline.play();
```

## التسهيل

تتحكم دوال التسهيل في معدل الحركة.

### التسهيل الأساسي

```rust
use hikari_animation::easing;

// خطي - بدون تسهيل
linear(0.5); // 0.5

// Ease In - يبدأ بطيئًا، ينتهي سريعًا
ease_in(0.5); // 0.25

// Ease Out - يبدأ سريعًا، ينتهي بطيئًا
ease_out(0.5); // 0.75

// Ease In Out - بطيء في كلا الطرفين
ease_in_out(0.5); // 0.5
```

### التسهيل المتقدم

```rust
// الخلفي - يتجاوز قليلاً
back_out(0.5); // 1.2

// المرن - يتذبذب
elastic_out(0.5); // 1.0

// الارتداد - يرتد في النهاية
bounce_out(0.5); // 0.75
```

## الجدول الزمني

التحكم في تسلسلات الحركة والتوقيت.

### الحركات المتسلسلة

```rust
use hikari_animation::Timeline;

let mut timeline = Timeline::new();

// إضافة حركات بالتسلسل
timeline.add(
    AnimationBuilder::new(&elements)
        .add_style("box", CssProperty::Opacity, "0")
        .build()
);

timeline.add(
    AnimationBuilder::new(&elements)
        .add_style("box", CssProperty::Opacity, "1")
        .with_delay(200)
        .build()
);

timeline.play();
```

### الحركات المتوازية

```rust
let mut timeline = Timeline::new();

// تشغيل الحركات في وقت واحد
timeline.add_parallel(
    AnimationBuilder::new(&elements)
        .add_style("box", CssProperty::Transform, "translateX(100px)")
        .build()
);

timeline.add_parallel(
    AnimationBuilder::new(&elements)
        .add_style("box", CssProperty::Opacity, "0.5")
        .build()
);

timeline.play();
```

### التحكم في الجدول الزمني

```rust
let timeline = Timeline::new();

// التحكم في التشغيل
timeline.play();      // بدء التشغيل
timeline.pause();     // إيقاف مؤقت
timeline.reverse();   // عكس التشغيل
timeline.seek(0.5);   // الانتقال إلى 50%

// التحكم في السرعة
timeline.set_speed(2.0);  // سرعة 2x
timeline.set_speed(0.5);  // سرعة 0.5x

// التحكم في الحلقة
timeline.set_loop(true);
timeline.set_repeat_count(3);
```

## الإعدادات المسبقة

حركات مسبقة البناء.

### حركات التلاشي

```rust
use hikari_animation::presets;

// تلاشي للداخل
presets::fade_in(&elements, "box", 300);

// تلاشي للخارج
presets::fade_out(&elements, "box", 300);

// التلاشي إلى شفافية محددة
presets::fade_to(&elements, "box", 0.5, 300);
```

### حركات الانزلاق

```rust
// انزلاق من اليسار
presets::slide_in_left(&elements, "box", 300);

// انزلاق من اليمين
presets::slide_in_right(&elements, "box", 300);

// انزلاق إلى اليسار
presets::slide_out_left(&elements, "box", 300);

// انزلاق من الأعلى
presets::slide_in_top(&elements, "box", 300);
```

### حركات التكبير

```rust
// تكبير
presets::scale_up(&elements, "box", 1.5, 300);

// تصغير
presets::scale_down(&elements, "box", 0.8, 300);

// نبض
presets::pulse(&elements, "box", 300);
```

### حركات الدوران

```rust
// دوران مع عقارب الساعة
presets::rotate_cw(&elements, "box", 90, 500);

// دوران عكس عقارب الساعة
presets::rotate_ccw(&elements, "box", 90, 500);

// قلب
presets::flip_x(&elements, "box", 500);
presets::flip_y(&elements, "box", 500);
```

## البقعة المضيئة

تأثير توهج يتبع الماوس للعناصر.

### البقعة المضيئة الأساسية

```rust
use hikari_animation::spotlight;

// تهيئة البقعة المضيئة على جميع الأزرار
spotlight::init();

// أو التهيئة على عناصر محددة
spotlight::init_selector(".hi-button");
```

### بقعة مضيئة مخصصة

```rust
spotlight::Config {
    size: 200,              // حجم البقعة بالبكسل
    opacity: 0.15,          // الشفافية (0-1)
    color: "#00A0E9",       // لون التوهج
    blur: 20,              // نصف قطر الضبابية بالبكسل
    transition: "150ms"     // سرعة الانتقال
}.init();
```

### البقعة المضيئة في المكونات

```rust
rsx! {
    Button {
        label: "مرر فوقي",
        class: "hi-spotlight",  // تفعيل البقعة المضيئة
        "Data: spot-{spot_id}"   // معرف فريد
    }
}
```

## السياق

يوفر سياق الحركة معلومات وقت التشغيل.

### موقع الماوس

```rust
AnimationBuilder::new(&elements)
    .add_style_dynamic("target", CssProperty::Transform, |ctx| {
        let x = ctx.mouse_x();
        let y = ctx.mouse_y();
        format!("translate({}px, {}px)", x, y)
    })
    .apply();
```

### حركة قائمة على الوقت

```rust
.add_style_dynamic("clock", CssProperty::Transform, |ctx| {
    let time = ctx.elapsed_time();
    let angle = (time.as_millis() % 1000) as f64 / 1000.0 * 360.0;
    format!("rotate({}deg)", angle)
})
```

### موقع التمرير

```rust
.add_style_dynamic("header", CssProperty::Background, |ctx| {
    let scroll_y = ctx.scroll_y();
    let opacity = (scroll_y / 100.0).min(1.0);
    format!("rgba(0, 160, 233, {})", opacity)
})
```

## النمط

معالجة خصائص CSS آمنة للنوع.

### تعداد CssProperty

```rust
use hikari_animation::style::CssProperty;

// خصائص اللون
CssProperty::Color
CssProperty::BackgroundColor
CssProperty::BorderColor

// خصائص التخطيط
CssProperty::Width
CssProperty::Height
CssProperty::Margin
CssProperty::Padding

// خصائص التحويل
CssProperty::Transform
CssProperty::Translate
CssProperty::Scale
CssProperty::Rotate

// خصائص التأثير
CssProperty::Opacity
CssProperty::BoxShadow
CssProperty::Filter
```

### معالجة النمط

```rust
// تعيين خاصية واحدة
builder.add_style("element", CssProperty::Color, "#00A0E9");

// تعيين التحويل
builder.add_style("element", CssProperty::Transform, "translate(10px, 20px)");

// تعيين الشفافية
builder.add_style("element", CssProperty::Opacity, "0.5");

// تحويل معقد
builder.add_style("element", CssProperty::Transform,
    "perspective(1000px) rotateX(45deg) translateZ(50px)");
```

### خصائص CSS المخصصة

```rust
// خاصية مخصصة
builder.add_style("element", CssProperty::Custom("--my-var"), "value");

// واستخدامها
builder.add_style("element", CssProperty::Color, "var(--my-var)");
```

## أمثلة الاستخدام

### تأثير تمرير الزر

```rust
use hikari_animation::{AnimationBuilder, AnimationContext};
use hikari_animation::style::CssProperty;

#[component]
fn AnimatedButton() -> Element {
    let elements = use_signal(|| {
        let mut map = HashMap::new();
        map.insert("btn".to_string(), get_button_element());
        map
    });

    rsx! {
        button {
            class: "hi-button hi-spotlight",
            onmouseenter: move |_| {
                AnimationBuilder::new(&elements())
                    .add_style("btn", CssProperty::Transform, "scale(1.05)")
                    .add_style("btn", CssProperty::BoxShadow, "0 8px 16px rgba(0, 160, 233, 0.3)")
                    .apply_with_transition("200ms", "ease-out");
            },
            onmouseleave: move |_| {
                AnimationBuilder::new(&elements())
                    .add_style("btn", CssProperty::Transform, "scale(1)")
                    .add_style("btn", CssProperty::BoxShadow, "none")
                    .apply_with_transition("200ms", "ease-out");
            },
            "مرر فوقي"
        }
    }
}
```

### حركة التحميل

```rust
#[component]
fn LoadingSpinner() -> Element {
    let elements = use_signal(|| HashMap::new());

    use_effect(move || {
        let elements = elements.clone();
        async move {
            loop {
                AnimationBuilder::new(&elements())
                    .add_style("spinner", CssProperty::Transform, "rotate(0deg)")
                    .build();

                AnimationBuilder::new(&elements())
                    .add_style("spinner", CssProperty::Transform, "rotate(360deg)")
                    .apply_with_transition("1000ms", "linear");

                tokio::time::sleep(Duration::from_millis(1000)).await;
            }
        }
    });

    rsx! {
        div {
            id: "spinner",
            style: "width: 40px; height: 40px; border: 4px solid var(--hi-color-primary); border-top-color: transparent; border-radius: 50%;"
        }
    }
}
```

### التمرير البارالاكس

```rust
#[component]
fn ParallaxSection() -> Element {
    let scroll_y = use_signal(|| 0.0);

    rsx! {
        div {
            onscroll: move |e| {
                scroll_y.set(e.scroll_y());

                AnimationBuilder::new(&elements())
                    .add_style_dynamic("bg", CssProperty::Transform, |ctx| {
                        let y = ctx.scroll_y() * 0.5;
                        format!("translateY({}px)", y)
                    })
                    .apply_with_transition("100ms", "ease-out");
            },
            div {
                id: "bg",
                style: "position: fixed; width: 100%; height: 100%; background: url(bg.jpg);"
            },
            div {
                style: "position: relative; z-index: 1;",
                "المحتوى"
            }
        }
    }
}
```

### عداد متحرك

```rust
#[component]
fn AnimatedCounter() -> Element {
    let mut count = use_signal(|| 0);

    use_effect(move || {
        let target = 1000;
        let duration = 2000; // ثانيتان
        let steps = 60;
        let step_value = target as f64 / steps as f64;
        let step_duration = duration / steps;

        async move {
            for i in 0..=steps {
                count.set((i as f64 * step_value) as i32);
                tokio::time::sleep(Duration::from_millis(step_duration)).await;
            }
        }
    });

    rsx! {
        div {
            class: "counter",
            "{count()}"
        }
    }
}
```

## تحسين الأداء

### تحديثات Debounce

```rust
use hikari_animation::AnimationBuilder;

// AnimationBuilder يقوم تلقائيًا بـ debounce للتحديثات
AnimationBuilder::new(&elements)
    .add_style_dynamic("element", CssProperty::Transform, |ctx| {
        // هذا مؤجل - لن يتم تحديثه عند كل حركة ماوس
        let x = ctx.mouse_x();
        format!("translateX({}px)", x)
    })
    .apply_with_transition("100ms", "ease-out");
```

### RequestAnimationFrame

يستخدم نظام الحركة `requestAnimationFrame` لحركات سلسة بـ 60 إطار في الثانية:

```rust
// تكامل RAF تلقائي
AnimationBuilder::new(&elements)
    .add_style("anim", CssProperty::Opacity, "1")
    .apply_with_transition("1000ms", "ease");
```

### تسريع GPU

استخدم التحويل والشفافية لحركات مسرعة بـ GPU:

```rust
// ✅ جيد - مسرع بـ GPU
builder.add_style("element", CssProperty::Transform, "translateX(100px)");
builder.add_style("element", CssProperty::Opacity, "0.5");

// ❌ تجنب - يحفز التخطيط
builder.add_style("element", CssProperty::Width, "100px");
builder.add_style("element", CssProperty::Margin, "10px");
```

### تلميح Will-change

```css
/* تلميح للمتصفح للتحسين */
.animated-element {
    will-change: transform, opacity;
}
```

## مرجع واجهة البرمجة

### AnimationBuilder

```rust
pub struct AnimationBuilder<'a> {
    elements: &'a HashMap<String, Element>,
}

impl<'a> AnimationBuilder<'a> {
    pub fn new(elements: &'a HashMap<String, Element>) -> Self;

    pub fn add_style(self, element: &str, property: CssProperty, value: &str) -> Self;
    pub fn add_style_dynamic<F>(self, element: &str, property: CssProperty, f: F) -> Self
    where
        F: Fn(&AnimationContext) -> String + 'static;

    pub fn add_class(self, element: &str, class: &str) -> Self;
    pub fn remove_class(self, element: &str, class: &str) -> Self;

    pub fn apply(self);
    pub fn apply_with_transition(self, duration: &str, easing: &str);
    pub fn apply_with_custom_transition(self, transition: &str);
}
```

### AnimationContext

```rust
pub struct AnimationContext<'a> {
    pub mouse_x: f64,
    pub mouse_y: f64,
    pub scroll_x: f64,
    pub scroll_y: f64,
    pub elapsed_time: Duration,
    pub window_width: f64,
    pub window_height: f64,
}

impl<'a> AnimationContext<'a> {
    pub fn mouse_x(&self) -> f64;
    pub fn mouse_y(&self) -> f64;
    pub fn scroll_x(&self) -> f64;
    pub fn scroll_y(&self) -> f64;
    pub fn elapsed_time(&self) -> Duration;
}
```

### Timeline

```rust
pub struct Timeline {
    // داخلي
}

impl Timeline {
    pub fn new() -> Self;

    pub fn add(&mut self, animation: Animation) -> &mut Self;
    pub fn add_parallel(&mut self, animation: Animation) -> &mut Self;

    pub fn play(&mut self);
    pub fn pause(&mut self);
    pub fn stop(&mut self);
    pub fn reverse(&mut self);
    pub fn seek(&mut self, progress: f64);

    pub fn set_speed(&mut self, speed: f64);
    pub fn set_loop(&mut self, loop: bool);
    pub fn set_repeat_count(&mut self, count: usize);
}
```

## أفضل الممارسات

### 1. استخدم الانتقالات باعتدال

```rust
// ✅ جيد - فقط عند تفاعل المستخدم
button {
    onmouseenter: move |_| {
        builder.apply_with_transition("200ms", "ease");
    }
}

// ❌ تجنب - حركة مستمرة
loop {
    builder.apply_with_transition("16ms", "linear"); // 60 إطار، ثقيل!
}
```

### 2. فضّل التحويل على التخطيط

```rust
// ✅ جيد - مسرع بـ GPU
builder.add_style("el", CssProperty::Transform, "translateX(100px)");

// ❌ تجنب - اضطراب التخطيط
builder.add_style("el", CssProperty::Margin, "100px");
```

### 3. استخدم التسهيل المناسب

```rust
// إحساس طبيعي
"ease-out"      // تباطؤ
"ease-in-out"   // تسارع ثم تباطؤ

// إحساس ميكانيكي
"linear"        // سرعة ثابتة

// مرح
"elastic-out"   // يتذبذب
"bounce-out"    // يرتد في النهاية
```

### 4. احترم تقليل الحركة

```rust
use_effect(move || {
    let prefers_reduced_motion = window()
        .match_media("(prefers-motion: reduce)")
        .ok()
        .and_then(|m| m.matches());

    if prefers_reduced_motion.unwrap_or(false) {
        // استخدم حركات أبسط
        builder.apply_with_transition("0ms", "linear");
    } else {
        // حركة كاملة
        builder.apply_with_transition("300ms", "ease-out");
    }
});
```

## الأنظمة ذات الصلة

- [نظام السمات](./theme.md) - متغيرات CSS للحركات
- [المكونات](../components/) - مكونات واجهة متحركة
- [نظام اللوحات](./palette.md) - تعريفات الألوان
