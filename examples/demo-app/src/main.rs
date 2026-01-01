// demo-app/src/main.rs
// Comprehensive demo showcasing all Hikari components

use dioxus::prelude::*;
use hikari_components::*;

#[derive(Clone, Routable, Debug, PartialEq)]
enum Route {
    #[route("/")]
    Home {},

    #[route("/basic")]
    BasicComponents {},

    #[route("/feedback")]
    FeedbackComponents {},

    #[route("/navigation")]
    NavigationComponents {},

    #[route("/data")]
    DataComponents {},
}

fn main() {
    // Launch the app
    dioxus::launch(App);
}

#[component]
fn App() -> Element {
    rsx! {
        Router::<Route> {}
    }
}

#[component]
fn Home() -> Element {
    rsx! {
        div { class: "demo-app",
            style { "display: flex; height: 100vh; font-family: system-ui, -apple-system, sans-serif;" }

            // Sidebar
            aside {
                style: "width: 250px; background: #1a1a2e; color: #fff; padding: 20px; display: flex; flex-direction: column; gap: 8px;",
                h2 { style: "margin: 0 0 20px 0; font-size: 24px; color: #4a9eff;", "Hikari Demo" }
                Link { to: Route::Home {}, style: "color: #fff; text-decoration: none; padding: 10px; border-radius: 6px;",
                    "Home"
                }
                Link { to: Route::BasicComponents {}, style: "color: #fff; text-decoration: none; padding: 10px; border-radius: 6px;",
                    "Basic Components"
                }
                Link { to: Route::FeedbackComponents {}, style: "color: #fff; text-decoration: none; padding: 10px; border-radius: 6px;",
                    "Feedback Components"
                }
                Link { to: Route::NavigationComponents {}, style: "color: #fff; text-decoration: none; padding: 10px; border-radius: 6px;",
                    "Navigation Components"
                }
                Link { to: Route::DataComponents {}, style: "color: #fff; text-decoration: none; padding: 10px; border-radius: 6px;",
                    "Data Components"
                }
            }

            // Main content
            main {
                style: "flex: 1; padding: 40px; background: #f5f5f5; overflow-y: auto;",

                h1 { style: "font-size: 32px; margin-bottom: 20px; color: #1a1a2e;",
                    "Welcome to Hikari UI Demo"
                }

                p { style: "font-size: 16px; line-height: 1.6; color: #666; margin-bottom: 30px;",
                    "Hikari is a modern UI component library for Dioxus, inspired by Arknights design aesthetics with FUI (Futuristic User Interface) elements and traditional Chinese colors. The name \"Hikari\" comes from the rhythm game Arcaea."
                }

                div { style: "display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; margin-top: 40px;",
                    DemoCard {
                        title: "Basic Components",
                        description: "Button, Input, Card, Badge",
                        route: Route::BasicComponents {},
                    }
                    DemoCard {
                        title: "Feedback Components",
                        description: "Alert, Toast, Tooltip",
                        route: Route::FeedbackComponents {},
                    }
                    DemoCard {
                        title: "Navigation Components",
                        description: "Menu, Tabs, Breadcrumb",
                        route: Route::NavigationComponents {},
                    }
                    DemoCard {
                        title: "Data Components",
                        description: "Table, Tree",
                        route: Route::DataComponents {},
                    }
                }

                div { style: "margin-top: 60px; padding: 20px; background: #fff; border-radius: 8px; border-left: 4px solid #4a9eff;",
                    h3 { style: "margin: 0 0 10px 0; color: #1a1a2e;", "About Hikari" }
                    p { style: "margin: 0; color: #666; line-height: 1.6;",
                        "Hikari (光) means 'light' in Japanese. This library brings together the best of modern web design with traditional Chinese color palettes, creating a unique and beautiful UI experience."
                    }
                }
            }
        }
    }
}

#[component]
fn DemoCard(title: String, description: String, route: Route) -> Element {
    rsx! {
        Link { to: route,
            style: "text-decoration: none; color: inherit; display: block; height: 100%;",
            div {
                style: "background: #fff; padding: 24px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); transition: transform 0.2s, box-shadow 0.2s; cursor: pointer;",
                h3 { style: "margin: 0 0 8px 0; color: #1a1a2e; font-size: 18px;",
                    "{title}"
                }
                p { style: "margin: 0; color: #666; font-size: 14px;",
                    "{description}"
                }
            }
        }
    }
}

#[component]
fn BasicComponents() -> Element {
    rsx! {
        div { class: "demo-page",
            style: "display: flex; height: 100vh; font-family: system-ui, -apple-system, sans-serif;",

            // Sidebar
            aside {
                style: "width: 250px; background: #1a1a2e; color: #fff; padding: 20px; display: flex; flex-direction: column; gap: 8px;",
                h2 { style: "margin: 0 0 20px 0; font-size: 24px; color: #4a9eff;", "Hikari Demo" }
                Link { to: Route::Home {}, style: "color: #fff; text-decoration: none; padding: 10px; border-radius: 6px;",
                    "← Back to Home"
                }
            }

            // Main content
            main {
                style: "flex: 1; padding: 40px; background: #f5f5f5; overflow-y: auto;",

                h1 { style: "font-size: 32px; margin-bottom: 30px; color: #1a1a2e;",
                    "Basic Components"
                }

                // Buttons Section
                Section {
                    title: "Buttons",
                    children: rsx! {
                        div { style: "display: flex; gap: 12px; flex-wrap: wrap; align-items: center;",
                            Button { variant: ButtonVariant::Primary, "Primary Button" }
                            Button { variant: ButtonVariant::Secondary, "Secondary Button" }
                            Button { variant: ButtonVariant::Ghost, "Ghost Button" }
                            Button { variant: ButtonVariant::Danger, "Danger Button" }
                            Button { variant: ButtonVariant::Success, "Success Button" }
                        }

                        div { style: "margin-top: 20px; display: flex; gap: 12px; flex-wrap: wrap; align-items: center;",
                            Button { size: ButtonSize::Small, "Small" }
                            Button { size: ButtonSize::Medium, "Medium" }
                            Button { size: ButtonSize::Large, "Large" }
                        }

                        div { style: "margin-top: 20px; display: flex; gap: 12px; flex-wrap: wrap; align-items: center;",
                            Button { loading: true, "Loading..." }
                            Button { disabled: true, "Disabled" }
                        }
                    }
                }

                // Input Section
                Section {
                    title: "Inputs",
                    children: rsx! {
                        div { style: "display: flex; flex-direction: column; gap: 16px; max-width: 400px;",
                            div {
                                label { style: "display: block; margin-bottom: 6px; font-weight: 500; color: #333;", "Default Input" }
                                Input { placeholder: "Enter text..." }
                            }

                            div {
                                label { style: "display: block; margin-bottom: 6px; font-weight: 500; color: #333;", "Disabled Input" }
                                Input { disabled: true, value: "Disabled input" }
                            }
                        }
                    }
                }

                // Cards Section
                Section {
                    title: "Cards",
                    children: rsx! {
                        div { style: "display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px;",
                            Card {
                                title: "Card Title".to_string(),
                                div { style: "margin: 0; color: #666;", "This is a simple card with header and content." }
                            }

                            Card {
                                h3 { style: "margin: 0 0 10px 0;", "Simple Card" }
                                p { style: "margin: 0; color: #666;", "Card without header, just content." }
                            }
                        }
                    }
                }

                // Badges Section
                Section {
                    title: "Badges",
                    children: rsx! {
                        div { style: "display: flex; gap: 12px; flex-wrap: wrap; align-items: center;",
                            Badge { variant: BadgeVariant::Default, "Default" }
                            Badge { variant: BadgeVariant::Primary, "Primary" }
                            Badge { variant: BadgeVariant::Success, "Success" }
                            Badge { variant: BadgeVariant::Warning, "Warning" }
                            Badge { variant: BadgeVariant::Danger, "Danger" }
                        }
                    }
                }
            }
        }
    }
}

#[component]
fn FeedbackComponents() -> Element {
    rsx! {
        div { class: "demo-page",
            style: "display: flex; height: 100vh; font-family: system-ui, -apple-system, sans-serif;",

            aside {
                style: "width: 250px; background: #1a1a2e; color: #fff; padding: 20px; display: flex; flex-direction: column; gap: 8px;",
                h2 { style: "margin: 0 0 20px 0; font-size: 24px; color: #4a9eff;", "Hikari Demo" }
                Link { to: Route::Home {}, style: "color: #fff; text-decoration: none; padding: 10px; border-radius: 6px;",
                    "← Back to Home"
                }
            }

            main {
                style: "flex: 1; padding: 40px; background: #f5f5f5; overflow-y: auto;",

                h1 { style: "font-size: 32px; margin-bottom: 30px; color: #1a1a2e;",
                    "Feedback Components"
                }

                // Alerts Section
                Section {
                    title: "Alerts",
                    children: rsx! {
                        div { style: "display: flex; flex-direction: column; gap: 12px; max-width: 600px;",
                            Alert { variant: AlertVariant::Info, description: "This is an info alert message.".to_string() }
                            Alert { variant: AlertVariant::Success, description: "Operation completed successfully!".to_string() }
                            Alert { variant: AlertVariant::Warning, description: "Please review this warning message.".to_string() }
                            Alert { variant: AlertVariant::Error, description: "An error has occurred.".to_string() }
                        }
                    }
                }

                // Toast Section
                Section {
                    title: "Toasts",
                    children: rsx! {
                        div { style: "display: flex; gap: 12px; flex-wrap: wrap;",
                            Button {
                                onclick: |_| println!("Show info toast"),
                                "Show Info Toast"
                            }
                            Button {
                                onclick: |_| println!("Show success toast"),
                                "Show Success Toast"
                            }
                            Button {
                                onclick: |_| println!("Show warning toast"),
                                "Show Warning Toast"
                            }
                        }
                        p { style: "margin-top: 12px; color: #666; font-size: 14px;",
                            "Click buttons to show toast notifications (console log for demo)"
                        }
                    }
                }

                // Tooltip Section
                Section {
                    title: "Tooltips",
                    children: rsx! {
                        div { style: "display: flex; gap: 12px; flex-wrap: wrap; align-items: center;",
                            div { style: "display: inline-block;",
                                Tooltip { content: "This is a helpful tooltip".to_string(),
                                    Button { "Hover me" }
                                }
                            }
                            Button { "Button with tooltip coming soon" }
                        }
                    }
                }
            }
        }
    }
}

#[component]
fn NavigationComponents() -> Element {
    rsx! {
        div { class: "demo-page",
            style: "display: flex; height: 100vh; font-family: system-ui, -apple-system, sans-serif;",

            aside {
                style: "width: 250px; background: #1a1a2e; color: #fff; padding: 20px; display: flex; flex-direction: column; gap: 8px;",
                h2 { style: "margin: 0 0 20px 0; font-size: 24px; color: #4a9eff;", "Hikari Demo" }
                Link { to: Route::Home {}, style: "color: #fff; text-decoration: none; padding: 10px; border-radius: 6px;",
                    "← Back to Home"
                }
            }

            main {
                style: "flex: 1; padding: 40px; background: #f5f5f5; overflow-y: auto;",

                h1 { style: "font-size: 32px; margin-bottom: 30px; color: #1a1a2e;",
                    "Navigation Components"
                }

                // Menu Section
                Section {
                    title: "Menu",
                    children: rsx! {
                        p { style: "color: #666;", "Menu component - inline demo for showcase" }
                        div { style: "background: #fff; border-radius: 8px; padding: 20px; max-width: 300px;",
                            div { style: "display: flex; flex-direction: column; gap: 8px;",
                                div { style: "padding: 10px; border-radius: 6px; background: #4a9eff; color: #fff; cursor: pointer;",
                                    "Menu Item 1 (Active)"
                                }
                                div { style: "padding: 10px; border-radius: 6px; cursor: pointer;",
                                    "Menu Item 2"
                                }
                                div { style: "padding: 10px; border-radius: 6px; cursor: pointer;",
                                    "Menu Item 3"
                                }
                            }
                        }
                    }
                }

                // Tabs Section
                Section {
                    title: "Tabs",
                    children: rsx! {
                        div { style: "max-width: 600px;",
                            div { style: "border-bottom: 2px solid #e0e0e0; display: flex; gap: 24px;",
                                div { style: "padding: 12px 24px; cursor: pointer; border-bottom: 2px solid #4a9eff; color: #4a9eff; margin-bottom: -2px;",
                                    "Tab 1"
                                }
                                div { style: "padding: 12px 24px; cursor: pointer; color: #666;",
                                    "Tab 2"
                                }
                                div { style: "padding: 12px 24px; cursor: pointer; color: #666;",
                                    "Tab 3"
                                }
                            }
                            div { style: "padding: 24px; background: #fff; margin-top: 16px; border-radius: 0 8px 8px 8px;",
                                "Tab 1 content - Active tab panel"
                            }
                        }
                    }
                }

                // Breadcrumb Section
                Section {
                    title: "Breadcrumb",
                    children: rsx! {
                        div { style: "display: flex; align-items: center; gap: 8px; color: #666;",
                            span { "Home" }
                            span { style: "color: #999;", "/" }
                            span { "Components" }
                            span { style: "color: #999;", "/" }
                            span { style: "color: #4a9eff; font-weight: 500;", "Navigation" }
                        }
                    }
                }
            }
        }
    }
}

#[component]
fn DataComponents() -> Element {
    // Sample table data
    let columns = vec![
        hikari_components::table::ColumnDef::new("name", "Operator Name").sortable(true),
        hikari_components::table::ColumnDef::new("class", "Class"),
        hikari_components::table::ColumnDef::new("rarity", "Rarity").align(hikari_components::ColumnAlign::Center),
        hikari_components::table::ColumnDef::new("level", "Level").align(hikari_components::ColumnAlign::Center),
    ];

    let data = vec![
        vec!["Amiya".to_string(), "Guard".to_string(), "6".to_string(), "90".to_string()],
        vec!["SilverAsh".to_string(), "Guard".to_string(), "6".to_string(), "90".to_string()],
        vec!["Exusiai".to_string(), "Sniper".to_string(), "6".to_string(), "90".to_string()],
        vec!["Siege".to_string(), "Vanguard".to_string(), "6".to_string(), "80".to_string()],
        vec!["Myrtle".to_string(), "Vanguard".to_string(), "4".to_string(), "70".to_string()],
    ];

    rsx! {
        div { class: "demo-page",
            style: "display: flex; height: 100vh; font-family: system-ui, -apple-system, sans-serif;",

            aside {
                style: "width: 250px; background: #1a1a2e; color: #fff; padding: 20px; display: flex; flex-direction: column; gap: 8px;",
                h2 { style: "margin: 0 0 20px 0; font-size: 24px; color: #4a9eff;", "Hikari Demo" }
                Link { to: Route::Home {}, style: "color: #fff; text-decoration: none; padding: 10px; border-radius: 6px;",
                    "← Back to Home"
                }
            }

            main {
                style: "flex: 1; padding: 40px; background: #f5f5f5; overflow-y: auto;",

                h1 { style: "font-size: 32px; margin-bottom: 30px; color: #1a1a2e;",
                    "Data Components"
                }

                // Table Section
                Section {
                    title: "Table",
                    children: rsx! {
                        div { style: "max-width: 800px;",
                            Table {
                                columns: columns.clone(),
                                data: data.clone(),
                                bordered: true,
                                striped: true,
                                hoverable: true,
                            }
                        }
                    }
                }

                // Tree Section
                Section {
                    title: "Tree",
                    children: rsx! {
                        div { style: "max-width: 600px; background: #fff; padding: 20px; border-radius: 8px;",
                            p { style: "margin: 0 0 16px 0; color: #666;",
                                "Tree component demo (visual placeholder)"
                            }
                            div { style: "font-family: monospace; color: #333;",
                                div { style: "padding: 4px 0;", "📁 Root" }
                                div { style: "padding: 4px 0; padding-left: 24px;", "  📁 Branch 1" }
                                div { style: "padding: 4px 0; padding-left: 48px;", "    📄 Leaf 1.1" }
                                div { style: "padding: 4px 0; padding-left: 48px;", "    📄 Leaf 1.2" }
                                div { style: "padding: 4px 0; padding-left: 24px;", "  📁 Branch 2" }
                                div { style: "padding: 4px 0; padding-left: 48px;", "    📄 Leaf 2.1" }
                            }
                        }
                    }
                }

                // More data demos
                Section {
                    title: "Advanced Table Features",
                    children: rsx! {
                        div { style: "max-width: 800px;",
                            Table {
                                columns: columns,
                                data: data,
                                size: hikari_components::TableSize::Small,
                                bordered: true,
                            }
                        }
                    }
                }
            }
        }
    }
}

#[component]
fn Section(title: String, children: Element) -> Element {
    rsx! {
        div { style: "margin-bottom: 48px;",
            h2 { style: "font-size: 24px; margin-bottom: 16px; color: #1a1a2e; border-bottom: 2px solid #e0e0e0; padding-bottom: 8px;",
                "{title}"
            }
            { children }
        }
    }
}
