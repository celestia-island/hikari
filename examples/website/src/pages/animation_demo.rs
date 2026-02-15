// website/src/pages/animation_demo.rs
// Animation demonstration page

use dioxus::prelude::*;

use _animation::presets::{glow, neon, tech, transition};
use _components::{
    basic::{Button, ButtonSize, ButtonVariant},
    layout::{Row, Section},
};

/// Animation demonstration page
///
/// Showcases various animation effects from the Hikari animation system:
/// - FUI glow effects (breathing, pulsing, shimmering)
/// - Neon effects (flickering, buzzing, scanlines)
/// - Technology effects (glitch, typing, data flow, HUD scan)
/// - Transition effects (fade/slide, scale/blur, rotate/zoom)
#[component]
pub fn AnimationDemo() -> Element {
    // Animation instances
    let glow_animation = use_signal(|| glow());
    let neon_animation = use_signal(|| neon());
    let tech_animation = use_signal(|| tech());
    let transition_animation = use_signal(|| transition());

    // Animation control state
    let mut is_glow_active = use_signal(|| false);
    let mut is_neon_active = use_signal(|| false);
    let mut is_tech_active = use_signal(|| false);
    let mut is_transition_active = use_signal(|| false);

    rsx! {
        div {
            class: "animation-demo-page",
            Section {
                                                                            title: "🎨 Animation System Demo".to_string(),
                                                                            children: rsx! {
                                                                                div { class: "demo-intro",
                                                                                    h1 { class: "demo-title", "Hikari Animation System" }
                                                                                    p { class: "demo-description",
                                                                                        "Experience the power of our advanced animation system with FUI-inspired effects, "
                                                                                        "smooth transitions, and interactive animations."
                                                                                    }
                                                                                }
                                                                            }
                                                                        }

                                                                        // Glow Effects Section
                                                                        Section {
                                                                            title: "✨ Glow Effects".to_string(),
                                                                            children: rsx! {
                                                                                div { class: "glow-controls",
                                                                                    Row {
                                                                                        Button {
                                                                                            variant: ButtonVariant::Primary,
                                                                                            size: ButtonSize::Medium,
                                                                                            onclick: move |_| {
                                                                                                if *is_glow_active.read() {
                                                                                                    is_glow_active.set(false);
                                                                                                } else {
                                                                                                    let _id = glow_animation.read().pulse(2000, 0.6);
                                                                                                    is_glow_active.set(true);
                                                                                                }
                                                                                            },
                                                children: rsx! {
                                                                                    if *is_glow_active.read() {
                                                                                        "⏹ Stop Pulse"
                                                                                    } else {
                                                                                        "▶ Start Pulse"
                                                                                    }
                                                                                }
                                                                                        }
                                                                                        Button {
                                                                                            variant: ButtonVariant::Secondary,
                                                                                            size: ButtonSize::Medium,
                                                                                            onclick: move |_| {
                                                                                                if *is_glow_active.read() {
                                                                                                    is_glow_active.set(false);
                                                                                                } else {
                                                                                                    let _id = glow_animation.read().breathe(4000);
                                                                                                    is_glow_active.set(true);
                                                                                                }
                                                                                            },
                                            children: rsx! {
                                                                                if *is_glow_active.read() {
                                                                                    "⏹ Stop Breathe"
                                                                                } else {
                                                                                    "▶ Start Breathe"
                                                                                }
                                                                            }
                                                                                        }
                                                                                        Button {
                                                                                            variant: ButtonVariant::Ghost,
                                                                                            size: ButtonSize::Medium,
                                                                                            onclick: move |_| {
                                                                                                if *is_glow_active.read() {
                                                                                                    is_glow_active.set(false);
                                                                                                } else {
                                                                                                    let _id = glow_animation.read().shimmer(3000, 45.0);
                                                                                                    is_glow_active.set(true);
                                                                                                }
                                                                                            },
                                        children: rsx! {
                                                                            if *is_glow_active.read() {
                                                                                "⏹ Stop Shimmer"
                                                                            } else {
                                                                                "▶ Start Shimmer"
                                                                            }
                                                                        }
                                                                                        }
                                                                                    }
                                                                                }
                                                                                div {
                                                                                    class: "glow-demo-container",
                                                                                    div {
                                                                                        class: "glow-demo-element",
                                                                                        "Glow Element"
                                                                                    }
                                                                                }
                                                                            }
                                                                        }

                                                            // Neon Effects Section
                                                                        Section {
                                                                            title: "🔴 Neon Effects".to_string(),
                                                                            children: rsx! {
                                                                                div { class: "neon-controls",
                                                                                    Row {
                                                                                        Button {
                                                                                            variant: ButtonVariant::Primary,
                                                                                            size: ButtonSize::Medium,
                                                                                            onclick: move |_| {
                                                                                                if *is_neon_active.read() {
                                                                                                    is_neon_active.set(false);
                                                                                                } else {
                                                                                                    let _id = neon_animation.read().flicker(150, 0.3);
                                                                                                    is_neon_active.set(true);
                                                                                                }
                                                                                            },
                                    children: rsx! {
                                                                        if *is_neon_active.read() {
                                                                            "⏹ Stop Flicker"
                                                                        } else {
                                                                            "▶ Start Flicker"
                                                                        }
                                                                    }
                                                                                        }
                                                                                        Button {
                                                                                            variant: ButtonVariant::Secondary,
                                                                                            size: ButtonSize::Medium,
                                                                                            onclick: move |_| {
                                                                                                if *is_neon_active.read() {
                                                                                                    is_neon_active.set(false);
                                                                                                } else {
                                                                                                    let _id = neon_animation.read().buzz(500, 2.0);
                                                                                                    is_neon_active.set(true);
                                                                                                }
                                                                                            },
                                children: rsx! {
                                                                    if *is_neon_active.read() {
                                                                        "⏹ Stop Buzz"
                                                                    } else {
                                                                        "▶ Start Buzz"
                                                                    }
                                                                }
                                                                                        }
                                                                                        Button {
                                                                                            variant: ButtonVariant::Ghost,
                                                                                            size: ButtonSize::Medium,
                                                                                            onclick: move |_| {
                                                                                                if *is_neon_active.read() {
                                                                                                    is_neon_active.set(false);
                                                                                                } else {
                                                                                                    let _id = neon_animation.read().scanline(2000);
                                                                                                    is_neon_active.set(true);
                                                                                                }
                                                                                            },
                            children: rsx! {
                                                                if *is_neon_active.read() {
                                                                    "⏹ Stop Scanline"
                                                                } else {
                                                                    "▶ Start Scanline"
                                                                }
                                                            }
                                                                                        }
                                                                                    }
                                                                                }
                                                                                div {
                                                                                    class: "neon-demo-container",
                                                                                    div {
                                                                                        class: "neon-demo-element",
                                                                                        "Neon Element"
                                                                                    }
                                                                                }
                                                                            }
                                                                        }

                                                        // Tech Effects Section
                                                                    Section {
                                                                        title: "💻 Tech Effects".to_string(),
                                                                        children: rsx! {
                                                                                div { class: "tech-controls",
                                                                                    Row {
                                                                                        Button {
                                                                                            variant: ButtonVariant::Primary,
                                                                                            size: ButtonSize::Medium,
                                                                                            onclick: move |_| {
                                                                                                if *is_tech_active.read() {
                                                                                                    is_tech_active.set(false);
                                                                                                } else {
                                                                                                    let _id = tech_animation.read().glitch(300, 5.0);
                                                                                                    is_tech_active.set(true);
                                                                                                }
                                                                                            },
                        children: rsx! {
                                                            if *is_tech_active.read() {
                                                                "⏹ Stop Glitch"
                                                            } else {
                                                                "▶ Start Glitch"
                                                            }
                                                        }
                                                                                        }
                                                                                        Button {
                                                                                            variant: ButtonVariant::Secondary,
                                                                                            size: ButtonSize::Medium,
                                                                                            onclick: move |_| {
                                                                                                if *is_tech_active.read() {
                                                                                                    is_tech_active.set(false);
                                                                                                } else {
                                                                                                    let _id = tech_animation.read().typing(2000, 20);
                                                                                                    is_tech_active.set(true);
                                                                                                }
                                                                                            },
                    children: rsx! {
                                                        if *is_tech_active.read() {
                                                            "⏹ Stop Typing"
                                                        } else {
                                                            "▶ Start Typing"
                                                        }
                                                    }
                                                                                        }
                                                                                        Button {
                                                                                            variant: ButtonVariant::Ghost,
                                                                                            size: ButtonSize::Medium,
                                                                                            onclick: move |_| {
                                                                                                if *is_tech_active.read() {
                                                                                                    is_tech_active.set(false);
                                                                                                } else {
                                                                                                    let _id = tech_animation.read().data_flow(3000, 100.0);
                                                                                                    is_tech_active.set(true);
                                                                                                }
                                                                                            },
                children: rsx! {
                                                    if *is_tech_active.read() {
                                                        "⏹ Stop Data Flow"
                                                    } else {
                                                        "▶ Start Data Flow"
                                                    }
                                                }
                                                                                        }
                                                                                    }
                                                                                }
                                                                                div {
                                                                                    class: "tech-demo-container",
                                                                                    div {
                                                                                        class: "tech-demo-element",
                                                                                        "Tech Element"
                                                                                    }
                                                                                }
                                                                            }
                                                                        }

                                                    // Transition Effects Section
                                                                Section {
                                                                    title: "🎭 Transition Effects".to_string(),
                                                                    children: rsx! {
                                                                                div { class: "transition-controls",
                                                                                    Row {
                                                                                        Button {
                                                                                            variant: ButtonVariant::Primary,
                                                                                            size: ButtonSize::Medium,
                                                                                            onclick: move |_| {
                                                                                                if *is_transition_active.read() {
                                                                                                    is_transition_active.set(false);
                                                                                                } else {
                                                                                                    let _id = transition_animation.read().fade_slide_in(800, 50.0);
                                                                                                    is_transition_active.set(true);
                                                                                                }
                                                                                            },
            children: rsx! {
                                                if *is_transition_active.read() {
                                                    "⏹ Stop Fade In"
                                                } else {
                                                    "▶ Start Fade In"
                                                }
                                            }
                                                                                        }
                                                                                        Button {
                                                                                            variant: ButtonVariant::Secondary,
                                                                                            size: ButtonSize::Medium,
                                                                                            onclick: move |_| {
                                                                                                if *is_transition_active.read() {
                                                                                                    is_transition_active.set(false);
                                                                                                } else {
                                                                                                    let _id = transition_animation.read().scale_blur_in(1000);
                                                                                                    is_transition_active.set(true);
                                                                                                }
                                                                                            },
        children: rsx! {
                                            if *is_transition_active.read() {
                                                "⏹ Stop Scale In"
                                            } else {
                                                "▶ Start Scale In"
                                            }
                                        }
                                                                                        }
                                                                                        Button {
                                                                                            variant: ButtonVariant::Ghost,
                                                                                            size: ButtonSize::Medium,
                                                                                            onclick: move |_| {
                                                                                                if *is_transition_active.read() {
                                                                                                    is_transition_active.set(false);
                                                                                                } else {
                                                                                                    let _id = transition_animation.read().rotate_zoom_in(1200, 180.0);
                                                                                                    is_transition_active.set(true);
                                                                                                }
                                                                                            },
    children: rsx! {
                                        if *is_transition_active.read() {
                                            "⏹ Stop Rotate In"
                                        } else {
                                            "▶ Start Rotate In"
                                        }
                                    }
                                                                                        }
                                                                                    }
                                                                                }
                                                                                div {
                                                                                    class: "transition-demo-container",
                                                                                    div {
                                                                                        class: "transition-demo-element",
                                                                                        "Transition Element"
                                                                                    }
                                                                                }
                                                                            }
                                                                        }
                                                                    }
                                                                }
}
