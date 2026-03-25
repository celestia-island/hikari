// hi-components/src/feedback/glow.rs
// Unified glow effect component with mouse-following spotlight and acrylic blur

use hikari_palette::classes::{ClassesBuilder, GlowClass};
use tairitsu_vdom::IntoAttrValue;

#[cfg(all(target_arch = "wasm32", target_os = "unknown"))]
use crate::platform::{
    element_from_point, get_bounding_client_rect, get_element_by_class_upward, log,
    set_style_property,
};
use crate::prelude::*;

#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum GlowBlur {
    None,
    Light,
    #[default]
    Medium,
    Heavy,
}

#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum GlowColor {
    #[default]
    Ghost,
    Primary,
    Secondary,
    Danger,
    Success,
    Warning,
    Info,
}

#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum GlowIntensity {
    Dim,
    #[default]
    Soft,
    Bright,
}

impl std::fmt::Display for GlowBlur {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            GlowBlur::None => write!(f, "none"),
            GlowBlur::Light => write!(f, "light"),
            GlowBlur::Medium => write!(f, "medium"),
            GlowBlur::Heavy => write!(f, "heavy"),
        }
    }
}

impl std::fmt::Display for GlowColor {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            GlowColor::Ghost => write!(f, "ghost"),
            GlowColor::Primary => write!(f, "primary"),
            GlowColor::Secondary => write!(f, "secondary"),
            GlowColor::Danger => write!(f, "danger"),
            GlowColor::Success => write!(f, "success"),
            GlowColor::Warning => write!(f, "warning"),
            GlowColor::Info => write!(f, "info"),
        }
    }
}

impl std::fmt::Display for GlowIntensity {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            GlowIntensity::Dim => write!(f, "dim"),
            GlowIntensity::Soft => write!(f, "soft"),
            GlowIntensity::Bright => write!(f, "bright"),
        }
    }
}

impl IntoAttrValue for GlowBlur {
    fn into_attr_value(self) -> Option<String> {
        Some(self.to_string())
    }
}

impl IntoAttrValue for GlowColor {
    fn into_attr_value(self) -> Option<String> {
        Some(self.to_string())
    }
}

impl IntoAttrValue for GlowIntensity {
    fn into_attr_value(self) -> Option<String> {
        Some(self.to_string())
    }
}

#[define_props]
pub struct GlowProps {
    pub children: Element,
    pub blur: GlowBlur,
    pub color: GlowColor,
    pub intensity: GlowIntensity,
    pub active_intensity: Option<GlowIntensity>,
    pub class: String,
    pub block: bool,
    #[default("100".to_string())]
    pub transition_duration: String,
}

#[component]
pub fn Glow(props: GlowProps) -> Element {
    let blur_class = match props.blur {
        GlowBlur::None => GlowClass::GlowBlurNone,
        GlowBlur::Light => GlowClass::GlowBlurLight,
        GlowBlur::Medium => GlowClass::GlowBlurMedium,
        GlowBlur::Heavy => GlowClass::GlowBlurHeavy,
    };

    let intensity_class = match props.intensity {
        GlowIntensity::Dim => GlowClass::GlowDim,
        GlowIntensity::Soft => GlowClass::GlowSoft,
        GlowIntensity::Bright => GlowClass::GlowBright,
    };

    let glow_classes = ClassesBuilder::new()
        .add(GlowClass::GlowWrapper)
        .add_if(GlowClass::GlowWrapperBlock, || props.block)
        .add(blur_class)
        .add(intensity_class)
        .add_raw(&props.class)
        .build();

    #[cfg(all(target_arch = "wasm32", target_os = "unknown"))]
    let glow_color = match props.color {
        GlowColor::Ghost => "var(--hi-ghost-glow, rgba(128, 128, 128, 0.5))",
        GlowColor::Primary => "var(--hi-glow-button-primary)",
        GlowColor::Secondary => "var(--hi-glow-button-secondary)",
        GlowColor::Danger => "var(--hi-glow-button-danger)",
        GlowColor::Success => "var(--hi-glow-button-success)",
        GlowColor::Warning => "var(--hi-glow-button-warning)",
        GlowColor::Info => "var(--hi-glow-button-info)",
    };

    #[cfg(all(target_arch = "wasm32", target_os = "unknown"))]
    {
        let initial_style = format!(
            "--glow-x: 50%; --glow-y: 50%; --hi-glow-color: {}; --glow-intensity-scale: 0; --glow-spread-scale: 1.0;",
            glow_color,
        );

        let onmousemove_handler = move |event: MouseEvent| {
            #[cfg(all(target_arch = "wasm32", target_os = "unknown"))]
            {
                let client_x = event.client_x;
                let client_y = event.client_y;

                if let Some(target_el) = element_from_point(client_x, client_y) {
                    if let Some(wrapper) =
                        get_element_by_class_upward("hi-glow-wrapper", &target_el)
                    {
                        if let Some(rect) = get_bounding_client_rect(&wrapper) {
                            let relative_x = client_x as f64 - rect.x;
                            let relative_y = client_y as f64 - rect.y;
                            let width = rect.width;
                            let height = rect.height;

                            if width > 0.0 && height > 0.0 {
                                let percent_x = ((relative_x / width) * 100.0).clamp(0.0, 100.0);
                                let percent_y = ((relative_y / height) * 100.0).clamp(0.0, 100.0);
                                set_style_property(
                                    &wrapper,
                                    "--glow-x",
                                    &format!("{:.1}%", percent_x),
                                );
                                set_style_property(
                                    &wrapper,
                                    "--glow-y",
                                    &format!("{:.1}%", percent_y),
                                );
                            }
                        }
                    }
                }
            }
            let _ = event;
        };

        let onmouseenter_handler = move |event: MouseEvent| {
            #[cfg(all(target_arch = "wasm32", target_os = "unknown"))]
            {
                let client_x = event.client_x;
                let client_y = event.client_y;

                if let Some(target_el) = element_from_point(client_x, client_y) {
                    if let Some(wrapper) =
                        get_element_by_class_upward("hi-glow-wrapper", &target_el)
                    {
                        set_style_property(&wrapper, "--glow-intensity-scale", "0.5");
                    }
                }
            }
            let _ = event;
        };

        let onmouseleave_handler = move |event: MouseEvent| {
            #[cfg(all(target_arch = "wasm32", target_os = "unknown"))]
            {
                let client_x = event.client_x;
                let client_y = event.client_y;

                if let Some(target_el) = element_from_point(client_x, client_y) {
                    if let Some(wrapper) =
                        get_element_by_class_upward("hi-glow-wrapper", &target_el)
                    {
                        set_style_property(&wrapper, "--glow-intensity-scale", "0");
                    }
                }
            }
            let _ = event;
        };

        let onmousedown_handler = move |event: MouseEvent| {
            #[cfg(all(target_arch = "wasm32", target_os = "unknown"))]
            {
                let client_x = event.client_x;
                let client_y = event.client_y;

                if let Some(target_el) = element_from_point(client_x, client_y) {
                    if let Some(wrapper) =
                        get_element_by_class_upward("hi-glow-wrapper", &target_el)
                    {
                        set_style_property(&wrapper, "--glow-intensity-scale", "1.0");
                    }
                }
            }
            let _ = event;
        };

        let onmouseup_handler = move |event: MouseEvent| {
            #[cfg(all(target_arch = "wasm32", target_os = "unknown"))]
            {
                let client_x = event.client_x;
                let client_y = event.client_y;

                if let Some(target_el) = element_from_point(client_x, client_y) {
                    if let Some(wrapper) =
                        get_element_by_class_upward("hi-glow-wrapper", &target_el)
                    {
                        set_style_property(&wrapper, "--glow-intensity-scale", "0.5");
                    }
                }
            }
            let _ = event;
        };

        rsx! {
            div {
                class: glow_classes,
                "data-glow": "true",
                style: initial_style,
                onmousemove: onmousemove_handler,
                onmouseenter: onmouseenter_handler,
                onmouseleave: onmouseleave_handler,
                onmousedown: onmousedown_handler,
                onmouseup: onmouseup_handler,
                {props.children}
            }
        }
    }

    #[cfg(not(all(target_arch = "wasm32", target_os = "unknown")))]
    {
        rsx! {
            div { class: glow_classes, "data-glow": "true", {props.children} }
        }
    }
}

pub struct GlowComponent;

impl crate::styled::StyledComponent for GlowComponent {
    fn styles() -> &'static str {
        include_str!(concat!(env!("OUT_DIR"), "/styles/glow.css"))
    }

    fn name() -> &'static str {
        "glow"
    }
}
