# Composants de retour

Composants de retour utilisateur de base.

## Alerte

Composant de notification d'alerte pour afficher des informations importantes.

```hikari
rsx! {
    div { style: "padding:12px 16px;border-radius:6px;background:rgba(58,110,165,0.1);border:1px solid rgba(58,110,165,0.3);margin:1rem 0;display:flex;gap:8px;align-items:center;",
        span { style: "color:#3a6ea5;font-weight:600;", "ℹ" }
        span { style: "color:#333;font-size:14px;", "This is an info alert message." }
    }
}
```

## Toast

Composant de notification de message léger.

```hikari
rsx! {
    div { style: "padding:12px 20px;border-radius:6px;background:#333;color:#fff;font-size:14px;box-shadow:0 4px 12px rgba(0,0,0,0.15);display:inline-block;",
        "Operation succeeded" }
}
```

## Infobulle

Infobulle affichée au survol de la souris.

```hikari
rsx! {
    div { style: "padding:1rem;",
        span { style: "position:relative;display:inline-block;padding:4px 8px;background:#333;color:#fff;border-radius:4px;font-size:12px;",
            "Hover for info" }
    }
}
```
