# Обзор архитектуры системы

Фреймворк Hikari использует модульный дизайн, состоящий из нескольких независимых пакетов, каждый из которых отвечает за определённые функциональные области.

## Основные системы

### 1. Система палитры (hikari-palette)

Реализация системы традиционных китайских цветов на Rust.

**Обязанности**:
- Предоставляет более 500 определений традиционных китайских цветов
- Управление палитрами тем
- Генератор служебных классов
- Прозрачность и смешивание цветов

**Основные возможности**:
```rust
use hikari_palette::{ChineseColor, opacity};

// Использование традиционных цветов
let red = ChineseColor::Cinnabar;
let blue = ChineseColor::Azurite;

// Работа с прозрачностью
let semi_red = opacity(red, 0.5);

// Система тем
let theme = Hikari::default();
println!("Primary: {}", theme.primary.hex());
```

**Философия дизайна**:
- **Культурная уверенность**: Использование традиционных названий цветов
- **Типобезопасность**: Проверка значений цветов во время компиляции
- **Высокая производительность**: Абстракции с нулевой стоимостью

### 2. Система тем (hikari-theme)

Контекст темы и система внедрения стилей.

**Обязанности**:
- Компонент-провайдер темы
- Управление контекстом темы
- Генерация CSS-переменных
- Переключение тем

**Основные возможности**:
```rust
use hikari_theme::ThemeProvider;

rsx! {
    ThemeProvider { palette: "hikari" } {
        // Содержимое приложения
        App {}
    }
}
```

**Поддерживаемые темы**:
- **Hikari (Светлая)** - Светлая тема
  - Основной: Азурит (#00A0E9)
  - Вторичный: Киноварь (#E94B35)
  - Акцент: Винный жёлтый (#F8B62D)

- **Tairitsu** - Тёмная тема
  - Основной: Индиго (#1a237e)
  - Вторичный: Киноварь (#E94B35)
  - Акцент: Гусиный жёлтый (#FFF176)

### 3. Система анимаций (hikari-animation)

Высокопроизводительная декларативная система анимаций.

**Обязанности**:
- Построитель анимаций
- Контекст анимации
- Функции сглаживания
- Готовые анимации

**Основные возможности**:
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

**Компоненты архитектуры**:
- **builder** - API построителя анимаций
- **context** - Контекст анимации во время выполнения
- **style** - Типобезопасные CSS-операции
- **easing** - 30+ функций сглаживания
- **tween** - Система интерполяции
- **timeline** - Управление временной шкалой
- **presets** - Готовые анимации (затухание, скольжение, масштабирование)
- **spotlight** - Эффект прожектора

**Возможности производительности**:
- WASM-оптимизация
- Дебаунсинг обновлений
- Интеграция с requestAnimationFrame
- Минимизация reflows и repaints

### 4. Система иконок (hikari-icons)

Управление иконками и система рендеринга.

**Обязанности**:
- Определения перечислений иконок
- Генерация SVG-контента
- Варианты размеров иконок
- Интеграция с Lucide Icons

**Основные возможности**:
```rust
use hikari_icons::{Icon, LucideIcon};

rsx! {
    Icon {
        icon: LucideIcon::Search,
        size: 24,
        color: "var(--hi-primary)"
    }
}
```

**Источники иконок**:
- Lucide Icons (более 1000 иконок)
- Расширяемые пользовательские иконки
- Поддержка нескольких размеров

### 5. Библиотека компонентов (hikari-components)

Полная библиотека UI-компонентов.

**Обязанности**:
- Базовые UI-компоненты
- Компоненты раскладки
- Реестр стилей
- Адаптивные хуки

**Категории компонентов**:

1. **Базовые компоненты** (feature: "basic")
   - Button, Input, Card, Badge

2. **Компоненты обратной связи** (feature: "feedback")
   - Alert, Toast, Tooltip, Spotlight

3. **Навигационные компоненты** (feature: "navigation")
   - Menu, Tabs, Breadcrumb

4. **Компоненты раскладки** (всегда доступны)
   - Layout, Header, Aside, Content, Footer

5. **Компоненты данных** (feature: "data")
   - Table, Tree, Pagination

**Модульный дизайн**:
```
hikari-components/
 ├── basic/          # Базовые компоненты
 ├── feedback/       # Компоненты обратной связи
 ├── navigation/     # Навигационные компоненты
 ├── layout/         # Компоненты раскладки
 ├── data/           # Компоненты данных
 ├── hooks.rs        # React-хуки
 ├── styled.rs       # Трейты стилей
 └── theme_provider.rs  # Провайдер темы
```

**Система стилей**:
- Исходный SCSS
- Типобезопасные служебные классы
- Изоляция стилей на уровне компонентов
- Интеграция CSS-переменных

### 6. Система сборки (hikari-builder)

Генерация кода во время компиляции и компиляция SCSS.

**Обязанности**:
- Компиляция SCSS (с использованием Grass)
- Обнаружение компонентов
- Генерация кода
- Сборка ресурсов

**Процесс сборки**:
```
1. Найти корневую директорию workspace
   ↓
2. Сканировать SCSS-файлы
   ↓
3. Сгенерировать Rust-константы
   ↓
4. Скомпилировать SCSS-бандл
   ↓
5. Вывести в public/
```

**Использование**:
```rust
// build.rs
fn main() {
    hikari_builder::build().expect("Сборка не удалась");
}
```

**Сгенерированные файлы**:
- `packages/builder/src/generated/components.rs` - Константы компонентов
- `public/styles/bundle.css` - Скомпилированный CSS

### 7. Сервис рендеринга (hikari-render-service)

Серверный рендеринг и раздача статических ресурсов.

**Обязанности**:
- Рендеринг HTML-шаблонов
- Реестр стилей
- Построитель роутера
- Сервис статических файлов
- Интеграция с Axum

**Основные возможности**:
```rust
use hikari_render_service::HikariRenderServicePlugin;

let app = HikariRenderServicePlugin::new()
    .component_style_registry(registry)
    .static_assets("./dist", "/static")
    .add_route("/api/health", get(health_check))
    .build()?;
```

**Модули архитектуры**:
- **html** - HTML-сервис
- **registry** - Реестр стилей
- **router** - Построитель роутера
- **static_files** - Сервис статических файлов
- **styles_service** - Внедрение стилей
- **plugin** - Система плагинов

### 8. Библиотека дополнительных компонентов (hikari-extra-components)

Продвинутые UI-компоненты для сложных сценариев взаимодействия.

**Обязанности**:
- Продвинутые служебные компоненты
- Взаимодействия перетаскивания и масштабирования
- Сворачиваемые панели
- Интеграция анимаций

**Основные компоненты**:

1. **Collapsible** - Сворачиваемая панель
   - Анимация появления/исчезновения слева/справа
   - Настраиваемая ширина
   - Callback состояния развёрнутости

2. **DragLayer** - Слой перетаскивания
   - Ограничения границ
   - Callback-события перетаскивания
   - Настраиваемый z-index

3. **ZoomControls** - Элементы управления масштабированием
   - Поддержка горячих клавиш
   - Настраиваемый диапазон масштабирования
   - Несколько вариантов позиционирования

**Основные возможности**:
```rust
use hikari_extra_components::{Collapsible, DragLayer, ZoomControls};

// Сворачиваемая панель
Collapsible {
    title: "Настройки".to_string(),
    expanded: true,
    position: CollapsiblePosition::Right,
    div { "Содержимое" }
}

// Слой перетаскивания
DragLayer {
    initial_x: 100.0,
    initial_y: 100.0,
    constraints: DragConstraints {
        min_x: Some(0.0),
        max_x: Some(500.0),
        ..Default::default()
    },
    div { "Перетащи меня" }
}

// Элементы управления масштабированием
ZoomControls {
    zoom: 1.0,
    on_zoom_change: move |z| println!("Масштаб: {}", z)
}
```

## Принципы архитектуры

### 1. Модульный дизайн

Каждый пакет независим и может использоваться отдельно:

```toml
# Использовать только палитру
[dependencies]
hikari-palette = "0.1"

# Использовать компоненты и темы
[dependencies]
hikari-components = "0.1"
hikari-theme = "0.1"

# Использовать систему анимаций
[dependencies]
hikari-animation = "0.1"
```

### 2. Многослойная архитектура

```
┌─────────────────────────────────────┐
│      Слой приложения (examples/)    │
├─────────────────────────────────────┤
│    Слой компонентов (hikari-components)│
├─────────────────────────────────────┤
│  Слой систем (theme, animation, icons)│
├─────────────────────────────────────┤
│   Слой основы (palette, builder)    │
└─────────────────────────────────────┘
```

### 3. Однонаправленный поток данных

```
Действие пользователя → Обработчик событий → Обновление состояния → Перерисовка UI
```

### 4. Типобезопасность

Все API типобезопасны:
- Проверка во время компиляции
- Автодополнение в IDE
- Безопасность рефакторинга

### 5. Производительность прежде всего

- WASM-оптимизация
- Виртуальная прокрутка
- Дебаунсинг/троттлинг
- Минимизация манипуляций с DOM

## Процесс сборки

### Режим разработки
```bash
cargo run
```

### Продакшн-сборка
```bash
# 1. Сборка Rust-кода
cargo build --release

# 2. Система сборки автоматически компилирует SCSS
# 3. Генерирует CSS-бандл
# 4. Собирает статические ресурсы
```

### WASM-сборка
```bash
trunk build --release
```

## Зависимости

```
hikari-components
  ├── hikari-palette
  ├── hikari-theme
  ├── hikari-animation
  └── hikari-icons

hikari-extra-components
  ├── hikari-palette
  ├── hikari-theme
  └── hikari-animation

hikari-render-service
  ├── hikari-components
  └── axum

hikari-builder
  └── grass (SCSS-компилятор)
```

## Расширяемость

### Добавление пользовательских компонентов

```rust
use hikari_components::{StyledComponent, StyleRegistry};

pub struct MyComponent;

impl StyledComponent for MyComponent {
    fn register_styles(registry: &mut StyleRegistry) {
        registry.register("my-component", include_str!("my-component.scss"));
    }
}
```

### Добавление пользовательских тем

```rust
use hikari_palette::ThemePalette;

struct CustomTheme;

impl CustomTheme {
    pub fn palette() -> ThemePalette {
        ThemePalette {
            primary: "#FF0000",
            secondary: "#00FF00",
            // ...
        }
    }
}
```

### Добавление пользовательских пресетов анимаций

```rust
use hikari_animation::{AnimationBuilder, AnimationContext};

pub fn fade_in(
    builder: AnimationBuilder,
    element: &str,
    duration: u32,
) -> AnimationBuilder {
    builder
        .add_style(element, CssProperty::Opacity, "0")
        .add_style(element, CssProperty::Opacity, "1")
        .apply_with_transition(&format!("{}ms", duration), "ease-out")
}
```

## Оптимизация производительности

### 1. CSS-оптимизация
- SCSS компилируется в оптимизированный CSS
- Удаление неиспользуемых стилей (tree-shaking)
- Минификация продакшн-CSS

### 2. WASM-оптимизация
- Оптимизация `wasm-opt`
- Ленивая загрузка WASM-модулей
- Оптимизация линейной памяти

### 3. Оптимизация во время выполнения
- Виртуальная прокрутка (большие списки данных)
- Дебаунсинг обновлений анимаций
- requestAnimationFrame

### 4. Оптимизация сборки
- Параллельная компиляция
- Инкрементальная компиляция
- Кэширование бинарников

## Стратегия тестирования

### Модульные тесты
Каждый модуль имеет полные модульные тесты:

```rust
#[cfg(test)]
mod tests {
    #[test]
    fn test_color_conversion() {
        let color = ChineseColor::Cinnabar;
        assert_eq!(color.hex(), "#E94B35");
    }
}
```

### Интеграционные тесты
Примеры приложений в `examples/` служат интеграционными тестами

### Визуальное регрессионное тестирование
Используйте Percy или аналогичные инструменты для snapshot-тестирования UI

## Следующие шаги

- Прочитайте [Документацию компонентов](../components/) для конкретных компонентов
- Просмотрите [API Документацию](https://docs.rs/hikari-components) для деталей API
- Изучите [Примеры кода](../../examples/) для изучения лучших практик
