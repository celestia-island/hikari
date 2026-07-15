# Framework UI Hikari

Hikari (光) est un framework UI moderne pour Rust, construit avec :

- **Tairitsu 0.7** - Framework UI réactif
- **Grass** - Compilateur SCSS
- **Axum** - Serveur web pour le SSR

## Philosophie de conception

Hikari combine :

- **Esthétique Arknights** - Lignes épurées, contraste élevé
- **FUI (Future User Interface)** - Effets de lueur, indicateurs dynamiques
- **Couleurs traditionnelles chinoises** - 500+ noms de couleurs authentiques

## Démarrage rapide

```bash
cargo new my-app
cd my-app
cargo add hikari-components hikari-theme
```

```rust
use hikari_components::{ThemeProvider, Button};

fn App() -> Element {
    rsx! {
        ThemeProvider { palette: "hikari" } {
            Button { label: "Bonjour, Hikari !" }
        }
    }
}
```

## Fonctionnalités

- 🎨 500+ couleurs traditionnelles chinoises
- 🌙 Thèmes clair et sombre
- 🔧 Classes utilitaires sûres par le typage
- ✨ Animations fluides
- 📱 Composants responsives
- 🌐 Support i18n intégré

## Documentation

Visitez [docs.hikari.dev](https://docs.hikari.dev) pour la documentation complète.
