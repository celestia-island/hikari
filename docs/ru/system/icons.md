# Система иконок

Система управления и рендеринга иконок, интегрированная с Lucide Icons.

## Обзор

`hikari-icons` предоставляет:

- **1000+ Иконок** - Полная коллекция Lucide Icons
- **Типобезопасность** - Имена иконок на основе перечислений
- **SVG рендеринг** - Клиентский и серверный рендеринг
- **Загрузка во время выполнения** - Загрузка SVG иконок по требованию

## Компонент Icon

### Базовое использование

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

### Доступные иконки

```rust
pub enum LucideIcon {
    // Навигация
    Home,
    Menu,
    Search,
    Settings,
    ChevronDown,
    ChevronLeft,
    ChevronRight,

    // Действия
    Edit,
    Trash,
    Check,
    X,
    Plus,
    Minus,

    // Статус
    AlertCircle,
    CheckCircle,
    Info,
    AlertTriangle,

    // ... 1000+ иконок
}
```

### Свойства

| Свойство | Тип | По умолчанию | Описание |
|----------|-----|--------------|----------|
| `icon` | `LucideIcon` | - | Тип иконки |
| `size` | `u32` | `24` | Размер иконки |
| `color` | `&str` | - | Цвет |

## Загрузка во время выполнения

### Клиентский рендеринг

```rust
use hikari_icons::runtime;

// Асинхронная загрузка SVG иконки
async fn load_icon(name: &str) -> Result<String, Error> {
    runtime::load_icon(name).await
}
```

### Серверный рендеринг

```rust
use hikari_icons::server;

// Серверный рендеринг иконки
fn render_icon(name: &str) -> String {
    server::render_icon(name)
}
```

## Справочник API

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
    // 1000+ вариантов иконок
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

## Интеграция с другими системами

- **Компоненты** - Иконки используются в Button, Input и других компонентах
- **Render-service** - Сервис статических файлов иконок
- **Тема** - Цвета иконок наследуются от темы

## Связанные системы

- [Компоненты](../components/) - Компоненты, использующие иконки
- [Render-service](./render-service.md) - Сервис файлов иконок
- [Палитра](./palette.md) - Цвета иконок
