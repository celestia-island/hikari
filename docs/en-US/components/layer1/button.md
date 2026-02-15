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

## Icon Buttons

Supports three sizes of icon buttons: small, medium, and large.

```_hikari_component
pages/components/layer1/button#icon
```

## API

### Props

| Property | Description | Type | Default |
|----------|-------------|------|---------|
| variant | Button style variant | ButtonVariant | Primary |
| size | Button size | ButtonSize | Medium |
| disabled | Whether disabled | bool | false |
| children | Button content | Element | - |
