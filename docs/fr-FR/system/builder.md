# Système Builder

Système de génération de code à la compilation et de compilation SCSS.

## Aperçu

`hikari-builder` fournit :

- **Compilation SCSS** - Compiler SCSS en CSS en utilisant Grass
- **Découverte de composants** - Découverte automatique des fichiers SCSS de composants
- **Génération de code** - Générer des constantes et types Rust
- **Bundling de ressources** - Créer des bundles CSS optimisés

## Fonctionnalités principales

### 1. Compilation SCSS

```rust
// build.rs
fn main() {
    hikari_builder::build().expect("Échec de la compilation");
}
```

Processus de compilation :
1. Scanner le répertoire `packages/components/src/styles/components/`
2. Compiler tous les fichiers `.scss`
3. Sortie vers `public/styles/bundle.css`

### 2. Découverte de composants

Découverte automatique des composants et génération de constantes :

```rust
// Généré dans packages/builder/src/generated/components.rs
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

Configuration de compilation :

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
    .expect("Échec de la compilation");
```

## Référence API

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

## Exemples d'utilisation

### Utilisation dans build.rs

```rust
fn main() {
    // Compilation par défaut
    hikari_builder::build().unwrap();

    // Ou utiliser une configuration personnalisée
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

## Intégration avec d'autres systèmes

- **Composants** - Fournit les fichiers SCSS des composants
- **Thème** - Fournit les variables et mixins de thème
- **Render-service** - Utilise le bundle CSS généré

## Systèmes liés

- [Palette](./palette.md) - Variables de couleur
- [Thème](./theme.md) - Mixins SCSS
- [Composants](../components/) - Bibliothèque de composants
