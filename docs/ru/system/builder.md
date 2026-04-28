# Система сборки

Система генерации кода во время компиляции и компиляции SCSS.

## Обзор

`hikari-builder` предоставляет:

- **Компиляция SCSS** - Компиляция SCSS в CSS с помощью Grass
- **Обнаружение компонентов** - Автообнаружение SCSS-файлов компонентов
- **Генерация кода** - Генерация констант и типов Rust
- **Сборка ресурсов** - Создание оптимизированных CSS-бандлов

## Основные функции

### 1. Компиляция SCSS

```rust
// build.rs
fn main() {
    hikari_builder::build().expect("Сборка не удалась");
}
```

Процесс компиляции:
1. Сканирование директории `packages/components/src/styles/components/`
2. Компиляция всех файлов `.scss`
3. Вывод в `public/styles/bundle.css`

### 2. Обнаружение компонентов

Автообнаружение компонентов и генерация констант:

```rust
// Сгенерировано в packages/builder/src/generated/components.rs
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

Конфигурация сборки:

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
    .expect("Сборка не удалась");
```

## Справочник API

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

## Примеры использования

### Использование в build.rs

```rust
fn main() {
    // Сборка по умолчанию
    hikari_builder::build().unwrap();

    // Или используйте пользовательскую конфигурацию
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

## Интеграция с другими системами

- **Компоненты** - Предоставляет SCSS-файлы компонентов
- **Тема** - Предоставляет переменные темы и миксины
- **Render-service** - Использует сгенерированный CSS-бандл

## Связанные системы

- [Палитра](./palette.md) - Цветовые переменные
- [Тема](./theme.md) - SCSS-миксины
- [Компоненты](../components/) - Библиотека компонентов
