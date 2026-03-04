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

/// Glow intensity (shadow strength)
///
/// Use `Dim` for large surface containers (cards, panels) — barely perceptible ambient glow.
/// Use `Soft` (default) for interactive elements (buttons, inputs) — clear but balanced feedback.
/// Use `Bright` for emphasis and active states — intense spotlight effect.
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum GlowIntensity {
    /// Dim glow (subtle, for cards / containers)
    Dim,
    /// Soft glow (medium, default for buttons / interactive)
    #[default]
    Soft,
    /// Bright glow (intense, for emphasis)
    Bright,
}

#[derive(Clone, PartialEq, Props)]
pub struct GlowProps {
    /// Child elements to wrap
    children: Element,

    /// Blur intensity
    #[props(default)]
    pub blur: GlowBlur,

    /// Glow color mode
    #[props(default)]
    pub color: GlowColor,

    /// Glow intensity (normal state)
    #[props(default)]
    pub intensity: GlowIntensity,

    /// Glow intensity when active/pressed
    /// If None, uses normal intensity (no change on press)
    #[props(default)]
    pub active_intensity: Option<GlowIntensity>,

    /// Additional CSS classes
    #[props(default)]
    pub class: String,

    /// Display mode: inline (default) or block
    #[props(default)]
    pub block: bool,

    /// Animation transition duration in milliseconds
    /// Set to 0 to disable transition
    #[props(default = "100".to_string())]
    pub transition_duration: String,
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
///
/// # Border Radius
///
/// Glow wrapper uses unified 4px border-radius for all components.
///
/// # Active State Animation
///
/// The component supports dynamic intensity changes via CSS variables:
/// - Set `--glow-intensity-scale` to change opacity (0.0 - 2.0)
/// - Set `--glow-spread-scale` to change spread (0.5 - 2.0)
/// These can be controlled by parent components for press animations
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
        // Build initial style - default to hidden (scale 0)
        let initial_style = format!(
            "--glow-x: 50%; --glow-y: 50%; --hi-glow-color: {}; --glow-intensity-scale: 0; --glow-spread-scale: 1.0;",
            glow_color,
        );

        // Handler for mouse move - update glow position
        let onmousemove_handler = move |event: Event<MouseData>| {
            if let Some(web_event) = event.downcast::<web_sys::MouseEvent>() {
                let client_x = web_event.client_x() as f64;
                let client_y = web_event.client_y() as f64;

                let mut target: Option<web_sys::EventTarget> = web_event.target();

                while let Some(current) = target {
                    let current_el = current.dyn_ref::<web_sys::Element>();

                    if let Some(el) = current_el {
                        if el.class_list().contains("hi-glow-wrapper") {
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
                                        .apply();
                                }
                            }
                            break;
                        }
                    }

                    let node = current.dyn_ref::<web_sys::Node>();
                    target = node
                        .and_then(|n| n.parent_node())
                        .and_then(|n| n.dyn_into::<web_sys::EventTarget>().ok());
                }
            }
        };

        // Handler for mouse enter - show glow (hover state)
        let onmouseenter_handler = move |event: Event<MouseData>| {
            #[cfg(target_arch = "wasm32")]
            {
                if let Some(web_event) = event.downcast::<web_sys::MouseEvent>() {
                    web_sys::console::log_1(&"🔵 Glow: mouseenter triggered".into());
                    if let Some(target) = web_event.current_target() {
                        if let Some(wrapper) = target.dyn_ref::<HtmlElement>() {
                            web_sys::console::log_1(&"🔵 Glow: setting intensity to 0.5".into());
                            StyleBuilder::new(wrapper)
                                .add_custom("--glow-intensity-scale", "0.5")
                                .apply();
                        }
                    }
                }
            }
        };

        // Handler for mouse leave - hide glow (idle state)
        let onmouseleave_handler = move |event: Event<MouseData>| {
            #[cfg(target_arch = "wasm32")]
            {
                if let Some(web_event) = event.downcast::<web_sys::MouseEvent>() {
                    web_sys::console::log_1(&"⚫ Glow: mouseleave triggered".into());
                    if let Some(target) = web_event.current_target() {
                        if let Some(wrapper) = target.dyn_ref::<HtmlElement>() {
                            web_sys::console::log_1(&"⚫ Glow: setting intensity to 0".into());
                            StyleBuilder::new(wrapper)
                                .add_custom("--glow-intensity-scale", "0")
                                .apply();
                        }
                    }
                }
            }
        };

        // Handler for mouse down - intense glow (active state)
        // Use onmousedown on the wrapper to catch the event from children
        let onmousedown_handler = move |event: Event<MouseData>| {
            #[cfg(target_arch = "wasm32")]
            {
                if let Some(web_event) = event.downcast::<web_sys::MouseEvent>() {
                    web_sys::console::log_1(&"🔴 Glow: mousedown triggered".into());
                    if let Some(target) = web_event.current_target() {
                        if let Some(wrapper) = target.dyn_ref::<HtmlElement>() {
                            web_sys::console::log_1(&"🔴 Glow: setting intensity to 1.0".into());
                            
                            // Log current style before change
                            let current_style = wrapper.style().get_property_value("--glow-intensity-scale").unwrap_or_default();
                            web_sys::console::log_1(&format!("🔴 Glow: current inline intensity = '{}'", current_style).into());
                            
                            // Log computed style
                            let window = web_sys::window().unwrap();
                            let computed = window.get_computed_style(wrapper).ok().flatten();
                            if let Some(computed) = computed {
                                let computed_intensity = computed.get_property_value("--glow-intensity-scale").unwrap_or_default();
                                let computed_base = computed.get_property_value("--glow-base-opacity").unwrap_or_default();
                                web_sys::console::log_1(&format!("🔴 Glow: computed intensity = '{}', base-opacity = '{}'", computed_intensity, computed_base).into());
                            }
                            
                            StyleBuilder::new(wrapper)
                                .add_custom("--glow-intensity-scale", "1.0")
                                .apply();
                            
                            // Log style after change
                            let new_style = wrapper.style().get_property_value("--glow-intensity-scale").unwrap_or_default();
                            web_sys::console::log_1(&format!("🔴 Glow: new inline intensity = '{}'", new_style).into());
                            
                            // Log computed style after change
                            let computed2 = window.get_computed_style(wrapper).ok().flatten();
                            if let Some(computed2) = computed2 {
                                let computed_intensity2 = computed2.get_property_value("--glow-intensity-scale").unwrap_or_default();
                                web_sys::console::log_1(&format!("🔴 Glow: after apply, computed intensity = '{}'", computed_intensity2).into());
                            }
                        }
                    }
                }
            }
        };

        // Handler for mouse up - return to hover state
        let onmouseup_handler = move |event: Event<MouseData>| {
            #[cfg(target_arch = "wasm32")]
            {
                if let Some(web_event) = event.downcast::<web_sys::MouseEvent>() {
                    web_sys::console::log_1(&"🟢 Glow: mouseup triggered".into());
                    if let Some(target) = web_event.current_target() {
                        if let Some(wrapper) = target.dyn_ref::<HtmlElement>() {
                            web_sys::console::log_1(&"🟢 Glow: setting intensity to 0.5".into());
                            StyleBuilder::new(wrapper)
                                .add_custom("--glow-intensity-scale", "0.5")
                                .apply();
                        }
                    }
                }
            }
        };

        rsx! {
            div {
                class: "{glow_classes}",
                "data-glow": "true",
                style: "{initial_style}",
                onmousemove: onmousemove_handler,
                onmouseenter: onmouseenter_handler,
                onmouseleave: onmouseleave_handler,
                onmousedown: onmousedown_handler,
                onmouseup: onmouseup_handler,
                {props.children}
            }
        }
    }

    #[cfg(not(target_arch = "wasm32"))]
    {
        rsx! {
            div {
                class: "{glow_classes}",
                "data-glow": "true",
                {props.children}
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
