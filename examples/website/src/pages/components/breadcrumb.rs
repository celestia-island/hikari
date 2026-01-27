// website/src/pages/components/breadcrumb.rs
// Breadcrumb component showcase page with real rendered examples

use dioxus::prelude::*;

use crate::{app::Route, components::Layout};
use _components::{Breadcrumb, BreadcrumbItem, BreadcrumbSeparator, layout::{Container, Section}};
use _icons::{Icon, MdiIcon};
use _palette::classes::{ ClassesBuilder, FontSize, FontWeight, MarginBottom, Padding, PaddingLeft, TextColor, };

#[allow(non_snake_case)]
pub fn ComponentsBreadcrumb() -> Element {
    rsx! {
        Layout { current_route: Route::ComponentsNavigation {},

            Container {
                // Page header
                div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                    h1 {
                        class: ClassesBuilder::new()
                            .add(FontSize::X4xl)
                            .add(FontWeight::Bold)
                            .add(MarginBottom::Mb0)
                            .add(MarginBottom::Mb2)
                            .build(),
                        "Breadcrumb"
                    }
                    p { class: ClassesBuilder::new().add(MarginBottom::Mb0).add(TextColor::Secondary).build(),
                        "Navigation breadcrumbs showing current page location with FUI aesthetics"
                    }
                }

                // Overview
                Section {
                    title: Some("Overview".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                        p {
                            "Breadcrumbs show the current page's location in the site hierarchy. They support:"
                        }
                        ul { class: ClassesBuilder::new().add(PaddingLeft::Pl6).add(MarginBottom::Mb0).build(),
                            li {
                                strong { "Default separator" }
                                " - Chevron-right icon (refined)"
                            }
                            li {
                                strong { "Custom separators" }
                                " - Slash, arrow, dot, or custom"
                            }
                            li {
                                strong { "Click navigation" }
                                " - Links to parent pages"
                            }
                            li {
                                strong { "Icons" }
                                " - Optional icons for breadcrumb items"
                            }
                            li {
                                strong { "Style variants" }
                                " - Background and pill styles"
                            }
                        }
                    }
                }

                // Basic Breadcrumb
                Section {
                    title: Some("Basic Breadcrumb".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Default Breadcrumb"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Basic breadcrumb with chevron separator"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            Breadcrumb {
                                BreadcrumbItem { item_key: "1".to_string(), "Home" }
                                BreadcrumbItem { item_key: "2".to_string(), "Library" }
                                BreadcrumbItem { item_key: "3".to_string(), "Book" }
                            }
                        }
                    }

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Breadcrumb with Icons"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Enhanced breadcrumbs with visual icons"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            Breadcrumb {
                                BreadcrumbItem { item_key: "1".to_string(),
                                    Icon { icon: MdiIcon::Alert, size: 14 }
                                    span { "Home" }
                                }
                                BreadcrumbItem { item_key: "2".to_string(),
                                    Icon { icon: MdiIcon::Alert, size: 14 }
                                    span { "Projects" }
                                }
                                BreadcrumbItem { item_key: "3".to_string(),
                                    Icon { icon: MdiIcon::Alert, size: 14 }
                                    span { "Details" }
                                }
                            }
                        }
                    }

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Clickable Breadcrumb"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Breadcrumb items with click handlers"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            Breadcrumb {
                                BreadcrumbItem {
                                    item_key: "1".to_string(),
                                    onclick: move |_| {
                                        println!("Clicked Home");
                                    },
                                    "Home"
                                }
                                BreadcrumbItem {
                                    item_key: "2".to_string(),
                                    onclick: move |_| {
                                        println!("Clicked Products");
                                    },
                                    "Products"
                                }
                                BreadcrumbItem { item_key: "3".to_string(), "Current Page" }
                            }
                        }
                    }
                }

                // Custom Separators
                Section {
                    title: Some("Custom Separators".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Slash Separator"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Classic slash separator"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            Breadcrumb { separator: "/".to_string(),
                                BreadcrumbItem { item_key: "1".to_string(), "Home" }
                                BreadcrumbSeparator { separator: "/".to_string() }
                                BreadcrumbItem { item_key: "2".to_string(), "Library" }
                                BreadcrumbSeparator { separator: "/".to_string() }
                                BreadcrumbItem { item_key: "3".to_string(), "Data" }
                            }
                        }
                    }

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Arrow Separator"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Arrow symbol separator"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            Breadcrumb { separator: "->".to_string(),
                                BreadcrumbItem { item_key: "1".to_string(), "Home" }
                                BreadcrumbSeparator { separator: "->".to_string() }
                                BreadcrumbItem { item_key: "2".to_string(), "Category" }
                                BreadcrumbSeparator { separator: "->".to_string() }
                                BreadcrumbItem { item_key: "3".to_string(), "Item" }
                            }
                        }
                    }

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Dot Separator"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Minimal dot separator"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            Breadcrumb { separator: ".".to_string(),
                                BreadcrumbItem { item_key: "1".to_string(), "Section" }
                                BreadcrumbSeparator { separator: ".".to_string() }
                                BreadcrumbItem { item_key: "2".to_string(), "Subsection" }
                                BreadcrumbSeparator { separator: ".".to_string() }
                                BreadcrumbItem { item_key: "3".to_string(), "Page" }
                            }
                        }
                    }
                }

                // Style Variants
                Section {
                    title: Some("Style Variants".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Background Style"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Breadcrumb with background fill"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            Breadcrumb { class: "hi-breadcrumb-background".to_string(),
                                BreadcrumbItem { item_key: "1".to_string(), "Home" }
                                BreadcrumbItem { item_key: "2".to_string(), "Products" }
                                BreadcrumbItem { item_key: "3".to_string(), "Category" }
                            }
                        }
                    }

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Pill Style"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Pill-shaped breadcrumb items"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            Breadcrumb { class: "hi-breadcrumb-pill".to_string(),
                                BreadcrumbItem { item_key: "1".to_string(), "Home" }
                                BreadcrumbItem { item_key: "2".to_string(), "Settings" }
                                BreadcrumbItem { item_key: "3".to_string(), "Profile" }
                            }
                        }
                    }
                }

                // Common Patterns
                Section {
                    title: Some("Common Patterns".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Site Navigation"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Standard site hierarchy navigation"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            Breadcrumb {
                                BreadcrumbItem { item_key: "1".to_string(),
                                    Icon { icon: MdiIcon::Alert, size: 14 }
                                    "Home"
                                }
                                BreadcrumbItem { item_key: "2".to_string(), "Documentation" }
                                BreadcrumbItem { item_key: "3".to_string(), "Components" }
                                BreadcrumbItem { item_key: "4".to_string(), "Breadcrumb" }
                            }
                        }
                    }

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "File System Path"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "File or directory path representation"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            Breadcrumb {
                                BreadcrumbItem { item_key: "1".to_string(),
                                    Icon { icon: MdiIcon::Alert, size: 14 }
                                    "Root"
                                }
                                BreadcrumbItem { item_key: "2".to_string(), "Users" }
                                BreadcrumbItem { item_key: "3".to_string(), "Documents" }
                                BreadcrumbItem { item_key: "4".to_string(), "Projects" }
                            }
                        }
                    }

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Process Flow"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Multi-step process indicator"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            Breadcrumb {
                                BreadcrumbItem { item_key: "1".to_string(), "Start" }
                                BreadcrumbItem { item_key: "2".to_string(), "Processing" }
                                BreadcrumbItem { item_key: "3".to_string(), "Review" }
                                BreadcrumbItem { item_key: "4".to_string(), "Complete" }
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
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Basic Breadcrumb"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            code {
                                r#"Breadcrumb {{
    BreadcrumbItem {{ item_key: "1".to_string(), "Home" }}
    BreadcrumbItem {{ item_key: "2".to_string(), "Library" }}
    BreadcrumbItem {{ item_key: "3".to_string(), "Book" }}
}}"#
                            }
                        }
                    }

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Breadcrumb with Icons"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            code {
                                r#"Breadcrumb {{
    BreadcrumbItem {{
        item_key: "1".to_string(),
        Icon {{ icon: MdiIcon::Alert, size: 14 }}
        "Home"
    }}
    BreadcrumbItem {{
        item_key: "2".to_string(),
        "Products"
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
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Custom Separator"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            code {
                                r#"Breadcrumb {{
    separator: "/".to_string(),
    BreadcrumbItem {{ item_key: "1".to_string(), "Home" }}
    BreadcrumbSeparator {{ separator: "/".to_string() }}
    BreadcrumbItem {{ item_key: "2".to_string(), "Page" }}
}}"#
                            }
                        }
                    }

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Clickable Items"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            code {
                                r#"Breadcrumb {{
    BreadcrumbItem {{
        item_key: "1".to_string(),
        onclick: move |_| println!("Home"),
        "Home"
    }}
    BreadcrumbItem {{
        item_key: "2".to_string(),
        "Current"
    }}
}}"#
                            }
                        }
                    }
                }

                // Best Practices
                Section {
                    title: Some("Best Practices".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "When to Use Breadcrumbs"
                        }
                        ul { class: ClassesBuilder::new().add(PaddingLeft::Pl6).add(MarginBottom::Mb0).build(),
                            li {
                                strong { "Deep hierarchies" }
                                " - 3+ levels deep"
                            }
                            li {
                                strong { "Navigation aid" }
                                " - Show user's current location"
                            }
                            li {
                                strong { "Wayfinding" }
                                " - Easy path back to parent pages"
                            }
                            li {
                                strong { "Secondary navigation" }
                                " - Complement primary menus"
                            }
                        }

                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Content Guidelines"
                        }
                        ul { class: ClassesBuilder::new().add(PaddingLeft::Pl6).add(MarginBottom::Mb0).build(),
                            li {
                                strong { "Keep it concise" }
                                " - Short, clear labels"
                            }
                            li {
                                strong { "Match page titles" }
                                " - Consistent naming"
                            }
                            li {
                                strong { "Start broad" }
                                " - Home → Category → Page"
                            }
                            li {
                                strong { "Last item" }
                                " - Current page (non-clickable)"
                            }
                        }

                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Design Guidelines"
                        }
                        ul { class: ClassesBuilder::new().add(PaddingLeft::Pl6).add(MarginBottom::Mb0).build(),
                            li {
                                strong { "Placement" }
                                " - Below header, above content"
                            }
                            li {
                                strong { "Visibility" }
                                " - Clear contrast and spacing"
                            }
                            li {
                                strong { "Separators" }
                                " - Use chevron or slash"
                            }
                            li {
                                strong { "Mobile" }
                                " - Consider truncating on small screens"
                            }
                        }
                    }
                }
            }
        }
    }
}
