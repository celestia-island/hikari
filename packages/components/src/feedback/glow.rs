// hi-components/src/feedback/glow.rs
// Unified glow effect component with mouse-following spotlight and acrylic blur
//
// Animation architecture:
// - Uses CSS variables updated via mouse events for position tracking
// - CSS transitions provide smooth interpolation between positions
// - Platform-agnostic: works on both wasm32-unknown-unknown and wasm32-wasip2
// - Uses platform abstraction layer for DOM operations where needed

use hikari_palette::classes::{ClassesBuilder, GlowClass};
use tairitsu_vdom::IntoAttrValue;
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

/// Glow animation presets for continuous animation effects
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum GlowPreset {
    #[default]
    None,
    Pulse,
    Breathe,
    Shimmer,
}

impl std::fmt::Display for GlowPreset {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            GlowPreset::None => write!(f, ""),
            GlowPreset::Pulse => write!(f, "pulse"),
            GlowPreset::Breathe => write!(f, "breathe"),
            GlowPreset::Shimmer => write!(f, "shimmer"),
        }
    }
}

impl IntoAttrValue for GlowPreset {
    fn into_attr_value(self) -> Option<String> {
        if self == GlowPreset::None {
            None
        } else {
            Some(self.to_string())
        }
    }
}

#[define_props]
pub struct GlowProps {
    pub children: Element,
    pub blur: GlowBlur,
    pub color: GlowColor,
    pub intensity: GlowIntensity,
    pub active_intensity: Option<GlowIntensity>,
    pub preset: GlowPreset,
    pub class: String,
    pub block: bool,
    #[default("100".to_string())]
    pub transition_duration: String,
}

/// Get opacity value for intensity level
fn get_opacity_for_intensity(intensity: GlowIntensity) -> f32 {
    match intensity {
        GlowIntensity::Dim => 0.07,
        GlowIntensity::Soft => 0.15,
        GlowIntensity::Bright => 0.30,
    }
}

/// Animation state for glow effect
#[derive(Clone, Copy, PartialEq, Debug, Default)]
struct GlowState {
    mouse_x: f64,
    mouse_y: f64,
    is_inside: bool,
    interaction_level: f32, // 0 = idle, 0.5 = hover, 1.0 = active
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
        .add_raw(&props.preset.to_string())
        .build();

    let glow_color = match props.color {
        GlowColor::Ghost => "var(--hi-ghost-glow, rgba(128, 128, 128, 0.5))",
        GlowColor::Primary => "var(--hi-glow-button-primary)",
        GlowColor::Secondary => "var(--hi-glow-button-secondary)",
        GlowColor::Danger => "var(--hi-glow-button-danger)",
        GlowColor::Success => "var(--hi-glow-button-success)",
        GlowColor::Warning => "var(--hi-glow-button-warning)",
        GlowColor::Info => "var(--hi-glow-button-info)",
    };

    let base_opacity = get_opacity_for_intensity(props.intensity);
    let active_opacity = props.active_intensity.map(get_opacity_for_intensity);

    // Animation state
    let glow_state = use_signal(|| GlowState::default());

    // Dynamic style signal for CSS variable updates
    let glow_style = use_signal(|| {
        format!(
            "--glow-x: 50%; --glow-y: 50%; --hi-glow-color: {}; --glow-opacity: {}; --glow-intensity-scale: 0;",
            glow_color, base_opacity
        )
    });

    #[cfg(all(target_arch = "wasm32", target_os = "unknown"))]
    {
        use tairitsu_hooks::use_element_ref;
        use web_sys::{Element, HtmlElement};

        // Get element reference for bounds calculation
        let element_ref = use_element_ref::<Element>();

        // Mouse move handler - update position and style
        let onmousemove_handler = {
            let state = glow_state.clone();
            let style = glow_style.clone();
            let element_ref = element_ref.clone();

            move |event: MouseEvent| {
                let new_state = GlowState {
                    mouse_x: event.client_x() as f64,
                    mouse_y: event.client_y() as f64,
                    is_inside: true,
                    interaction_level: state.read().interaction_level,
                };
                state.set(new_state);

                // Calculate relative position as percentage
                let (percent_x, percent_y) = if let Some(el) = element_ref.get() {
                    if let Ok(html_el) = el.clone().dyn_into::<HtmlElement>() {
                        let rect = html_el.get_bounding_client_rect();
                        if rect.width() > 0.0 && rect.height() > 0.0 {
                            let rel_x = event.client_x() as f64 - rect.x();
                            let rel_y = event.client_y() as f64 - rect.y();
                            let px = ((rel_x / rect.width()) * 100.0).clamp(0.0, 100.0);
                            let py = ((rel_y / rect.height()) * 100.0).clamp(0.0, 100.0);
                            (px, py)
                        } else {
                            (50.0, 50.0)
                        }
                    } else {
                        (50.0, 50.0)
                    }
                } else {
                    (50.0, 50.0)
                };

                // Calculate current opacity
                let current_opacity = base_opacity
                    + (active_opacity.unwrap_or(base_opacity) - base_opacity) * state.read().interaction_level;

                // Update CSS variables
                let current_style = format!(
                    "--glow-x: {:.1}%; --glow-y: {:.1}%; --glow-intensity-scale: {}; --glow-opacity: {:.3};",
                    percent_x,
                    percent_y,
                    state.read().interaction_level,
                    current_opacity
                );
                style.set(current_style);
            }
        };

        // Mouse enter handler
        let onmouseenter_handler = {
            let state = glow_state.clone();
            move |_: MouseEvent| {
                let mut s = *state.read();
                s.interaction_level = 0.5;
                state.set(s);
            }
        };

        // Mouse leave handler
        let onmouseleave_handler = {
            let state = glow_state.clone();
            let style = glow_style.clone();

            move |_: MouseEvent| {
                let mut s = *state.read();
                s.is_inside = false;
                s.interaction_level = 0.0;
                state.set(s);

                // Reset to center position
                let current_style = format!(
                    "--glow-x: 50%; --glow-y: 50%; --glow-intensity-scale: 0; --glow-opacity: {:.3};",
                    base_opacity
                );
                style.set(current_style);
            }
        };

        // Mouse down handler
        let onmousedown_handler = {
            let state = glow_state.clone();
            move |_: MouseEvent| {
                let mut s = *state.read();
                s.interaction_level = 1.0;
                state.set(s);
            }
        };

        // Mouse up handler
        let onmouseup_handler = {
            let state = glow_state.clone();
            move |_: MouseEvent| {
                let mut s = *state.read();
                if s.is_inside {
                    s.interaction_level = 0.5;
                } else {
                    s.interaction_level = 0.0;
                }
                state.set(s);
            }
        };

        rsx! {
            div {
                class: glow_classes,
                "data-glow": "true",
                style: "{glow_style}",
                ref_: element_ref,
                onmousemove: onmousemove_handler,
                onmouseenter: onmouseenter_handler,
                onmouseleave: onmouseleave_handler,
                onmousedown: onmousedown_handler,
                onmouseup: onmouseup_handler,
                {props.children}
            }
        }
    }

    // WASI/wasip2 target - simplified version without element bounds
    #[cfg(all(target_arch = "wasm32", not(target_os = "unknown")))]
    {
        // Mouse move handler - update style without position calculation
        let onmousemove_handler = {
            let state = glow_state.clone();
            let style = glow_style.clone();

            move |event: MouseEvent| {
                let new_state = GlowState {
                    mouse_x: event.client_x() as f64,
                    mouse_y: event.client_y() as f64,
                    is_inside: true,
                    interaction_level: state.read().interaction_level,
                };
                state.set(new_state);

                // For WASI, use a simplified approach - center the glow
                // TODO: Implement proper position calculation using WIT bindings
                let current_opacity = base_opacity
                    + (active_opacity.unwrap_or(base_opacity) - base_opacity) * state.read().interaction_level;

                let current_style = format!(
                    "--glow-x: 50%; --glow-y: 50%; --glow-intensity-scale: {}; --glow-opacity: {:.3};",
                    state.read().interaction_level,
                    current_opacity
                );
                style.set(current_style);
            }
        };

        // Mouse enter handler
        let onmouseenter_handler = {
            let state = glow_state.clone();
            move |_: MouseEvent| {
                let mut s = *state.read();
                s.interaction_level = 0.5;
                state.set(s);
            }
        };

        // Mouse leave handler
        let onmouseleave_handler = {
            let state = glow_state.clone();
            let style = glow_style.clone();

            move |_: MouseEvent| {
                let mut s = *state.read();
                s.is_inside = false;
                s.interaction_level = 0.0;
                state.set(s);

                let current_style = format!(
                    "--glow-x: 50%; --glow-y: 50%; --glow-intensity-scale: 0; --glow-opacity: {:.3};",
                    base_opacity
                );
                style.set(current_style);
            }
        };

        // Mouse down handler
        let onmousedown_handler = {
            let state = glow_state.clone();
            move |_: MouseEvent| {
                let mut s = *state.read();
                s.interaction_level = 1.0;
                state.set(s);
            }
        };

        // Mouse up handler
        let onmouseup_handler = {
            let state = glow_state.clone();
            move |_: MouseEvent| {
                let mut s = *state.read();
                if s.is_inside {
                    s.interaction_level = 0.5;
                } else {
                    s.interaction_level = 0.0;
                }
                state.set(s);
            }
        };

        rsx! {
            div {
                class: glow_classes,
                "data-glow": "true",
                style: "{glow_style}",
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
