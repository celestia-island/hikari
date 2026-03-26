# Input Campo de entrada

El componente Input es un componente de entrada de formulario básico que admite múltiples estados y estilos personalizados.

## Configuración de tres niveles

El componente Input admite una arquitectura de configuración de variables CSS de tres niveles:

- **Layer1 (Nivel base)**: Define valores globales predeterminados a través de temas
- **Layer2 (Nivel de componente)**: Define variables de componente a través de `input-vars.scss`
- **Custom (Tiempo de ejecución)**: Sobrescribe dinámicamente a través de propiedades del componente

## Uso básico

```_hikari_component
pages/components/layer1/input#basic
```

## Estado deshabilitado

El campo de entrada puede deshabilitarse, volviéndolo no editable cuando está deshabilitado.

```_hikari_component
pages/components/layer1/input#disabled
```

## Colores personalizados

Los colores del campo de entrada pueden sobrescribirse dinámicamente a través de propiedades de la capa Custom.

```rust
Input {
    placeholder: "Custom styled input",
    text_color: Some("#ff0000".to_string()),        // Color de texto personalizado
    border_color: Some("#ff4f00".to_string()),       // Color de borde personalizado
    background_color: Some("rgba(255, 255, 255, 0.1)".to_string()), // Color de fondo personalizado
}
```

## Sobrescritura de variables CSS

Las variables CSS pueden sobrescribirse por lotes a través de la propiedad `css_vars`.

```rust
Input {
    placeholder: "CSS Variables Override",
    css_vars: Some(vec![
        ("--hi-input-radius", "16px".to_string()),
        ("--hi-input-border-color-focus", "#22c55e".to_string()),
        ("--hi-input-shadow-focus", "0 0 0 2px rgba(34, 197, 94, 0.3)".to_string()),
    ]),
}
```

## Integración de animación

Los efectos de animación pueden integrarse con AnimationBuilder a través de la propiedad `animation_id`.

```rust
Input {
    placeholder: "Animated Input",
    animation_id: Some("animated-input".to_string()),
}

// Controlar la animación con AnimationBuilder
AnimationBuilder::new()
    .style("--hi-input-border-color", "rgb(255, 79, 0)")
    .style("--hi-input-shadow-focus", "0 0 0 2px rgba(255, 79, 0, 0.3)")
    .duration(300)
    .apply_to_element("animated-input");
```

## API

### Input Props

| Propiedad | Descripción | Tipo | Por defecto |
|-----------|-------------|------|-------------|
| size | Tamaño del campo de entrada | InputSize | Medium |
| disabled | Si está deshabilitado | bool | false |
| readonly | Si es de solo lectura | bool | false |
| placeholder | Texto de marcador de posición | Option\<String\> | None |
| value | Valor de entrada | Option\<String\> | None |
| input_type | Tipo de entrada | Option\<String\> | "text" |
| autofocus | Si hace autofocus automático | bool | false |
| class | Clase CSS personalizada | String | "" |
| prefix_icon | Icono de prefijo | Option\<Element\> | None |
| suffix_icon | Icono de sufijo | Option\<Element\> | None |
| oninput | Callback de entrada | Option\<EventHandler\<String\>\> | None |
| onfocus | Callback de enfoque | Option\<EventHandler\<FocusEvent\>\> | None |
| onblur | Callback de pérdida de enfoque | Option\<EventHandler\<FocusEvent\>\> | None |
| onkeydown | Callback de pulsación de tecla | Option\<EventHandler\<KeyboardEvent\>\> | None |
| glow | Si el efecto de brillo está habilitado | bool | true |
| glow_blur | Intensidad de desenfoque de brillo | GlowBlur | Medium |
| glow_intensity | Intensidad del brillo | GlowIntensity | Soft |
| glow_color | Color del brillo | GlowColor | Ghost |
| **Propiedades de la capa Custom** | | | |
| text_color | Color de texto personalizado | Option\<String\> | None |
| placeholder_color | Color de marcador personalizado | Option\<String\> | None |
| border_color | Color de borde personalizado | Option\<String\> | None |
| background_color | Color de fondo personalizado | Option\<String\> | None |
| animation_id | ID de animación AnimationBuilder | Option\<String\> | None |
| css_vars | Sobrescritura por lotes de variables CSS | Option\<Vec\<(&'static str, String)\>\> | None |

## Referencia de variables CSS

### Variables CSS de Input

| Variable | Descripción | Por defecto |
|----------|-------------|-------------|
| --hi-input-text-color | Color del texto | var(--hi-color-text-primary) |
| --hi-input-text-color-disabled | Color del texto deshabilitado | var(--hi-color-text-disabled) |
| --hi-input-placeholder-color | Color del marcador de posición | var(--hi-color-text-secondary) |
| --hi-input-placeholder-opacity | Opacidad del marcador de posición | 0.6 |
| --hi-input-bg | Color de fondo | transparent |
| --hi-input-bg-disabled | Fondo deshabilitado | rgba(255, 255, 255, 0.5) |
| --hi-input-border-color | Color del borde | var(--hi-color-border) |
| --hi-input-border-color-focus | Color del borde al enfocar | var(--hi-color-primary) |
| --hi-input-border-color-disabled | Color del borde deshabilitado | var(--hi-border-color-disabled) |
| --hi-input-border-color-error | Color del borde de error | var(--hi-color-danger) |
| --hi-input-shadow-focus | Sombra al enfocar | 0 0 0 2px var(--hi-color-primary) |
| --hi-input-radius | Radio del borde | var(--hi-radius-md) |
| --hi-input-padding-x | Relleno horizontal | 0.75rem |
| --hi-input-padding-y | Relleno vertical | 0.5rem |
| --hi-input-font-size | Tamaño de fuente | var(--hi-font-size-sm) |

## Documentación relacionada

- [Resumen del sistema de diseño](../../design-system/overview.md)
- [Layer1 Nivel base](../../design-system/layer1.md)
- [Layer2 Nivel de componente](../../design-system/layer2.md)
- [Custom Nivel personalizado](../../design-system/custom.md)
