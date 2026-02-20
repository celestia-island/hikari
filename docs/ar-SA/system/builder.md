# نظام البناء

نظام توليد الكود وقت الترجمة وتجميع SCSS.

## نظرة عامة

يوفر `hikari-builder`:

- **تجميع SCSS** - تجميع SCSS إلى CSS باستخدام Grass
- **اكتشاف المكونات** - اكتشاف تلقائي لملفات SCSS للمكونات
- **توليد الكود** - توليد ثوابت وأنواع Rust
- **تجميع الموارد** - إنشاء حزم CSS محسّنة

## الميزات الأساسية

### 1. تجميع SCSS

```rust
// build.rs
fn main() {
    hikari_builder::build().expect("فشل البناء");
}
```

عملية التجميع:
1. فحص دليل `packages/components/src/styles/components/`
2. تجميع جميع ملفات `.scss`
3. الإخراج إلى `public/styles/bundle.css`

### 2. اكتشاف المكونات

اكتشاف تلقائي للمكونات وتوليد الثوابت:

```rust
// تم توليده في packages/builder/src/generated/components.rs
pub const AVAILABLE_COMPONENTS: &[&str] = &[
    "button",
    "input",
    "card",
    "badge",
    // ...
];

pub fn default_components() -> Vec<String> {
    AVAILABLE_COMPONENTS
        .iter()
        .map(|s| s.to_string())
        .collect()
}
```

### 3. BuildConfig

تكوين البناء:

```rust
use hikari_builder::{Builder, BuildConfig};

let config = BuildConfig {
    components: vec![
        "button".to_string(),
        "input".to_string(),
    ],
    output_dir: "dist".into(),
    minify_css: true,
    ..BuildConfig::default()
};

Builder::new(config)
    .build()
    .expect("فشل البناء");
```

## مرجع واجهة البرمجة

### build()

```rust
pub fn build() -> Result<(), Box<dyn std::error::Error>>
```

### Builder

```rust
pub struct Builder {
    config: BuildConfig,
}

impl Builder {
    pub fn new(config: BuildConfig) -> Self;
    pub fn build(self) -> Result<(), Box<dyn std::error::Error>>;
}
```

### BuildConfig

```rust
pub struct BuildConfig {
    pub components: Vec<String>,
    pub output_dir: PathBuf,
    pub minify_css: bool,
    pub scss_entry: PathBuf,
}

impl Default for BuildConfig {
    fn default() -> Self { ... }
}
```

## أمثلة الاستخدام

### الاستخدام في build.rs

```rust
fn main() {
    // البناء الافتراضي
    hikari_builder::build().unwrap();

    // أو استخدام تكوين مخصص
    let config = hikari_builder::BuildConfig {
        components: vec![
            "button".to_string(),
            "card".to_string(),
        ],
        ..Default::default()
    };

    hikari_builder::Builder::new(config)
        .build()
        .unwrap();
}
```

## التكامل مع الأنظمة الأخرى

- **المكونات** - يوفر ملفات SCSS للمكونات
- **السمة** - توفر متغيرات ومزيجات السمة
- **خدمة العرض** - تستخدم حزمة CSS المولدة

## الأنظمة ذات الصلة

- [لوحة الألوان](./palette.md) - متغيرات الألوان
- [السمة](./theme.md) - مزيجات SCSS
- [المكونات](../components/) - مكتبة المكونات
