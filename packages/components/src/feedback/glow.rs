// hi-components/src/feedback/glow.rs
// Unified glow effect component with mouse-following spotlight and acrylic blur

#[cfg(target_arch = "wasm32")]
use crate::style_builder::StyleBuilder;
use crate::prelude::*;
use hikari_palette::classes::{ClassesBuilder, GlowClass};
use tairitsu_vdom::IntoAttrValue;
#[cfg(target_arch = "wasm32")]
use wasm_bindgen::JsCast;
#[cfg(target_arch = "wasm32")]
use web_sys::HtmlElement;

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

///
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum GlowIntensity {
    Dim,
    #[default]
    Soft,
    Bright,
}

// Implement Display for CSS attribute generation
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

// Implement IntoAttrValue so these types can be used as HTML attributes
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

#[derive(Clone, PartialEq, Props)]
pub struct GlowProps {
    children: Element,

    #[props(default)]
    pub blur: GlowBlur,

    #[props(default)]
    pub color: GlowColor,

    #[props(default)]
    pub intensity: GlowIntensity,

    #[props(default)]
    pub active_intensity: Option<GlowIntensity>,

    #[props(default)]
    pub class: String,

    #[props(default)]
    pub block: bool,

    #[props(default = "100".to_string())]
    pub transition_duration: String,
}

///
///
///
///
///
///
///
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
                            let current_style = wrapper
                                .style()
                                .get_property_value("--glow-intensity-scale")
                                .unwrap_or_default();
                            web_sys::console::log_1(
                                &format!("🔴 Glow: current inline intensity = '{}'", current_style)
                                    .into(),
                            );

                            // Log computed style
                            let window = web_sys::window().unwrap();
                            let computed = window.get_computed_style(wrapper).ok().flatten();
                            if let Some(computed) = computed {
                                let computed_intensity = computed
                                    .get_property_value("--glow-intensity-scale")
                                    .unwrap_or_default();
                                let computed_base = computed
                                    .get_property_value("--glow-base-opacity")
                                    .unwrap_or_default();
                                let computed_opacity =
                                    computed.get_property_value("opacity").unwrap_or_default();
                                web_sys::console::log_1(&format!("🔴 Glow: computed intensity='{}', base-opacity='{}', wrapper opacity='{}'", computed_intensity, computed_base, computed_opacity).into());
                            }

                            // Check class list
                            let class_list = wrapper.class_list();
                            let mut classes: Vec<String> = Vec::new();
                            for i in 0..class_list.length() {
                                if let Some(class_name) = class_list.item(i) {
                                    classes.push(class_name);
                                }
                            }
                            web_sys::console::log_1(
                                &format!("🔴 Glow: wrapper classes = {:?}", classes).into(),
                            );

                            StyleBuilder::new(wrapper)
                                .add_custom("--glow-intensity-scale", "1.0")
                                .apply();

                            // Log style after change
                            let new_style = wrapper
                                .style()
                                .get_property_value("--glow-intensity-scale")
                                .unwrap_or_default();
                            web_sys::console::log_1(
                                &format!("🔴 Glow: new inline intensity = '{}'", new_style).into(),
                            );

                            // Log computed style after change
                            let computed2 = window.get_computed_style(wrapper).ok().flatten();
                            if let Some(computed2) = computed2 {
                                let computed_intensity2 = computed2
                                    .get_property_value("--glow-intensity-scale")
                                    .unwrap_or_default();
                                let computed_opacity2 =
                                    computed2.get_property_value("opacity").unwrap_or_default();
                                web_sys::console::log_1(&format!("🔴 Glow: after apply, computed intensity='{}', wrapper opacity='{}'", computed_intensity2, computed_opacity2).into());
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

    #[cfg(not(target_arch = "wasm32"))]
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

// Re-exports for backward compatibility
pub use Glow as Acrylic;
pub use GlowBlur as AcrylicBlur;
pub use GlowColor as AcrylicMode;
pub use GlowIntensity as AcrylicIntensity;
