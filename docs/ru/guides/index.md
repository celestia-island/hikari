# Hikari UI Framework

> Современный UI-фреймворк на Rust, построенный на Tairitsu + Grass + Axum
>
> **Стиль дизайна**: Плоский дизайн Arknights + Sci-Fi эстетика FUI + Традиционные китайские цвета
>
> **Происхождение названия**: "Hikari" (Свет) из ритм-игры Arcaea

## Что такое Hikari?

Hikari — это современный UI-фреймворк, разработанный для экосистемы Rust, объединяющий традиционную китайскую цветовую эстетику с sci-fi дизайном интерфейсов. Фреймворк использует модульный подход, предоставляя полную библиотеку компонентов, систему тем и систему анимаций.

## Основные возможности

### 🎨 Система традиционных китайских цветов
- **500+ традиционных цветов**: Полная палитра традиционных китайских цветов
- **Система тем**: Встроенные темы Hikari (светлая) и Tairitsu (тёмная)
- **Типобезопасность**: Проверка значений цветов во время компиляции

### 🧩 Богатая библиотека компонентов
- **Базовые компоненты**: Button, Input, Card, Badge
- **Компоненты обратной связи**: Alert, Toast, Tooltip, Spotlight
- **Навигационные компоненты**: Menu, Tabs, Breadcrumb
- **Компоненты данных**: Table, Tree, Pagination
- **Компоненты раскладки**: Layout, Header, Aside, Content, Footer
- **Дополнительные компоненты**: Collapsible, DragLayer, ZoomControls

### ✨ Мощная система анимаций
- **Декларативные анимации**: Fluent API в стиле CSS
- **Динамические значения**: Вычисляемые во время выполнения значения анимаций
- **Функции сглаживания**: 30+ функций сглаживания
- **Готовые анимации**: Затухание, скольжение, масштабирование и т.д.

### 🎯 Продвинутые возможности
- **Серверный рендеринг**: Полная поддержка SSR
- **Типобезопасность**: Полное использование системы типов Rust
- **Адаптивный дизайн**: Встроенные утилиты адаптивной раскладки
- **Система сборки**: Автоматическая компиляция SCSS и генерация ресурсов

## Быстрый старт

### Установка зависимостей

Добавьте в `Cargo.toml`:

```toml
[dependencies]
hikari-components = "0.1"
hikari-palette = "0.1"
hikari-theme = "0.1"
tairitsu = "0.5"
```

### Базовое использование

```rust
use hikari_components::{ThemeProvider, Button};
use hikari_theme::ThemeProvider;

#[component]
fn App() -> Element {
    rsx! {
        ThemeProvider { palette: "hikari" } {
            div { class: "hi-flex hi-flex-col hi-gap-4" {
                Button { label: "Нажми меня" }
                Button { label: "Основная кнопка", variant: "primary" }
                Button { label: "Вторичная кнопка", variant: "secondary" }
            }
        }
    }
}
```

### Сборка и запуск

```bash
# Режим разработки
cargo run

# Сборка
cargo build --release

# Сборка WASM
trunk build --release
```

## Философия дизайна

### Плоский дизайн Arknights
- Чистые линии и чёткая иерархия информации
- Высокий контраст для читаемости
- Минималистичный, но утончённый дизайн

### Sci-Fi эстетика FUI
- Тонкие эффекты свечения
- Динамические индикаторы (дыхание, пульсирующие анимации)
- Тонкие границы и геометрические узоры

### Традиционные китайские цвета
- Основные: 石青 (Лазурный/Синий), 朱砂 (Киноварь/Красный), 藤黄 (Гуммигут/Жёлтый)
- Нейтральные: 月白 (Лунный белый), 墨色 (Чернильный чёрный), 缟色 (Светло-серый)
- Функциональные: 葱倩 (Успех), 鹅黄 (Предупреждение), 朱砂 (Опасность)

## Структура проекта

```
hikari/
 ├── packages/
 │   ├── hikari-palette/          # Палитра традиционных китайских цветов
 │   ├── hikari-theme/            # Система тем
 │   ├── hikari-animation/        # Система анимаций
 │   ├── hikari-icons/            # Система иконок
 │   ├── hikari-components/       # Библиотека компонентов
 │   ├── hikari-extra-components/ # Библиотека дополнительных компонентов
 │
 └── examples/
     ├── website/                 # Официальный сайт
     ├── table-demo/              # Демо компонента Table
     ├── tree-demo/               # Демо компонента Tree
     └── node-graph-demo/         # Демо графа узлов
```

## Документация

- [Компоненты](./components/) - Руководство по использованию UI-компонентов
- [Система](./system/) - Архитектура основных систем
- [API Reference](https://docs.rs/hikari-components) - Документация Rust API

## Примеры

### Переключение темы

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
                "Переключить тему"
            }
        }
    }
}
```

### Использование анимаций

```rust
use hikari_animation::{AnimationBuilder, AnimationContext};
use hikari_animation::style::CssProperty;

// Статическая анимация
AnimationBuilder::new(&elements)
    .add_style("button", CssProperty::Opacity, "0.8")
    .apply_with_transition("300ms", "ease-in-out");

// Динамическая анимация (следование за мышью)
AnimationBuilder::new(&elements)
    .add_style_dynamic("button", CssProperty::Transform, |ctx| {
        let x = ctx.mouse_x();
        let y = ctx.mouse_y();
        format!("translate({}px, {}px)", x, y)
    })
    .apply_with_transition("150ms", "ease-out");
```

## Участие в разработке

Приветствуются любые вклады! Пожалуйста, прочитайте [CONTRIBUTING.md](../../en-US/guides/CONTRIBUTING.md) для подробностей.

## Лицензия

[MIT License](../../../LICENSE)

## Благодарности

- **Tairitsu** - Мощный Rust UI-фреймворк
- [Grass](https://github.com/kaj/kaj) - Чистый Rust SCSS-компилятор
- [Element Plus](https://element-plus.org/) - Отличный справочник по дизайну библиотеки компонентов
- [Material UI](https://mui.com/) - Вдохновение современным UI-дизайном

---

**Hikari** - Минимализм, Технологии, Культурная уверенность
