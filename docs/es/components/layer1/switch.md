# Componentes Switch

Los componentes switch proporcionan funcionalidad de alternancia con múltiples colores y variantes.

## Switch Básico

Soporta múltiples colores: Success, Primary, Secondary, Danger, Warning, Info.

```_hikari_component
pages/components/layer1/switch#switch
```

## Variante Switch con Icono

Switch con iconos, proporciona por defecto los símbolos ✓ y ✗.

```_hikari_component
pages/components/layer1/switch#icon
```

## Variante Switch con Texto

Switch con etiquetas de texto, ajusta automáticamente el ancho del control deslizante.

```_hikari_component
pages/components/layer1/switch#text
```

## Variante de Tamaño de Switch

Soporta tamaños Small, Medium, Large.

```_hikari_component
pages/components/layer1/switch#sizes
```

## Progress

Componente de barra de progreso para mostrar el progreso de operaciones.

```_hikari_component
pages/components/layer1/switch#progress
```

## Slider

Componente deslizante para selección numérica.

```_hikari_component
pages/components/layer1/switch#slider
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
