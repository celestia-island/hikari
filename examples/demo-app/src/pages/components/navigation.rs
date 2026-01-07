// demo-app/src/pages/components/navigation.rs
// Navigation components demonstration page with FUI styling

extern crate components as hikari_components;

use dioxus::prelude::*;
use components::{
    Tabs, TabPane, Menu, MenuItem, Breadcrumb, BreadcrumbItem,
    Button, ButtonVariant, ButtonSize, Card,
    layout::{Container, Grid, Row, Section}
};

use crate::{app::Route, components::Layout};

#[component]
pub fn ComponentsNavigation() -> Element {
    // Tab state management
    let mut active_tab = use_signal(|| "1".to_string());

    rsx! {
        Layout {
            current_route: Route::ComponentsNavigation {},

            // Page header using Container
            Container {
                class: "showcase-header",
                h1 {
                    class: "showcase-title",
                    "Navigation Components"
                }
                p {
                    class: "showcase-description",
                    "Navigation and routing components with FUI aesthetics"
                }
            }

            // Tabs Section using Section component
            Section {
                class: "showcase-section",
                title: Some("Tabs".to_string()),
                description: Some("Tab component for organizing content into separate panels.".to_string()),

                // Interactive tabs demo using Container
                Container {
                    max_width: "lg".to_string(),

                    // Custom tab buttons using Row
                    Row {
                        gap: "sm".to_string(),
                        class: "showcase-tabs-nav",

                        button {
                            class: if *active_tab.read() == "1" {
                                "showcase-tab-active"
                            } else {
                                "showcase-tab"
                            },
                            onclick: move |_| active_tab.set("1".to_string()),
                            "Overview"
                        }
                        button {
                            class: if *active_tab.read() == "2" {
                                "showcase-tab-active"
                            } else {
                                "showcase-tab"
                            },
                            onclick: move |_| active_tab.set("2".to_string()),
                            "Features"
                        }
                        button {
                            class: if *active_tab.read() == "3" {
                                "showcase-tab-active"
                            } else {
                                "showcase-tab"
                            },
                            onclick: move |_| active_tab.set("3".to_string()),
                            "Settings"
                        }
                    }

                    // Tab content
                    div {
                        class: "showcase-tab-content",
                        if *active_tab.read() == "1" {
                            div {
                                h3 {
                                    class: "showcase-tab-title",
                                    "Overview Tab"
                                }
                                p {
                                    class: "showcase-tab-text",
                                    "This is the overview tab content. Tabs allow you to organize content into separate panels."
                                }
                            }
                        } else if *active_tab.read() == "2" {
                            div {
                                h3 {
                                    class: "showcase-tab-title",
                                    "Features Tab"
                                }
                                p {
                                    class: "showcase-tab-text",
                                    "Explore the features of this component. Click on different tabs to see content change."
                                }
                            }
                        } else if *active_tab.read() == "3" {
                            div {
                                h3 {
                                    class: "showcase-tab-title",
                                    "Settings Tab"
                                }
                                p {
                                    class: "showcase-tab-text",
                                    "Configure your settings here. This tab demonstrates the third panel."
                                }
                            }
                        }
                    }
                }
            }

            // Menu Section using Section component
            Section {
                class: "showcase-section",
                title: Some("Menu".to_string()),
                description: Some("Menu components for navigation within your application.".to_string()),

                // Use Grid component for menu cards
                Grid {
                    gap: "lg".to_string(),
                    class: "showcase-grid",

                    // Vertical menu demo
                    Card {
                        title: "Vertical Menu".to_string(),
                        div {
                            class: "showcase-menu-vertical",
                            div {
                                class: "showcase-menu-item-active",
                                "Dashboard"
                            }
                            div {
                                class: "showcase-menu-item",
                                "Projects"
                            }
                            div {
                                class: "showcase-menu-item",
                                "Tasks"
                            }
                            div {
                                class: "showcase-menu-item",
                                "Settings"
                            }
                        }
                    }

                    // Horizontal menu demo
                    Card {
                        title: "Horizontal Menu".to_string(),
                        Row {
                            gap: "sm".to_string(),
                            Button {
                                size: ButtonSize::Small,
                                variant: ButtonVariant::Primary,
                                "Home"
                            }
                            Button {
                                size: ButtonSize::Small,
                                variant: ButtonVariant::Ghost,
                                "Products"
                            }
                            Button {
                                size: ButtonSize::Small,
                                variant: ButtonVariant::Ghost,
                                "About"
                            }
                            Button {
                                size: ButtonSize::Small,
                                variant: ButtonVariant::Ghost,
                                "Contact"
                            }
                        }
                    }

                    // Menu with icons
                    Card {
                        title: "Menu with Icons".to_string(),
                        div {
                            class: "showcase-menu-vertical",
                            div {
                                class: "showcase-menu-item-active showcase-menu-item-icon",
                                span { class: "showcase-menu-icon", "📊" }
                                span { "Analytics" }
                            }
                            div {
                                class: "showcase-menu-item showcase-menu-item-icon",
                                span { class: "showcase-menu-icon", "👥" }
                                span { "Users" }
                            }
                            div {
                                class: "showcase-menu-item showcase-menu-item-icon",
                                span { class: "showcase-menu-icon", "⚙️" }
                                span { "Settings" }
                            }
                        }
                    }
                }
            }

            // Breadcrumb Section using Section component
            Section {
                class: "showcase-section",
                title: Some("Breadcrumbs".to_string()),
                description: Some("Breadcrumb navigation showing the user's current location.".to_string()),

                Container {
                    max_width: "lg".to_string(),
                    class: "showcase-vertical-stack",

                    // Simple breadcrumb
                    Card {
                        title: "Simple Breadcrumb".to_string(),
                        div {
                            class: "showcase-breadcrumb",
                            span { "Home" }
                            span { class: "showcase-breadcrumb-separator", "/" }
                            span { "Components" }
                            span { class: "showcase-breadcrumb-separator", "/" }
                            span { class: "showcase-breadcrumb-current", "Navigation" }
                        }
                    }

                    // Breadcrumb with icons
                    Card {
                        title: "Breadcrumb with Icons".to_string(),
                        div {
                            class: "showcase-breadcrumb",
                            span { class: "showcase-breadcrumb-icon", "🏠" }
                            span { class: "showcase-breadcrumb-separator", "→" }
                            span { "Components" }
                            span { class: "showcase-breadcrumb-separator", "→" }
                            span { class: "showcase-breadcrumb-current", "Navigation" }
                        }
                    }

                    // Long breadcrumb path
                    Card {
                        title: "Deep Path".to_string(),
                        div {
                            class: "showcase-breadcrumb",
                            span { "Home" }
                            span { class: "showcase-breadcrumb-separator", "/" }
                            span { "Library" }
                            span { class: "showcase-breadcrumb-separator", "/" }
                            span { "Components" }
                            span { class: "showcase-breadcrumb-separator", "/" }
                            span { "Navigation" }
                            span { class: "showcase-breadcrumb-separator", "/" }
                            span { class: "showcase-breadcrumb-current", "Breadcrumbs" }
                        }
                    }
                }
            }

            // Interactive Demo Section
            Section {
                class: "showcase-section",
                title: Some("Interactive Demo".to_string()),

                Grid {
                    gap: "lg".to_string(),
                    class: "demo-card-grid",

                    Card {
                        title: "Tabbed Interface".to_string(),
                        div {
                            class: "showcase-tabbed-interface",

                            // Tab buttons using Row
                            Row {
                                gap: "sm".to_string(),
                                class: "showcase-tabs-nav-small",

                                button {
                                    class: if *active_tab.read() == "a" {
                                        "showcase-tab-small-active"
                                    } else {
                                        "showcase-tab-small"
                                    },
                                    onclick: move |_| active_tab.set("a".to_string()),
                                    "Tab A"
                                }
                                button {
                                    class: if *active_tab.read() == "b" {
                                        "showcase-tab-small-active"
                                    } else {
                                        "showcase-tab-small"
                                    },
                                    onclick: move |_| active_tab.set("b".to_string()),
                                    "Tab B"
                                }
                            }

                            // Tab content
                            div {
                                class: "showcase-tab-content-small",
                                {format!("Content for {}", active_tab.read())}
                            }
                        }
                    }
                }
            }
        }
    }
}
