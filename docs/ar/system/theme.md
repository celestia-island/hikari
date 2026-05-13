# نظام السمات

نظام إدارة السمات يوفر سياق السمات، ومتغيرات CSS، ووظائف تبديل السمات.

## جدول المحتويات

- [نظرة عامة](#نظرة-عامة)
- [ThemeProvider](#themeprovider-مزود-السمة)
- [ThemeContext](#themecontext-سياق-السمة)
- [الموارد المولدة](#الموارد-المولدة)
- [نظام متغيرات CSS](#نظام-متغيرات-css)
- [تبديل السمات](#تبديل-السمات)
- [تخصيص الأنماط](#تخصيص-الأنماط)
- [مرجع API](#مرجع-api)

## نظرة عامة

يوفر `hikari-theme` حلاً كاملاً لإدارة السمات:

- **ThemeProvider** - مكون مزود سياق السمة
- **ThemeContext** - تكوين السمة وتعريفات الألوان
- **المولدة** - متغيرات CSS وموارد مولدة تلقائياً
- **متغيرات CSS** - نظام متغيرات سمة ديناميكي
- **تبديل السمات** - دعم تبديل السمات أثناء التشغيل

جميع مكونات السمات تتميز بـ:

- **أمان الأنواع** - فحص معرف السمة في وقت الترجمة
- **استجابة** - تتكيف تلقائياً مع السمات المختلفة
- **قابلة للتوسعة** - تدعم السمات المخصصة

## ThemeProvider

يوفر سياق السمة للتطبيق بالكامل.

### الاستخدام الأساسي

```rust
use dioxus::prelude::*;
use hikari_theme::ThemeProvider;

rsx! {
    ThemeProvider { palette: "hikari".to_string() }
        // محتوى التطبيق
        App {}
    }
}
```

### تبديل السمات

```rust
#[component]
fn App() -> Element {
    let mut theme = use_signal(|| "hikari".to_string());

    rsx! {
        ThemeProvider { palette: theme() }
            div {
                button {
                    onclick: move |_| {
                        theme.set(if theme() == "hikari" {
                            "tairitsu".to_string()
                        } else {
                            "hikari".to_string()
                        });
                    },
                    "تبديل السمة"
                }
                // محتوى التطبيق
            }
        }
    }
}
```

### الخصائص

| الخاصية | النوع | الافتراضي | الوصف |
|---------|-------|-----------|-------|
| `palette` | `String` | `"hikari"` | معرف السمة |
| `children` | `Element` | - | العناصر الفرعية |

### السمات المدعومة

- **hikari** - سمة فاتحة
- **tairitsu** - سمة داكنة

## ThemeContext

هيكل البيانات الذي يحتوي على تكوين السمة وتعريفات الألوان.

### تعريف الهيكل

```rust
pub struct ThemeContext {
    pub palette: String,
    pub colors: Palette,
}
```

### أوصاف الحقول

- **palette** - سلسلة معرف السمة
- **colors** - تكوين لوحة السمة (من `hikari-palette`)

### القيم الافتراضية

```rust
impl Default for ThemeContext {
    fn default() -> Self {
        ThemeContext {
            palette: "hikari".to_string(),
            colors: themes::Hikari::palette(),
        }
    }
}
```

## الموارد المولدة

موارد ثابتة ومتغيرات CSS مولدة تلقائياً.

### Tailwind CSS

```rust
use hikari_theme::generated::tailwind;

// الوصول إلى فئات Tailwind CSS المولدة
let tailwind_classes = tailwind::TAILWIND_CLASSES;
```

### المحتوى المولد

تحتوي وحدة `generated/mod.rs` على:

- `tailwind` - أسماء الفئات والمتغيرات المولدة لـ Tailwind CSS
- `components` - ثوابت أنماط المكونات (مولدة بواسطة الباني)

### مواقع الملفات

```
packages/theme/src/generated/
├── mod.rs           # مدخل الوحدة
├── tailwind.rs      # محتوى Tailwind CSS المولد
└── ...              # محتوى مولد آخر
```

## نظام متغيرات CSS

يستخدم نظام السمات متغيرات CSS للتبديل الديناميكي للسمات.

### متغيرات الجذر

معرفة تحت `:root` أو `[data-theme]`:

```css
[data-theme="hikari"] {
    --hi-color-primary: #00A0E9;
    --hi-color-secondary: #E94B35;
    --hi-color-accent: #F8B62D;
    --hi-color-background: #FFFFFF;
    --hi-color-surface: #F5F5F5;
    --hi-color-text-primary: #1A1A2E;
    --hi-color-text-secondary: #666666;
}

[data-theme="tairitsu"] {
    --hi-color-primary: #1a237e;
    --hi-color-secondary: #E94B35;
    --hi-color-accent: #FFF176;
    --hi-color-background: #0D1117;
    --hi-color-surface: #161B22;
    --hi-color-text-primary: #C9D1D9;
    --hi-color-text-secondary: #8B949E;
}
```

### استخدام متغيرات CSS

استخدام في أنماط المكونات:

```rust
rsx! {
    div {
        style: "color: var(--hi-color-primary); background: var(--hi-color-surface);",
        "استخدام متغيرات السمة"
    }
}
```

أو في SCSS:

```scss
.my-component {
    color: var(--hi-color-primary);
    background-color: var(--hi-color-surface);
    border: 1px solid var(--hi-color-border);
}
```

### قائمة المتغيرات الكاملة

#### متغيرات الألوان

```css
--hi-color-primary          /* اللون الأساسي */
--hi-color-secondary        /* اللون الثانوي */
--hi-color-accent           /* لون التمييز */
--hi-color-success          /* لون النجاح */
--hi-color-warning          /* لون التحذير */
--hi-color-danger           /* لون الخطر */
--hi-color-background       /* لون الخلفية */
--hi-color-surface          /* لون السطح */
--hi-color-border           /* لون الحدود */
--hi-color-text-primary     /* لون النص الأساسي */
--hi-color-text-secondary   /* لون النص الثانوي */
```

#### متغيرات الخطوط

```css
--hi-font-family-sans       /* خط sans-serif */
--hi-font-family-mono       /* خط monospace */
--hi-font-size-xs           /* 12px */
--hi-font-size-sm           /* 14px */
--hi-font-size-base         /* 16px */
--hi-font-size-lg           /* 18px */
--hi-font-size-xl           /* 20px */
--hi-font-size-2xl          /* 24px */
--hi-font-size-3xl          /* 30px */
```

#### متغيرات التباعد

```css
--hi-spacing-xs            /* 4px */
--hi-spacing-sm            /* 8px */
--hi-spacing-md            /* 16px */
--hi-spacing-lg            /* 24px */
--hi-spacing-xl            /* 32px */
--hi-spacing-2xl           /* 48px */
```

#### متغيرات نصف القطر

```css
--hi-radius-sm             /* 4px */
--hi-radius-md             /* 8px */
--hi-radius-lg             /* 12px */
--hi-radius-xl             /* 16px */
--hi-radius-full           /* 9999px */
```

#### متغيرات الظلال

```css
--hi-shadow-sm             /* ظل صغير */
--hi-shadow-md             /* ظل متوسط */
--hi-shadow-lg             /* ظل كبير */
--hi-shadow-xl             /* ظل كبير جداً */
```

#### متغيرات الانتقال

```css
--hi-transition-fast       /* 150ms */
--hi-transition-base       /* 200ms */
--hi-transition-slow       /* 300ms */
```

## تبديل السمات

### التبديل أثناء التشغيل

```rust
#[component]
fn ThemeSwitcher() -> Element {
    let mut theme = use_signal(|| "hikari".to_string());

    rsx! {
        ThemeProvider { palette: theme() }
            div {
                button {
                    onclick: move |_| theme.set("hikari".to_string()),
                    class: if theme() == "hikari" { "active" } else { "" },
                    "فاتح"
                }
                button {
                    onclick: move |_| theme.set("tairitsu".to_string()),
                    class: if theme() == "tairitsu" { "active" } else { "" },
                    "داكن"
                }
            }
        }
    }
}
```

### سمة مستمرة

```rust
use gloo::storage::LocalStorage;

#[component]
fn PersistentTheme() -> Element {
    // تحميل السمة من LocalStorage
    let mut theme = use_signal(|| {
        LocalStorage::get("theme")
            .unwrap_or_else(|_| Ok("hikari".to_string()))
            .unwrap_or("hikari".to_string())
    });

    // حفظ السمة في LocalStorage عند تغييرها
    use_effect(move || {
        let theme = theme();
        async move {
            if let Err(e) = LocalStorage::set("theme", &theme) {
                eprintln!("فشل حفظ السمة: {}", e);
            }
        }
    });

    rsx! {
        ThemeProvider { palette: theme() }
            // محتوى التطبيق
        }
    }
}
```

### اكتشاف سمة النظام

```rust
use web_sys::window;

#[component]
fn SystemTheme() -> Element {
    let mut theme = use_signal(|| "hikari".to_string());

    // اكتشاف تفضيل سمة النظام
    use_effect(|| {
        let win = window()?;
        let media_query = win.match_media("(prefers-color-scheme: dark)")?;

        let listener = Closure::wrap(Box::new(move |e: Event| {
            let matches = e
                .dyn_ref::<MediaQueryListEvent>()
                .unwrap()
                .matches();
            theme.set(if matches {
                "tairitsu".to_string()
            } else {
                "hikari".to_string()
            });
        }) as Box<dyn Fn(_)>);

        media_query
            .add_listener_with_opt_callback(Some(listener.as_ref().unchecked_ref()))
            .unwrap();
        listener.forget();

        async move {}
    });

    rsx! {
        ThemeProvider { palette: theme() }
            // محتوى التطبيق
        }
    }
}
```

## تخصيص الأنماط

### تجاوز متغيرات السمة

```css
/* تجاوز متغيرات السمة في الأنماط العامة */
[data-theme="hikari"] {
    --hi-color-primary: #0066CC;
    --hi-color-secondary: #FF6600;
}
```

### سمة على مستوى المكون

```rust
rsx! {
    // استخدام سمة مختلفة لمكون محدد
    div {
        "data-theme": "tairitsu",
        style: "background: var(--hi-color-surface);",
        "هذا المكون يستخدم السمة الداكنة"
    }
}
```

### متغيرات سمة مخصصة

```css
[data-theme="custom"] {
    --hi-color-primary: #FF0066;
    --hi-color-secondary: #00FF99;
    --hi-color-accent: #FFFF00;
    /* ... متغيرات أخرى */
}
```

## أفضل الممارسات

### 1. وضع مزود السمة

```rust
// جيد: ضع ThemeProvider في جذر التطبيق
#[component]
fn App() -> Element {
    rsx! {
        ThemeProvider { palette: "hikari".to_string() }
            Router {}
        }
    }
}

// تجنب: تداخل عدة ThemeProviders
#[component]
fn BadExample() -> Element {
    rsx! {
        ThemeProvider { palette: "hikari".to_string() }
            ThemeProvider { palette: "tairitsu".to_string() }
                // السمة الداخلية ستتجاوز الخارجية
            }
        }
    }
}
```

### 2. رسوم متحركة لتبديل السمة

```css
/* إضافة انتقال سلس لتبديل السمة */
* {
    transition: background-color 0.3s ease,
                color 0.3s ease,
                border-color 0.3s ease;
}
```

### 3. التنسيق الشرطي

```rust
rsx! {
    div {
        class: if theme() == "hikari" {
            "light-theme"
        } else {
            "dark-theme"
        },
        "تطبيق أنماط مختلفة بناءً على السمة"
    }
}
```

### 4. قيمة احتياطية لمتغيرات CSS

```css
/* توفير قيمة احتياطية للمتصفحات التي لا تدعم متغيرات CSS */
.my-component {
    background-color: #00A0E9; /* قيمة احتياطية */
    background-color: var(--hi-color-primary, #00A0E9);
}
```

## مرجع API

### ThemeProvider

```rust
#[component]
pub fn ThemeProvider(
    palette: String,
    children: Element
) -> Element
```

### ThemeContext

```rust
pub struct ThemeContext {
    pub palette: String,
    pub colors: Palette,
}

impl Default for ThemeContext {
    fn default() -> Self { ... }
}
```

## التكامل مع الأنظمة الأخرى

### التكامل مع لوحة الألوان

```rust
use hikari_palette::{ChineseColor, themes};

let hikari_palette = themes::Hikari::palette();
println!("الأساسي: {}", hikari_palette.primary.hex);
```

### التكامل مع الرسوم المتحركة

```rust
use hikari_animation::AnimationBuilder;
use hikari_theme::ThemeProvider;

// يمكن استخدام متغيرات السمة في الرسوم المتحركة
AnimationBuilder::new(&elements)
    .add_style("button", "background-color", "var(--hi-color-primary)")
    .apply_with_transition("300ms", "ease-in-out");
```

### التكامل مع المكونات

جميع المكونات ترث السمة المقدمة من ThemeProvider تلقائياً:

```rust
rsx! {
    ThemeProvider { palette: "hikari".to_string() }
        // جميع المكونات تستخدم سمة هيكاري تلقائياً
        Button { label: "زر" }
        Card { "بطاقة" }
        Input { placeholder: "حقل إدخال" }
    }
}
```

## فلسفة التصميم

### طراز Arknights

- **السمة الفاتحة (hikari)**:
  - الأساسي: الأزوريت (#00A0E9)
  - الخلفية: أبيض
  - النص: داكن

- **السمة الداكنة (tairitsu)**:
  - الأساسي: النيلي (#1a237e)
  - الخلفية: داكن
  - النص: فاتح

### عناصر FUI

- تأثيرات توهج دقيقة
- مؤشرات ديناميكية (أضواء تنفسية)
- حدود دقيقة

### الاستجابة

- أولوية الجوال
- تخطيطات متكيفة
- نظام نقاط التوقف

## الأنظمة ذات الصلة

- [نظام اللوحة](./palette.md) - تعريفات الألوان ولوحات السمات
- [نظام الرسوم المتحركة](./animation.md) - الرسوم المتحركة وتكامل السمات
- [المكونات](../components/) - مكتبة المكونات باستخدام السمات
