// website/src/pages/home.rs
// Home page - Showcasing Hikari Component Library

use dioxus::prelude::*;
use dioxus_router::components::Link;

use crate::{
    app::Route,
    components::Layout,
    hooks::{use_i18n, use_language},
};
use _components::{
    basic::Logo as HikariLogo,
    layout::{Container, Row, Section, Spacer},
    Button, ButtonSize, ButtonVariant,
};
use _palette::classes::{ClassesBuilder, FontSize, MarginBottom, TextAlign, TextColor};

#[component]
pub fn Home() -> Element {
    let i18n = use_i18n();
    let lang_ctx = use_language();
    let lang = (*lang_ctx.language.read()).url_prefix().to_string();

    let (title, subtitle, description, tagline, explore_text, docs_text) = match i18n {
        Some(ctx) => {
            let keys = &ctx.keys;
            (
                keys.page.home.hero.title.clone(),
                keys.page.home.hero.subtitle.clone(),
                keys.page.home.hero.description.clone(),
                keys.page.home.hero.tagline.clone(),
                keys.page.home.hero.explore.clone(),
                keys.page.documentation.quick_start.clone(),
            )
        }
        None => (
            "Hikari".to_string(),
            "A modern Rust UI component library for Dioxus.".to_string(),
            "Based on Dioxus + Grass + Axum, designed with Arknights aesthetics and FUI styling."
                .to_string(),
            "There is no shame in wanting to feel happy.".to_string(),
            "Explore Components →".to_string(),
            "View Documentation".to_string(),
        ),
    };

    rsx! {
        Layout { current_route: Route::LangHome { lang: lang.clone() },

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
                            "{title}"
                        }

                        Spacer { size: "md".to_string() }

                        p { class: ClassesBuilder::new().add(FontSize::Lg).add(TextColor::Primary).build(),
                            "{subtitle}"
                        }

                        p { class: ClassesBuilder::new().add(FontSize::Sm).add(TextColor::Primary).build(),
                            "{description}"
                        }

                        p { class: ClassesBuilder::new().add(FontSize::Sm).add(TextColor::Secondary).build(),
                            "{tagline}"
                        }
                    }
                }

                Spacer { size: "lg".to_string() }

                // CTA Buttons
                Row {
                    justify: "center".to_string(),
                    gap: "md".to_string(),
                    wrap: true,

                    Link { to: Route::ComponentsOverview { lang: lang.clone() },
                        Button {
                            variant: ButtonVariant::Primary,
                            size: ButtonSize::Large,
                            "{explore_text}"
                        }
                    }

                    Link { to: Route::SystemOverview { lang: lang.clone() },
                        Button {
                            variant: ButtonVariant::Secondary,
                            size: ButtonSize::Large,
                            "{docs_text}"
                        }
                    }
                }

                Spacer { size: "xl".to_string() }
            }
        }
    }
}
