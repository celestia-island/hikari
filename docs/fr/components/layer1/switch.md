# Composants Switch

Les composants Switch fournissent une fonctionnalité de bascule avec plusieurs couleurs et variantes.

## Switch Basique

Prend en charge plusieurs couleurs: Success, Primary, Secondary, Danger, Warning, Info.

```_hikari_component
pages/components/layer1/switch#switch
```

## Variante Switch Icône

Switch avec icônes, fournit par défaut les symboles ✓ et ✗.

```_hikari_component
pages/components/layer1/switch#icon
```

## Variante Switch Texte

Switch avec étiquettes texte, ajuste automatiquement la largeur du curseur.

```_hikari_component
pages/components/layer1/switch#text
```

## Variante Switch Taille

Prend en charge les tailles Small, Medium, Large.

```_hikari_component
pages/components/layer1/switch#sizes
```

## Progress

Composant barre de progression pour afficher la progression des opérations.

```_hikari_component
pages/components/layer1/switch#progress
```

## Slider

Composant curseur pour la sélection numérique.

```_hikari_component
pages/components/layer1/switch#slider
```

## API

### SwitchProps

| Propriété | Type | Défaut | Description |
|------|------|--------|------|
| checked | `bool` | `false` | Si coché |
| on_change | `EventEmitter<bool>` | - | Callback de changement d'état |
| disabled | `bool` | `false` | Si désactivé |
| size | `SwitchSize` | `Medium` | Taille |
| variant | `SwitchVariant` | `Default` | Type de variante |
| color | `SwitchColor` | `Success` | Couleur lorsque coché |
| checked_content | `Option<SwitchContent>` | `None` | Contenu lorsque coché |
| unchecked_content | `Option<SwitchContent>` | `None` | Contenu lorsque non coché |

### SwitchVariant

| Valeur | Description |
|------|------|
| `Default` | Style par défaut (point) |
| `Text` | Variante texte |
| `Icon` | Variante icône |
| `Custom` | Variante personnalisée |

### SwitchColor

| Valeur | Description |
|------|------|
| `Success` | Succès/Activé (vert, par défaut) |
| `Primary` | Couleur primaire (bleu) |
| `Secondary` | Couleur secondaire (violet) |
| `Danger` | Danger (rouge) |
| `Warning` | Avertissement (jaune) |
| `Info` | Info (indigo) |

### SwitchContent

| Valeur | Description |
|------|------|
| `Text(String)` | Contenu texte |
| `Icon(SwitchIcon)` | Contenu icône |
| `Image(String)` | URL d'image |

### SwitchIcon

| Valeur | Description |
|------|------|
| `Check` | Icône coche |
| `Close` | Icône fermeture |
| `Plus` | Icône plus |
| `Minus` | Icône moins |
| `Custom(&'static str)` | chemin SVG personnalisé |
