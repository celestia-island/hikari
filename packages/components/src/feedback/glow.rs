// hi-components/src/feedback/glow.rs
// Unified glow effect component with mouse-following spotlight and acrylic blur

#[cfg(target_arch = "wasm32")]
use animation::style::StyleBuilder;
use dioxus::prelude::*;
use palette::classes::{ClassesBuilder, GlowClass};
#[cfg(target_arch = "wasm32")]
use wasm_bindgen::JsCast;
#[cfg(target_arch = "wasm32")]
use web_sys::HtmlElement;

/// Glow blur intensity levels
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum GlowBlur {
    /// No blur
    None,
    /// Light blur (5px)
    Light,
    /// Medium blur (10px, default)
    #[default]
    Medium,
    /// Heavy blur (20px)
    Heavy,
}

/// Glow color mode
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum GlowColor {
    /// Ghost button - transparent background, use black/white glow
    #[default]
    Ghost,
    /// Primary button - depends on theme
    Primary,
    /// Secondary button - depends on theme
    Secondary,
    /// Danger button - depends on theme
    Danger,
    /// Success button - depends on theme
    Success,
    /// Warning button - depends on theme
    Warning,
    /// Info button - depends on theme
    Info,
}

/// Glow intensity
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum GlowIntensity {
    /// Subtle glow
    #[default]
    Subtle,
    /// Standard glow
    Standard,
    /// Intense glow
    Intense,
}

#[derive(Clone, PartialEq, Props)]
pub struct GlowProps {
    /// Child elements to wrap
    children: Element,

    /// Blur intensity
    #[props(default)]
    blur: GlowBlur,

    /// Glow color mode
    #[props(default)]
    color: GlowColor,

    /// Glow intensity
    #[props(default)]
    intensity: GlowIntensity,

    /// Additional CSS classes
    #[props(default)]
    class: String,
}

/// Unified glow component with mouse-following effect
///
/// Combines spotlight (mouse-following glow) and acrylic (blur) effects.
/// Automatically adapts to theme colors.
///
/// # Implementation Notes
///
/// Glow effects use component-isolated mouse tracking:
/// - Uses onmousemove handler to track mouse position relative to element
/// - Updates CSS variables directly on DOM without re-render
/// - No global monitoring or MutationObserver needed
#[component]
pub fn Glow(props: GlowProps) -> Element {
    let blur_class = match props.blur {
        GlowBlur::None => GlowClass::GlowBlurNone,
        GlowBlur::Light => GlowClass::GlowBlurLight,
        GlowBlur::Medium => GlowClass::GlowBlurMedium,
        GlowBlur::Heavy => GlowClass::GlowBlurHeavy,
    };

    let intensity_class = match props.intensity {
        GlowIntensity::Subtle => GlowClass::GlowSubtle,
        GlowIntensity::Standard => GlowClass::GlowStandard,
        GlowIntensity::Intense => GlowClass::GlowIntense,
    };

    let glow_classes = ClassesBuilder::new()
        .add(GlowClass::GlowWrapper)
        .add(blur_class)
        .add(intensity_class)
        .add_raw(&props.class)
        .build();

    #[cfg(target_arch = "wasm32")]
    let glow_intensity = match props.intensity {
        GlowIntensity::Subtle => "0.8",
        GlowIntensity::Standard => "1.0",
        GlowIntensity::Intense => "1.5",
    };

    #[cfg(target_arch = "wasm32")]
    let glow_color = match props.color {
        GlowColor::Ghost => "var(--hi-ghost-glow, rgba(128, 128, 128, 0.5))",
        GlowColor::Primary => "var(--hi-glow-button-primary)",
        GlowColor::Secondary => "var(--hi-glow-button-secondary)",
        GlowColor::Danger => "var(--hi-glow-button-danger)",
        GlowColor::Success => "var(--hi-glow-button-success)",
        GlowColor::Warning => "var(--hi-glow-button-warning)",
        GlowColor::Info => "var(--hi-glow-button-info)",
    };

    #[cfg(target_arch = "wasm32")]
    {
        let initial_style = format!(
            "--glow-x: 50%; --glow-y: 50%; --glow-intensity: {}; --hi-glow-color: {};",
            glow_intensity, glow_color
        );

        let onmousemove_handler = move |event: Event<MouseData>| {
            if let Some(web_event) = event.downcast::<web_sys::MouseEvent>() {
                let client_x = web_event.client_x() as f64;
                let client_y = web_event.client_y() as f64;

                // Find the glow wrapper by traversing up from the target
                let mut target: Option<web_sys::EventTarget> = web_event.target();

                while let Some(current) = target {
                    let current_el = current.dyn_ref::<web_sys::Element>();

                    if let Some(el) = current_el {
                        if el.class_list().contains("hi-glow-wrapper") {
                            // Found the glow wrapper
                            if let Some(wrapper) = el.dyn_ref::<HtmlElement>() {
                                let rect = wrapper.get_bounding_client_rect();

                                let relative_x = client_x - rect.left();
                                let relative_y = client_y - rect.top();

                                let width = rect.width();
                                let height = rect.height();

                                if width > 0.0 && height > 0.0 {
                                    let percent_x =
                                        ((relative_x / width) * 100.0).clamp(0.0, 100.0);
                                    let percent_y =
                                        ((relative_y / height) * 100.0).clamp(0.0, 100.0);

                                    StyleBuilder::new(wrapper)
                                        .add_custom("--glow-x", &format!("{:.1}%", percent_x))
                                        .add_custom("--glow-y", &format!("{:.1}%", percent_y))
                                        .add_custom("--glow-intensity", &glow_intensity.to_string())
                                        .apply();
                                }
                            }
                            break;
                        }
                    }

                    // Move up to parent
                    let node = current.dyn_ref::<web_sys::Node>();
                    target = node
                        .and_then(|n| n.parent_node())
                        .and_then(|n| n.dyn_into::<web_sys::EventTarget>().ok());
                }
            }
        };

        rsx! {
            div {
                class: "{glow_classes}",
                "data-glow": "true",
                style: "{initial_style}",
                onmousemove: onmousemove_handler,
                { props.children }
            }
        }
    }

    #[cfg(not(target_arch = "wasm32"))]
    {
        rsx! {
            div {
                class: "{glow_classes}",
                "data-glow": "true",
                { props.children }
            }
        }
    }
}

/// Type wrapper for styling
pub struct GlowComponent;

impl crate::styled::StyledComponent for GlowComponent {
    fn styles() -> &'static str {
        include_str!(concat!(env!("OUT_DIR"), "/styles/glow.css"))
    }

    fn name() -> &'static str {
        "glow"
    }
}

// Re-exports for backward compatibility
pub use Glow as Acrylic;
pub use GlowBlur as AcrylicBlur;
pub use GlowColor as AcrylicMode;
pub use GlowIntensity as AcrylicIntensity;
