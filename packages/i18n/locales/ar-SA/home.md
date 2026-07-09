# إطار عمل واجهات Hikari

Hikari (光) هو إطار عمل حديث لواجهات المستخدم مكتوب بلغة Rust، مبني على:

- **Tairitsu 0.7** - إطار عمل واجهات تفاعلي
- **Grass** - مُصرّف SCSS
- **Axum** - خادم ويب للتصيير من جهة الخادم (SSR)

## فلسفة التصميم

يجمع Hikari بين:

- **جماليات Arknights** - خطوط نظيفة، تباين عالٍ
- **FUI (واجهة المستخدم المستقبلية)** - تأثيرات توهج، مؤشرات ديناميكية
- **الألوان الصينية التقليدية** - أكثر من 500 اسم لون أصيل

## البداية السريعة

```bash
cargo new my-app
cd my-app
cargo add hikari-components hikari-theme
```

```rust
use hikari_components::{ThemeProvider, Button};

fn App() -> Element {
    rsx! {
        ThemeProvider { palette: "hikari" } {
            Button { label: "مرحباً يا Hikari!" }
        }
    }
}
```

## الميزات

- 🎨 أكثر من 500 لون صيني تقليدي
- 🌙 سمان فاتح وداكن
- 🔧 فئات أدوات آمنة نوعياً
- ✨ حركات سلسة
- 📱 مكوّنات متجاوبة
- 🌐 دعم مدمج للتدويل (i18n)

## التوثيق

للاطلاع على الوثائق الكاملة، زُر [docs.hikari.dev](https://docs.hikari.dev).
