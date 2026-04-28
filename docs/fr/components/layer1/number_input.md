# Number Input Saisie numérique

Le composant Number Input est utilisé pour la saisie numérique avec support de l'incrémenteur.

## Utilisation de base

```_hikari_component
pages/components/layer1/number_input#basic
```

## Tailles

Trois tailles disponibles : Petit, Moyen (par défaut) et Grand.

```_hikari_component
pages/components/layer1/number_input#sizes
```

## État désactivé

```_hikari_component
pages/components/layer1/number_input#disabled
```

## Incrémenteur avec plage

Vous pouvez définir la valeur minimale, la valeur maximale et la taille du pas.

```_hikari_component
pages/components/layer1/number_input#stepper
```

## API

| Propriété | Description | Type | Défaut |
|-----------|-------------|------|--------|
| value | Valeur actuelle | i64 | 0 |
| on_change | Callback de changement de valeur | EventHandler<i64> | - |
| min | Valeur minimale | Option<i64> | None |
| max | Valeur maximale | Option<i64> | None |
| step | Taille du pas | i64 | 1 |
| disabled | Si désactivé | bool | false |
| size | Variante de taille | NumberInputSize | Medium |
| class | Nom de classe personnalisé | String | "" |
| style | Style personnalisé | String | "" |

### NumberInputSize

- `Small` - Petite taille (24px)
- `Medium` - Taille moyenne (32px, par défaut)
- `Large` - Grande taille (40px)
