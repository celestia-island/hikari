# Input

The Input component is a basic form input component that supports multiple states and custom styles.

## Three-Layer Configuration

The Input component supports a three-layer CSS variable configuration architecture:

- **Layer1 (Base Layer)**: Defines global default values through themes
- **Layer2 (Component Layer)**: Defines component variables through `input-vars.scss`
- **Custom (Runtime)**: Dynamically overrides through component properties

## Basic Usage

```_hikari_component
pages/components/layer1/input#basic
```

## Disabled State

The input can be disabled, making it non-editable when disabled.

```_hikari_component
pages/components/layer1/input#disabled
```

## Custom Colors

Input colors can be dynamically overridden through Custom layer properties.

```rust
Input {
    placeholder: "Custom styled input",
    text_color: Some("#ff0000".to_string()),        // Custom text color
    border_color: Some("#ff4f00".to_string()),       // Custom border color
    background_color: Some("rgba(255, 255, 255, 0.1)".to_string()), // Custom background color
}
```

## CSS Variables Override

CSS variables can be overridden in batches through the `css_vars` property.

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

## Animation Integration

Animation effects can be integrated with AnimationBuilder through the `animation_id` property.

```rust
Input {
    placeholder: "Animated Input",
    animation_id: Some("animated-input".to_string()),
}

// Control animation with AnimationBuilder
AnimationBuilder::new()
    .style("--hi-input-border-color", "rgb(255, 79, 0)")
    .style("--hi-input-shadow-focus", "0 0 0 2px rgba(255, 79, 0, 0.3)")
    .duration(300)
    .apply_to_element("animated-input");
```

## API

### Input Props

| Property | Description | Type | Default |
|----------|-------------|------|---------|
| size | Input size | InputSize | Medium |
| disabled | Whether disabled | bool | false |
| readonly | Whether readonly | bool | false |
| placeholder | Placeholder text | Option\<String\> | None |
| value | Input value | Option\<String\> | None |
| input_type | Input type | Option\<String\> | "text" |
| autofocus | Whether to auto focus | bool | false |
| class | Custom CSS class | String | "" |
| prefix_icon | Prefix icon | Option\<Element\> | None |
| suffix_icon | Suffix icon | Option\<Element\> | None |
| oninput | Input callback | Option\<EventHandler\<String\>\> | None |
| onfocus | Focus callback | Option\<EventHandler\<FocusEvent\>\> | None |
| onblur | Blur callback | Option\<EventHandler\<FocusEvent\>\> | None |
| onkeydown | Key press callback | Option\<EventHandler\<KeyboardEvent\>\> | None |
| glow | Whether to enable glow effect | bool | true |
| glow_blur | Glow blur intensity | GlowBlur | Medium |
| glow_intensity | Glow intensity | GlowIntensity | Soft |
| glow_color | Glow color | GlowColor | Ghost |
| **Custom Layer Properties** | | | |
| text_color | Custom text color | Option\<String\> | None |
| placeholder_color | Custom placeholder color | Option\<String\> | None |
| border_color | Custom border color | Option\<String\> | None |
| background_color | Custom background color | Option\<String\> | None |
| animation_id | AnimationBuilder animation ID | Option\<String\> | None |
| css_vars | CSS variables batch override | Option\<Vec\<(&'static str, String)\>\> | None |

## CSS Variables Reference

### Input CSS Variables

| Variable | Description | Default |
|----------|-------------|---------|
| --hi-input-text-color | Text color | var(--hi-color-text-primary) |
| --hi-input-text-color-disabled | Disabled text color | var(--hi-color-text-disabled) |
| --hi-input-placeholder-color | Placeholder color | var(--hi-color-text-secondary) |
| --hi-input-placeholder-opacity | Placeholder opacity | 0.6 |
| --hi-input-bg | Background color | transparent |
| --hi-input-bg-disabled | Disabled background | rgba(255, 255, 255, 0.5) |
| --hi-input-border-color | Border color | var(--hi-color-border) |
| --hi-input-border-color-focus | Focus border color | var(--hi-color-primary) |
| --hi-input-border-color-disabled | Disabled border color | var(--hi-border-color-disabled) |
| --hi-input-border-color-error | Error border color | var(--hi-color-danger) |
| --hi-input-shadow-focus | Focus shadow | 0 0 0 2px var(--hi-color-primary) |
| --hi-input-radius | Border radius | var(--hi-radius-md) |
| --hi-input-padding-x | Horizontal padding | 0.75rem |
| --hi-input-padding-y | Vertical padding | 0.5rem |
| --hi-input-font-size | Font size | var(--hi-font-size-sm) |

## Related Documentation

- [Design System Overview](../../design/overview.md)
