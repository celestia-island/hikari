# Système de palette

Implémentation du système de couleurs traditionnelles chinoises avec plus de 500 couleurs historiques.

## Table des matières

- [Aperçu](#aperçu)
- [Couleurs](#couleurs)
- [ClassesBuilder](#classesbuilder-générateur-de-classes-utilitaires)
- [Thèmes](#thèmes)
- [Opacité et fusion](#opacité-et-fusion)
- [Référence API](#référence-api)

## Aperçu

`hikari-palette` fournit :

- **500+ Couleurs** - Définitions complètes des couleurs traditionnelles chinoises
- **Sécurité de type** - Vérification des valeurs de couleur à la compilation
- **Classes utilitaires** - Générateur de classes utilitaires de type Tailwind avec sécurité de type
- **Palettes de thèmes** - Schémas de couleurs de thèmes préconfigurés
- **Support d'opacité** - Transparence et fusion des couleurs

Toutes les définitions de couleurs comportent :

- **Patrimoine culturel** - Noms de couleurs traditionnelles chinoises
- **Sécurité de type** - Définitions de couleurs basées sur des énumérations
- **Valeurs Hex** - Codes de couleurs hexadécimaux standard
- **Catégories** - Organisées par familles de couleurs

## Couleurs

### Utilisation de base

```rust
use hikari_palette::ChineseColor;

// Accéder aux couleurs en utilisant des variantes d'énumération
let red = ChineseColor::Cinnabar;
let blue = ChineseColor::Azurite;
let yellow = ChineseColor::VineYellow;

println!("Rouge: {}", red.hex());  // #E94B35
println!("Bleu: {}", blue.hex()); // #00A0E9
println!("Jaune: {}", yellow.hex()); // #F8B62D
```

### Catégories de couleurs disponibles

#### Série rouge (红色系)

```rust
// Couleurs rouges traditionnelles
ChineseColor::Cinnabar      // 朱砂 #E94B35 - Vermillon
ChineseColor::Vermilion     // 朱红 #FF4C00 - Rouge-orange vif
ChineseColor::Crimson       // 绯红 #FF3030 - Cramoisi profond
ChineseColor::PeachBlossom  // 桃红 #F6BEC8 - Rose pêche
ChineseColor::RoseRed       // 玫瑰红 #C21F30 - Rouge rose
```

#### Série bleue (蓝色系)

```rust
// Couleurs bleues traditionnelles
ChineseColor::Azurite       // 石青 #00A0E9 - Bleu azurite
ChineseColor::Indigo        // 靛蓝 #1a237e - Bleu indigo
ChineseColor::Cyan          // 青色 #00CED1 - Cyan
ChineseColor::SkyBlue       // 天蓝 #87CEEB - Bleu ciel
ChineseColor::Turquoise     // 绿松石 #40E0D0 - Turquoise
```

#### Série jaune (黄色系)

```rust
// Couleurs jaunes traditionnelles
ChineseColor::VineYellow    // 藤黄 #F8B62D - Jaune gommenthe
ChineseColor::GooseYellow   // 鹅黄 #FFF176 - Jaune clair
ChineseColor::Golden        // 金色 #FFD700 - Or
ChineseColor::Amber         // 琥珀 #FFBF00 - Ambre
```

#### Série verte (绿色系)

```rust
// Couleurs vertes traditionnelles
ChineseColor::ScallionGreen // 葱倩 #4CAF50 - Vert ciboulette
ChineseColor::BambooGreen  // 竹青 #789262 - Vert bambou
ChineseColor::Jade          // 玉色 #A0E6DA - Vert jade
ChineseColor::Emerald       // 翡翠 #50C878 - Vert émeraude
```

#### Série neutre (中性色系)

```rust
// Couleurs neutres traditionnelles
ChineseColor::InkBlack      // 墨色 #1A1A2E - Noir d'encre
ChineseColor::MoonWhite     // 月白 #F5F5F5 - Blanc lune
ChineseColor::LightGray     // 缟色 #E0E0E0 - Gris clair
ChineseColor::AshGray       // 灰色 #808080 - Gris cendre
```

### Propriétés des couleurs

Chaque couleur fournit :

```rust
let color = ChineseColor::Azurite;

// Obtenir la valeur hexadécimale
let hex = color.hex();  // "#00A0E9"

// Obtenir les valeurs RGB
let rgb = color.rgb();  // (0, 160, 233)

// Obtenir le nom de la couleur
let name = color.name();  // "石青"

// Obtenir le nom anglais
let english_name = color.english_name();  // "Azurite"
```

## ClassesBuilder

Générateur de classes utilitaires avec sécurité de type pour des classes de type Tailwind CSS.

### Utilisation de base

```rust
use hikari_palette::{ClassesBuilder, classes::*};

let classes = ClassesBuilder::new()
    .add(Display::Flex)
    .add(FlexDirection::Row)
    .add(Gap::Gap4)
    .build();

// Sortie : "hi-flex hi-flex-row hi-gap-4"
```

### Classes utilitaires disponibles

#### Classes d'affichage

```rust
use hikari_palette::classes::Display;

Display::Block      // "hi-block"
Display::Flex       // "hi-flex"
Display::Grid       // "hi-grid"
Display::Hidden     // "hi-hidden"
```

#### Classes Flexbox

```rust
use hikari_palette::classes::{FlexDirection, AlignItems, JustifyContent};

FlexDirection::Row        // "hi-flex-row"
FlexDirection::Column     // "hi-flex-column"
AlignItems::Center        // "hi-items-center"
AlignItems::Stretch       // "hi-items-stretch"
JustifyContent::Center    // "hi-justify-center"
JustifyContent::Between   // "hi-justify-between"
```

#### Classes d'espacement

```rust
use hikari_palette::classes::{Padding, Margin, Gap};

Padding::P4        // "hi-p-4"
Padding::Px8       // "hi-px-8"
Margin::M4         // "hi-m-4"
Margin::MyAuto     // "hi-my-auto"
Gap::Gap4          // "hi-gap-4"
```

#### Classes de couleurs

```rust
use hikari_palette::classes::{TextColor, BackgroundColor};

TextColor::Primary       // "hi-text-primary"
TextColor::Secondary     // "hi-text-secondary"
BackgroundColor::Primary // "hi-bg-primary"
BackgroundColor::Surface // "hi-bg-surface"
```

#### Classes de typographie

```rust
use hikari_palette::classes::{FontSize, FontWeight};

FontSize::Base       // "hi-text-base"
FontSize::XL         // "hi-text-xl"
FontSize::2XL        // "hi-text-2xl"
FontWeight::Normal   // "hi-font-normal"
FontWeight::Bold     // "hi-font-bold"
```

#### Classes de bordure

```rust
use hikari_palette::classes::{Border, BorderRadius};

Border::B            // "hi-border"
Border::B2           // "hi-border-2"
BorderRadius::Md     // "hi-rounded-md"
BorderRadius::Full   // "hi-rounded-full"
```

### Combinaison de classes

```rust
use hikari_palette::{ClassesBuilder, classes::*};

// Style de composant complexe
let button_classes = ClassesBuilder::new()
    .add(Display::Flex)
    .add(AlignItems::Center)
    .add(JustifyContent::Center)
    .add(Padding::Px4)
    .add(Padding::Py2)
    .add(BorderRadius::Md)
    .add(BackgroundColor::Primary)
    .add(TextColor::White)
    .build();

// Sortie : "hi-flex hi-items-center hi-justify-center hi-px-4 hi-py-2 hi-rounded-md hi-bg-primary hi-text-white"
```

### Avantages de la sécurité de type

```rust
// ✅ Sécurité de type - vérification à la compilation
let classes = ClassesBuilder::new()
    .add(Display::Flex)
    .add(FlexDirection::Row)
    .build();

// ❌ Ne compilerait pas - protection contre les fautes de frappe
let classes = ClassesBuilder::new()
    .add(Display::Flx)  // Erreur de compilation !
    .build();
```

## Thèmes

Palettes de thèmes préconfigurés.

### Thème Hikari (Clair)

```rust
use hikari_palette::themes;

let hikari = themes::Hikari::palette();

println!("Primaire: {}", hikari.primary.hex);   // #00A0E9
println!("Secondaire: {}", hikari.secondary.hex); // #E94B35
println!("Accent: {}", hikari.accent.hex);     // #F8B62D
println!("Arrière-plan: {}", hikari.background.hex); // #FFFFFF
println!("Surface: {}", hikari.surface.hex);   // #F5F5F5
```

**Schéma de couleurs** :
- Primaire : Azurite (石青) - Cyan-bleu frais
- Secondaire : Cinnabar (朱砂) - Rouge-orange énergique
- Accent : Jaune gommenthe (藤黄) - Jaune doré chaud
- Arrière-plan : Blanc lune (月白) - Blanc pur
- Surface : Gris clair avec teinte subtile

### Thème Tairitsu (Sombre)

```rust
use hikari_palette::themes;

let tairitsu = themes::Tairitsu::palette();

println!("Primaire: {}", tairitsu.primary.hex);   // #1a237e
println!("Secondaire: {}", tairitsu.secondary.hex); // #E94B35
println!("Accent: {}", tairitsu.accent.hex);     // #FFF176
println!("Arrière-plan: {}", tairitsu.background.hex); // #0D1117
println!("Surface: {}", tairitsu.surface.hex);   // #161B22
```

**Schéma de couleurs** :
- Primaire : Indigo (靛蓝) - Bleu indigo profond
- Secondaire : Cinnabar (朱砂) - Rouge-orange énergique
- Accent : Jaune oison (鹅黄) - Jaune pâle vif
- Arrière-plan : Gris foncé profond
- Surface : Gris foncé légèrement plus clair

### Thème personnalisé

```rust
use hikari_palette::{ThemePalette, ChineseColor};

let custom = ThemePalette {
    primary: ChineseColor::Crimson,
    secondary: ChineseColor::VineYellow,
    accent: ChineseColor::Azurite,
    background: ChineseColor::InkBlack,
    surface: ChineseColor::MoonWhite,
    success: ChineseColor::ScallionGreen,
    warning: ChineseColor::GooseYellow,
    danger: ChineseColor::Cinnabar,
};
```

### Structure du thème

```rust
pub struct ThemePalette {
    pub primary: ChineseColor,
    pub secondary: ChineseColor,
    pub accent: ChineseColor,
    pub background: ChineseColor,
    pub surface: ChineseColor,
    pub success: ChineseColor,
    pub warning: ChineseColor,
    pub danger: ChineseColor,
    pub text_primary: ChineseColor,
    pub text_secondary: ChineseColor,
    pub border: ChineseColor,
}
```

## Opacité et fusion

Utilitaires de transparence et de fusion des couleurs.

### Fonction d'opacité

```rust
use hikari_palette::{ChineseColor, opacity};

let color = ChineseColor::Azurite;
let semi_blue = opacity(color, 0.5);

// Sortie : "rgba(0, 160, 233, 0.5)"
```

### Fonction de fusion

```rust
use hikari_palette::{ChineseColor, blend};

let color1 = ChineseColor::Azurite;
let color2 = ChineseColor::Cinnabar;
let blended = blend(color1, color2, 0.5);

// Fusionne 50% de chaque couleur
```

### Éclaircissement des couleurs

```rust
use hikari_palette::{ChineseColor, lighten};

let color = ChineseColor::InkBlack;
let lighter = lighten(color, 0.2);

// Éclaircit de 20%
```

### Assombrissement des couleurs

```rust
use hikari_palette::{ChineseColor, darken};

let color = ChineseColor::MoonWhite;
let darker = darken(color, 0.3);

// Assombrit de 30%
```

## Exemples d'intégration

### Avec ThemeProvider

```rust
use dioxus::prelude::*;
use hikari_theme::ThemeProvider;
use hikari_palette::themes;

#[component]
fn App() -> Element {
    let hikari = themes::Hikari::palette();

    rsx! {
        ThemeProvider { palette: "hikari".to_string() }
            div {
                style: "color: {hikari.primary.hex}",
                "Texte thématique"
            }
        }
    }
}
```

### Avec les composants

```rust
use hikari_components::Button;
use hikari_palette::ChineseColor;

rsx! {
    Button {
        variant: "primary",
        style: format!("background: {}", ChineseColor::Azurite.hex()),
        "Bouton personnalisé"
    }
}
```

### Avec les classes utilitaires

```rust
use hikari_palette::{ClassesBuilder, classes::*};

let card_classes = ClassesBuilder::new()
    .add(BackgroundColor::Surface)
    .add(BorderRadius::Lg)
    .add(Padding::P6)
    .add(Shadow::Lg)
    .build();

rsx! {
    div {
        class: "{card_classes}",
        "Contenu de la carte"
    }
}
```

## Référence API

### ChineseColor

```rust
pub enum ChineseColor {
    // Série rouge
    Cinnabar,      // 朱砂
    Vermilion,     // 朱红
    Crimson,       // 绯红

    // Série bleue
    Azurite,       // 石青
    Indigo,        // 靛蓝
    Cyan,          // 青色

    // Série jaune
    VineYellow,    // 藤黄
    GooseYellow,   // 鹅黄

    // Série verte
    ScallionGreen, // 葱倩
    BambooGreen,   // 竹青
    Jade,          // 玉色

    // Série neutre
    InkBlack,      // 墨色
    MoonWhite,     // 月白
    LightGray,     // 缟色

    // ... 500+ couleurs supplémentaires
}

impl ChineseColor {
    pub fn hex(&self) -> String;
    pub fn rgb(&self) -> (u8, u8, u8);
    pub fn name(&self) -> &'static str;
    pub fn english_name(&self) -> &'static str;
}
```

### ClassesBuilder

```rust
pub struct ClassesBuilder {
    // interne
}

impl ClassesBuilder {
    pub fn new() -> Self;
    pub fn add(mut self, class: impl Class) -> Self;
    pub fn build(self) -> String;
}
```

### ThemePalette

```rust
pub struct ThemePalette {
    pub primary: ChineseColor,
    pub secondary: ChineseColor,
    pub accent: ChineseColor,
    pub background: ChineseColor,
    pub surface: ChineseColor,
    pub success: ChineseColor,
    pub warning: ChineseColor,
    pub danger: ChineseColor,
    pub text_primary: ChineseColor,
    pub text_secondary: ChineseColor,
    pub border: ChineseColor,
}
```

### Utilitaires de couleur

```rust
pub fn opacity(color: ChineseColor, alpha: f64) -> String;
pub fn blend(color1: ChineseColor, color2: ChineseColor, factor: f64) -> String;
pub fn lighten(color: ChineseColor, amount: f64) -> String;
pub fn darken(color: ChineseColor, amount: f64) -> String;
```

## Philosophie de design

### Signification culturelle

Chaque couleur traditionnelle chinoise porte une signification culturelle et historique :

- **Cinnabar (朱砂)** : Utilisé dans les sceaux impériaux, représente le pouvoir et l'autorité
- **Azurite (石青)** : Utilisé dans la peinture traditionnelle, représente l'élégance
- **Jaune gommenthe (藤黄)** : Pigment de peinture traditionnelle, chaleur et vitalité
- **Noir d'encre (墨色)** : Encre de calligraphie, représente le savoir et la profondeur
- **Blanc lune (月白)** : Blanc bleuté pâle, représente la pureté

### Harmonie des couleurs

Les combinaisons de couleurs traditionnelles chinoises suivent des règles d'harmonie spécifiques :

- **Complémentaire** : Rouge + Vert (朱砂 + 竹青)
- **Analogue** : Bleu + Cyan (石青 + 青色)
- **Triadique** : Rouge + Jaune + Bleu (朱砂 + 藤黄 + 石青)

## Bonnes pratiques

### 1. Utiliser des énumérations pour la sécurité de type

```rust
// ✅ Bon - Sécurité de type
let color = ChineseColor::Azurite;

// ❌ À éviter - Basé sur une chaîne
let color = "#00A0E9";
```

### 2. Exploiter les palettes de thèmes

```rust
// ✅ Bon - Utiliser la palette de thème
let palette = themes::Hikari::palette();
let primary = palette.primary;

// ❌ À éviter - Couleurs codées en dur
let primary = "#00A0E9";
```

### 3. Utiliser les classes utilitaires

```rust
// ✅ Bon - Utilitaires avec sécurité de type
let classes = ClassesBuilder::new()
    .add(Display::Flex)
    .add(Gap::Gap4)
    .build();

// ✅ Acceptable - Basé sur une chaîne (moins sûr)
let classes = "hi-flex hi-gap-4";
```

### 4. Nommage sémantique des couleurs

```rust
// ✅ Bon - Usage sémantique
let button_color = theme.palette.primary;
let error_color = theme.palette.danger;

// ❌ À éviter - Références directes aux couleurs
let button_color = ChineseColor::Azurite;
let error_color = ChineseColor::Cinnabar;
```

## Systèmes liés

- [Système de thème](./theme.md) - Contexte de thème et variables CSS
- [Composants](../components/) - Bibliothèque de composants utilisant les palettes
- [Système Builder](./builder.md) - Compilation SCSS avec variables de palette

## Ressources

- [Couleurs traditionnelles chinoises](https://zh.wikipedia.org/wiki/%E4%B8%AD%E5%9B%BD%E4%BC%A0%E7%BB%9F%E9%A2%9C%E8%89%B2)
- [Théorie des cinq couleurs](https://zh.wikipedia.org/wiki/%E4%BA%94%E8%A1%8C%E8%89%B2%E7%90%86%E8%AE%BA)
- [Couleurs dans la culture chinoise](https://zh.wikipedia.org/wiki/%E4%B8%AD%E5%9B%BD%E6%96%87%E5%8C%96%E4%B8%AD%E7%9A%84%E9%A2%9C%E8%89%B2)
