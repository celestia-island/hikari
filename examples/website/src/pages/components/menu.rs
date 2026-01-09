// website/src/pages/components/menu.rs
// Menu component showcase page with real rendered examples


use dioxus::prelude::*;

use _components::{Menu, MenuItem, MenuMode, SubMenu, layout::{Container, Section}};
use _icons::{Icon, MdiIcon};
use _palette::classes::{ ClassesBuilder, MarginBottom, FontSize, FontWeight, TextColor, Padding, PaddingLeft, Margin, };
use crate::{app::Route, components::Layout};

#[allow(non_snake_case)]
pub fn ComponentsMenu() -> Element {
    rsx! {
        Layout { current_route: Route::ComponentsNavigation {},

            Container {
                // Page header
                div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                    h1 {
                        class: ClassesBuilder::new()
                            .add(FontSize::X4xl)
                            .add(FontWeight::Bold)
                            .add(Margin::M0)
                            .add(MarginBottom::Mb2)
                            .build(),
                        "Menu"
                    }
                    p { class: ClassesBuilder::new().add(Margin::M0).add(TextColor::Gray600).build(),
                        "Navigation menu for organizing and structuring content with FUI aesthetics"
                    }
                }

                // Overview
                Section {
                    title: Some("Overview".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(TextColor::Gray600).build(),
                        p { "Menus provide navigation through your application. They support:" }
                        ul { class: ClassesBuilder::new().add(PaddingLeft::Pl6).add(Margin::M0).build(),
                            li {
                                strong { "Multiple modes" }
                                " - Vertical, Horizontal, Inline"
                            }
                            li {
                                strong { "Nested items" }
                                " - Submenus with expandable content"
                            }
                            li {
                                strong { "Icons" }
                                " - Optional icons for menu items"
                            }
                            li {
                                strong { "Active states" }
                                " - Visual indication for selected items"
                            }
                            li {
                                strong { "Disabled items" }
                                " - Non-interactive menu items"
                            }
                        }
                    }
                }

                // Vertical Menu
                Section {
                    title: Some("Vertical Menu".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Gray700)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Basic Vertical Menu"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Gray600).build(),
                            "Default vertical menu for sidebar navigation"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            Menu { mode: MenuMode::Vertical,
                                MenuItem {
                                    item_key: "1".to_string(),
                                    icon: rsx! {
                                        Icon { icon: MdiIcon::Alert, size: 16 }
                                    },
                                    "Dashboard"
                                }
                                MenuItem {
                                    item_key: "2".to_string(),
                                    icon: rsx! {
                                        Icon { icon: MdiIcon::Alert, size: 16 }
                                    },
                                    "Settings"
                                }
                                MenuItem {
                                    item_key: "3".to_string(),
                                    icon: rsx! {
                                        Icon { icon: MdiIcon::Alert, size: 16 }
                                    },
                                    "Profile"
                                }
                            }
                        }
                    }

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Gray700)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Menu with Submenus"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Gray600).build(),
                            "Nested menu items with expandable sections"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            Menu { mode: MenuMode::Vertical,
                                MenuItem {
                                    item_key: "1".to_string(),
                                    icon: rsx! {
                                        Icon { icon: MdiIcon::Alert, size: 16 }
                                    },
                                    "Home"
                                }
                                SubMenu {
                                    item_key: "2".to_string(),
                                    title: "Products".to_string(),
                                    icon: rsx! {
                                        Icon { icon: MdiIcon::Alert, size: 16 }
                                    },
                                    MenuItem { item_key: "2-1".to_string(), "Category A" }
                                    MenuItem { item_key: "2-2".to_string(), "Category B" }
                                    MenuItem { item_key: "2-3".to_string(), "Category C" }
                                }
                                SubMenu {
                                    item_key: "3".to_string(),
                                    title: "Services".to_string(),
                                    icon: rsx! {
                                        Icon { icon: MdiIcon::Alert, size: 16 }
                                    },
                                    MenuItem { item_key: "3-1".to_string(), "Consulting" }
                                    MenuItem { item_key: "3-2".to_string(), "Development" }
                                }
                            }
                        }
                    }

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Gray700)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Menu with Disabled Items"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Gray600).build(),
                            "Non-interactive menu items for unavailable features"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            Menu { mode: MenuMode::Vertical,
                                MenuItem { item_key: "1".to_string(), "Active Item" }
                                MenuItem { item_key: "2".to_string(), disabled: true, "Disabled Item" }
                                MenuItem { item_key: "3".to_string(), "Another Active Item" }
                            }
                        }
                    }
                }

                // Horizontal Menu
                Section {
                    title: Some("Horizontal Menu".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Gray700)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Basic Horizontal Menu"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Gray600).build(),
                            "Horizontal menu for top navigation bars"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            Menu { mode: MenuMode::Horizontal,
                                MenuItem { item_key: "1".to_string(), "Home" }
                                MenuItem { item_key: "2".to_string(), "Products" }
                                MenuItem { item_key: "3".to_string(), "About" }
                                MenuItem { item_key: "4".to_string(), "Contact" }
                            }
                        }
                    }

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Gray700)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Horizontal Menu with Icons"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Gray600).build(),
                            "Icon-enhanced horizontal navigation"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            Menu { mode: MenuMode::Horizontal,
                                MenuItem {
                                    item_key: "1".to_string(),
                                    icon: rsx! {
                                        Icon { icon: MdiIcon::Alert, size: 16 }
                                    },
                                    "Home"
                                }
                                MenuItem {
                                    item_key: "2".to_string(),
                                    icon: rsx! {
                                        Icon { icon: MdiIcon::Alert, size: 16 }
                                    },
                                    "Search"
                                }
                                MenuItem {
                                    item_key: "3".to_string(),
                                    icon: rsx! {
                                        Icon { icon: MdiIcon::Alert, size: 16 }
                                    },
                                    "Notifications"
                                }
                            }
                        }
                    }
                }

                // Inline Menu
                Section {
                    title: Some("Inline Menu".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Gray700)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Compact Inline Menu"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Gray600).build(),
                            "Space-saving inline variant for compact layouts"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            Menu { mode: MenuMode::Vertical, inline: true,
                                MenuItem { item_key: "1".to_string(), "Overview" }
                                MenuItem { item_key: "2".to_string(), "Documentation" }
                                MenuItem { item_key: "3".to_string(), "Examples" }
                            }
                        }
                    }
                }

                // Usage Examples
                Section {
                    title: Some("Usage Examples".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Gray700)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Basic Vertical Menu"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            code {
                                r#"Menu {{
    mode: MenuMode::Vertical,
    MenuItem {{ item_key: "1".to_string(), "Home" }}
    MenuItem {{ item_key: "2".to_string(), "Settings" }}
    MenuItem {{ item_key: "3".to_string(), "Profile" }}
}}"#
                            }
                        }
                    }

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Gray700)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Menu with Icons"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            code {
                                r#"Menu {{
    mode: MenuMode::Vertical,
    MenuItem {{
        item_key: "1".to_string(),
        icon: rsx! {{
            Icon {{ icon: MdiIcon::Alert, size: 16 }}
        }},
        "Dashboard"
    }}
}}"#
                            }
                        }
                    }

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Gray700)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Menu with Submenus"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            code {
                                r#"Menu {{
    mode: MenuMode::Vertical,
    MenuItem {{ item_key: "1".to_string(), "Home" }}
    SubMenu {{
        item_key: "2".to_string(),
        title: "Products".to_string(),
        MenuItem {{ item_key: "2-1".to_string(), "Category A" }}
        MenuItem {{ item_key: "2-2".to_string(), "Category B" }}
    }}
}}"#
                            }
                        }
                    }

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Gray700)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Horizontal Menu"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            code {
                                r#"Menu {{
    mode: MenuMode::Horizontal,
    MenuItem {{ item_key: "1".to_string(), "Home" }}
    MenuItem {{ item_key: "2".to_string(), "Products" }}
    MenuItem {{ item_key: "3".to_string(), "About" }}
}}"#
                            }
                        }
                    }
                }

                // Best Practices
                Section {
                    title: Some("Best Practices".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(TextColor::Gray600).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Gray700)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "When to Use Menus"
                        }
                        ul { class: ClassesBuilder::new().add(PaddingLeft::Pl6).add(Margin::M0).build(),
                            li {
                                strong { "Vertical menus" }
                                " - Sidebars, settings panels"
                            }
                            li {
                                strong { "Horizontal menus" }
                                " - Top navigation, category filters"
                            }
                            li {
                                strong { "Submenus" }
                                " - Hierarchical content organization"
                            }
                            li {
                                strong { "Icons" }
                                " - Enhance visual recognition and scanning"
                            }
                        }

                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Gray700)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Organization Guidelines"
                        }
                        ul { class: ClassesBuilder::new().add(PaddingLeft::Pl6).add(Margin::M0).build(),
                            li {
                                strong { "Keep it simple" }
                                " - Limit to 7 items per level"
                            }
                            li {
                                strong { "Clear labels" }
                                " - Use descriptive, concise text"
                            }
                            li {
                                strong { "Logical order" }
                                " - Group related items together"
                            }
                            li {
                                strong { "Consistent placement" }
                                " - Maintain position across pages"
                            }
                        }
                    }
                }
            }
        }
    }
}
