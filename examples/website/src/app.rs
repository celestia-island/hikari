// website/src/app.rs
// Main application component with new routing structure

use dioxus::prelude::*;

use _components::{PortalProvider, ThemeProvider};

/// Main application component (root)
#[component]
pub fn App() -> Element {
    rsx! {
        ThemeProvider { palette: "hikari".to_string(),
            PortalProvider {
                Router::<Route> {}
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
    #[route("/components/layer1/basic")]
    Layer1Basic {},
    #[route("/components/layer1/form")]
    Layer1Form {},
    #[route("/components/layer1/switch")]
    Layer1Switch {},
    #[route("/components/layer1/feedback")]
    Layer1Feedback {},
    #[route("/components/layer1/display")]
    Layer1Display {},
    // Entry components
    #[route("/components/entry/cascader")]
    CascaderDoc {},
    #[route("/components/entry/transfer")]
    TransferDoc {},
    #[route("/components/entry/number_input")]
    NumberInputDoc {},
    #[route("/components/entry/search")]
    SearchDoc {},

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

    // Layer 3 Routes
    #[route("/components/layer3/overview")]
    Layer3Overview {},
    #[route("/components/layer3/media")]
    Layer3Media {},
    #[route("/components/layer3/editor")]
    Layer3Editor {},
    #[route("/components/layer3/visualization")]
    Layer3Visualization {},
    // Extra components
    #[route("/components/extra/collapsible")]
    CollapsibleDoc {},
    #[route("/components/extra/timeline")]
    TimelineDoc {},
    #[route("/components/extra/user_guide")]
    UserGuideDoc {},
    #[route("/components/extra/zoom_controls")]
    ZoomControlsDoc {},
    // Layer 3 Doc routes (temporarily disabled due to compilation issues)
    // #[route("/components/layer3/video_player")]
    // VideoPlayerDoc {},
    // #[route("/components/layer3/audio_waveform")]
    // AudioWaveformDoc {},
    // #[route("/components/layer3/rich_text_editor")]
    // RichTextEditorDoc {},
    // #[route("/components/layer3/drag_layer")]
    // DragLayerDoc {},

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
// NOTE: Page components already include Layout, so we just call them directly

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

#[allow(non_snake_case)]
fn Layer1Basic() -> Element {
    rsx! {
        crate::pages::components::layer1::Layer1Basic {}
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

// Layer 3 Doc routes (temporarily disabled)
// #[allow(non_snake_case)]
// fn VideoPlayerDoc() -> Element {
//     rsx! {
//         crate::pages::components::layer3::VideoPlayerDoc {}
//     }
// }
//
// #[allow(non_snake_case)]
// fn AudioWaveformDoc() -> Element {
//     rsx! {
//         crate::pages::components::layer3::AudioWaveformDoc {}
//     }
// }
//
// #[allow(non_snake_case)]
// fn RichTextEditorDoc() -> Element {
//     rsx! {
//         crate::pages::components::layer3::RichTextEditorDoc {}
//     }
// }
//
// #[allow(non_snake_case)]
// fn DragLayerDoc() -> Element {
//     rsx! {
//         crate::pages::components::layer3::DragLayerDoc {}
//     }
// }

// Entry components
#[allow(non_snake_case)]
fn CascaderDoc() -> Element {
    rsx! {
        crate::pages::components::entry::CascaderDoc {}
    }
}

#[allow(non_snake_case)]
fn TransferDoc() -> Element {
    rsx! {
        crate::pages::components::entry::TransferDoc {}
    }
}

#[allow(non_snake_case)]
fn NumberInputDoc() -> Element {
    rsx! {
        crate::pages::components::entry::NumberInputDoc {}
    }
}

#[allow(non_snake_case)]
fn SearchDoc() -> Element {
    rsx! {
        crate::pages::components::entry::SearchDoc {}
    }
}

// Extra components
#[allow(non_snake_case)]
fn CollapsibleDoc() -> Element {
    rsx! {
        crate::pages::components::extra::CollapsibleDoc {}
    }
}

#[allow(non_snake_case)]
fn TimelineDoc() -> Element {
    rsx! {
        crate::pages::components::extra::TimelineDoc {}
    }
}

#[allow(non_snake_case)]
fn UserGuideDoc() -> Element {
    rsx! {
        crate::pages::components::extra::UserGuideDoc {}
    }
}

#[allow(non_snake_case)]
fn ZoomControlsDoc() -> Element {
    rsx! {
        crate::pages::components::extra::ZoomControlsDoc {}
    }
}

#[allow(non_snake_case)]
fn SystemI18n() -> Element {
    rsx! {
        crate::components::I18nDemo {}
    }
}
