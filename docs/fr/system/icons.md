# Système d'icônes

Système de gestion et de rendu d'icônes, intégré avec Material Design Icons (MDI).

## Aperçu

`hikari-icons` fournit :

- **1000+ Icônes** - Collection complète Material Design Icons (MDI)
- **Sécurité de type** - Noms d'icônes basés sur des énumérations
- **Rendu SVG** - Rendu côté client et côté serveur
- **Chargement à l'exécution** - Chargement SVG d'icônes à la demande

## Composant Icon

### Utilisation de base

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

### Icônes disponibles

```rust
pub enum MdiIcon {
    // Navigation
    Home,
    Menu,
    Magnify,
    Cog,
    ChevronDown,
    ChevronLeft,
    ChevronRight,

    // Actions
    Pencil,
    Delete,
    Check,
    Close,
    Plus,
    Minus,

    // Statut
    AlertCircleOutline,
    CheckCircleOutline,
    InformationOutline,
    AlertOutline,

    // ... 1000+ icônes
}
```

### Props

| Propriété | Type | Défaut | Description |
|----------|------|--------|-------------|
| `icon` | `MdiIcon` | - | Type d'icône |
| `size` | `u32` | `24` | Taille de l'icône |
| `color` | `&str` | - | Couleur |

## Chargement à l'exécution

### Rendu côté client

```rust
use hikari_icons::runtime;

// Charger le SVG de l'icône de manière asynchrone
async fn load_icon(name: &str) -> Result<String, Error> {
    runtime::load_icon(name).await
}
```

### Rendu côté serveur

```rust
use hikari_icons::server;

// Rendu d'icône côté serveur
fn render_icon(name: &str) -> String {
    server::render_icon(name)
}
```

## Référence API

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
    // 1000+ variantes d'icônes
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

## Intégration avec d'autres systèmes

- **Composants** - Icônes utilisées dans Button, Input et d'autres composants
- **Render-service** - Service de fichiers d'icônes statiques
- **Thème** - Les couleurs d'icônes héritent du thème

## Systèmes liés

- [Composants](../components/) - Composants utilisant des icônes
- [Palette](./palette.md) - Couleurs d'icônes
