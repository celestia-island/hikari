# Sistema Builder

Sistema de generación de código en tiempo de compilación y compilación SCSS.

## Descripción General

`hikari-builder` proporciona:

- **Compilación SCSS** - Compilar SCSS a CSS usando Grass
- **Descubrimiento de Componentes** - Auto-descubrir archivos SCSS de componentes
- **Generación de Código** - Generar constantes y tipos Rust
- **Empaquetado de Recursos** - Crear paquetes CSS optimizados

## Características Principales

### 1. Compilación SCSS

```rust
// build.rs
fn main() {
    hikari_builder::build().expect("Build failed");
}
```

Proceso de compilación:
1. Escanear directorio `packages/components/src/styles/components/`
2. Compilar todos los archivos `.scss`
3. Generar salida en `public/styles/bundle.css`

### 2. Descubrimiento de Componentes

Auto-descubrir componentes y generar constantes:

```rust
// Generado en packages/builder/src/generated/components.rs
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

Configuración de build:

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
    .expect("Build failed");
```

## Referencia de API

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

## Ejemplos de Uso

### Usando en build.rs

```rust
fn main() {
    // Build por defecto
    hikari_builder::build().unwrap();

    // O usar configuración personalizada
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

## Integración con Otros Sistemas

- **Componentes** - Proporciona archivos SCSS de componentes
- **Tema** - Proporciona variables y mixins de tema
- **Render-service** - Usa el paquete CSS generado

## Sistemas Relacionados

- [Paleta](./palette.md) - Variables de color
- [Tema](./theme.md) - Mixins SCSS
- [Componentes](../components/) - Biblioteca de componentes
