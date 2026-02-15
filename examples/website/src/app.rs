// website/src/app.rs
// Main application component with new routing structure

use dioxus::prelude::*;

use crate::hooks::I18nProviderWrapper;
use _components::{PortalProvider, ThemeProvider};
use _i18n::context::Language;

/// Main application component (root)
#[component]
pub fn App() -> Element {
    let mut language = use_signal(|| Language::English);

    rsx! {
        I18nProviderWrapper {
            language,
            ThemeProvider { palette: "hikari".to_string(),
                PortalProvider {
                    Router::<Route> {}
                }
            }
        }
    }
}

/// Main application routes
#[derive(Clone, Debug, PartialEq, Routable)]
pub enum Route {
    // Home
    #[route("/")]
    Home {},

    // Components Routes - Overview
    #[route("/components")]
    ComponentsOverview {},

    // Animation Demo
    #[route("/demos/animation")]
    AnimationDemo {},

    // Demos Routes
    #[route("/demos")]
    DemosOverview {},
    #[route("/demos/layer1/form")]
    FormDemo {},
    #[route("/demos/layer2/dashboard")]
    DashboardDemo {},
    #[route("/demos/layer3/video")]
    VideoDemo {},

    // Layer 1 Routes
    #[route("/components/layer1/button")]
    Button {},
    #[route("/components/layer1/form")]
    Layer1Form {},
    #[route("/components/layer1/switch")]
    Layer1Switch {},
    #[route("/components/layer1/feedback")]
    Layer1Feedback {},
    #[route("/components/layer1/display")]
    Layer1Display {},
    // Layer 1 - New component routes
    #[route("/components/layer1/number_input")]
    NumberInput {},
    #[route("/components/layer1/search")]
    Search {},
    #[route("/components/layer1/avatar")]
    Avatar {},
    #[route("/components/layer1/image")]
    Image {},
    #[route("/components/layer1/tag")]
    Tag {},
    #[route("/components/layer1/empty")]
    Empty {},
    #[route("/components/layer1/comment")]
    Comment {},
    #[route("/components/layer1/description_list")]
    DescriptionList {},

    // Layer 2 Routes
    #[route("/components/layer2")]
    Layer2Overview {},
    #[route("/components/layer2/navigation")]
    Layer2Navigation {},
    #[route("/components/layer2/data")]
    Layer2Data {},
    #[route("/components/layer2/form")]
    Layer2Form {},
    #[route("/components/layer2/feedback")]
    Layer2Feedback {},
    // Layer 2 - New component routes
    #[route("/components/layer2/cascader")]
    Cascader {},
    #[route("/components/layer2/transfer")]
    Transfer {},
    #[route("/components/layer2/collapsible")]
    Collapsible {},
    #[route("/components/layer2/timeline")]
    Timeline {},
    #[route("/components/layer2/table")]
    Table {},
    #[route("/components/layer2/tree")]
    Tree {},
    #[route("/components/layer2/pagination")]
    Pagination {},
    #[route("/components/layer2/qrcode")]
    QRCode {},

    // Layer 3 Routes
    #[route("/components/layer3/overview")]
    Layer3Overview {},
    #[route("/components/layer3/media")]
    Layer3Media {},
    #[route("/components/layer3/editor")]
    Layer3Editor {},
    #[route("/components/layer3/visualization")]
    Layer3Visualization {},
    // Layer 3 - New component routes
    #[route("/components/layer3/user_guide")]
    UserGuide {},
    #[route("/components/layer3/zoom_controls")]
    ZoomControls {},

    // System Routes
    #[route("/system")]
    SystemOverview {},
    #[route("/system/css")]
    SystemCSS {},
    #[route("/system/icons")]
    SystemIcons {},
    #[route("/system/palette")]
    SystemPalette {},
    #[route("/system/animations")]
    SystemAnimations {},
    #[route("/system/i18n")]
    SystemI18n {},
}

// ============================================================
// Route Handler Functions
// ============================================================

#[allow(non_snake_case)]
fn Home() -> Element {
    rsx! {
        crate::pages::home::Home {}
    }
}

#[allow(non_snake_case)]
fn ComponentsOverview() -> Element {
    rsx! {
        crate::pages::components::overview::ComponentsOverview {}
    }
}

#[allow(non_snake_case)]
fn AnimationDemo() -> Element {
    rsx! {
        crate::pages::animation_demo::AnimationDemo {}
    }
}

#[allow(non_snake_case)]
fn DemosOverview() -> Element {
    rsx! {
        crate::pages::demos::DemosOverview {}
    }
}

#[allow(non_snake_case)]
fn SystemOverview() -> Element {
    rsx! {
        crate::pages::system::SystemOverview {}
    }
}

#[allow(non_snake_case)]
fn SystemCSS() -> Element {
    rsx! {
        crate::pages::system::SystemCSS {}
    }
}

#[allow(non_snake_case)]
fn SystemIcons() -> Element {
    rsx! {
        crate::pages::system::SystemIcons {}
    }
}

#[allow(non_snake_case)]
fn SystemPalette() -> Element {
    rsx! {
        crate::pages::system::SystemPalette {}
    }
}

#[allow(non_snake_case)]
fn SystemAnimations() -> Element {
    rsx! {
        crate::pages::system::SystemAnimations {}
    }
}

#[allow(non_snake_case)]
fn FormDemo() -> Element {
    rsx! {
        crate::pages::demos::layer1::form_demo::FormDemo {}
    }
}

#[allow(non_snake_case)]
fn DashboardDemo() -> Element {
    rsx! {
        crate::pages::demos::layer2::dashboard_demo::DashboardDemo {}
    }
}

#[allow(non_snake_case)]
fn VideoDemo() -> Element {
    rsx! {
        crate::pages::demos::layer3::video_demo::VideoDemo {}
    }
}

// Layer 1 handlers
#[allow(non_snake_case)]
fn Button() -> Element {
    rsx! {
        crate::components::DynamicDocPage {
            current_route: Route::Button {},
            doc_path: "components/layer1/button",
        }
    }
}

#[allow(non_snake_case)]
fn Layer1Form() -> Element {
    rsx! {
        crate::pages::components::layer1::Layer1Form {}
    }
}

#[allow(non_snake_case)]
fn Layer1Switch() -> Element {
    rsx! {
        crate::pages::components::layer1::Layer1Switch {}
    }
}

#[allow(non_snake_case)]
fn Layer1Feedback() -> Element {
    rsx! {
        crate::pages::components::layer1::Layer1Feedback {}
    }
}

#[allow(non_snake_case)]
fn Layer1Display() -> Element {
    rsx! {
        crate::pages::components::layer1::Layer1Display {}
    }
}

#[allow(non_snake_case)]
fn NumberInput() -> Element {
    rsx! {
        crate::pages::components::layer1::NumberInput {}
    }
}

#[allow(non_snake_case)]
fn Search() -> Element {
    rsx! {
        crate::pages::components::layer1::Search {}
    }
}

#[allow(non_snake_case)]
fn Avatar() -> Element {
    rsx! {
        crate::pages::components::layer1::Avatar {}
    }
}

#[allow(non_snake_case)]
fn Image() -> Element {
    rsx! {
        crate::pages::components::layer1::Image {}
    }
}

#[allow(non_snake_case)]
fn Tag() -> Element {
    rsx! {
        crate::pages::components::layer1::Tag {}
    }
}

#[allow(non_snake_case)]
fn Empty() -> Element {
    rsx! {
        crate::pages::components::layer1::Empty {}
    }
}

#[allow(non_snake_case)]
fn QRCode() -> Element {
    rsx! {
        crate::pages::components::layer2::QRCode {}
    }
}

#[allow(non_snake_case)]
fn Comment() -> Element {
    rsx! {
        crate::pages::components::layer1::Comment {}
    }
}

#[allow(non_snake_case)]
fn DescriptionList() -> Element {
    rsx! {
        crate::pages::components::layer1::DescriptionList {}
    }
}

// Layer 2 handlers
#[allow(non_snake_case)]
fn Layer2Overview() -> Element {
    rsx! {
        crate::pages::components::layer2::Layer2Overview {}
    }
}

#[allow(non_snake_case)]
fn Layer2Navigation() -> Element {
    rsx! {
        crate::pages::components::layer2::Layer2Navigation {}
    }
}

#[allow(non_snake_case)]
fn Layer2Data() -> Element {
    rsx! {
        crate::pages::components::layer2::Layer2Data {}
    }
}

#[allow(non_snake_case)]
fn Layer2Form() -> Element {
    rsx! {
        crate::pages::components::layer2::Layer2Form {}
    }
}

#[allow(non_snake_case)]
fn Layer2Feedback() -> Element {
    rsx! {
        crate::pages::components::layer2::Layer2Feedback {}
    }
}

#[allow(non_snake_case)]
fn Cascader() -> Element {
    rsx! {
        crate::pages::components::layer2::Cascader {}
    }
}

#[allow(non_snake_case)]
fn Transfer() -> Element {
    rsx! {
        crate::pages::components::layer2::Transfer {}
    }
}

#[allow(non_snake_case)]
fn Collapsible() -> Element {
    rsx! {
        crate::pages::components::layer2::Collapsible {}
    }
}

#[allow(non_snake_case)]
fn Timeline() -> Element {
    rsx! {
        crate::pages::components::layer2::Timeline {}
    }
}

#[allow(non_snake_case)]
fn Table() -> Element {
    rsx! {
        crate::pages::components::layer2::Table {}
    }
}

#[allow(non_snake_case)]
fn Tree() -> Element {
    rsx! {
        crate::pages::components::layer2::Tree {}
    }
}

#[allow(non_snake_case)]
fn Pagination() -> Element {
    rsx! {
        crate::pages::components::layer2::Pagination {}
    }
}

// Layer 3 handlers
#[allow(non_snake_case)]
fn Layer3Overview() -> Element {
    rsx! {
        crate::pages::components::layer3::Layer3Overview {}
    }
}

#[allow(non_snake_case)]
fn Layer3Media() -> Element {
    rsx! {
        crate::pages::components::layer3::Layer3Media {}
    }
}

#[allow(non_snake_case)]
fn Layer3Editor() -> Element {
    rsx! {
        crate::pages::components::layer3::Layer3Editor {}
    }
}

#[allow(non_snake_case)]
fn Layer3Visualization() -> Element {
    rsx! {
        crate::pages::components::layer3::Layer3Visualization {}
    }
}

#[allow(non_snake_case)]
fn UserGuide() -> Element {
    rsx! {
        crate::pages::components::layer3::UserGuide {}
    }
}

#[allow(non_snake_case)]
fn ZoomControls() -> Element {
    rsx! {
        crate::pages::components::layer3::ZoomControls {}
    }
}

#[allow(non_snake_case)]
fn SystemI18n() -> Element {
    rsx! {
        crate::components::I18nDemo {}
    }
}
