# Button

Le composant Button est le composant d'interaction utilisateur le plus basique, prenant en charge plusieurs styles et états.

Les boutons sont utilisés pour déclencher des actions ou des événements, comme soumettre des formulaires, ouvrir des dialogues, annuler des opérations ou effectuer des opérations de suppression.

## Variantes de Bouton

Prend en charge quatre variantes: Primary, Secondary, Ghost et Danger.

```_hikari_component
pages/components/layer1/button#variants
```

## État Désactivé

Les boutons peuvent être désactivés, auquel cas ils ne sont pas cliquables.

```_hikari_component
pages/components/layer1/button#disabled
```

## Tailles de Bouton Icône

Les boutons icône prennent en charge trois tailles: petit (24px), moyen (32px) et grand (40px).

```_hikari_component
pages/components/layer1/button#icon-sizes
```

## Variantes de Bouton Icône

Les boutons icône prennent en charge cinq variantes de couleur: Ghost, Primary, Secondary, Danger et Success.

```_hikari_component
pages/components/layer1/button#icon-variants
```

## API

### Props Button

| Propriété | Description | Type | Défaut |
|-----------|-------------|------|--------|
| variant | Variante de style du bouton | ButtonVariant | Primary |
| size | Taille du bouton | ButtonSize | Medium |
| disabled | Si désactivé | bool | false |
| children | Contenu du bouton | Element | - |

### Props IconButton

| Propriété | Description | Type | Défaut |
|-----------|-------------|------|--------|
| icon | Icône à afficher | MdiIcon | - |
| size | Taille du bouton | IconButtonSize | Large |
| variant | Variante de couleur | IconButtonVariant | Ghost |
| glow | Activer l'effet de lueur | bool | true |
| disabled | Si désactivé | bool | false |
| onclick | Gestionnaire de clic | EventHandler\<MouseEvent\> | - |
