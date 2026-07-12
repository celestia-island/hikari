# Composants d'affichage

Composants d'affichage de données de base.

## Badge

Composant Badge pour afficher le statut ou le compteur.

```hikari
rsx! {
    div { style: "display:flex;gap:16px;padding:1rem;align-items:center;",
        div { style: "position:relative;",
            span { style: "font-size:14px;", "Messages" }
            span { style: "position:absolute;top:-8px;right:-12px;background:#ef4444;color:#fff;font-size:10px;min-width:16px;height:16px;border-radius:50%;display:flex;align-items:center;justify-content:center;padding:0 4px;", "5" }
        }
    }
}
```

## Séparateur

Composant Divider pour séparer le contenu.

```hikari
rsx! {
    div { style: "padding:1rem;",
        p { style: "margin:0 0 16px;", "Content above" }
        hr { style: "border:none;border-top:1px solid #e2e2ea;margin:0;" }
        p { style: "margin:16px 0 0;", "Content below" }
    }
}
```

## Carte

Composant Card pour regrouper et afficher du contenu.

```hikari
rsx! {
    div { style: "padding:1rem;border:1px solid #e2e2ea;border-radius:8px;max-width:300px;background:#fff;",
        h3 { style: "margin:0 0 8px;font-size:16px;", "Card Title" }
        p { style: "margin:0;color:#666;font-size:14px;", "Card content goes here." }
    }
}
```
