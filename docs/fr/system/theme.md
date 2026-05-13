# Système de Thèmes

Système de gestion de thèmes fournissant le contexte de thème, les variables CSS et la fonctionnalité de changement de thème.

## Table des Matières

- [Aperçu](#aperçu)
- [ThemeProvider](#themeprovider-fournisseur-de-thème)
- [ThemeContext](#themecontext-contexte-de-thème)
- [Ressources Générées](#ressources-générées)
- [Système de Variables CSS](#système-de-variables-css)
- [Changement de Thème](#changement-de-thème)
- [Personnalisation des Styles](#personnalisation-des-styles)
- [Référence API](#référence-api)

## Aperçu

`hikari-theme` fournit une solution complète de gestion de thèmes:

- **ThemeProvider** - Composant fournisseur de contexte de thème
- **ThemeContext** - Configuration du thème et définitions des couleurs
- **Generated** - Variables CSS et ressources auto-générées
- **Variables CSS** - Système de variables de thème dynamiques
- **Changement de Thème** - Support du changement de thème à l'exécution

Tous les composants de thème disposent de:

- **Type Safe** - Vérification des identifiants de thème à la compilation
- **Réactif** - S'adapte automatiquement aux différents thèmes
- **Extensible** - Supporte les thèmes personnalisés

## ThemeProvider

Fournit le contexte de thème pour l'application entière.

### Utilisation de Base

```rust
use dioxus::prelude::*;
use hikari_theme::ThemeProvider;

rsx! {
    ThemeProvider { palette: "hikari".to_string() }
        // Contenu de l'application
        App {}
    }
}
```

### Changement de Thème

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
                    "Changer de Thème"
                }
                // Contenu de l'application
            }
        }
    }
}
```

### Props

| Propriété | Type | Défaut | Description |
|-----------|------|--------|-------------|
| `palette` | `String` | `"hikari"` | Identifiant du thème |
| `children` | `Element` | - | Éléments enfants |

### Thèmes Supportés

- **hikari** - Thème clair
- **tairitsu** - Thème sombre

## ThemeContext

Structure de données contenant la configuration du thème et les définitions des couleurs.

### Définition de la Structure

```rust
pub struct ThemeContext {
    pub palette: String,
    pub colors: Palette,
}
```

### Descriptions des Champs

- **palette** - Chaîne identifiant le thème
- **colors** - Configuration de la palette de thème (de `hikari-palette`)

### Valeurs par Défaut

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

## Ressources Générées

Ressources statiques et variables CSS auto-générées.

### Tailwind CSS

```rust
use hikari_theme::generated::tailwind;

// Accéder aux classes Tailwind CSS générées
let tailwind_classes = tailwind::TAILWIND_CLASSES;
```

### Contenu Généré

Le module `generated/mod.rs` contient:

- `tailwind` - Classes et variables Tailwind CSS générées
- `components` - Constantes de style de composants (générées par builder)

### Emplacements des Fichiers

```
packages/theme/src/generated/
├── mod.rs           # Point d'entrée du module
├── tailwind.rs      # Contenu Tailwind CSS généré
└── ...              # Autre contenu généré
```

## Système de Variables CSS

Le système de thèmes utilise des variables CSS pour le changement de thème dynamique.

### Variables Racine

Définies sous `:root` ou `[data-theme]`:

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

### Utilisation des Variables CSS

Utiliser dans les styles de composants:

```rust
rsx! {
    div {
        style: "color: var(--hi-color-primary); background: var(--hi-color-surface);",
        "Utilisation des variables de thème"
    }
}
```

Ou en SCSS:

```scss
.my-component {
    color: var(--hi-color-primary);
    background-color: var(--hi-color-surface);
    border: 1px solid var(--hi-color-border);
}
```

### Liste Complète des Variables

#### Variables de Couleur

```css
--hi-color-primary          /* Couleur primaire */
--hi-color-secondary        /* Couleur secondaire */
--hi-color-accent           /* Couleur d'accentuation */
--hi-color-success          /* Couleur de succès */
--hi-color-warning          /* Couleur d'avertissement */
--hi-color-danger           /* Couleur de danger */
--hi-color-background       /* Couleur de fond */
--hi-color-surface          /* Couleur de surface */
--hi-color-border           /* Couleur de bordure */
--hi-color-text-primary     /* Couleur du texte principal */
--hi-color-text-secondary   /* Couleur du texte secondaire */
```

#### Variables de Typographie

```css
--hi-font-family-sans       /* Police sans-serif */
--hi-font-family-mono       /* Police monospace */
--hi-font-size-xs           /* 12px */
--hi-font-size-sm           /* 14px */
--hi-font-size-base         /* 16px */
--hi-font-size-lg           /* 18px */
--hi-font-size-xl           /* 20px */
--hi-font-size-2xl          /* 24px */
--hi-font-size-3xl          /* 30px */
```

#### Variables d'Espacement

```css
--hi-spacing-xs            /* 4px */
--hi-spacing-sm            /* 8px */
--hi-spacing-md            /* 16px */
--hi-spacing-lg            /* 24px */
--hi-spacing-xl            /* 32px */
--hi-spacing-2xl           /* 48px */
```

#### Variables de Rayon

```css
--hi-radius-sm             /* 4px */
--hi-radius-md             /* 8px */
--hi-radius-lg             /* 12px */
--hi-radius-xl             /* 16px */
--hi-radius-full           /* 9999px */
```

#### Variables d'Ombre

```css
--hi-shadow-sm             /* Petite ombre */
--hi-shadow-md             /* Ombre moyenne */
--hi-shadow-lg             /* Grande ombre */
--hi-shadow-xl             /* Très grande ombre */
```

#### Variables de Transition

```css
--hi-transition-fast       /* 150ms */
--hi-transition-base       /* 200ms */
--hi-transition-slow       /* 300ms */
```

## Changement de Thème

### Changement à l'Exécution

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
                    "Clair"
                }
                button {
                    onclick: move |_| theme.set("tairitsu".to_string()),
                    class: if theme() == "tairitsu" { "active" } else { "" },
                    "Sombre"
                }
            }
        }
    }
}
```

### Thème Persistant

```rust
use gloo::storage::LocalStorage;

#[component]
fn PersistentTheme() -> Element {
    // Charger le thème depuis LocalStorage
    let mut theme = use_signal(|| {
        LocalStorage::get("theme")
            .unwrap_or_else(|_| Ok("hikari".to_string()))
            .unwrap_or("hikari".to_string())
    });

    // Sauvegarder le thème dans LocalStorage lors du changement
    use_effect(move || {
        let theme = theme();
        async move {
            if let Err(e) = LocalStorage::set("theme", &theme) {
                eprintln!("Échec de la sauvegarde du thème: {}", e);
            }
        }
    });

    rsx! {
        ThemeProvider { palette: theme() }
            // Contenu de l'application
        }
    }
}
```

### Détection du Thème Système

```rust
use web_sys::window;

#[component]
fn SystemTheme() -> Element {
    let mut theme = use_signal(|| "hikari".to_string());

    // Détecter la préférence de thème système
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
            // Contenu de l'application
        }
    }
}
```

## Personnalisation des Styles

### Remplacement des Variables de Thème

```css
/* Remplacer les variables de thème dans les styles globaux */
[data-theme="hikari"] {
    --hi-color-primary: #0066CC;
    --hi-color-secondary: #FF6600;
}
```

### Thème au Niveau du Composant

```rust
rsx! {
    // Utiliser un thème différent pour un composant spécifique
    div {
        "data-theme": "tairitsu",
        style: "background: var(--hi-color-surface);",
        "Ce composant utilise le thème sombre"
    }
}
```

### Variables de Thème Personnalisées

```css
[data-theme="custom"] {
    --hi-color-primary: #FF0066;
    --hi-color-secondary: #00FF99;
    --hi-color-accent: #FFFF00;
    /* ... autres variables */
}
```

## Bonnes Pratiques

### 1. Placement du ThemeProvider

```rust
// Bien: Placer ThemeProvider à la racine de l'application
#[component]
fn App() -> Element {
    rsx! {
        ThemeProvider { palette: "hikari".to_string() }
            Router {}
        }
    }
}

// Éviter: Imbriquer plusieurs ThemeProviders
#[component]
fn BadExample() -> Element {
    rsx! {
        ThemeProvider { palette: "hikari".to_string() }
            ThemeProvider { palette: "tairitsu".to_string() }
                // Le thème interne remplacera l'externe
            }
        }
    }
}
```

### 2. Animation de Changement de Thème

```css
/* Ajouter une transition fluide pour le changement de thème */
* {
    transition: background-color 0.3s ease,
                color 0.3s ease,
                border-color 0.3s ease;
}
```

### 3. Style Conditionnel

```rust
rsx! {
    div {
        class: if theme() == "hikari" {
            "light-theme"
        } else {
            "dark-theme"
        },
        "Appliquer différents styles selon le thème"
    }
}
```

### 4. Fallback de Variable CSS

```css
/* Fournir un fallback pour les navigateurs ne supportant pas les variables CSS */
.my-component {
    background-color: #00A0E9; /* Valeur de fallback */
    background-color: var(--hi-color-primary, #00A0E9);
}
```

## Référence API

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

## Intégration avec d'Autres Systèmes

### Intégration avec Palette

```rust
use hikari_palette::{ChineseColor, themes};

let hikari_palette = themes::Hikari::palette();
println!("Primaire: {}", hikari_palette.primary.hex);
```

### Intégration avec Animation

```rust
use hikari_animation::AnimationBuilder;
use hikari_theme::ThemeProvider;

// Les variables de thème peuvent être utilisées dans les animations
AnimationBuilder::new(&elements)
    .add_style("button", "background-color", "var(--hi-color-primary)")
    .apply_with_transition("300ms", "ease-in-out");
```

### Intégration avec les Composants

Tous les composants héritent automatiquement du thème fourni par ThemeProvider:

```rust
rsx! {
    ThemeProvider { palette: "hikari".to_string() }
        // Tous les composants utilisent automatiquement le thème hikari
        Button { label: "Bouton" }
        Card { "Carte" }
        Input { placeholder: "Entrée" }
    }
}
```

## Philosophie de Design

### Style Arknights

- **Thème clair (hikari)**:
  - Primaire: Azurite (#00A0E9)
  - Fond: Blanc
  - Texte: Sombre

- **Thème sombre (tairitsu)**:
  - Primaire: Indigo (#1a237e)
  - Fond: Sombre
  - Texte: Clair

### Éléments FUI

- Effets de lueur subtils
- Indicateurs dynamiques (lumières respirantes)
- Bordures fines

### Réactif

- Mobile d'abord
- Layouts adaptatifs
- Système de breakpoints

## Systèmes Connexes

- [Système Palette](./palette.md) - Définitions des couleurs et palettes de thèmes
- [Système Animation](./animation.md) - Animation et intégration de thème
- [Composants](../components/) - Bibliothèque de composants utilisant les thèmes
