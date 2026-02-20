# Entrée numérique

Composant Number Input pour la saisie numérique avec prise en charge du stepper.

## Utilisation de base

```_hikari_component
pages/components/layer1/number_input#basic
```

## Avec stepper

```_hikari_component
pages/components/layer1/number_input#stepper
```

## API

| Propriété | Description | Type | Défaut |
|----------|-------------|------|--------|
| value | Valeur actuelle | i64 | 0 |
| min | Valeur minimale | Option\<i64\> | Aucun |
| max | Valeur maximale | Option\<i64\> | Aucun |
| step | Taille du pas | i64 | 1 |
