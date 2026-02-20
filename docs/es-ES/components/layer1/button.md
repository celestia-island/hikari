# Button

El componente Button es el componente de interacción de usuario más básico, soportando múltiples estilos y estados.

Los botones se usan para activar acciones o eventos, como enviar formularios, abrir diálogos, cancelar operaciones o realizar operaciones de eliminación.

## Variantes de Botón

Soporta cuatro variantes: Primary, Secondary, Ghost y Danger.

```_hikari_component
pages/components/layer1/button#variants
```

## Estado Deshabilitado

Los botones pueden ser deshabilitados, en cuyo caso no son clicables.

```_hikari_component
pages/components/layer1/button#disabled
```

## Tamaños de Botón con Icono

Los botones con icono soportan tres tamaños: pequeño (24px), mediano (32px) y grande (40px).

```_hikari_component
pages/components/layer1/button#icon-sizes
```

## Variantes de Botón con Icono

Los botones con icono soportan cinco variantes de color: Ghost, Primary, Secondary, Danger y Success.

```_hikari_component
pages/components/layer1/button#icon-variants
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
