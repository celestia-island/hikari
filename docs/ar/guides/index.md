# إطار عمل هيكاري واجهة المستخدم

> إطار عمل حديث لواجهة المستخدم مبني بلغة Rust باستخدام Tairitsu + Grass + Axum
>
> **نمط التصميم**: تصميم مسطح على طراز Arknights + جماليات FUI الخيالية العلمية + الألوان الصينية التقليدية
>
> **أصل الاسم**: "هيكاري" (الضوء) من لعبة الإيقاع Arcaea

## ما هو هيكاري؟

هيكاري هو إطار عمل حديث لواجهة المستخدم مصمم لنظام Rust البيئي، يجمع بين جماليات الألوان الصينية التقليدية وتصميم واجهات الخيال العلمي. يعتمد الإطار تصميماً معيارياً، يوفر مكتبة مكونات كاملة، ونظام سمات، ونظام رسوم متحركة.

## الميزات الأساسية

### 🎨 نظام الألوان الصينية التقليدية
- **أكثر من 500 لون تقليدي**: لوحة ألوان صينية تقليدية كاملة
- **نظام السمات**: سمات مدمجة هيكاري (فاتح) وتايريتسو (داكن)
- **أمان الأنواع**: فحص قيم الألوان في وقت الترجمة

### 🧩 مكتبة مكونات غنية
- **المكونات الأساسية**: زر، حقل إدخال، بطاقة، شارة
- **مكونات التغذية الراجعة**: تنبيه، إشعار، تلميح، بقعة ضوئية
- **مكونات التنقل**: قائمة، تبويبات، مسار التنقل
- **مكونات البيانات**: جدول، شجرة، ترقيم الصفحات
- **مكونات التخطيط**: تخطيط، رأس، جانب، محتوى، تذييل
- **مكونات إضافية**: قابلة للطي، طبقة سحب، عناصر تحكم التكبير

### ✨ نظام رسوم متحركة قوي
- **رسوم متحركة تصريحية**: API سلس يشبه CSS
- **قيم ديناميكية**: قيم رسوم متحركة محسوبة أثناء التشغيل
- **دوال التسهيل**: أكثر من 30 دالة تسهيل
- **رسوم متحركة مسبقة**: تلاشي، انزلاق، تكبير، إلخ

### 🎯 ميزات متقدمة
- **العرض من جانب الخادم**: دعم SSR كامل
- **أمان الأنواع**: الاستفادة الكاملة من نظام أنواع Rust
- **التصميم المستجيب**: أدوات تخطيط مستجيبة مدمجة
- **نظام البناء**: تجميع SCSS آلي وتوليد الأصول

## البدء السريع

### تثبيت التبعيات

أضف إلى `Cargo.toml`:

```toml
[dependencies]
hikari-components = "0.1"
hikari-palette = "0.1"
hikari-theme = "0.1"
tairitsu = "0.5"
```

### الاستخدام الأساسي

```rust
use hikari_components::{ThemeProvider, Button};
use hikari_theme::ThemeProvider;

#[component]
fn App() -> Element {
    rsx! {
        ThemeProvider { palette: "hikari" } {
            div { class: "hi-flex hi-flex-col hi-gap-4" {
                Button { label: "اضغط هنا" }
                Button { label: "زر رئيسي", variant: "primary" }
                Button { label: "زر ثانوي", variant: "secondary" }
            }
        }
    }
}
```

### البناء والتشغيل

```bash
# وضع التطوير
cargo run

# البناء
cargo build --release

# بناء WASM
trunk build --release
```

## فلسفة التصميم

### تصميم Arknights المسطح
- خطوط نظيفة وتسلسل هرمي واضح للمعلومات
- تباين عالٍ للقراءة
- تصميم بسيط لكن مكرر

### جماليات FUI الخيالية العلمية
- تأثيرات توهج دقيقة
- مؤشرات ديناميكية (أضواء تنفسية، رسوم نبضية)
- حدود دقيقة وأنماط هندسية

### الألوان الصينية التقليدية
- الأساسية: 石青 (أزرق سماوي)، 朱砂 (أحمر قرمزي)، 藤黄 (أصفر جامبوج)
- المحايدة: 月白 (أبيض فاتح)، 墨色 (أسود حبر)، 缟色 (رمادي فاتح)
- الوظيفية: 葱倩 (نجاح)، 鹅黄 (تحذير)، 朱砂 (خطر)

## هيكل المشروع

```
hikari/
├── packages/
│   ├── hikari-palette/          # لوحة الألوان الصينية التقليدية
│   ├── hikari-theme/            # نظام السمات
│   ├── hikari-animation/        # نظام الرسوم المتحركة
│   ├── hikari-icons/            # نظام الأيقونات
│   ├── hikari-components/       # مكتبة المكونات
│   ├── hikari-extra-components/ # مكتبة المكونات الإضافية
│
└── examples/
    ├── website/                 # الموقع الرسمي
    ├── table-demo/              # عرض توضيحي للجدول
    ├── tree-demo/               # عرض توضيحي للشجرة
    └── node-graph-demo/         # عرض توضيحي للرسم البياني
```

## التوثيق

- [المكونات](./components/) - دليل استخدام مكونات واجهة المستخدم
- [النظام](./system/) - بنية النظام الأساسية
- [مرجع API](https://docs.rs/hikari-components) - توثيق Rust API

## أمثلة

### تبديل السمات

```rust
use hikari_theme::ThemeProvider;

fn App() -> Element {
    let mut theme = use_signal(|| "hikari".to_string());

    rsx! {
        ThemeProvider { palette: "{theme}" } {
            button {
                onclick: move |_| {
                    theme.set(if *theme() == "hikari" {
                        "tairitsu".to_string()
                    } else {
                        "hikari".to_string()
                    });
                },
                "تبديل السمة"
            }
        }
    }
}
```

### استخدام الرسوم المتحركة

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

## المساهمة

المساهمات مرحب بها! يرجى قراءة [CONTRIBUTING.md](../../en-US/guides/CONTRIBUTING.md) للتفاصيل.

## الترخيص

[رخصة MIT](../../../LICENSE)

## شكر وتقدير

- **Tairitsu** - إطار عمل Rust قوي لواجهة المستخدم
- [Grass](https://github.com/kaj/kaj) - مترجم SCSS نقي بلغة Rust
- [Element Plus](https://element-plus.org/) - مرجع تصميم مكتبة مكونات ممتازة
- [Material UI](https://mui.com/) - إلهام تصميم واجهة مستخدم حديثة

---

**هيكاري** - البساطة، التكنولوجيا، الثقة الثقافية
