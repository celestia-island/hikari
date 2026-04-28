# Cascadeur

Le cascadeur est utilisé pour la sélection de données multi-niveaux.

## Utilisation de base

```_hikari_component
pages/components/layer2/cascader#basic
```

## API

| Propriété | Description | Type | Défaut |
|----------|-------------|------|--------|
| options | Données d'option | Vec\<CascaderOption\> | - |
| value | Valeur actuelle | Option\<String\> | Aucun |
| on_change | Rappel de changement | EventHandler\<String\> | - |
