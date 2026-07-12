# Button

El componente Button es el componente de interacción de usuario más básico, soportando múltiples estilos y estados.

Los botones se usan para activar acciones o eventos, como enviar formularios, abrir diálogos, cancelar operaciones o realizar operaciones de eliminación.

## Variantes de Botón

Soporta cuatro variantes: Primary, Secondary, Ghost y Danger.

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

## Estado Deshabilitado

Los botones pueden ser deshabilitados, en cuyo caso no son clicables.

```hikari
rsx! {
    div { style: "display:flex;gap:8px;padding:1rem;",
        button { style: "padding:6px 16px;border:none;border-radius:4px;background:#3a6ea5;color:#fff;", "Normal" }
        button { disabled: true, style: "padding:6px 16px;border:none;border-radius:4px;background:#ccc;color:#999;cursor:not-allowed;", "Disabled" }
    }
}
```

## Tamaños de Botón con Icono

Los botones con icono soportan tres tamaños: pequeño (24px), mediano (32px) y grande (40px).

```hikari
rsx! {
    div { style: "display:flex;gap:12px;padding:1rem;align-items:center;",
        button { style: "width:24px;height:24px;border:1px solid #ccc;border-radius:4px;background:#fff;cursor:pointer;", "" }
        button { style: "width:32px;height:32px;border:1px solid #ccc;border-radius:4px;background:#fff;cursor:pointer;", "" }
        button { style: "width:40px;height:40px;border:1px solid #ccc;border-radius:4px;background:#fff;cursor:pointer;", "" }
    }
}
```

## Variantes de Botón con Icono

Los botones con icono soportan cinco variantes de color: Ghost, Primary, Secondary, Danger y Success.

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

### Props de Button

| Propiedad | Descripción | Tipo | Por Defecto |
|-----------|-------------|------|-------------|
| variant | Variante de estilo del botón | ButtonVariant | Primary |
| size | Tamaño del botón | ButtonSize | Medium |
| disabled | Si está deshabilitado | bool | false |
| children | Contenido del botón | Element | - |

### Props de IconButton

| Propiedad | Descripción | Tipo | Por Defecto |
|-----------|-------------|------|-------------|
| icon | Icono a mostrar | MdiIcon | - |
| size | Tamaño del botón | IconButtonSize | Large |
| variant | Variante de color | IconButtonVariant | Ghost |
| glow | Activar efecto de brillo | bool | true |
| disabled | Si está deshabilitado | bool | false |
| onclick | Manejador de clic | EventHandler\<MouseEvent\> | - |
