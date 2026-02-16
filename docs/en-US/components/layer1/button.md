# Button

The Button component is the most basic user interaction component, supporting multiple styles and states.

Buttons are used to trigger actions or events, such as submitting forms, opening dialogs, canceling operations, or performing delete operations.

## Button Variants

Supports four variants: Primary, Secondary, Ghost, and Danger.

```_hikari_component
pages/components/layer1/button#variants
```

## Disabled State

Buttons can be disabled, in which case they are not clickable.

```_hikari_component
pages/components/layer1/button#disabled
```

## Icon Button Sizes

Icon buttons support three sizes: small (24px), medium (32px), and large (40px).

```_hikari_component
pages/components/layer1/button#icon
```

## Icon Button Variants

Icon buttons support five color variants: Ghost, Primary, Secondary, Danger, and Success.

```_hikari_component
pages/components/layer1/button#icon-variants
```

## Icon Button Size Comparison

Shows the Primary variant in different sizes.

```_hikari_component
pages/components/layer1/button#icon-sizes
```

## API

### Button Props

| Property | Description | Type | Default |
|----------|-------------|------|---------|
| variant | Button style variant | ButtonVariant | Primary |
| size | Button size | ButtonSize | Medium |
| disabled | Whether disabled | bool | false |
| children | Button content | Element | - |

### IconButton Props

| Property | Description | Type | Default |
|----------|-------------|------|---------|
| icon | Icon to display | MdiIcon | - |
| size | Button size | IconButtonSize | Large |
| variant | Color variant | IconButtonVariant | Ghost |
| glow | Enable glow effect | bool | true |
| disabled | Whether disabled | bool | false |
| onclick | Click handler | EventHandler\<MouseEvent\> | - |
