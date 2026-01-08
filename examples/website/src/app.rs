// website/src/app.rs
// Main application component with new routing structure

use dioxus::prelude::*;
use dioxus_router::components::Router;

// Import scrollbar system
use _components::scripts::scrollbar_container;
// Import ThemeProvider
use _components::ThemeProvider;

/// Main application routes
#[derive(Clone, Routable, Debug, PartialEq)]
pub enum Route {
    // Home
    #[route("/")]
    Home {},

    // Components Routes - Overview
    #[route("/components")]
    ComponentsOverview {},

    // Layout Components
    #[route("/components/layout")]
    ComponentsLayout {},
    #[route("/components/layout/container")]
    LayoutContainer {},
    #[route("/components/layout/grid")]
    LayoutGrid {},
    #[route("/components/layout/section")]
    LayoutSection {},

    // Basic Components
    #[route("/components/basic")]
    ComponentsBasic {},
    #[route("/components/basic/button")]
    BasicButton {},
    #[route("/components/basic/input")]
    BasicInput {},
    #[route("/components/basic/card")]
    BasicCard {},
    #[route("/components/basic/badge")]
    BasicBadge {},

    // Feedback Components
    #[route("/components/feedback")]
    ComponentsFeedback {},
    #[route("/components/feedback/alert")]
    FeedbackAlert {},
    #[route("/components/feedback/toast")]
    FeedbackToast {},
    #[route("/components/feedback/tooltip")]
    FeedbackTooltip {},

    // Navigation Components
    #[route("/components/navigation")]
    ComponentsNavigation {},
    #[route("/components/navigation/menu")]
    NavigationMenu {},
    #[route("/components/navigation/tabs")]
    NavigationTabs {},
    #[route("/components/navigation/breadcrumb")]
    NavigationBreadcrumb {},

    // Data Components
    #[route("/components/data")]
    ComponentsData {},
    #[route("/components/data/table")]
    DataTable {},
    #[route("/components/data/tree")]
    DataTree {},
    #[route("/components/data/pagination")]
    DataPagination {},

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
fn ComponentsBasic() -> Element {
    rsx! {
        crate::pages::components::basic::ComponentsBasic {}
    }
}

#[allow(non_snake_case)]
fn ComponentsFeedback() -> Element {
    rsx! {
        crate::pages::components::feedback::ComponentsFeedback {}
    }
}

#[allow(non_snake_case)]
fn ComponentsNavigation() -> Element {
    rsx! {
        crate::pages::components::navigation::ComponentsNavigation {}
    }
}

#[allow(non_snake_case)]
fn ComponentsData() -> Element {
    rsx! {
        crate::pages::components::data::ComponentsData {}
    }
}

// Layout component pages
#[allow(non_snake_case)]
fn ComponentsLayout() -> Element {
    rsx! {
        crate::pages::components::layout::ComponentsLayout {}
    }
}

#[allow(non_snake_case)]
fn LayoutContainer() -> Element {
    rsx! {
        crate::pages::components::layout::ComponentsLayout {}
    }
}

#[allow(non_snake_case)]
fn LayoutGrid() -> Element {
    rsx! {
        crate::pages::components::layout::ComponentsLayout {}
    }
}

#[allow(non_snake_case)]
fn LayoutSection() -> Element {
    rsx! {
        crate::pages::components::layout::ComponentsLayout {}
    }
}

// Basic component pages
#[allow(non_snake_case)]
fn BasicButton() -> Element {
    rsx! {
        crate::pages::components::button::ComponentsButton {}
    }
}

#[allow(non_snake_case)]
fn BasicInput() -> Element {
    rsx! {
        crate::pages::components::input::ComponentsInput {}
    }
}

#[allow(non_snake_case)]
fn BasicCard() -> Element {
    rsx! {
        crate::pages::components::card::ComponentsCard {}
    }
}

#[allow(non_snake_case)]
fn BasicBadge() -> Element {
    rsx! {
        crate::pages::components::badge::ComponentsBadge {}
    }
}

// Feedback component pages
#[allow(non_snake_case)]
fn FeedbackAlert() -> Element {
    rsx! {
        crate::pages::components::alert::ComponentsAlert {}
    }
}

#[allow(non_snake_case)]
fn FeedbackToast() -> Element {
    rsx! {
        crate::pages::components::toast::ComponentsToast {}
    }
}

#[allow(non_snake_case)]
fn FeedbackTooltip() -> Element {
    rsx! {
        crate::pages::components::tooltip::ComponentsTooltip {}
    }
}

// Navigation component pages
#[allow(non_snake_case)]
fn NavigationMenu() -> Element {
    rsx! {
        crate::pages::components::menu::ComponentsMenu {}
    }
}

#[allow(non_snake_case)]
fn NavigationTabs() -> Element {
    rsx! {
        crate::pages::components::tabs::ComponentsTabs {}
    }
}

#[allow(non_snake_case)]
fn NavigationBreadcrumb() -> Element {
    rsx! {
        crate::pages::components::breadcrumb::ComponentsBreadcrumb {}
    }
}

// Data component pages (placeholder for now)
#[allow(non_snake_case)]
fn DataTable() -> Element {
    rsx! {
        crate::pages::components::data::ComponentsData {}
    }
}

#[allow(non_snake_case)]
fn DataTree() -> Element {
    rsx! {
        crate::pages::components::data::ComponentsData {}
    }
}

#[allow(non_snake_case)]
fn DataPagination() -> Element {
    rsx! {
        crate::pages::components::data::ComponentsData {}
    }
}

macro_rules! system_page {
    ($name:ident) => {
        #[allow(non_snake_case)]
        fn $name() -> Element {
            rsx! {
                crate::pages::system::$name {}
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
        crate::pages::demos::DemosOverview {}
    }
}

/// Main App component
#[allow(non_snake_case)]
pub fn App() -> Element {
    // Theme state (default to hikari light theme)
    let mut theme = use_signal(|| "hikari".to_string());

    // Provide theme context to all children
    use_context_provider(|| ThemeContext {
        theme: theme.clone(),
    });

    // Initialize custom scrollbars on mount
    use_effect(move || {
        // Initialize custom DOM-based scrollbars for all containers
        // This provides smooth 6px → 10px width animation on hover
        // And intelligent expansion during drag and scroll
        scrollbar_container::init_all();
    });

    rsx! {
        ThemeProvider {
            palette: "{theme.read()}",
            Router::<Route> {}
        }
    }
}

/// Theme context for accessing and updating theme state
#[derive(Clone, Debug)]
pub struct ThemeContext {
    pub theme: Signal<String>,
}

