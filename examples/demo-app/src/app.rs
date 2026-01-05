// demo-app/src/app.rs
// Main application component with new routing structure

use dioxus::prelude::*;
use dioxus_router::components::Router;

use crate::components::*;

/// Main application routes
#[derive(Clone, Routable, Debug, PartialEq)]
pub enum Route {
    // Home
    #[route("/")]
    Home {},

    // Components Routes
    #[route("/components")]
    ComponentsOverview {},

    #[route("/components/basic")]
    ComponentsBasic {},
    #[route("/components/feedback")]
    ComponentsFeedback {},
    #[route("/components/navigation")]
    ComponentsNavigation {},
    #[route("/components/data")]
    ComponentsData {},

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

    // Demos Routes
    #[route("/demos")]
    DemosOverview {},
}

// ============================================================
// Route Handler Functions
// ============================================================

#[allow(non_snake_case)]
fn Home() -> Element {
    rsx! {
        Layout {
            current_route: Route::Home {},
            crate::pages::home::Home {}
        }
    }
}

#[allow(non_snake_case)]
fn ComponentsOverview() -> Element {
    rsx! {
        Layout {
            current_route: Route::ComponentsOverview {},
            crate::pages::components::ComponentsOverview {}
        }
    }
}

macro_rules! component_page {
    ($name:ident) => {
        #[allow(non_snake_case)]
        fn $name() -> Element {
            rsx! {
                Layout {
                    current_route: Route::$name {},
                    crate::pages::components::$name {}
                }
            }
        }
    };
}

component_page!(ComponentsBasic);
component_page!(ComponentsFeedback);
component_page!(ComponentsNavigation);
component_page!(ComponentsData);

macro_rules! system_page {
    ($name:ident) => {
        #[allow(non_snake_case)]
        fn $name() -> Element {
            rsx! {
                Layout {
                    current_route: Route::$name {},
                    crate::pages::system::$name {}
                }
            }
        }
    };
}

system_page!(SystemOverview);
system_page!(SystemCSS);
system_page!(SystemIcons);
system_page!(SystemPalette);
system_page!(SystemAnimations);

#[allow(non_snake_case)]
fn DemosOverview() -> Element {
    rsx! {
        Layout {
            current_route: Route::DemosOverview {},
            crate::pages::demos::DemosOverview {}
        }
    }
}

/// Main App component
#[allow(non_snake_case)]
pub fn App() -> Element {
    rsx! {
        Router::<Route> {}
    }
}
