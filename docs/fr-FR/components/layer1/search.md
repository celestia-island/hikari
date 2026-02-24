# Recherche

Composant Search pour la saisie de recherche.

## Utilisation de base

```_hikari_component
pages/components/layer1/search#basic
```

## Saisie vocale

Prend en charge la fonctionnalité de saisie vocale. Cliquez sur l'icône du microphone pour commencer l'enregistrement.

```_hikari_component
pages/components/layer1/search#voice
```

## API

| Propriété | Description | Type | Défaut |
|----------|-------------|------|--------|
| placeholder | Texte de l'espace réservé | String | "Rechercher..." |
| on_search | Rappel de recherche | Option\<EventHandler\<String\>\> | Aucun |
| voice_input | Activer la saisie vocale | bool | false |
