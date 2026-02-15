// website/src/pages/home.rs
// Home page - Showcasing Hikari Component Library

use dioxus::prelude::*;
use dioxus_router::components::Link;

use crate::{app::Route, components::Layout};
use _components::{
    basic::Logo as HikariLogo,
    layout::{Container, Row, Section, Spacer},
    Button, ButtonSize, ButtonVariant,
};
use _palette::classes::{ClassesBuilder, FontSize, MarginBottom, TextAlign, TextColor};

#[component]
pub fn Home() -> Element {
    rsx! {
        Layout { current_route: Route::Home {},

            Container { max_width: "xxl".to_string(),

                // Hero Section
                Section { size: "lg".to_string(),

                    // Hero Content using semantic HTML
                    div { class: ClassesBuilder::new().add(TextAlign::Center).build(),

                        HikariLogo {
                            src: "/images/logo.png".to_string(),
                            alt: "Hikari Logo".to_string(),
                            height: 80,
                            max_width: 300,
                        }
                        p {
                            class: ClassesBuilder::new()
                                .add(FontSize::X2xl)
                                .add(TextColor::Secondary)
                                .add(MarginBottom::Mb6)
                                .build(),
                            "Hikari"
                        }

                        Spacer { size: "md".to_string() }

                        p { class: ClassesBuilder::new().add(FontSize::Lg).add(TextColor::Primary).build(),
                            "A modern Rust UI component library for Dioxus."
                        }

                        p { class: ClassesBuilder::new().add(FontSize::Sm).add(TextColor::Primary).build(),
                            "There is no shame in wanting to feel happy."
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
            }
        }
    }
}
