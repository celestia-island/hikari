# Button

The Button component is the most basic user interaction component, supporting multiple styles and states.

Buttons are used to trigger actions or events, such as submitting forms, opening dialogs, canceling operations, or performing delete operations.

## Button Variants

Supports four variants: Primary, Secondary, Ghost, and Danger.

```hikari
rsx! {
    div { style: "display:flex;gap:8px;padding:1rem;flex-wrap:wrap;",
        button { style: "padding:6px 16px;border:none;border-radius:4px;background:#3a6ea5;color:#fff;cursor:pointer;", "Primary" }
        button { style: "padding:6px 16px;border:1px solid #ccc;border-radius:4px;background:#fff;color:#333;cursor:pointer;", "Secondary" }
        button { style: "padding:6px 16px;border:none;border-radius:4px;background:transparent;color:#3a6ea5;cursor:pointer;", "Ghost" }
        button { style: "padding:6px 16px;border:none;border-radius:4px;background:#ef4444;color:#fff;cursor:pointer;", "Danger" }
    }
}
```

## Disabled State

Buttons can be disabled, in which case they are not clickable.

```hikari
rsx! {
    div { style: "display:flex;gap:8px;padding:1rem;",
        button { style: "padding:6px 16px;border:none;border-radius:4px;background:#3a6ea5;color:#fff;", "Normal" }
        button { disabled: true, style: "padding:6px 16px;border:none;border-radius:4px;background:#ccc;color:#999;cursor:not-allowed;", "Disabled" }
    }
}
```

## Icon Button Sizes

Icon buttons support three sizes: small (24px), medium (32px), and large (40px).

```hikari
rsx! {
    div { style: "display:flex;gap:12px;padding:1rem;align-items:center;",
        button { style: "width:24px;height:24px;border:1px solid #ccc;border-radius:4px;background:#fff;cursor:pointer;", "" }
        button { style: "width:32px;height:32px;border:1px solid #ccc;border-radius:4px;background:#fff;cursor:pointer;", "" }
        button { style: "width:40px;height:40px;border:1px solid #ccc;border-radius:4px;background:#fff;cursor:pointer;", "" }
    }
}
```

## Icon Button Variants

Icon buttons support five color variants: Ghost, Primary, Secondary, Danger, and Success.

```hikari
rsx! {
    div { style: "display:flex;gap:8px;padding:1rem;",
        button { style: "width:32px;height:32px;border:none;border-radius:4px;background:transparent;color:#666;cursor:pointer;", "G" }
        button { style: "width:32px;height:32px;border:none;border-radius:4px;background:#3a6ea5;color:#fff;cursor:pointer;", "P" }
        button { style: "width:32px;height:32px;border:1px solid #ccc;border-radius:4px;background:#fff;color:#333;cursor:pointer;", "S" }
        button { style: "width:32px;height:32px;border:none;border-radius:4px;background:#ef4444;color:#fff;cursor:pointer;", "D" }
        button { style: "width:32px;height:32px;border:none;border-radius:4px;background:#22c55e;color:#fff;cursor:pointer;", "✓" }
    }
}
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
