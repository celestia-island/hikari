// hi-components/src/basic/switch.rs
// Switch component with Glow effect and content variants

use dioxus::prelude::*;
use palette::classes::{ClassesBuilder, SwitchClass};

use crate::styled::StyledComponent;

#[derive(Clone, PartialEq, Props)]
pub struct SwitchProps {
    pub checked: bool,

    pub on_change: EventHandler<bool>,

    #[props(default)]
    pub disabled: bool,

    #[props(default)]
    pub size: SwitchSize,

    #[props(default)]
    pub class: String,

    #[props(default)]
    pub children: Element,

    #[props(default)]
    pub variant: SwitchVariant,

    #[props(default)]
    pub checked_content: Option<SwitchContent>,

    #[props(default)]
    pub unchecked_content: Option<SwitchContent>,

    #[props(default)]
    pub color: SwitchColor,
}

#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum SwitchSize {
    #[default]
    Medium,
    Small,
    Large,
}

#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum SwitchVariant {
    #[default]
    Default,
    Text,
    Icon,
    Custom,
}

#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum SwitchColor {
    #[default]
    Primary,
    Secondary,
}

#[derive(Clone, PartialEq, Debug)]
pub enum SwitchContent {
    Text(String),
    Icon(SwitchIcon),
    Image(String),
}

#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum SwitchIcon {
    #[default]
    Check,
    Close,
    Plus,
    Minus,
    Custom(&'static str),
}

#[component]
pub fn Switch(props: SwitchProps) -> Element {
    let size_class = match props.size {
        SwitchSize::Small => SwitchClass::Sm,
        SwitchSize::Medium => SwitchClass::Md,
        SwitchSize::Large => SwitchClass::Lg,
    };

    let variant_class = match props.variant {
        SwitchVariant::Default => "",
        SwitchVariant::Text => "hi-switch-text-variant",
        SwitchVariant::Icon => "hi-switch-icon-variant",
        SwitchVariant::Custom => "hi-switch-custom-variant",
    };

    let color_class = match props.color {
        SwitchColor::Primary => "hi-switch-color-primary",
        SwitchColor::Secondary => "hi-switch-color-secondary",
    };

    let switch_classes = ClassesBuilder::new()
        .add(SwitchClass::Switch)
        .add(size_class)
        .add_if(SwitchClass::Checked, || props.checked)
        .add_if(SwitchClass::Disabled, || props.disabled)
        .add_raw(variant_class)
        .add_raw(color_class)
        .add_raw(&props.class)
        .build();

    let handle_click = move |e: MouseEvent| {
        if !props.disabled {
            e.stop_propagation();
            props.on_change.call(!props.checked);
        }
    };

    let thumb_content = if props.checked {
        props.checked_content.clone()
    } else {
        props.unchecked_content.clone()
    };

    let thumb_inner = match thumb_content {
        Some(SwitchContent::Text(text)) => rsx! {
            span { class: "hi-switch-thumb-text", "{text}" }
        },
        Some(SwitchContent::Icon(icon)) => {
            let icon_svg = match icon {
                SwitchIcon::Check => rsx! {
                    svg { view_box: "0 0 24 24", fill: "none", stroke: "currentColor", stroke_width: "3", stroke_linecap: "round", stroke_linejoin: "round",
                        path { d: "M20 6L9 17l-5-5" }
                    }
                },
                SwitchIcon::Close => rsx! {
                    svg { view_box: "0 0 24 24", fill: "none", stroke: "currentColor", stroke_width: "3", stroke_linecap: "round",
                        path { d: "M18 6L6 18M6 6l12 12" }
                    }
                },
                SwitchIcon::Plus => rsx! {
                    svg { view_box: "0 0 24 24", fill: "none", stroke: "currentColor", stroke_width: "3", stroke_linecap: "round",
                        path { d: "M12 5v14M5 12h14" }
                    }
                },
                SwitchIcon::Minus => rsx! {
                    svg { view_box: "0 0 24 24", fill: "none", stroke: "currentColor", stroke_width: "3", stroke_linecap: "round",
                        path { d: "M5 12h14" }
                    }
                },
                SwitchIcon::Custom(path) => rsx! {
                    svg { view_box: "0 0 24 24", fill: "none", stroke: "currentColor", stroke_width: "2", stroke_linecap: "round", stroke_linejoin: "round",
                        path { d: "{path}" }
                    }
                },
            };
            rsx! { span { class: "hi-switch-thumb-icon", {icon_svg} } }
        }
        Some(SwitchContent::Image(src)) => rsx! {
            img { class: "hi-switch-thumb-image", src: "{src}", alt: "" }
        },
        None => rsx! { div { class: "hi-switch-thumb-dot" } },
    };

    rsx! {
        label {
            class: "hi-switch-label",
            onclick: handle_click,

            div { class: "{switch_classes}",
                div { class: "hi-switch-track",
                    div { class: "hi-switch-thumb", {thumb_inner} }
                }
            }

            span { class: "hi-switch-text", {props.children} }
        }
    }
}

pub struct SwitchComponent;

impl StyledComponent for SwitchComponent {
    fn styles() -> &'static str {
        r#"
.hi-switch-label {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    user-select: none;
}

.hi-switch-label:has(.hi-switch-disabled) {
    cursor: not-allowed;
}

.hi-switch-glow {
    border-radius: 100px;
    overflow: hidden;
}

.hi-switch {
    position: relative;
    display: inline-flex;
    align-items: center;
    background-color: var(--hi-component-selection-surface);
    border: 1.5px solid var(--hi-component-selection-border);
    border-radius: 100px;
    transition: all 0.2s ease;
    vertical-align: middle;
    box-sizing: border-box;
}

.hi-switch:hover:not(.hi-switch-disabled) {
    border-color: var(--hi-primary);
    box-shadow: 0 0 8px var(--hi-component-selection-glow);
}

.hi-switch-track {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: flex-start;
    padding: 2px;
    box-sizing: border-box;
}

.hi-switch-sm { height: 20px; min-width: 36px; }
.hi-switch-md { height: 26px; min-width: 48px; }
.hi-switch-lg { height: 32px; min-width: 60px; }

.hi-switch-text-variant.hi-switch-sm { min-width: 44px; }
.hi-switch-text-variant.hi-switch-md { min-width: 56px; }
.hi-switch-text-variant.hi-switch-lg { min-width: 72px; }

.hi-switch-thumb {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: var(--hi-component-selection-surface);
    border-radius: 50%;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    transition: transform 0.2s ease, background 0.2s ease;
    flex-shrink: 0;
    box-sizing: border-box;
}

.hi-switch-sm .hi-switch-thumb { width: 14px; height: 14px; }
.hi-switch-md .hi-switch-thumb { width: 20px; height: 20px; }
.hi-switch-lg .hi-switch-thumb { width: 26px; height: 26px; }

.hi-switch-icon-variant .hi-switch-thumb,
.hi-switch-text-variant .hi-switch-thumb {
    border-radius: 50%;
}

.hi-switch-text-variant .hi-switch-thumb { padding: 0 4px; }
.hi-switch-sm.hi-switch-text-variant .hi-switch-thumb { width: auto; min-width: 18px; }
.hi-switch-md.hi-switch-text-variant .hi-switch-thumb { width: auto; min-width: 24px; }
.hi-switch-lg.hi-switch-text-variant .hi-switch-thumb { width: auto; min-width: 30px; }

.hi-switch-checked .hi-switch-track {
    justify-content: flex-end;
}

.hi-switch-sm.hi-switch-checked .hi-switch-thumb { transform: translateX(16px); }
.hi-switch-md.hi-switch-checked .hi-switch-thumb { transform: translateX(22px); }
.hi-switch-lg.hi-switch-checked .hi-switch-thumb { transform: translateX(28px); }

.hi-switch-text-variant.hi-switch-sm.hi-switch-checked .hi-switch-thumb { transform: translateX(0); }
.hi-switch-text-variant.hi-switch-md.hi-switch-checked .hi-switch-thumb { transform: translateX(0); }
.hi-switch-text-variant.hi-switch-lg.hi-switch-checked .hi-switch-thumb { transform: translateX(0); }

/* Checked state - uses Layer 2 gradient background */
.hi-switch-checked {
    background: var(--hi-component-selection-bg);
    border-color: var(--hi-primary);
    box-shadow: 0 0 6px var(--hi-component-selection-glow), inset 0 0 3px rgba(255, 255, 255, 0.15);
}

.hi-switch-checked .hi-switch-thumb {
    background-color: var(--hi-component-selection-surface);
    box-shadow: 0 0 4px var(--hi-component-selection-glow);
}

.hi-switch-label:hover .hi-switch-checked:not(.hi-switch-disabled) {
    box-shadow: 0 0 10px var(--hi-component-selection-glow), inset 0 0 4px rgba(255, 255, 255, 0.2);
    transform: scale(1.02);
}

.hi-switch-disabled {
    opacity: 0.4;
    cursor: not-allowed;
    pointer-events: none;
    background: var(--hi-component-selection-surface);
    border-color: var(--hi-component-selection-border);
}

/* Thumb dot - uses Layer 2 icon color */
.hi-switch-thumb-dot {
    width: 6px;
    height: 6px;
    background-color: var(--hi-component-selection-border);
    border-radius: 50%;
    transition: background 0.2s ease;
}

.hi-switch-sm .hi-switch-thumb-dot { width: 4px; height: 4px; }
.hi-switch-lg .hi-switch-thumb-dot { width: 8px; height: 8px; }

.hi-switch-checked .hi-switch-thumb-dot {
    background: var(--hi-component-selection-icon);
}

/* Thumb text - uses Layer 2 icon color */
.hi-switch-thumb-text {
    font-size: 11px;
    font-weight: 600;
    color: var(--hi-component-selection-border);
    white-space: nowrap;
    line-height: 1;
    transition: color 0.2s ease;
}

.hi-switch-sm .hi-switch-thumb-text { font-size: 9px; }
.hi-switch-lg .hi-switch-thumb-text { font-size: 12px; }

.hi-switch-checked .hi-switch-thumb-text {
    color: var(--hi-component-selection-icon);
}

/* Thumb icon - uses Layer 2 icon color */
.hi-switch-thumb-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--hi-component-selection-border);
    transition: color 0.2s ease;
}

.hi-switch-sm .hi-switch-thumb-icon svg { width: 8px; height: 8px; }
.hi-switch-md .hi-switch-thumb-icon svg { width: 12px; height: 12px; }
.hi-switch-lg .hi-switch-thumb-icon svg { width: 16px; height: 16px; }

.hi-switch-checked .hi-switch-thumb-icon {
    color: var(--hi-component-selection-icon);
}

.hi-switch-thumb-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 50%;
}

.hi-switch-text {
    font-size: 14px;
    color: var(--hi-text-primary);
    line-height: 1.5;
}

/* Primary/Secondary color variants */
.hi-switch-color-primary.hi-switch-checked {
    --hi-primary: var(--hi-primary);
}

.hi-switch-color-secondary.hi-switch-checked {
    --hi-primary: var(--hi-secondary);
}
"#
    }

    fn name() -> &'static str {
        "switch"
    }
}
