# نظام الأيقونات

نظام إدارة وعرض الأيقونات، متكامل مع Lucide Icons.

## نظرة عامة

يوفر `hikari-icons`:

- **أكثر من 1000 أيقونة** - مجموعة Lucide Icons الكاملة
- **آمن للنوع** - أسماء أيقونات قائمة على التعداد
- **عرض SVG** - عرض من جانب العميل والخادم
- **تحميل وقت التشغيل** - تحميل SVG للأيقونات عند الطلب

## مكون الأيقونة

### الاستخدام الأساسي

```rust
use dioxus::prelude::*;
use hikari_icons::{Icon, LucideIcon};

rsx! {
    Icon {
        icon: LucideIcon::Search,
        size: 24,
        color: "var(--hi-color-primary)"
    }
}
```

### الأيقونات المتاحة

```rust
pub enum LucideIcon {
    // التنقل
    Home,
    Menu,
    Search,
    Settings,
    ChevronDown,
    ChevronLeft,
    ChevronRight,

    // الإجراءات
    Edit,
    Trash,
    Check,
    X,
    Plus,
    Minus,

    // الحالة
    AlertCircle,
    CheckCircle,
    Info,
    AlertTriangle,

    // ... أكثر من 1000 أيقونة
}
```

### الخصائص

| الخاصية | النوع | الافتراضي | الوصف |
|---------|-------|-----------|-------|
| `icon` | `LucideIcon` | - | نوع الأيقونة |
| `size` | `u32` | `24` | حجم الأيقونة |
| `color` | `&str` | - | اللون |

## تحميل وقت التشغيل

### العرض من جانب العميل

```rust
use hikari_icons::runtime;

// تحميل SVG للأيقونة بشكل غير متزامن
async fn load_icon(name: &str) -> Result<String, Error> {
    runtime::load_icon(name).await
}
```

### العرض من جانب الخادم

```rust
use hikari_icons::server;

// عرض الأيقونة من جانب الخادم
fn render_icon(name: &str) -> String {
    server::render_icon(name)
}
```

## مرجع واجهة البرمجة

### Icon

```rust
#[component]
pub fn Icon(
    icon: LucideIcon,
    size: Option<u32>,
    color: Option<&str>,
    class: Option<String>,
    style: Option<String>
) -> Element
```

### LucideIcon

```rust
pub enum LucideIcon {
    // أكثر من 1000 نوع أيقونة
}
```

### runtime

```rust
pub mod runtime {
    pub async fn load_icon(name: &str) -> Result<String, Error>;
}
```

### server

```rust
pub mod server {
    pub fn render_icon(name: &str) -> String;
}
```

## التكامل مع الأنظمة الأخرى

- **المكونات** - الأيقونات المستخدمة في الزر، الإدخال، والمكونات الأخرى
- **خدمة العرض** - خدمة ملفات الأيقونات الثابتة
- **السمة** - ألوان الأيقونات ترث من السمة

## الأنظمة ذات الصلة

- [المكونات](../components/) - المكونات التي تستخدم الأيقونات
- [خدمة العرض](./render-service.md) - خدمة ملفات الأيقونات
- [لوحة الألوان](./palette.md) - ألوان الأيقونات
