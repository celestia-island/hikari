// website/src/components/layout.rs
// Layout component using modernized Hikari components

use dioxus::prelude::*;
use dioxus_router::components::Link;

use super::{AsideFooter, sidebar::Sidebar};
use crate::{app::Route, hooks::use_language};
use _components::{basic::Logo, layout::{Aside, Header, Layout as HikariLayout}};
use _i18n::context::Language;
use _palette::classes::{AlignItems, ClassesBuilder, Display, FontWeight, Gap, Padding};

#[component]
pub fn Layout(children: Element, #[allow(unused_variables)] current_route: Route) -> Element {
    let mut is_drawer_open = use_signal(|| false);
    let current_route = use_route::<Route>();
    let lang_ctx = use_language();
    let lang = (*lang_ctx.language.read()).url_prefix().to_string();

    rsx! {
        HikariLayout {
            header: rsx! {
                Header {
                    show_menu_toggle: true,
                    on_menu_toggle: move |_| is_drawer_open.toggle(),
                    bordered: true,

                    Logo {
                        src: "/images/logo.png".to_string(),
                        alt: "Hikari Logo".to_string(),
                        height: 32,
                        max_width: 120,
                    }
                }
            },

            aside: rsx! {
                Aside {
                    width: "lg".to_string(),
                    variant: "light".to_string(),
                    initial_open: *is_drawer_open.read(),
                    on_close: move |_| is_drawer_open.set(false),
                    footer: rsx! {
                        AsideFooter {}
                    },

                    Sidebar { current_route: current_route.clone() }
                }
            },

            div { class: ClassesBuilder::new().add(Padding::P4).build(),
                BreadcrumbNav { current_route, lang }
            }

            {children}
        }
    }
}

#[component]
fn BreadcrumbNav(current_route: Route, lang: String) -> Element {
    let breadcrumb_items = get_breadcrumb_items(&current_route, &lang);

    rsx! {
        nav {
            class: ClassesBuilder::new()
                .add(Display::Flex)
                .add(AlignItems::Center)
                .add(Gap::Gap2)
                .build(),

            Link {
                to: Route::LangHome { lang: lang.clone() },
                class: ClassesBuilder::new()
                    .add_raw("hi-text-secondary")
                    .add_raw("hi-transition-colors")
                    .add_raw("hi-duration-150")
                    .add(Display::Flex)
                    .add(AlignItems::Center)
                    .build(),
                div { "Home" }
            }

            for (i, item) in breadcrumb_items.iter().enumerate() {
                div { class: ClassesBuilder::new().add_raw("hi-text-muted").build(),
                    "/"
                }

                if i == breadcrumb_items.len() - 1 {
                    span { class: ClassesBuilder::new().add_raw("hi-text-primary").add(FontWeight::Medium).build(),
                        "{item.label}"
                    }
                } else if let Some(route) = &item.route {
                    Link {
                        to: route.clone(),
                        class: ClassesBuilder::new()
                            .add_raw("hi-text-secondary")
                            .add_raw("hi-transition-colors")
                            .add_raw("hi-duration-150")
                            .build(),
                        "{item.label}"
                    }
                } else {
                    span { class: ClassesBuilder::new().add_raw("hi-text-muted").build(),
                        "{item.label}"
                    }
                }
            }
        }
    }
}

struct BreadcrumbItem {
    label: String,
    route: Option<Route>,
}

fn get_breadcrumb_items(route: &Route, lang: &str) -> Vec<BreadcrumbItem> {
    match route {
        Route::LangHome { .. } => vec![BreadcrumbItem {
            label: "Home".to_string(),
            route: None,
        }],

        Route::ComponentsOverview { .. } => vec![
            BreadcrumbItem {
                label: "Components".to_string(),
                route: Some(Route::ComponentsOverview {
                    lang: lang.to_string(),
                }),
            },
            BreadcrumbItem {
                label: "Overview".to_string(),
                route: None,
            },
        ],

        Route::Button { .. }
        | Route::Layer1Form { .. }
        | Route::Layer1Switch { .. }
        | Route::Layer1Feedback { .. }
        | Route::Layer1Display { .. }
        | Route::NumberInput { .. }
        | Route::Search { .. }
        | Route::Avatar { .. }
        | Route::Image { .. }
        | Route::Tag { .. }
        | Route::Empty { .. }
        | Route::Comment { .. }
        | Route::DescriptionList { .. } => vec![
            BreadcrumbItem {
                label: "Components".to_string(),
                route: Some(Route::ComponentsOverview {
                    lang: lang.to_string(),
                }),
            },
            BreadcrumbItem {
                label: "Layer 1".to_string(),
                route: None,
            },
        ],

        Route::Layer2Overview { .. }
        | Route::Layer2Navigation { .. }
        | Route::Layer2Data { .. }
        | Route::Layer2Form { .. }
        | Route::Layer2Feedback { .. }
        | Route::Cascader { .. }
        | Route::Transfer { .. }
        | Route::Collapsible { .. }
        | Route::Timeline { .. }
        | Route::Table { .. }
        | Route::Tree { .. }
        | Route::Pagination { .. }
        | Route::QRCode { .. } => vec![
            BreadcrumbItem {
                label: "Components".to_string(),
                route: Some(Route::ComponentsOverview {
                    lang: lang.to_string(),
                }),
            },
            BreadcrumbItem {
                label: "Layer 2".to_string(),
                route: None,
            },
        ],

        Route::Layer3Overview { .. }
        | Route::Layer3Media { .. }
        | Route::Layer3Editor { .. }
        | Route::Layer3Visualization { .. }
        | Route::UserGuide { .. }
        | Route::ZoomControls { .. } => vec![
            BreadcrumbItem {
                label: "Components".to_string(),
                route: Some(Route::ComponentsOverview {
                    lang: lang.to_string(),
                }),
            },
            BreadcrumbItem {
                label: "Layer 3".to_string(),
                route: None,
            },
        ],

        Route::SystemOverview { .. } => vec![
            BreadcrumbItem {
                label: "System".to_string(),
                route: Some(Route::SystemOverview {
                    lang: lang.to_string(),
                }),
            },
            BreadcrumbItem {
                label: "Overview".to_string(),
                route: None,
            },
        ],

        Route::SystemCSS { .. } => vec![
            BreadcrumbItem {
                label: "System".to_string(),
                route: Some(Route::SystemOverview {
                    lang: lang.to_string(),
                }),
            },
            BreadcrumbItem {
                label: "CSS".to_string(),
                route: None,
            },
        ],

        Route::SystemIcons { .. } => vec![
            BreadcrumbItem {
                label: "System".to_string(),
                route: Some(Route::SystemOverview {
                    lang: lang.to_string(),
                }),
            },
            BreadcrumbItem {
                label: "Icons".to_string(),
                route: None,
            },
        ],

        Route::SystemPalette { .. } => vec![
            BreadcrumbItem {
                label: "System".to_string(),
                route: Some(Route::SystemOverview {
                    lang: lang.to_string(),
                }),
            },
            BreadcrumbItem {
                label: "Palette".to_string(),
                route: None,
            },
        ],

        Route::SystemAnimations { .. } => vec![
            BreadcrumbItem {
                label: "System".to_string(),
                route: Some(Route::SystemOverview {
                    lang: lang.to_string(),
                }),
            },
            BreadcrumbItem {
                label: "Animations".to_string(),
                route: None,
            },
        ],

        Route::AnimationDemo { .. } => vec![
            BreadcrumbItem {
                label: "System".to_string(),
                route: Some(Route::SystemOverview {
                    lang: lang.to_string(),
                }),
            },
            BreadcrumbItem {
                label: "Animation Demo".to_string(),
                route: None,
            },
        ],

        Route::SystemI18n { .. } => vec![
            BreadcrumbItem {
                label: "System".to_string(),
                route: Some(Route::SystemOverview {
                    lang: lang.to_string(),
                }),
            },
            BreadcrumbItem {
                label: "I18n".to_string(),
                route: None,
            },
        ],

        Route::DemosOverview { .. } => vec![
            BreadcrumbItem {
                label: "Demos".to_string(),
                route: Some(Route::DemosOverview {
                    lang: lang.to_string(),
                }),
            },
            BreadcrumbItem {
                label: "Overview".to_string(),
                route: None,
            },
        ],

        Route::FormDemo { .. } => vec![
            BreadcrumbItem {
                label: "Demos".to_string(),
                route: Some(Route::DemosOverview {
                    lang: lang.to_string(),
                }),
            },
            BreadcrumbItem {
                label: "Form Demo".to_string(),
                route: None,
            },
        ],

        Route::DashboardDemo { .. } => vec![
            BreadcrumbItem {
                label: "Demos".to_string(),
                route: Some(Route::DemosOverview {
                    lang: lang.to_string(),
                }),
            },
            BreadcrumbItem {
                label: "Dashboard Demo".to_string(),
                route: None,
            },
        ],

        Route::VideoDemo { .. } => vec![
            BreadcrumbItem {
                label: "Demos".to_string(),
                route: Some(Route::DemosOverview {
                    lang: lang.to_string(),
                }),
            },
            BreadcrumbItem {
                label: "Video Demo".to_string(),
                route: None,
            },
        ],

        _ => vec![],
    }
}
