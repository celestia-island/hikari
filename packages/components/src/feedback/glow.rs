// hi-components/src/feedback/glow.rs
// Unified glow effect component with mouse-following spotlight and acrylic blur
//
// Animation architecture:
// - Uses CSS variables updated via mouse events for position tracking
// - CSS transitions provide smooth interpolation between positions
// - WASI-compatible: single implementation for both browser and server
// - Server environments stub out mouse-related APIs automatically
//
// # CSS Value Type Integration
//
// This component can use the type-safe CSS value system from tairitsu-css-values:
//
// ```rust
// use hikari_components::style_builder::{StyleStringBuilder, CssLength};
//
// // Type-safe approach (recommended for new code):
// let style = StyleStringBuilder::new()
//     .add_var_with_length("glow-x", CssLength::percent(50))
//     .add_var_with_length("glow-y", CssLength::percent(50))
//     .build();
//
// // Traditional string approach (still supported):
// let style = StyleStringBuilder::new()
//     .add_var("glow-x", "50%")
//     .add_var("glow-y", "50%")
//     .build();
// ```

use hikari_palette::classes::{ClassesBuilder, GlowClass};
use tairitsu_vdom::IntoAttrValue;

use crate::prelude::*;
use crate::style_builder::StyleStringBuilder;

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

/// Props for the [`Glow`] component, controlling blur, color, intensity, and animation preset.
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
    #[default("inherit".to_string())]
    pub radius: String,
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

/// A mouse-following glow spotlight with acrylic blur, wrapping children in an interactive overlay.
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
        .add_typed(GlowClass::GlowWrapper)
        .add_typed_if(GlowClass::GlowWrapperBlock, props.block)
        .add_typed(blur_class)
        .add_typed(intensity_class)
        .add(&props.class)
        .add(&props.preset.to_string())
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
    let glow_state = use_signal(GlowState::default);

    // Build initial style using StyleStringBuilder
    let glow_style = use_signal(|| {
        StyleStringBuilder::new()
            .add_var("glow-x", "50%")
            .add_var("glow-y", "50%")
            .add_var("hi-glow-color", glow_color)
            .add_var("glow-opacity", &base_opacity.to_string())
            .add_var("glow-intensity-scale", "0")
            .add_var("glow-radius", &props.radius)
            .build()
    });

    let build_style =
        |interaction_level: f32, opacity: f32, glow_x: &str, glow_y: &str| -> String {
            StyleStringBuilder::new()
                .add_var("glow-x", glow_x)
                .add_var("glow-y", glow_y)
                .add_var("glow-intensity-scale", &interaction_level.to_string())
                .add_var("glow-opacity", &format!("{:.3}", opacity))
                .build()
        };

    fn calc_glow_percent(event: &MouseEvent) -> (String, String) {
        if let Some(target) = event.target {
            let rect =
                tairitsu_vdom::get_bounding_client_rect(tairitsu_vdom::DomHandle::from_raw(target));
            if rect.width > 0.0 && rect.height > 0.0 {
                let px = (event.offset_x as f64 / rect.width * 100.0).clamp(0.0, 100.0);
                let py = (event.offset_y as f64 / rect.height * 100.0).clamp(0.0, 100.0);
                return (format!("{:.1}%", px), format!("{:.1}%", py));
            }
        }
        ("50%".to_string(), "50%".to_string())
    }

    // Clone values for event handlers
    let base_opacity_clone = base_opacity;
    let active_opacity_clone = active_opacity;

    // Mouse move handler - update interaction level and style
    let onmousemove_handler = {
        let state = glow_state.clone();
        let style = glow_style.clone();

        move |event: MouseEvent| {
            let (glow_x, glow_y) = calc_glow_percent(&event);

            let current = state.read();
            let new_state = GlowState {
                mouse_x: event.offset_x as f64,
                mouse_y: event.offset_y as f64,
                is_inside: true,
                interaction_level: current.interaction_level,
            };
            state.set(new_state);

            let current_opacity = base_opacity_clone
                + (active_opacity_clone.unwrap_or(base_opacity_clone * 2.0) - base_opacity_clone)
                    * new_state.interaction_level;

            let new_style = build_style(
                new_state.interaction_level,
                current_opacity,
                &glow_x,
                &glow_y,
            );
            style.set(new_style);
        }
    };

    // Mouse enter handler
    let onmouseenter_handler = {
        let state = glow_state.clone();
        let style = glow_style.clone();
        let base_op = base_opacity_clone;

        move |event: MouseEvent| {
            let (glow_x, glow_y) = calc_glow_percent(&event);

            let current = state.read();
            let new_state = GlowState {
                mouse_x: event.offset_x as f64,
                mouse_y: event.offset_y as f64,
                interaction_level: 0.5,
                is_inside: true,
            };
            state.set(new_state);

            let current_opacity = base_op
                + (active_opacity_clone.unwrap_or(base_op * 2.0) - base_op)
                    * new_state.interaction_level;
            let new_style = build_style(
                new_state.interaction_level,
                current_opacity,
                &glow_x,
                &glow_y,
            );
            style.set(new_style);
        }
    };
    // Mouse leave handler
    let onmouseleave_handler = {
        let state = glow_state.clone();
        let style = glow_style.clone();

        move |_: MouseEvent| {
            let current = state.read();
            let new_state = GlowState {
                is_inside: false,
                interaction_level: 0.0,
                ..current
            };
            state.set(new_state);

            let new_style = build_style(0.0, 0.0, "50%", "50%");
            style.set(new_style);
        }
    };

    // Mouse down handler
    let onmousedown_handler = {
        let state = glow_state.clone();
        let style = glow_style.clone();
        let base_op = base_opacity_clone;

        move |_: MouseEvent| {
            let current = state.read();
            let new_state = GlowState {
                interaction_level: 1.0,
                ..current
            };
            state.set(new_state);

            let current_opacity = base_op
                + (active_opacity_clone.unwrap_or(base_op * 2.0) - base_op)
                    * new_state.interaction_level;
            let new_style = build_style(new_state.interaction_level, current_opacity, "50%", "50%");
            style.set(new_style);
        }
    };

    // Mouse up handler
    let onmouseup_handler = {
        let state = glow_state.clone();
        let style = glow_style.clone();
        let base_op = base_opacity_clone;

        move |_: MouseEvent| {
            let current = state.read();
            let interaction_level = if current.is_inside { 0.5 } else { 0.0 };
            let new_state = GlowState {
                interaction_level,
                ..current
            };
            state.set(new_state);

            let current_opacity = base_op
                + (active_opacity_clone.unwrap_or(base_op * 2.0) - base_op)
                    * new_state.interaction_level;
            let new_style = build_style(new_state.interaction_level, current_opacity, "50%", "50%");
            style.set(new_style);
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

pub struct GlowComponent;

impl crate::styled::StyledComponent for GlowComponent {
    fn styles() -> &'static str {
        include_str!(concat!(env!("OUT_DIR"), "/styles/glow.css"))
    }

    fn name() -> &'static str {
        "glow"
    }
}

#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub struct GlowConfig {
    pub glow: bool,
    pub blur: GlowBlur,
    pub color: GlowColor,
    pub intensity: GlowIntensity,
}

#[define_props]
pub struct ConditionalGlowProps {
    pub glow: bool,

    pub children: Element,

    pub blur: GlowBlur,

    pub color: GlowColor,

    pub intensity: GlowIntensity,

    #[default(false)]
    pub block: bool,
}

#[component]
pub fn ConditionalGlow(props: ConditionalGlowProps) -> Element {
    if props.glow {
        rsx! {
            Glow {
                blur: props.blur,
                color: props.color,
                intensity: props.intensity,
                block: props.block,
                {props.children}
            }
        }
    } else {
        props.children
    }
}
