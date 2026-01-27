// website/src/pages/components/display/description_list.rs
// DescriptionList component showcase page with real rendered examples

use dioxus::prelude::*;

use crate::{app::Route, components::Layout};
use _components::{DescriptionList, layout::{Container, Section}};
use _palette::classes::{ClassesBuilder, FontSize, FontWeight, MarginBottom, Padding, TextColor};

#[allow(non_snake_case)]
pub fn ComponentsDescriptionList() -> Element {
    rsx! {
        Layout {
            current_route: Route::DisplayDescriptionList {},

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
                        "DescriptionList"
                    }
                    p { class: ClassesBuilder::new().add(MarginBottom::Mb0).add(TextColor::Secondary).build(),
                        "Key-value lists for displaying structured information"
                    }
                }

                // Overview
                Section {
                    title: Some("Overview".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                        p {
                            "Description lists display key-value pairs in a grid format. They support:"
                        }
                        ul { class: ClassesBuilder::new().add_raw("pl-6").add(MarginBottom::Mb0).build(),
                            li {
                                strong { "Multiple columns" }
                                " - Configurable grid layout"
                            }
                            li {
                                strong { "Responsive design" }
                                " - Adapts to different screen sizes"
                            }
                            li {
                                strong { "Flexible content" }
                                " - Text or any Element as values"
                            }
                            li {
                                strong { "Clean styling" }
                                " - Semantic dl/dt/dd structure"
                            }
                        }
                    }
                }

                // Basic Description List
                Section {
                    title: Some("Basic Description Lists".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Single Column"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Basic key-value list in single column layout"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            DescriptionList {
                                items: vec![
                                    ("Name".to_string(), "Hikari".to_string()),
                                    ("Version".to_string(), "0.1.0".to_string()),
                                    ("License".to_string(), "MIT".to_string()),
                                    ("Language".to_string(), "Rust".to_string()),
                                ],
                                column: 1,
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
                            "Two Columns"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Grid layout with two columns of key-value pairs"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            DescriptionList {
                                items: vec![
                                    ("Name".to_string(), "Hikari".to_string()),
                                    ("Version".to_string(), "0.1.0".to_string()),
                                    ("License".to_string(), "MIT".to_string()),
                                    ("Language".to_string(), "Rust".to_string()),
                                    ("Framework".to_string(), "Dioxus".to_string()),
                                    ("Styling".to_string(), "Grass (SCSS)".to_string()),
                                ],
                                column: 2,
                            }
                        }
                    }
                }

                // Use Cases
                Section {
                    title: Some("Common Use Cases".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "User Profile"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Display user information"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            DescriptionList {
                                items: vec![
                                    ("Username".to_string(), "alice_j".to_string()),
                                    ("Email".to_string(), "alice@example.com".to_string()),
                                    ("Role".to_string(), "Administrator".to_string()),
                                    ("Status".to_string(), "Active".to_string()),
                                    ("Created".to_string(), "2024-01-01".to_string()),
                                    ("Last Login".to_string(), "2024-01-22 10:30".to_string()),
                                ],
                                column: 2,
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
                            "Project Details"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Display project metadata"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            DescriptionList {
                                items: vec![
                                    ("Project".to_string(), "Hikari UI Framework".to_string()),
                                    ("Repository".to_string(), "github.com/hikari/ui".to_string()),
                                    ("Version".to_string(), "0.1.0".to_string()),
                                    ("Stars".to_string(), "1,234".to_string()),
                                    ("Forks".to_string(), "56".to_string()),
                                    ("Issues".to_string(), "12".to_string()),
                                ],
                                column: 2,
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
                            "System Information"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Display system specifications"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            DescriptionList {
                                items: vec![
                                    ("OS".to_string(), "Linux".to_string()),
                                    ("Kernel".to_string(), "6.1.0".to_string()),
                                    ("Architecture".to_string(), "x86_64".to_string()),
                                    ("CPU".to_string(), "Intel Core i7".to_string()),
                                    ("Memory".to_string(), "16 GB".to_string()),
                                    ("Disk".to_string(), "512 GB SSD".to_string()),
                                ],
                                column: 2,
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
                            "API Configuration"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Display API settings"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            DescriptionList {
                                items: vec![
                                    ("Base URL".to_string(), "https://api.hikari.com".to_string()),
                                    ("Timeout".to_string(), "30s".to_string()),
                                    ("Rate Limit".to_string(), "100 req/min".to_string()),
                                    ("Authentication".to_string(), "Bearer Token".to_string()),
                                    ("Version".to_string(), "v2".to_string()),
                                ],
                                column: 2,
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
                            "Basic Description List"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            code {
                                r#"DescriptionList {{
    items: vec![
        ("Name".to_string(), "Hikari".to_string()),
        ("Version".to_string(), "0.1.0".to_string()),
    ],
    column: 1,
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
                            "Two Column Layout"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            code {
                                r#"DescriptionList {{
    items: vec![
        ("Name".to_string(), "Hikari".to_string()),
        ("Version".to_string(), "0.1.0".to_string()),
        ("License".to_string(), "MIT".to_string()),
        ("Language".to_string(), "Rust".to_string()),
    ],
    column: 2,
}}"#
                            }
                        }
                    }
                }
            }
        }
    }
}
