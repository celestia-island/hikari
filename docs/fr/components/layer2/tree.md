# Arbre

Composant Tree pour afficher des données hiérarchiques.

## Utilisation de base

```hikari
rsx! {
    div { style: "padding:1rem;font-size:14px;",
        div { style: "padding:4px 0;cursor:pointer;font-weight:500;", "▼ src" }
        div { style: "padding:4px 0 4px 20px;", "main.rs" }
        div { style: "padding:4px 0 4px 20px;", "lib.rs" }
        div { style: "padding:4px 0;cursor:pointer;", "▶ tests" }
    }
}
```

## API

| Propriété | Description | Type | Défaut |
|----------|-------------|------|--------|
| data | Données d'arbre | Vec\<TreeNode\> | - |
| selected | Nœud sélectionné | Option\<String\> | Aucun |
