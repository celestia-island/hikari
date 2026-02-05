// website/src/pages/system/animations.rs
// Animation system page

use dioxus::prelude::*;

use crate::{app::Route, components::Layout};
use _palette::classes::{ BgColor, BorderRadius, ClassesBuilder, Display, FlexDirection, FontSize, FontWeight, Gap, MarginBottom, Padding, TextColor, };

/// Animation system page
#[allow(non_snake_case)]
#[component]
pub fn SystemAnimations() -> Element {
    rsx! {
        Layout {
            current_route: Route::SystemAnimations {},
            children: rsx! {
                div {
                    class: ClassesBuilder::new()
                        .add(Display::Flex)
                        .add(FlexDirection::Column)
                        .add(Gap::Gap6)
                        .build(),

                    // Page header
                    div { class: ClassesBuilder::new().add(MarginBottom::Mb0).build(),
                        h1 {
                            class: ClassesBuilder::new()
                                .add(FontSize::X4xl)
                                .add(FontWeight::Bold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb0)
                                .build(),
                            "Animation System"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "GSAP-inspired declarative animation system for smooth, performant animations"
                        }
                    }

                    // Feature overview
                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h2 {
                            class: ClassesBuilder::new()
                                .add(FontSize::X2xl)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb4)
                                .build(),
                            "Core Features"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Muted).add(FontSize::Lg).add(MarginBottom::Mb4).build(),
                            "High-performance declarative animation system with static and dynamic values"
                        }
                        div {
                            class: ClassesBuilder::new()
                                .add_raw("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6")
                                .build(),

                            div {
                                class: ClassesBuilder::new().add(BgColor::White).add(BorderRadius::Lg).add(Padding::P6).build(),
                                h3 {
                                    class: ClassesBuilder::new()
                                        .add(FontSize::Lg)
                                        .add(FontWeight::Semibold)
                                        .add(MarginBottom::Mb2)
                                        .build(),
                                    "AnimationBuilder"
                                }
                                p {
                                    class: ClassesBuilder::new().add(TextColor::Secondary).add(MarginBottom::Mb2).build(),
                                    "High-level animation builder with fluent API for complex animations"
                                }
                            }
                            div {
                                class: ClassesBuilder::new().add(BgColor::White).add(BorderRadius::Lg).add(Padding::P6).build(),
                                h3 {
                                    class: ClassesBuilder::new()
                                        .add(FontSize::Lg)
                                        .add(FontWeight::Semibold)
                                        .add(MarginBottom::Mb2)
                                        .build(),
                                    "Tween System"
                                }
                                p {
                                    class: ClassesBuilder::new().add(TextColor::Secondary).add(MarginBottom::Mb2).build(),
                                    "Smooth value interpolation with 30+ easing functions"
                                }
                            }
                        }
                    }

                    // Easing functions
                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h2 {
                            class: ClassesBuilder::new()
                                .add(FontSize::X2xl)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb4)
                                .build(),
                            "Easing Functions"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Muted).add(FontSize::Lg).add(MarginBottom::Mb4).build(),
                            "30+ easing functions for smooth animations: Linear, EaseIn, EaseOut, EaseInOut, Sine, Quad, Cubic, Quart, Quint, Expo, Circ, Back, Elastic, Bounce"
                        }
                        div {
                            class: ClassesBuilder::new()
                                .add_raw("grid grid-cols-2 md:grid-cols-4 gap-4")
                                .build(),

                                div {
                                    class: ClassesBuilder::new().add(BgColor::Surface).add(Padding::P2).build(),
                                    "Linear"
                                }
                                div {
                                    class: ClassesBuilder::new().add(BgColor::Surface).add(Padding::P2).build(),
                                    "EaseIn"
                                }
                                div {
                                    class: ClassesBuilder::new().add(BgColor::Surface).add(Padding::P2).build(),
                                    "EaseOut"
                                }
                                div {
                                    class: ClassesBuilder::new().add(BgColor::Surface).add(Padding::P2).build(),
                                    "EaseInOut"
                                }
                        }
                    }

                    // Presets
                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h2 {
                            class: ClassesBuilder::new()
                                .add(FontSize::X2xl)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb4)
                                .build(),
                            "Animation Presets"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Muted).add(FontSize::Lg).add(MarginBottom::Mb4).build(),
                            "Pre-built animation presets: Fade, Slide, Scale, Rotate, Flip, Zoom"
                        }
                        div {
                            class: ClassesBuilder::new()
                                .add_raw("flex flex-wrap gap-4")
                                .build(),

                                div {
                                    class: ClassesBuilder::new().add(BgColor::Surface).add(Padding::P4).add(BorderRadius::Lg).build(),
                                    "Fade"
                                }
                                div {
                                    class: ClassesBuilder::new().add(BgColor::Surface).add(Padding::P4).add(BorderRadius::Lg).build(),
                                    "Slide"
                                }
                                div {
                                    class: ClassesBuilder::new().add(BgColor::Surface).add(Padding::P4).add(BorderRadius::Lg).build(),
                                    "Scale"
                                }
                                div {
                                    class: ClassesBuilder::new().add(BgColor::Surface).add(Padding::P4).add(BorderRadius::Lg).build(),
                                    "Rotate"
                                }
                        }
                    }

                    // Timeline
                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h2 {
                            class: ClassesBuilder::new()
                                .add(FontSize::X2xl)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb4)
                                .build(),
                            "Timeline Control"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Muted).add(FontSize::Lg).add(MarginBottom::Mb4).build(),
                            "State machine for managing animation sequences with precise timing"
                        }
                    }

                    // Spotlight
                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h2 {
                            class: ClassesBuilder::new()
                                .add(FontSize::X2xl)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb4)
                                .build(),
                            "Spotlight Effects"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Muted).add(FontSize::Lg).add(MarginBottom::Mb4).build(),
                            "FUI-inspired glow effects that follow mouse movement with smooth gradients"
                        }
                    }
                }
            }
        }
    }
}
