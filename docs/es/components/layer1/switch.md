# Componentes Switch

Los componentes switch proporcionan funcionalidad de alternancia con múltiples colores y variantes.

## Switch Básico

Soporta múltiples colores: Success, Primary, Secondary, Danger, Warning, Info.

```hikari
rsx! {
    div { style: "padding:1rem;display:flex;gap:16px;align-items:center;",
        div { style: "width:40px;height:22px;border-radius:11px;background:#3a6ea5;position:relative;",
            div { style: "position:absolute;right:2px;top:2px;width:18px;height:18px;border-radius:50%;background:#fff;" }
        }
        div { style: "width:40px;height:22px;border-radius:11px;background:#ccc;position:relative;",
            div { style: "position:absolute;left:2px;top:2px;width:18px;height:18px;border-radius:50%;background:#fff;" }
        }
    }
}
```

## Variante Switch con Icono

Switch con iconos, proporciona por defecto los símbolos ✓ y ✗.

```hikari
rsx! {
    div { style: "padding:1rem;display:flex;gap:8px;align-items:center;",
        span { style: "font-size:16px;", "🌙" }
        div { style: "width:40px;height:22px;border-radius:11px;background:#3a6ea5;position:relative;",
            div { style: "position:absolute;right:2px;top:2px;width:18px;height:18px;border-radius:50%;background:#fff;" } }
        span { style: "font-size:16px;", "☀" }
    }
}
```

## Variante Switch con Texto

Switch con etiquetas de texto, ajusta automáticamente el ancho del control deslizante.

```hikari
rsx! {
    div { style: "padding:1rem;display:flex;gap:8px;align-items:center;",
        span { style: "font-size:14px;color:#666;", "Off" }
        div { style: "width:40px;height:22px;border-radius:11px;background:#3a6ea5;position:relative;",
            div { style: "position:absolute;right:2px;top:2px;width:18px;height:18px;border-radius:50%;background:#fff;" } }
        span { style: "font-size:14px;color:#333;", "On" }
    }
}
```

## Variante de Tamaño de Switch

Soporta tamaños Small, Medium, Large.

```hikari
rsx! {
    div { style: "padding:1rem;display:flex;gap:16px;align-items:center;",
        div { style: "width:28px;height:16px;border-radius:8px;background:#3a6ea5;position:relative;",
            div { style: "position:absolute;right:1px;top:1px;width:14px;height:14px;border-radius:50%;background:#fff;" } }
        div { style: "width:40px;height:22px;border-radius:11px;background:#3a6ea5;position:relative;",
            div { style: "position:absolute;right:2px;top:2px;width:18px;height:18px;border-radius:50%;background:#fff;" } }
        div { style: "width:52px;height:28px;border-radius:14px;background:#3a6ea5;position:relative;",
            div { style: "position:absolute;right:2px;top:2px;width:24px;height:24px;border-radius:50%;background:#fff;" } }
    }
}
```

## Progress

Componente de barra de progreso para mostrar el progreso de operaciones.

```hikari
rsx! {
    div { style: "padding:1rem;",
        div { style: "width:200px;height:6px;background:#e2e2ea;border-radius:3px;overflow:hidden;",
            div { style: "width:60%;height:100%;background:#3a6ea5;border-radius:3px;" }
        }
    }
}
```

## Slider

Componente deslizante para selección numérica.

```hikari
rsx! {
    div { style: "padding:1rem;",
        input { type: "range", min: "0", max: "100", value: "60", style: "width:200px;" }
    }
}
```

## API

### SwitchProps

| Propiedad | Tipo | Por Defecto | Descripción |
|------|------|--------|------|
| checked | `bool` | `false` | Si está activado |
| on_change | `EventEmitter<bool>` | - | Callback de cambio de estado |
| disabled | `bool` | `false` | Si está deshabilitado |
| size | `SwitchSize` | `Medium` | Tamaño |
| variant | `SwitchVariant` | `Default` | Tipo de variante |
| color | `SwitchColor` | `Success` | Color cuando está activado |
| checked_content | `Option<SwitchContent>` | `None` | Contenido cuando está activado |
| unchecked_content | `Option<SwitchContent>` | `None` | Contenido cuando está desactivado |

### SwitchVariant

| Valor | Descripción |
|------|------|
| `Default` | Estilo por defecto (punto) |
| `Text` | Variante de texto |
| `Icon` | Variante de icono |
| `Custom` | Variante personalizada |

### SwitchColor

| Valor | Descripción |
|------|------|
| `Success` | Éxito/Encendido (verde, por defecto) |
| `Primary` | Color primario (azul) |
| `Secondary` | Color secundario (púrpura) |
| `Danger` | Peligro (rojo) |
| `Warning` | Advertencia (amarillo) |
| `Info` | Información (índigo) |

### SwitchContent

| Valor | Descripción |
|------|------|
| `Text(String)` | Contenido de texto |
| `Icon(SwitchIcon)` | Contenido de icono |
| `Image(String)` | URL de imagen |

### SwitchIcon

| Valor | Descripción |
|------|------|
| `Check` | Icono de verificación |
| `Close` | Icono de cerrar |
| `Plus` | Icono de más |
| `Minus` | Icono de menos |
| `Custom(&'static str)` | Ruta SVG personalizada |
