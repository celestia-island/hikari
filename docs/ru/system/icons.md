# Система иконок

Система управления и рендеринга иконок, интегрированная с Material Design Icons (MDI).

## Обзор

`hikari-icons` предоставляет:

- **1000+ Иконок** - Полная коллекция Material Design Icons (MDI)
- **Типобезопасность** - Имена иконок на основе перечислений
- **SVG рендеринг** - Клиентский и серверный рендеринг
- **Загрузка во время выполнения** - Загрузка SVG иконок по требованию

## Компонент Icon

### Базовое использование

```rust
use hikari_icons::{Icon, MdiIcon};

rsx! {
    Icon {
        icon: MdiIcon::Magnify,
        size: 24,
        color: "var(--hi-color-primary)"
    }
}
```

### Доступные иконки

```rust
pub enum MdiIcon {
    // Навигация
    Home,
    Menu,
    Magnify,
    Cog,
    ChevronDown,
    ChevronLeft,
    ChevronRight,

    // Действия
    Pencil,
    Delete,
    Check,
    Close,
    Plus,
    Minus,

    // Статус
    AlertCircleOutline,
    CheckCircleOutline,
    InformationOutline,
    AlertOutline,

    // ... 1000+ иконок
}
```

### Свойства

| Свойство | Тип | По умолчанию | Описание |
|----------|-----|--------------|----------|
| `icon` | `MdiIcon` | - | Тип иконки |
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
    icon: MdiIcon,
    size: Option<u32>,
    color: Option<&str>,
    class: Option<String>,
    style: Option<String>
) -> Element
```

### MdiIcon

```rust
pub enum MdiIcon {
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
