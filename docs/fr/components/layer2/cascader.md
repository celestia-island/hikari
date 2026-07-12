# Cascadeur

Le cascadeur est utilisé pour la sélection de données multi-niveaux.

## Utilisation de base

```hikari
rsx! {
    div { style: "padding:1rem;",
        select { style: "padding:6px 12px;border:1px solid #ccc;border-radius:4px;font-size:14px;",
            option { "Province / City / District" }
        }
    }
}
```

## API

| Propriété | Description | Type | Défaut |
|----------|-------------|------|--------|
| options | Données d'option | Vec\<CascaderOption\> | - |
| value | Valeur actuelle | Option\<String\> | Aucun |
| on_change | Rappel de changement | EventHandler\<String\> | - |
