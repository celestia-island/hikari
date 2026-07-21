// hi-components/src/basic/switch.rs
// Switch component with Glow effect and content variants

use hikari_palette::classes::{ClassesBuilder, SwitchClass};

use crate::{prelude::*, styled::StyledComponent};

#[define_props]
pub struct SwitchProps {
    pub checked: bool,

    pub on_change: Option<EventHandler<bool>>,

    #[default(false)]
    pub disabled: bool,

    #[default(SwitchSize::Medium)]
    pub size: SwitchSize,

    #[default(String::new())]
    pub class: String,

    pub children: Element,

    #[default(SwitchVariant::Default)]
    pub variant: SwitchVariant,

    pub checked_content: Option<SwitchContent>,

    pub unchecked_content: Option<SwitchContent>,

    #[default(SwitchColor::Primary)]
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
        SwitchVariant::Text => "hk-switch-text-variant",
        SwitchVariant::Icon => "hk-switch-icon-variant",
        SwitchVariant::Custom => "hk-switch-custom-variant",
    };

    let color_class = match props.color {
        SwitchColor::Primary => "hk-switch-color-primary",
        SwitchColor::Secondary => "hk-switch-color-secondary",
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

    let thumb_content = if props.checked {
        props.checked_content.clone()
    } else {
        props.unchecked_content.clone()
    };

    let thumb_inner = match thumb_content {
        Some(SwitchContent::Text(text)) => rsx! {
            span { class: "hk-switch-thumb-text", "{text}" }
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
            rsx! { span { class: "hk-switch-thumb-icon", {icon_svg} } }
        }
        Some(SwitchContent::Image(src)) => rsx! {
            img { class: "hk-switch-thumb-image", src: src, alt: "" }
        },
        None => rsx! { div { class: "hk-switch-thumb-dot" } },
    };

    rsx! {
        label {
            class: "hk-switch-label",
            onclick: move |e: MouseEvent| {
                if !props.disabled {
                    e.stop_propagation();
                    if let Some(callback) = props.on_change.as_ref() {
                        callback.call(!props.checked);
                    }
                }
            },

            div { class: switch_classes,
                div { class: "hk-switch-track",
                    div { class: "hk-switch-thumb", {thumb_inner} }
                }
            }

            span { class: "hk-switch-text", {props.children} }
        }
    }
}

pub struct SwitchComponent;

impl StyledComponent for SwitchComponent {
    fn styles() -> &'static str {
        r#"
.hk-switch-label {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    user-select: none;
}

.hk-switch-label:has(.hk-switch-disabled) {
    cursor: not-allowed;
}

.hk-switch-glow {
    border-radius: 100px;
    overflow: hidden;
}

.hk-switch {
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

.hk-switch:hover:not(.hk-switch-disabled) {
    border-color: var(--hi-primary);
    box-shadow: 0 0 8px var(--hi-component-selection-glow);
}

.hk-switch-track {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: flex-start;
    padding: 2px;
    box-sizing: border-box;
}

.hk-switch-sm { height: 20px; min-width: 36px; }
.hk-switch-md { height: 26px; min-width: 48px; }
.hk-switch-lg { height: 32px; min-width: 60px; }

.hk-switch-text-variant.hk-switch-sm { min-width: 44px; }
.hk-switch-text-variant.hk-switch-md { min-width: 56px; }
.hk-switch-text-variant.hk-switch-lg { min-width: 72px; }

.hk-switch-thumb {
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

.hk-switch-sm .hk-switch-thumb { width: 14px; height: 14px; }
.hk-switch-md .hk-switch-thumb { width: 20px; height: 20px; }
.hk-switch-lg .hk-switch-thumb { width: 26px; height: 26px; }

.hk-switch-icon-variant .hk-switch-thumb,
.hk-switch-text-variant .hk-switch-thumb {
    border-radius: 50%;
}

.hk-switch-text-variant .hk-switch-thumb { padding: 0 4px; }
.hk-switch-sm.hk-switch-text-variant .hk-switch-thumb { width: auto; min-width: 18px; }
.hk-switch-md.hk-switch-text-variant .hk-switch-thumb { width: auto; min-width: 24px; }
.hk-switch-lg.hk-switch-text-variant .hk-switch-thumb { width: auto; min-width: 30px; }

.hk-switch-checked .hk-switch-track {
    justify-content: flex-end;
}

.hk-switch-sm.hk-switch-checked .hk-switch-thumb { transform: translateX(16px); }
.hk-switch-md.hk-switch-checked .hk-switch-thumb { transform: translateX(22px); }
.hk-switch-lg.hk-switch-checked .hk-switch-thumb { transform: translateX(28px); }

.hk-switch-text-variant.hk-switch-sm.hk-switch-checked .hk-switch-thumb { transform: translateX(0); }
.hk-switch-text-variant.hk-switch-md.hk-switch-checked .hk-switch-thumb { transform: translateX(0); }
.hk-switch-text-variant.hk-switch-lg.hk-switch-checked .hk-switch-thumb { transform: translateX(0); }

/* Checked state - uses Layer 2 gradient background */
.hk-switch-checked {
    background: var(--hi-component-selection-bg);
    border-color: var(--hi-primary);
    box-shadow: 0 0 6px var(--hi-component-selection-glow), inset 0 0 3px rgba(255, 255, 255, 0.15);
}

.hk-switch-checked .hk-switch-thumb {
    background-color: var(--hi-component-selection-surface);
    box-shadow: 0 0 4px var(--hi-component-selection-glow);
}

.hk-switch-label:hover .hk-switch-checked:not(.hk-switch-disabled) {
    box-shadow: 0 0 10px var(--hi-component-selection-glow), inset 0 0 4px rgba(255, 255, 255, 0.2);
    transform: scale(1.02);
}

.hk-switch-disabled {
    opacity: 0.4;
    cursor: not-allowed;
    pointer-events: none;
    background: var(--hi-component-selection-surface);
    border-color: var(--hi-component-selection-border);
}

/* Thumb dot - uses Layer 2 icon color */
.hk-switch-thumb-dot {
    width: 6px;
    height: 6px;
    background-color: var(--hi-component-selection-border);
    border-radius: 50%;
    transition: background 0.2s ease;
}

.hk-switch-sm .hk-switch-thumb-dot { width: 4px; height: 4px; }
.hk-switch-lg .hk-switch-thumb-dot { width: 8px; height: 8px; }

.hk-switch-checked .hk-switch-thumb-dot {
    background: var(--hi-component-selection-icon);
}

/* Thumb text - uses Layer 2 icon color */
.hk-switch-thumb-text {
    font-size: 11px;
    font-weight: 600;
    color: var(--hi-component-selection-border);
    white-space: nowrap;
    line-height: 1;
    transition: color 0.2s ease;
}

.hk-switch-sm .hk-switch-thumb-text { font-size: 9px; }
.hk-switch-lg .hk-switch-thumb-text { font-size: 12px; }

.hk-switch-checked .hk-switch-thumb-text {
    color: var(--hi-component-selection-icon);
}

/* Thumb icon - uses Layer 2 icon color */
.hk-switch-thumb-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--hi-component-selection-border);
    transition: color 0.2s ease;
}

.hk-switch-sm .hk-switch-thumb-icon svg { width: 8px; height: 8px; }
.hk-switch-md .hk-switch-thumb-icon svg { width: 12px; height: 12px; }
.hk-switch-lg .hk-switch-thumb-icon svg { width: 16px; height: 16px; }

.hk-switch-checked .hk-switch-thumb-icon {
    color: var(--hi-component-selection-icon);
}

.hk-switch-thumb-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 50%;
}

.hk-switch-text {
    font-size: 14px;
    color: var(--hi-text-primary);
    line-height: 1.5;
}

/* Primary/Secondary color variants */
.hk-switch-color-primary.hk-switch-checked {
    --hi-primary: var(--hi-primary);
}

.hk-switch-color-secondary.hk-switch-checked {
    --hi-primary: var(--hi-secondary);
}
"#
    }

    fn name() -> &'static str {
        "switch"
    }
}
