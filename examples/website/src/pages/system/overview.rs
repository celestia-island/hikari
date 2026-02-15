// website/src/pages/system/overview.rs
// System overview page (simplified)

use dioxus::prelude::*;
use dioxus_router::components::Link;

use crate::{app::Route, components::PageContainer, hooks::use_i18n};
use _palette::classes::{
    BgColor, BorderRadius, ClassesBuilder, Display, Duration, FlexDirection, FontSize, FontWeight,
    Gap, GridCols, MarginBottom, Padding, Shadow, TextColor, Transition,
};

/// System overview page
#[allow(non_snake_case)]
#[component]
pub fn SystemOverview() -> Element {
    let i18n = use_i18n();

    let (
        page_title,
        page_desc,
        css_title,
        css_desc,
        icons_title,
        icons_desc,
        palette_title,
        palette_desc,
        anim_title,
        anim_desc,
    ) = match i18n {
        Some(ctx) => {
            let keys = &ctx.keys;
            (
                keys.sidebar.system.title.clone(),
                "Explore Hikari's foundational systems and utilities".to_string(),
                keys.sidebar
                    .system
                    .css_utilities
                    .clone()
                    .unwrap_or_else(|| "CSS Utilities".to_string()),
                "Tailwind-compatible utility classes for rapid styling".to_string(),
                keys.sidebar
                    .system
                    .icons
                    .clone()
                    .unwrap_or_else(|| "Icons".to_string()),
                "Comprehensive icon library powered by MDI".to_string(),
                keys.sidebar
                    .system
                    .palette
                    .clone()
                    .unwrap_or_else(|| "Palette".to_string()),
                "Chinese traditional color system with 500+ colors".to_string(),
                keys.sidebar
                    .system
                    .animations
                    .clone()
                    .unwrap_or_else(|| "Animations".to_string()),
                "GSAP-inspired animation system for smooth transitions".to_string(),
            )
        }
        None => (
            "System".to_string(),
            "Explore Hikari's foundational systems and utilities".to_string(),
            "CSS Utilities".to_string(),
            "Tailwind-compatible utility classes for rapid styling".to_string(),
            "Icons".to_string(),
            "Comprehensive icon library powered by MDI".to_string(),
            "Palette".to_string(),
            "Chinese traditional color system with 500+ colors".to_string(),
            "Animations".to_string(),
            "GSAP-inspired animation system for smooth transitions".to_string(),
        ),
    };

    rsx! {
        PageContainer {
            current_route: Route::SystemOverview {},
            title: page_title,
            description: page_desc,

            div { class: ClassesBuilder::new().add(Display::Grid).add(GridCols::Col3).add(Gap::Gap6).build(),
                SystemCard {
                    title: css_title,
                    description: css_desc,
                    route: Route::SystemCSS {},
                }

                SystemCard {
                    title: icons_title,
                    description: icons_desc,
                    route: Route::SystemIcons {},
                }

                SystemCard {
                    title: palette_title,
                    description: palette_desc,
                    route: Route::SystemPalette {},
                }

                SystemCard {
                    title: anim_title,
                    description: anim_desc,
                    route: Route::SystemAnimations {},
                }
            }
        }
    }
}

/// System feature card
#[component]
fn SystemCard(title: String, description: String, route: Route) -> Element {
    rsx! {
        Link {
            to: route,
            class: ClassesBuilder::new()
                .add(Display::Block)
                .add(Transition::All)
                .add(Duration::D300)
                .build(),
            div {
                class: ClassesBuilder::new()
                    .add(BgColor::White)
                    .add(BorderRadius::Lg)
                    .add(Padding::P6)
                    .add(Shadow::Md)
                    .add(Transition::All)
                    .add(Duration::D300)
                    .build(),
                h3 {
                    class: ClassesBuilder::new()
                        .add(FontSize::X2xl)
                        .add(FontWeight::Semibold)
                        .add(TextColor::Primary)
                        .add(MarginBottom::Mb0)
                        .build(),
                    "{title}"
                }
                p { class: ClassesBuilder::new().add(TextColor::Secondary).add(MarginBottom::Mb0).build(),
                    "{description}"
                }
            }
        }
    }
}
