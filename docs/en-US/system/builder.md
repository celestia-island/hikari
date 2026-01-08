# Builder System

Compile-time code generation and SCSS compilation system.

## Overview

`hikari-builder` provides:

- **SCSS Compilation** - Compile SCSS to CSS using Grass
- **Component Discovery** - Auto-discover SCSS component files
- **Code Generation** - Generate Rust constants and types
- **Resource Bundling** - Create optimized CSS bundles

## Core Features

### 1. SCSS Compilation

```rust
// build.rs
fn main() {
    hikari_builder::build().expect("Build failed");
}
```

Compilation process:
1. Scan `packages/components/src/styles/components/` directory
2. Compile all `.scss` files
3. Output to `public/styles/bundle.css`

### 2. Component Discovery

Auto-discover components and generate constants:

```rust
// Generated in packages/builder/src/generated/components.rs
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

Build configuration:

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

## API Reference

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

## Usage Examples

### Using in build.rs

```rust
fn main() {
    // Default build
    hikari_builder::build().unwrap();

    // Or use custom configuration
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

## Integration with Other Systems

- **Components** - Provides component SCSS files
- **Theme** - Provides theme variables and mixins
- **Render-service** - Uses generated CSS bundle

## Related Systems

- [Palette](./palette.md) - Color variables
- [Theme](./theme.md) - SCSS mixins
- [Components](../components/) - Component library
