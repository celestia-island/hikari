//! Background component
//!
//! Provides a full-screen gradient background with breathing color effects.
//! Automatically adapts to theme changes via global theme provider registry.
//! Includes a 60-second rotating gradient animation with configurable breathing.

use hikari_palette::classes::BackgroundClass;
use hikari_palette::colors::{墨色, 粉红, 精白, 靛蓝};
use tairitsu_hooks::ReactiveSignal;
use tairitsu_style::TypedClass;

use crate::platform;
use crate::prelude::*;
use crate::style_builder::StyleStringBuilder;
use crate::styled::StyledComponent;
use crate::theme::ThemeContext;

pub struct BackgroundComponent;

#[define_props]
pub struct BackgroundProps {
    #[default]
    pub children: Element,
}

#[component]
pub fn Background(props: BackgroundProps) -> Element {
    let animation_style = use_signal(String::new);
    let theme_ctx = use_context::<ThemeContext>();

    let theme_name_signal = theme_ctx.as_ref().map(|ctx| ctx.get().theme_name.clone());

    let animation_style_rsx = animation_style.clone();
    use_effect(move || {
        let animation_style_clone = animation_style.clone();
        let theme_name_signal = theme_name_signal.clone();
        let _stop = start_gradient_animation(theme_name_signal, move |style| {
            animation_style_clone.set(style);
        });
    });

    rsx! {
        div {
            class: BackgroundClass::Background.class_name(),
            style: "{animation_style_rsx}",
            {props.children}
        }
    }
}

struct AnimationState {
    start_time: f64,
    stopped: bool,
}

fn start_gradient_animation<F>(
    theme_name_signal: Option<ReactiveSignal<String>>,
    mut update_style: F,
) -> Box<dyn FnOnce()>
where
    F: FnMut(String) + 'static,
{
    let state = std::rc::Rc::new(std::cell::RefCell::new(AnimationState {
        start_time: platform::now_timestamp(),
        stopped: false,
    }));

    let period_ms = 60000.0;
    let radius_percent = 20.0;
    let center_x = 50.0;
    let center_y = 50.0;

    let state_clone = state.clone();

    platform::request_animation_frame_with_timestamp(move |timestamp| {
        let state_borrow = state_clone.borrow();
        if state_borrow.stopped {
            return;
        }

        let current_time = timestamp - state_borrow.start_time;

        let angle = (current_time / period_ms) * 2.0 * std::f64::consts::PI;
        let x = center_x + radius_percent * angle.cos();
        let y = center_y + radius_percent * angle.sin();

        let theme_name = theme_name_signal
            .as_ref()
            .map(|s: &ReactiveSignal<String>| s.get())
            .unwrap_or_else(|| "hikari".to_string());

        let (color1, color2) = match theme_name.as_str() {
            "tairitsu" => (墨色, 靛蓝),
            _ => (精白, 粉红),
        };

        let breathing_progress = (current_time / 4000.0) % 2.0;
        let actual_progress = if breathing_progress > 1.0 {
            2.0 - breathing_progress
        } else {
            breathing_progress
        };

        let sin_val = (actual_progress * std::f64::consts::PI).sin();
        let saturation_factor = 1.0 + (sin_val * 0.05);
        let lightness_factor = 1.0 + (sin_val * 0.05);

        let breathing_color1 = color1
            .adjust_saturation(saturation_factor)
            .adjust_lightness(lightness_factor);
        let breathing_color2 = color2
            .adjust_saturation(saturation_factor)
            .adjust_lightness(lightness_factor);

        let style = StyleStringBuilder::new()
            .add_var("bg-center-x", &format!("{:.1}%", x))
            .add_var("bg-center-y", &format!("{:.1}%", y))
            .add_var("bg-color-1", &breathing_color1.hex())
            .add_var("bg-color-2", &breathing_color2.hex())
            .build();

        update_style(style);
    });

    let state_final = state.clone();
    Box::new(move || {
        state_final.borrow_mut().stopped = true;
    })
}

impl StyledComponent for BackgroundComponent {
    fn styles() -> &'static str {
        include_str!(concat!(env!("OUT_DIR"), "/styles/background.css"))
    }

    fn name() -> &'static str {
        "background"
    }
}
