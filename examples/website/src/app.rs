// website/src/app.rs
// Main application component with new routing structure

use dioxus::prelude::*;
use dioxus_router::{Routable, Router};

use crate::hooks::{I18nProviderWrapper, LanguageContext};
use _components::{PortalProvider, ThemeProvider};
use _i18n::context::Language;

#[component]
pub fn App() -> Element {
    let language = use_signal(|| Language::default_lang());
    let _lang_ctx = use_context_provider(|| LanguageContext { language });

    rsx! {
        I18nProviderWrapper {
            ThemeProvider { palette: "hikari".to_string(),
                PortalProvider {
                    Router::<Route> {}
                }
            }
        }
    }
}

#[derive(Clone, Debug, PartialEq, Routable)]
pub enum Route {
    #[route("/")]
    RootRedirect {},

    #[route("/:lang")]
    LangHome { lang: String },

    #[route("/:lang/components")]
    ComponentsOverview { lang: String },

    #[route("/:lang/demos/animation")]
    AnimationDemo { lang: String },

    #[route("/:lang/demos")]
    DemosOverview { lang: String },
    #[route("/:lang/demos/layer1/form")]
    FormDemo { lang: String },
    #[route("/:lang/demos/layer2/dashboard")]
    DashboardDemo { lang: String },
    #[route("/:lang/demos/layer3/video")]
    VideoDemo { lang: String },

    #[route("/:lang/components/layer1/button")]
    Button { lang: String },
    #[route("/:lang/components/layer1/form")]
    Layer1Form { lang: String },
    #[route("/:lang/components/layer1/switch")]
    Layer1Switch { lang: String },
    #[route("/:lang/components/layer1/feedback")]
    Layer1Feedback { lang: String },
    #[route("/:lang/components/layer1/display")]
    Layer1Display { lang: String },
    #[route("/:lang/components/layer1/number_input")]
    NumberInput { lang: String },
    #[route("/:lang/components/layer1/search")]
    Search { lang: String },
    #[route("/:lang/components/layer1/avatar")]
    Avatar { lang: String },
    #[route("/:lang/components/layer1/image")]
    Image { lang: String },
    #[route("/:lang/components/layer1/tag")]
    Tag { lang: String },
    #[route("/:lang/components/layer1/empty")]
    Empty { lang: String },
    #[route("/:lang/components/layer1/comment")]
    Comment { lang: String },

    #[route("/:lang/components/layer2")]
    Layer2Overview { lang: String },
    #[route("/:lang/components/layer2/navigation")]
    Layer2Navigation { lang: String },
    #[route("/:lang/components/layer2/data")]
    Layer2Data { lang: String },
    #[route("/:lang/components/layer2/form")]
    Layer2Form { lang: String },
    #[route("/:lang/components/layer2/feedback")]
    Layer2Feedback { lang: String },
    #[route("/:lang/components/layer2/cascader")]
    Cascader { lang: String },
    #[route("/:lang/components/layer2/transfer")]
    Transfer { lang: String },
    #[route("/:lang/components/layer2/collapsible")]
    Collapsible { lang: String },
    #[route("/:lang/components/layer2/timeline")]
    Timeline { lang: String },
    #[route("/:lang/components/layer2/table")]
    Table { lang: String },
    #[route("/:lang/components/layer2/tree")]
    Tree { lang: String },
    #[route("/:lang/components/layer2/pagination")]
    Pagination { lang: String },
    #[route("/:lang/components/layer2/qrcode")]
    QRCode { lang: String },

    #[route("/:lang/components/layer3/overview")]
    Layer3Overview { lang: String },
    #[route("/:lang/components/layer3/media")]
    Layer3Media { lang: String },
    #[route("/:lang/components/layer3/editor")]
    Layer3Editor { lang: String },
    #[route("/:lang/components/layer3/visualization")]
    Layer3Visualization { lang: String },
    #[route("/:lang/components/layer3/user_guide")]
    UserGuide { lang: String },
    #[route("/:lang/components/layer3/zoom_controls")]
    ZoomControls { lang: String },

    #[route("/:lang/system")]
    SystemOverview { lang: String },
    #[route("/:lang/system/css")]
    SystemCSS { lang: String },
    #[route("/:lang/system/icons")]
    SystemIcons { lang: String },
    #[route("/:lang/system/palette")]
    SystemPalette { lang: String },
    #[route("/:lang/system/animations")]
    SystemAnimations { lang: String },
    #[route("/:lang/system/i18n")]
    SystemI18n { lang: String },

    #[route("/:lang/..")]
    NotFound { lang: String },

    #[route("/..")]
    LegacyRedirect { path: Vec<String> },
}

// ============================================================
// Route Handler Functions
// ============================================================

fn parse_lang(lang: &str) -> Language {
    Language::from_url_prefix(lang).unwrap_or_else(Language::default_lang)
}

#[component]
fn RootRedirect() -> Element {
    let navigator = use_navigator();
    let default_lang = Language::default_lang().url_prefix();
    navigator.replace(Route::LangHome {
        lang: default_lang.to_string(),
    });
    rsx! {}
}

#[component]
fn LegacyRedirect(path: Vec<String>) -> Element {
    let navigator = use_navigator();
    let default_lang = Language::default_lang().url_prefix();
    let new_path = format!("/{}", default_lang);
    if path.is_empty() {
        navigator.replace(Route::LangHome {
            lang: default_lang.to_string(),
        });
    } else {
        navigator.replace(Route::NotFound {
            lang: default_lang.to_string(),
        });
    }
    rsx! {}
}

#[component]
fn LangHome(lang: String) -> Element {
    crate::hooks::use_update_language_from_route(&lang);
    rsx! {
        crate::pages::home::Home {}
    }
}

#[component]
fn ComponentsOverview(lang: String) -> Element {
    crate::hooks::use_update_language_from_route(&lang);
    rsx! {
        crate::pages::components::overview::ComponentsOverview {}
    }
}

#[component]
fn AnimationDemo(lang: String) -> Element {
    crate::hooks::use_update_language_from_route(&lang);
    rsx! {
        crate::pages::animation_demo::AnimationDemo {}
    }
}

#[component]
fn DemosOverview(lang: String) -> Element {
    crate::hooks::use_update_language_from_route(&lang);
    rsx! {
        crate::pages::demos::DemosOverview {}
    }
}

#[component]
fn SystemOverview(lang: String) -> Element {
    crate::hooks::use_update_language_from_route(&lang);
    rsx! {
        crate::components::DynamicDocPage {
            current_route: Route::SystemOverview { lang: lang.clone() },
            doc_path: "system/overview",
        }
    }
}

#[component]
fn SystemCSS(lang: String) -> Element {
    crate::hooks::use_update_language_from_route(&lang);
    rsx! {
        crate::components::DynamicDocPage {
            current_route: Route::SystemCSS { lang: lang.clone() },
            doc_path: "system/css",
        }
    }
}

#[component]
fn SystemIcons(lang: String) -> Element {
    crate::hooks::use_update_language_from_route(&lang);
    rsx! {
        crate::components::DynamicDocPage {
            current_route: Route::SystemIcons { lang: lang.clone() },
            doc_path: "system/icons",
        }
    }
}

#[component]
fn SystemPalette(lang: String) -> Element {
    crate::hooks::use_update_language_from_route(&lang);
    rsx! {
        crate::components::DynamicDocPage {
            current_route: Route::SystemPalette { lang: lang.clone() },
            doc_path: "system/palette",
        }
    }
}

#[component]
fn SystemAnimations(lang: String) -> Element {
    crate::hooks::use_update_language_from_route(&lang);
    rsx! {
        crate::components::DynamicDocPage {
            current_route: Route::SystemAnimations { lang: lang.clone() },
            doc_path: "system/animation",
        }
    }
}

#[component]
fn FormDemo(lang: String) -> Element {
    crate::hooks::use_update_language_from_route(&lang);
    rsx! {
        crate::pages::demos::layer1::form_demo::FormDemo {}
    }
}

#[component]
fn DashboardDemo(lang: String) -> Element {
    crate::hooks::use_update_language_from_route(&lang);
    rsx! {
        crate::pages::demos::layer2::dashboard_demo::DashboardDemo {}
    }
}

#[component]
fn VideoDemo(lang: String) -> Element {
    crate::hooks::use_update_language_from_route(&lang);
    rsx! {
        crate::pages::demos::layer3::video_demo::VideoDemo {}
    }
}

// Layer 1 handlers
#[component]
fn Button(lang: String) -> Element {
    crate::hooks::use_update_language_from_route(&lang);
    rsx! {
        crate::components::DynamicDocPage {
            current_route: Route::Button { lang: lang.clone() },
            doc_path: "components/layer1/button",
        }
    }
}

#[component]
fn Layer1Form(lang: String) -> Element {
    crate::hooks::use_update_language_from_route(&lang);
    rsx! {
        crate::components::DynamicDocPage {
            current_route: Route::Layer1Form { lang: lang.clone() },
            doc_path: "components/layer1/form",
        }
    }
}

#[component]
fn Layer1Switch(lang: String) -> Element {
    crate::hooks::use_update_language_from_route(&lang);
    rsx! {
        crate::components::DynamicDocPage {
            current_route: Route::Layer1Switch { lang: lang.clone() },
            doc_path: "components/layer1/switch",
        }
    }
}

#[component]
fn Layer1Feedback(lang: String) -> Element {
    crate::hooks::use_update_language_from_route(&lang);
    rsx! {
        crate::components::DynamicDocPage {
            current_route: Route::Layer1Feedback { lang: lang.clone() },
            doc_path: "components/layer1/feedback",
        }
    }
}

#[component]
fn Layer1Display(lang: String) -> Element {
    crate::hooks::use_update_language_from_route(&lang);
    rsx! {
        crate::components::DynamicDocPage {
            current_route: Route::Layer1Display { lang: lang.clone() },
            doc_path: "components/layer1/display",
        }
    }
}

#[component]
fn NumberInput(lang: String) -> Element {
    crate::hooks::use_update_language_from_route(&lang);
    rsx! {
        crate::components::DynamicDocPage {
            current_route: Route::NumberInput { lang: lang.clone() },
            doc_path: "components/layer1/number_input",
        }
    }
}

#[component]
fn Search(lang: String) -> Element {
    crate::hooks::use_update_language_from_route(&lang);
    rsx! {
        crate::components::DynamicDocPage {
            current_route: Route::Search { lang: lang.clone() },
            doc_path: "components/layer1/search",
        }
    }
}

#[component]
fn Avatar(lang: String) -> Element {
    crate::hooks::use_update_language_from_route(&lang);
    rsx! {
        crate::components::DynamicDocPage {
            current_route: Route::Avatar { lang: lang.clone() },
            doc_path: "components/layer1/avatar",
        }
    }
}

#[component]
fn Image(lang: String) -> Element {
    crate::hooks::use_update_language_from_route(&lang);
    rsx! {
        crate::components::DynamicDocPage {
            current_route: Route::Image { lang: lang.clone() },
            doc_path: "components/layer1/image",
        }
    }
}

#[component]
fn Tag(lang: String) -> Element {
    crate::hooks::use_update_language_from_route(&lang);
    rsx! {
        crate::components::DynamicDocPage {
            current_route: Route::Tag { lang: lang.clone() },
            doc_path: "components/layer1/tag",
        }
    }
}

#[component]
fn Empty(lang: String) -> Element {
    crate::hooks::use_update_language_from_route(&lang);
    rsx! {
        crate::components::DynamicDocPage {
            current_route: Route::Empty { lang: lang.clone() },
            doc_path: "components/layer1/empty",
        }
    }
}

#[component]
fn QRCode(lang: String) -> Element {
    crate::hooks::use_update_language_from_route(&lang);
    rsx! {
        crate::components::DynamicDocPage {
            current_route: Route::QRCode { lang: lang.clone() },
            doc_path: "components/layer2/qrcode",
        }
    }
}

#[component]
fn Comment(lang: String) -> Element {
    crate::hooks::use_update_language_from_route(&lang);
    rsx! {
        crate::components::DynamicDocPage {
            current_route: Route::Comment { lang: lang.clone() },
            doc_path: "components/layer1/comment",
        }
    }
}

// Layer 2 handlers
#[component]
fn Layer2Overview(lang: String) -> Element {
    crate::hooks::use_update_language_from_route(&lang);
    rsx! {
        crate::pages::components::layer2::Layer2Overview {}
    }
}

#[component]
fn Layer2Navigation(lang: String) -> Element {
    crate::hooks::use_update_language_from_route(&lang);
    rsx! {
        crate::components::DynamicDocPage {
            current_route: Route::Layer2Navigation { lang: lang.clone() },
            doc_path: "components/layer2/navigation",
        }
    }
}

#[component]
fn Layer2Data(lang: String) -> Element {
    crate::hooks::use_update_language_from_route(&lang);
    rsx! {
        crate::components::DynamicDocPage {
            current_route: Route::Layer2Data { lang: lang.clone() },
            doc_path: "components/layer2/data",
        }
    }
}

#[component]
fn Layer2Form(lang: String) -> Element {
    crate::hooks::use_update_language_from_route(&lang);
    rsx! {
        crate::components::DynamicDocPage {
            current_route: Route::Layer2Form { lang: lang.clone() },
            doc_path: "components/layer2/form",
        }
    }
}

#[component]
fn Layer2Feedback(lang: String) -> Element {
    crate::hooks::use_update_language_from_route(&lang);
    rsx! {
        crate::components::DynamicDocPage {
            current_route: Route::Layer2Feedback { lang: lang.clone() },
            doc_path: "components/layer2/feedback",
        }
    }
}

#[component]
fn Cascader(lang: String) -> Element {
    crate::hooks::use_update_language_from_route(&lang);
    rsx! {
        crate::components::DynamicDocPage {
            current_route: Route::Cascader { lang: lang.clone() },
            doc_path: "components/layer2/cascader",
        }
    }
}

#[component]
fn Transfer(lang: String) -> Element {
    crate::hooks::use_update_language_from_route(&lang);
    rsx! {
        crate::components::DynamicDocPage {
            current_route: Route::Transfer { lang: lang.clone() },
            doc_path: "components/layer2/transfer",
        }
    }
}

#[component]
fn Collapsible(lang: String) -> Element {
    crate::hooks::use_update_language_from_route(&lang);
    rsx! {
        crate::components::DynamicDocPage {
            current_route: Route::Collapsible { lang: lang.clone() },
            doc_path: "components/layer2/collapsible",
        }
    }
}

#[component]
fn Timeline(lang: String) -> Element {
    crate::hooks::use_update_language_from_route(&lang);
    rsx! {
        crate::components::DynamicDocPage {
            current_route: Route::Timeline { lang: lang.clone() },
            doc_path: "components/layer2/timeline",
        }
    }
}

#[component]
fn Table(lang: String) -> Element {
    crate::hooks::use_update_language_from_route(&lang);
    rsx! {
        crate::components::DynamicDocPage {
            current_route: Route::Table { lang: lang.clone() },
            doc_path: "components/layer2/table",
        }
    }
}

#[component]
fn Tree(lang: String) -> Element {
    crate::hooks::use_update_language_from_route(&lang);
    rsx! {
        crate::components::DynamicDocPage {
            current_route: Route::Tree { lang: lang.clone() },
            doc_path: "components/layer2/tree",
        }
    }
}

#[component]
fn Pagination(lang: String) -> Element {
    crate::hooks::use_update_language_from_route(&lang);
    rsx! {
        crate::components::DynamicDocPage {
            current_route: Route::Pagination { lang: lang.clone() },
            doc_path: "components/layer2/pagination",
        }
    }
}

// Layer 3 handlers
#[component]
fn Layer3Overview(lang: String) -> Element {
    crate::hooks::use_update_language_from_route(&lang);
    rsx! {
        crate::pages::components::layer3::Layer3Overview {}
    }
}

#[component]
fn Layer3Media(lang: String) -> Element {
    crate::hooks::use_update_language_from_route(&lang);
    rsx! {
        crate::components::DynamicDocPage {
            current_route: Route::Layer3Media { lang: lang.clone() },
            doc_path: "components/layer3/media",
        }
    }
}

#[component]
fn Layer3Editor(lang: String) -> Element {
    crate::hooks::use_update_language_from_route(&lang);
    rsx! {
        crate::components::DynamicDocPage {
            current_route: Route::Layer3Editor { lang: lang.clone() },
            doc_path: "components/layer3/editor",
        }
    }
}

#[component]
fn Layer3Visualization(lang: String) -> Element {
    crate::hooks::use_update_language_from_route(&lang);
    rsx! {
        crate::components::DynamicDocPage {
            current_route: Route::Layer3Visualization { lang: lang.clone() },
            doc_path: "components/layer3/visualization",
        }
    }
}

#[component]
fn UserGuide(lang: String) -> Element {
    crate::hooks::use_update_language_from_route(&lang);
    rsx! {
        crate::components::DynamicDocPage {
            current_route: Route::UserGuide { lang: lang.clone() },
            doc_path: "components/layer3/user_guide",
        }
    }
}

#[component]
fn ZoomControls(lang: String) -> Element {
    crate::hooks::use_update_language_from_route(&lang);
    rsx! {
        crate::components::DynamicDocPage {
            current_route: Route::ZoomControls { lang: lang.clone() },
            doc_path: "components/layer3/zoom_controls",
        }
    }
}

#[component]
fn SystemI18n(lang: String) -> Element {
    crate::hooks::use_update_language_from_route(&lang);
    rsx! {
        crate::components::DynamicDocPage {
            current_route: Route::SystemI18n { lang: lang.clone() },
            doc_path: "system/i18n",
        }
    }
}

#[component]
fn NotFound(lang: String) -> Element {
    crate::hooks::use_update_language_from_route(&lang);
    rsx! {
        crate::components::Layout {
            current_route: Route::NotFound { lang: lang.clone() },
            div {
                style: "padding: 2rem; text-align: center;",
                h2 { "404 - Page Not Found" }
                p { "The page you are looking for does not exist." }
            }
        }
    }
}
