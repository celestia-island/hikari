# Avatar

Le composant Avatar est utilisé pour afficher des images d'avatar d'utilisateur ou d'entité.

## Tailles

Prend en charge cinq tailles : Xs, Sm, Md, Lg, Xl.

```_hikari_component
pages/components/layer1/avatar#sizes
```

## Variantes de forme

Prend en charge trois formes : Circulaire, Arrondi, Carré.

```_hikari_component
pages/components/layer1/avatar#variants
```

## Texte de secours

Lorsqu'aucune image n'est disponible, affiche les initiales ou un texte personnalisé.

```_hikari_component
pages/components/layer1/avatar#fallback
```

## API

### Props

| Propriété | Description | Type | Défaut |
|----------|-------------|------|--------|
| src | URL de l'image | Option\<String\> | Aucun |
| alt | Texte alternatif | String | - |
| size | Taille | AvatarSize | Md |
| variant | Variante de forme | AvatarVariant | Circular |
| fallback | Texte de secours | Option\<String\> | Aucun |
