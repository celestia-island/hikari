# UI-фреймворк Hikari

Hikari (光) — это современный UI-фреймворк на Rust, созданный на базе:

- **Tairitsu 0.7** - Реактивный UI-фреймворк
- **Grass** - Компилятор SCSS
- **Axum** - Веб-сервер для SSR

## Философия дизайна

Hikari сочетает:

- **Эстетика Arknights** - Чистые линии, высокий контраст
- **FUI (Future User Interface)** - Эффекты свечения, динамические индикаторы
- **Традиционные китайские цвета** - 500+ аутентичных названий цветов

## Быстрый старт

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
            Button { label: "Привет, Hikari!" }
        }
    }
}
```

## Возможности

- 🎨 500+ традиционных китайских цветов
- 🌙 Светлая и тёмная темы
- 🔧 Типобезопасные служебные классы
- ✨ Плавные анимации
- 📱 Адаптивные компоненты
- 🌐 Встроенная поддержка i18n

## Документация

Полная документация доступна на [docs.hikari.dev](https://docs.hikari.dev).
