# Pagination

Composant de pagination pour la pagination des données.

## Utilisation de base

```hikari
rsx! {
    div { style: "padding:1rem;display:flex;gap:4px;align-items:center;font-size:14px;",
        button { style: "padding:4px 10px;border:1px solid #ccc;border-radius:4px;cursor:pointer;", "‹" }
        span { style: "padding:4px 10px;background:#3a6ea5;color:#fff;border-radius:4px;", "1" }
        button { style: "padding:4px 10px;border:1px solid #ccc;border-radius:4px;cursor:pointer;", "2" }
        button { style: "padding:4px 10px;border:1px solid #ccc;border-radius:4px;cursor:pointer;", "›" }
    }
}
```

## API

| Propriété | Description | Type | Défaut |
|----------|-------------|------|--------|
| total | Nombre total | usize | 0 |
| page_size | Éléments par page | usize | 10 |
| current | Page actuelle | usize | 1 |
