# Composants Switch

Les composants Switch fournissent une fonctionnalité de bascule avec plusieurs couleurs et variantes.

## Switch Basique

Prend en charge plusieurs couleurs: Success, Primary, Secondary, Danger, Warning, Info.

```hikari
rsx! {
    div { style: "padding:1rem;display:flex;gap:16px;align-items:center;",
        div { style: "width:40px;height:22px;border-radius:11px;background:#3a6ea5;position:relative;",
            div { style: "position:absolute;right:2px;top:2px;width:18px;height:18px;border-radius:50%;background:#fff;" }
        }
        div { style: "width:40px;height:22px;border-radius:11px;background:#ccc;position:relative;",
            div { style: "position:absolute;left:2px;top:2px;width:18px;height:18px;border-radius:50%;background:#fff;" }
        }
    }
}
```

## Variante Switch Icône

Switch avec icônes, fournit par défaut les symboles ✓ et ✗.

```hikari
rsx! {
    div { style: "padding:1rem;display:flex;gap:8px;align-items:center;",
        span { style: "font-size:16px;", "🌙" }
        div { style: "width:40px;height:22px;border-radius:11px;background:#3a6ea5;position:relative;",
            div { style: "position:absolute;right:2px;top:2px;width:18px;height:18px;border-radius:50%;background:#fff;" } }
        span { style: "font-size:16px;", "☀" }
    }
}
```

## Variante Switch Texte

Switch avec étiquettes texte, ajuste automatiquement la largeur du curseur.

```hikari
rsx! {
    div { style: "padding:1rem;display:flex;gap:8px;align-items:center;",
        span { style: "font-size:14px;color:#666;", "Off" }
        div { style: "width:40px;height:22px;border-radius:11px;background:#3a6ea5;position:relative;",
            div { style: "position:absolute;right:2px;top:2px;width:18px;height:18px;border-radius:50%;background:#fff;" } }
        span { style: "font-size:14px;color:#333;", "On" }
    }
}
```

## Variante Switch Taille

Prend en charge les tailles Small, Medium, Large.

```hikari
rsx! {
    div { style: "padding:1rem;display:flex;gap:16px;align-items:center;",
        div { style: "width:28px;height:16px;border-radius:8px;background:#3a6ea5;position:relative;",
            div { style: "position:absolute;right:1px;top:1px;width:14px;height:14px;border-radius:50%;background:#fff;" } }
        div { style: "width:40px;height:22px;border-radius:11px;background:#3a6ea5;position:relative;",
            div { style: "position:absolute;right:2px;top:2px;width:18px;height:18px;border-radius:50%;background:#fff;" } }
        div { style: "width:52px;height:28px;border-radius:14px;background:#3a6ea5;position:relative;",
            div { style: "position:absolute;right:2px;top:2px;width:24px;height:24px;border-radius:50%;background:#fff;" } }
    }
}
```

## Progress

Composant barre de progression pour afficher la progression des opérations.

```hikari
rsx! {
    div { style: "padding:1rem;",
        div { style: "width:200px;height:6px;background:#e2e2ea;border-radius:3px;overflow:hidden;",
            div { style: "width:60%;height:100%;background:#3a6ea5;border-radius:3px;" }
        }
    }
}
```

## Slider

Composant curseur pour la sélection numérique.

```hikari
rsx! {
    div { style: "padding:1rem;",
        input { type: "range", min: "0", max: "100", value: "60", style: "width:200px;" }
    }
}
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
