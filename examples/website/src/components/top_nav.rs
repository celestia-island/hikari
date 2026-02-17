// website/src/components/top_nav.rs
// Top navigation bar using Hikari Tabs component

use dioxus::prelude::*;

use crate::app::Route;
use crate::hooks::use_language;
use _palette::classes::{
    AlignItems, ClassesBuilder, Display, FlexDirection, FontSize, FontWeight, Gap, JustifyContent,
    MarginBottom,
};

#[component]
pub fn TopNav(current_route: Route) -> Element {
    let lang_ctx = use_language();
    let lang = (*lang_ctx.language.read()).url_prefix().to_string();

    let mut active_tab = use_signal(|| match current_route {
        Route::LangHome { .. }
        | Route::ComponentsOverview { .. }
        | Route::Button { .. }
        | Route::Layer1Form { .. }
        | Route::Layer1Switch { .. }
        | Route::Layer1Feedback { .. }
        | Route::Layer1Display { .. }
        | Route::Layer2Overview { .. }
        | Route::Layer2Navigation { .. }
        | Route::Layer2Data { .. }
        | Route::Layer2Form { .. }
        | Route::Layer2Feedback { .. }
        | Route::Layer3Overview { .. }
        | Route::Layer3Media { .. }
        | Route::Layer3Editor { .. }
        | Route::Layer3Visualization { .. } => "0",

        Route::SystemOverview { .. }
        | Route::SystemCSS { .. }
        | Route::SystemIcons { .. }
        | Route::SystemPalette { .. }
        | Route::SystemAnimations { .. } => "1",

        Route::DemosOverview { .. }
        | Route::FormDemo { .. }
        | Route::DashboardDemo { .. }
        | Route::VideoDemo { .. } => "2",

        _ => "0",
    });

    rsx! {
        div {
            class: ClassesBuilder::new().add_raw("top-nav").build(),

            div {
                class: ClassesBuilder::new().add_raw("top-nav-header").add(Display::Flex).add(FlexDirection::Row).add(JustifyContent::Between).add(AlignItems::Center).add(MarginBottom::Mb3).build(),

                div {
                    class: ClassesBuilder::new().add_raw("top-nav-brand").add(Display::Flex).add(AlignItems::Center).add(Gap::Gap3).build(),

                    div {
                        class: ClassesBuilder::new().add_raw("top-nav-logo").build(),
                        span {
                            class: ClassesBuilder::new().add_raw("top-nav-logo-text").build(),
                            "H"
                        }
                    }

                    h1 {
                        class: ClassesBuilder::new().add_raw("top-nav-title").add(MarginBottom::Mb0).add(FontSize::Xl).add(FontWeight::Semibold).build(),
                        "Hikari UI"
                    }
                }

                a {
                    href: "https://github.com/celestia/hikari",
                    target: "_blank",
                    class: ClassesBuilder::new().add_raw("top-nav-github-link").build(),
                    "GitHub"
                }
            }

            div {
                class: ClassesBuilder::new().add_raw("top-nav-tabs").add(Display::InlineFlex).build(),

                dioxus_router::components::Link {
                    to: Route::ComponentsOverview { lang: lang.clone() },
                    class: ClassesBuilder::new()
                        .add_raw(if *active_tab.read() == "0" { "top-nav-tab-active" } else { "top-nav-tab" })
                        .build(),
                    onclick: move |_| { active_tab.set("0"); },
                    "组件"
                }

                dioxus_router::components::Link {
                    to: Route::SystemOverview { lang: lang.clone() },
                    class: ClassesBuilder::new()
                        .add_raw(if *active_tab.read() == "1" { "top-nav-tab-active" } else { "top-nav-tab" })
                        .build(),
                    onclick: move |_| { active_tab.set("1"); },
                    "系统"
                }

                dioxus_router::components::Link {
                    to: Route::DemosOverview { lang: lang.clone() },
                    class: ClassesBuilder::new()
                        .add_raw(if *active_tab.read() == "2" { "top-nav-tab-active" } else { "top-nav-tab" })
                        .build(),
                    onclick: move |_| { active_tab.set("2"); },
                    "案例"
                }
            }
        }
    }
}
