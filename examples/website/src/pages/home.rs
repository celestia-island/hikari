// website/src/pages/home.rs
// Home page - Showcasing Hikari Component Library


use dioxus::prelude::*;
use dioxus_router::components::Link;

use _palette::classes::{ClassesBuilder, FontSize, FontWeight, TextColor, TextAlign, MarginBottom};
use crate::{app::Route, components::Layout};
use _components::{Button, ButtonSize, ButtonVariant, Card, layout::{Container, Grid, Row, Section, Spacer}};

#[component]
pub fn Home() -> Element {
    rsx! {
        Layout { current_route: Route::Home {},

            Container { max_width: "xxl".to_string(),

                // Hero Section
                Section { size: "lg".to_string(),

                    // Hero Content using semantic HTML
                    div { class: ClassesBuilder::new().add(TextAlign::Center).build(),

                        h1 {
                            class: ClassesBuilder::new()
                                .add(FontSize::X4xl)
                                .add(FontWeight::Bold)
                                .add(MarginBottom::Mb4)
                                .build(),
                            "Hikari UI"
                        }
                        p {
                            class: ClassesBuilder::new()
                                .add(FontSize::X2xl)
                                .add(TextColor::Gray600)
                                .add(MarginBottom::Mb6)
                                .build(),
                            "光 · Light · Brilliance"
                        }

                        Spacer { size: "md".to_string() }

                        p { class: ClassesBuilder::new().add(FontSize::Lg).add(TextColor::Gray700).build(),
                            "A modern Rust UI component library for Dioxus, inspired by Arknights aesthetics with FUI elements and traditional Chinese colors."
                        }
                    }
                }

                Spacer { size: "lg".to_string() }

                // CTA Buttons
                Row {
                    justify: "center".to_string(),
                    gap: "md".to_string(),
                    wrap: true,

                    Link { to: Route::ComponentsOverview {},
                        Button {
                            variant: ButtonVariant::Primary,
                            size: ButtonSize::Large,
                            "Explore Components →"
                        }
                    }

                    Link { to: Route::SystemOverview {},
                        Button {
                            variant: ButtonVariant::Secondary,
                            size: ButtonSize::Large,
                            "View Documentation"
                        }
                    }
                }

                Spacer { size: "xl".to_string() }

                // Feature Cards Grid
                Grid { columns: 4, gap: "lg".to_string(),

                    FeatureCard {
                        icon: "🎨",
                        title: "Chinese Colors".to_string(),
                        description: "161 traditional Chinese colors with historical significance".to_string(),
                    }

                    FeatureCard {
                        icon: "⚡",
                        title: "FUI Design".to_string(),
                        description: "Futuristic interface inspired by Arknights and sci-fi aesthetics".to_string(),
                    }

                    FeatureCard {
                        icon: "🚀",
                        title: "WASM Optimized".to_string(),
                        description: "Minimal binary size with feature-gated Chinese names".to_string(),
                    }

                    FeatureCard {
                        icon: "📦",
                        title: "Component Library".to_string(),
                        description: "Complete set of UI components for modern applications".to_string(),
                    }
                }
            }
        }
    }
}

#[component]
fn FeatureCard(icon: String, title: String, description: String) -> Element {
    rsx! {
        Card { hoverable: true, title: Some(title), class: "feature-card",

            div { class: "feature-icon", "{icon}" }
            p { class: "feature-description", "{description}" }
        }
    }
}
