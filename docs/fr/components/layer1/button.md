# Button

Le composant Button est le composant d'interaction utilisateur le plus basique, prenant en charge plusieurs styles et états.

Les boutons sont utilisés pour déclencher des actions ou des événements, comme soumettre des formulaires, ouvrir des dialogues, annuler des opérations ou effectuer des opérations de suppression.

## Variantes de Bouton

Prend en charge quatre variantes: Primary, Secondary, Ghost et Danger.

```hikari
rsx! {
    div { style: "display:flex;gap:8px;padding:1rem;flex-wrap:wrap;",
        button { style: "padding:6px 16px;border:none;border-radius:4px;background:#3a6ea5;color:#fff;cursor:pointer;", "Primary" }
        button { style: "padding:6px 16px;border:1px solid #ccc;border-radius:4px;background:#fff;color:#333;cursor:pointer;", "Secondary" }
        button { style: "padding:6px 16px;border:none;border-radius:4px;background:transparent;color:#3a6ea5;cursor:pointer;", "Ghost" }
        button { style: "padding:6px 16px;border:none;border-radius:4px;background:#ef4444;color:#fff;cursor:pointer;", "Danger" }
    }
}
```

## État Désactivé

Les boutons peuvent être désactivés, auquel cas ils ne sont pas cliquables.

```hikari
rsx! {
    div { style: "display:flex;gap:8px;padding:1rem;",
        button { style: "padding:6px 16px;border:none;border-radius:4px;background:#3a6ea5;color:#fff;", "Normal" }
        button { disabled: true, style: "padding:6px 16px;border:none;border-radius:4px;background:#ccc;color:#999;cursor:not-allowed;", "Disabled" }
    }
}
```

## Tailles de Bouton Icône

Les boutons icône prennent en charge trois tailles: petit (24px), moyen (32px) et grand (40px).

```hikari
rsx! {
    div { style: "display:flex;gap:12px;padding:1rem;align-items:center;",
        button { style: "width:24px;height:24px;border:1px solid #ccc;border-radius:4px;background:#fff;cursor:pointer;", "" }
        button { style: "width:32px;height:32px;border:1px solid #ccc;border-radius:4px;background:#fff;cursor:pointer;", "" }
        button { style: "width:40px;height:40px;border:1px solid #ccc;border-radius:4px;background:#fff;cursor:pointer;", "" }
    }
}
```

## Variantes de Bouton Icône

Les boutons icône prennent en charge cinq variantes de couleur: Ghost, Primary, Secondary, Danger et Success.

```hikari
rsx! {
    div { style: "display:flex;gap:8px;padding:1rem;",
        button { style: "width:32px;height:32px;border:none;border-radius:4px;background:transparent;color:#666;cursor:pointer;", "G" }
        button { style: "width:32px;height:32px;border:none;border-radius:4px;background:#3a6ea5;color:#fff;cursor:pointer;", "P" }
        button { style: "width:32px;height:32px;border:1px solid #ccc;border-radius:4px;background:#fff;color:#333;cursor:pointer;", "S" }
        button { style: "width:32px;height:32px;border:none;border-radius:4px;background:#ef4444;color:#fff;cursor:pointer;", "D" }
        button { style: "width:32px;height:32px;border:none;border-radius:4px;background:#22c55e;color:#fff;cursor:pointer;", "✓" }
    }
}
```

## API

### Props Button

| Propriété | Description | Type | Défaut |
|-----------|-------------|------|--------|
| variant | Variante de style du bouton | ButtonVariant | Primary |
| size | Taille du bouton | ButtonSize | Medium |
| disabled | Si désactivé | bool | false |
| children | Contenu du bouton | Element | - |

### Props IconButton

| Propriété | Description | Type | Défaut |
|-----------|-------------|------|--------|
| icon | Icône à afficher | MdiIcon | - |
| size | Taille du bouton | IconButtonSize | Large |
| variant | Variante de couleur | IconButtonVariant | Ghost |
| glow | Activer l'effet de lueur | bool | true |
| disabled | Si désactivé | bool | false |
| onclick | Gestionnaire de clic | EventHandler\<MouseEvent\> | - |
