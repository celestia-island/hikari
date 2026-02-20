# Система тем

Система управления темами, предоставляющая контекст темы, CSS-переменные и функциональность переключения тем.

## Содержание

- [Обзор](#обзор)
- [ThemeProvider](#themeprovider-провайдер-темы)
- [ThemeContext](#themecontext-контекст-темы)
- [Сгенерированные ресурсы](#сгенерированные-ресурсы)
- [Система CSS-переменных](#система-css-переменных)
- [Переключение тем](#переключение-тем)
- [Настройка стилей](#настройка-стилей)
- [Справочник API](#справочник-api)

## Обзор

`hikari-theme` предоставляет полное решение для управления темами:

- **ThemeProvider** - Компонент-провайдер контекста темы
- **ThemeContext** - Конфигурация темы и определения цветов
- **Generated** - Автоматически сгенерированные CSS-переменные и ресурсы
- **CSS Variables** - Динамическая система переменных темы
- **Theme Switching** - Поддержка переключения тем во время выполнения

Все компоненты темы обладают следующими характеристиками:

- **Типобезопасность** - Проверка идентификаторов тем во время компиляции
- **Адаптивность** - Автоматическая адаптация к различным темам
- **Расширяемость** - Поддержка пользовательских тем

## ThemeProvider

Предоставляет контекст темы для всего приложения.

### Базовое использование

```rust
use dioxus::prelude::*;
use hikari_theme::ThemeProvider;

rsx! {
    ThemeProvider { palette: "hikari".to_string() }
        // Содержимое приложения
        App {}
    }
}
```

### Переключение темы

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
                    "Переключить тему"
                }
                // Содержимое приложения
            }
        }
    }
}
```

### Свойства

| Свойство | Тип | По умолчанию | Описание |
|----------|-----|--------------|----------|
| `palette` | `String` | `"hikari"` | Идентификатор темы |
| `children` | `Element` | - | Дочерние элементы |

### Поддерживаемые темы

- **hikari** - Светлая тема
- **tairitsu** - Тёмная тема

## ThemeContext

Структура данных, содержащая конфигурацию темы и определения цветов.

### Определение структуры

```rust
pub struct ThemeContext {
    pub palette: String,
    pub colors: Palette,
}
```

### Описание полей

- **palette** - Строковый идентификатор темы
- **colors** - Конфигурация палитры темы (из `hikari-palette`)

### Значения по умолчанию

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

## Сгенерированные ресурсы

Автоматически сгенерированные статические ресурсы и CSS-переменные.

### Tailwind CSS

```rust
use hikari_theme::generated::tailwind;

// Доступ к сгенерированным классам Tailwind CSS
let tailwind_classes = tailwind::TAILWIND_CLASSES;
```

### Сгенерированное содержимое

Модуль `generated/mod.rs` содержит:

- `tailwind` - Сгенерированные имена классов и переменные Tailwind CSS
- `components` - Константы стилей компонентов (сгенерированные builder'ом)

### Расположение файлов

```
packages/theme/src/generated/
├── mod.rs           # Точка входа модуля
├── tailwind.rs      # Сгенерированное содержимое Tailwind CSS
└── ...              # Другой сгенерированный контент
```

## Система CSS-переменных

Система тем использует CSS-переменные для динамического переключения тем.

### Корневые переменные

Определяются в `:root` или `[data-theme]`:

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

### Использование CSS-переменных

Используйте в стилях компонентов:

```rust
rsx! {
    div {
        style: "color: var(--hi-color-primary); background: var(--hi-color-surface);",
        "Использование переменных темы"
    }
}
```

Или в SCSS:

```scss
.my-component {
    color: var(--hi-color-primary);
    background-color: var(--hi-color-surface);
    border: 1px solid var(--hi-color-border);
}
```

### Полный список переменных

#### Цветовые переменные

```css
--hi-color-primary          /* Основной цвет */
--hi-color-secondary        /* Вторичный цвет */
--hi-color-accent           /* Акцентный цвет */
--hi-color-success          /* Цвет успеха */
--hi-color-warning          /* Цвет предупреждения */
--hi-color-danger           /* Цвет опасности */
--hi-color-background       /* Цвет фона */
--hi-color-surface          /* Цвет поверхности */
--hi-color-border           /* Цвет границы */
--hi-color-text-primary     /* Основной цвет текста */
--hi-color-text-secondary   /* Вторичный цвет текста */
```

#### Типографические переменные

```css
--hi-font-family-sans       /* Шрифт без засечек */
--hi-font-family-mono       /* Моноширинный шрифт */
--hi-font-size-xs           /* 12px */
--hi-font-size-sm           /* 14px */
--hi-font-size-base         /* 16px */
--hi-font-size-lg           /* 18px */
--hi-font-size-xl           /* 20px */
--hi-font-size-2xl          /* 24px */
--hi-font-size-3xl          /* 30px */
```

#### Переменные отступов

```css
--hi-spacing-xs            /* 4px */
--hi-spacing-sm            /* 8px */
--hi-spacing-md            /* 16px */
--hi-spacing-lg            /* 24px */
--hi-spacing-xl            /* 32px */
--hi-spacing-2xl           /* 48px */
```

#### Переменные скругления

```css
--hi-radius-sm             /* 4px */
--hi-radius-md             /* 8px */
--hi-radius-lg             /* 12px */
--hi-radius-xl             /* 16px */
--hi-radius-full           /* 9999px */
```

#### Переменные теней

```css
--hi-shadow-sm             /* Маленькая тень */
--hi-shadow-md             /* Средняя тень */
--hi-shadow-lg             /* Большая тень */
--hi-shadow-xl             /* Очень большая тень */
```

#### Переменные переходов

```css
--hi-transition-fast       /* 150ms */
--hi-transition-base       /* 200ms */
--hi-transition-slow       /* 300ms */
```

## Переключение тем

### Переключение во время выполнения

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
                    "Светлая"
                }
                button {
                    onclick: move |_| theme.set("tairitsu".to_string()),
                    class: if theme() == "tairitsu" { "active" } else { "" },
                    "Тёмная"
                }
            }
        }
    }
}
```

### Сохранение темы

```rust
use gloo::storage::LocalStorage;

#[component]
fn PersistentTheme() -> Element {
    // Загрузка темы из LocalStorage
    let mut theme = use_signal(|| {
        LocalStorage::get("theme")
            .unwrap_or_else(|_| Ok("hikari".to_string()))
            .unwrap_or("hikari".to_string())
    });

    // Сохранение темы в LocalStorage при изменении
    use_effect(move || {
        let theme = theme();
        async move {
            if let Err(e) = LocalStorage::set("theme", &theme) {
                eprintln!("Не удалось сохранить тему: {}", e);
            }
        }
    });

    rsx! {
        ThemeProvider { palette: theme() }
            // Содержимое приложения
        }
    }
}
```

### Определение системной темы

```rust
use web_sys::window;

#[component]
fn SystemTheme() -> Element {
    let mut theme = use_signal(|| "hikari".to_string());

    // Определение предпочтений системной темы
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
            // Содержимое приложения
        }
    }
}
```

## Настройка стилей

### Переопределение переменных темы

```css
/* Переопределение переменных темы в глобальных стилях */
[data-theme="hikari"] {
    --hi-color-primary: #0066CC;
    --hi-color-secondary: #FF6600;
}
```

### Тема на уровне компонента

```rust
rsx! {
    // Использование другой темы для конкретного компонента
    div {
        "data-theme": "tairitsu",
        style: "background: var(--hi-color-surface);",
        "Этот компонент использует тёмную тему"
    }
}
```

### Пользовательские переменные темы

```css
[data-theme="custom"] {
    --hi-color-primary: #FF0066;
    --hi-color-secondary: #00FF99;
    --hi-color-accent: #FFFF00;
    /* ... другие переменные */
}
```

## Лучшие практики

### 1. Размещение ThemeProvider

```rust
// Хорошо: Размещайте ThemeProvider в корне приложения
#[component]
fn App() -> Element {
    rsx! {
        ThemeProvider { palette: "hikari".to_string() }
            Router {}
        }
    }
}

// Избегайте: Вложенность нескольких ThemeProvider
#[component]
fn BadExample() -> Element {
    rsx! {
        ThemeProvider { palette: "hikari".to_string() }
            ThemeProvider { palette: "tairitsu".to_string() }
                // Внутренняя тема переопределит внешнюю
            }
        }
    }
}
```

### 2. Анимация переключения темы

```css
/* Добавьте плавный переход при переключении темы */
* {
    transition: background-color 0.3s ease,
                color 0.3s ease,
                border-color 0.3s ease;
}
```

### 3. Условное оформление

```rust
rsx! {
    div {
        class: if theme() == "hikari" {
            "light-theme"
        } else {
            "dark-theme"
        },
        "Применение разных стилей в зависимости от темы"
    }
}
```

### 4. Резервное значение CSS-переменных

```css
/* Предоставьте резервное значение для браузеров, не поддерживающих CSS-переменные */
.my-component {
    background-color: #00A0E9; /* Резервное значение */
    background-color: var(--hi-color-primary, #00A0E9);
}
```

## Справочник API

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

## Интеграция с другими системами

### Интеграция с Palette

```rust
use hikari_palette::{ChineseColor, themes};

let hikari_palette = themes::Hikari::palette();
println!("Primary: {}", hikari_palette.primary.hex);
```

### Интеграция с Animation

```rust
use hikari_animation::AnimationBuilder;
use hikari_theme::ThemeProvider;

// Переменные темы могут использоваться в анимациях
AnimationBuilder::new(&elements)
    .add_style("button", "background-color", "var(--hi-color-primary)")
    .apply_with_transition("300ms", "ease-in-out");
```

### Интеграция с Components

Все компоненты автоматически наследуют тему, предоставленную ThemeProvider:

```rust
rsx! {
    ThemeProvider { palette: "hikari".to_string() }
        // Все компоненты автоматически используют тему hikari
        Button { label: "Кнопка" }
        Card { "Карточка" }
        Input { placeholder: "Ввод" }
    }
}
```

## Философия дизайна

### Стиль Arknights

- **Светлая тема (hikari)**:
  - Основной: Азурит (#00A0E9)
  - Фон: Белый
  - Текст: Тёмный

- **Тёмная тема (tairitsu)**:
  - Основной: Индиго (#1a237e)
  - Фон: Тёмный
  - Текст: Светлый

### Элементы FUI

- Тонкие эффекты свечения
- Динамические индикаторы (дыхание)
- Тонкие границы

### Адаптивность

- Mobile-first подход
- Адаптивные раскладки
- Система брейкпоинтов

## Связанные системы

- [Система Palette](./palette.md) - Определения цветов и палитры тем
- [Система Animation](./animation.md) - Анимация и интеграция с темами
- [Компоненты](../components/) - Библиотека компонентов, использующая темы
