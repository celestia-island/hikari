# Image

Composant Image pour afficher des images avec état de chargement et gestion des erreurs.

## Utilisation de base

```hikari
rsx! {
    div { style: "padding:1rem;",
        img { src: "https://via.placeholder.com/200x120", alt: "Sample", style: "border-radius:8px;max-width:100%;" }
    }
}
```

## Espace réservé de chargement

```hikari
rsx! {
    div { style: "padding:1rem;",
        div { style: "width:200px;height:120px;background:#f0f0f0;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#999;", "No Image" }
    }
}
```

## API

| Propriété | Description | Type | Défaut |
|----------|-------------|------|--------|
| src | URL de l'image | String | - |
| alt | Texte alternatif | String | - |
| width | Largeur | Option\<String\> | Aucun |
| height | Hauteur | Option\<String\> | Aucun |
