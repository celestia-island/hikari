# Empty

Composant Empty pour afficher un état de données vide.

## Utilisation de base

```hikari
rsx! {
    div { style: "padding:2rem;text-align:center;color:#999;",
        p { style: "font-size:14px;margin:0;", "No data available" }
    }
}
```

## API

| Propriété | Description | Type | Défaut |
|----------|-------------|------|--------|
| description | Texte de description | Option\<String\> | Aucun |
