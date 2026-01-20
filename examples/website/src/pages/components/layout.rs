// website/src/pages/components/layout.rs
// Layout components showcase page

use dioxus::prelude::*;

use crate::{app::Route, components::Layout};
use _components::layout::{Container, Row, Section};
use _palette::classes::{
    BgColor, BorderRadius, ClassesBuilder, FontSize, FontWeight,
    MarginBottom, Padding, PaddingLeft, TextColor,
};

#[allow(non_snake_case)]
pub fn ComponentsLayout() -> Element {
    rsx! {
        Layout { current_route: Route::ComponentsBasic {},

            Container {
                // Page header
                div { class: ClassesBuilder::default().add(MarginBottom::Mb8).build(),
                    h1 {
                        class: ClassesBuilder::default()
                            .add(FontSize::X4xl)
                            .add(FontWeight::Bold)
                            .add(MarginBottom::Mb0)
                            .add(MarginBottom::Mb2)
                            .build(),
                        "Layout Components"
                    }
                    p { class: ClassesBuilder::default().add(MarginBottom::Mb0).add(TextColor::Secondary).build(),
                        "Structural components for building application layouts with FUI aesthetics"
                    }
                }

                // Layout System Overview
                Section {
                    title: Some("Layout System".to_string()),
                    class: ClassesBuilder::default().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::default().add(TextColor::Secondary).build(),
                        p {
                            "The Hikari Layout system provides a flexible set of components for building responsive application layouts. It includes:"
                        }
                        ul { class: ClassesBuilder::default().add(PaddingLeft::Pl6).add(MarginBottom::Mb0).build(),
                            li {
                                strong { "Layout" }
                                " - Main layout container with header, aside, and content areas"
                            }
                            li {
                                strong { "Header" }
                                " - Top navigation bar with branding and actions"
                            }
                            li {
                                strong { "Aside" }
                                " - Sidebar navigation panel"
                            }
                            li {
                                strong { "Content" }
                                " - Main content area"
                            }
                            li {
                                strong { "Container" }
                                " - Responsive container for content sections"
                            }
                            li {
                                strong { "Section" }
                                " - Themed content section with optional title"
                            }
                        }
                    }
                }

                // Container Examples
                Section {
                    title: Some("Container".to_string()),
                    class: ClassesBuilder::default().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::default().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::default()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Basic Container"
                        }
                        p { class: ClassesBuilder::default().add(TextColor::Secondary).build(),
                            "Container provides consistent spacing and max-width for content"
                        }
                        Container {
                            div {
                                class: ClassesBuilder::default()
                                    .add(Padding::P6)
                                    .add(BorderRadius::Lg)
                                    .add(BgColor::White)
                                    .add(TextColor::Primary)
                                    .build(),
                                "This is content wrapped in a Container component. Containers automatically handle responsive width and padding."
                            }
                        }
                    }
                }

                // Section Examples
                Section {
                    title: Some("Section".to_string()),
                    class: ClassesBuilder::default().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::default().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::default()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Section with Title"
                        }
                        Section { title: Some("Section Title".to_string()),
                            div { class: ClassesBuilder::default().add(TextColor::Secondary).build(),
                                "Sections provide themed styling with optional headers. Perfect for grouping related content."
                            }
                        }
                    }

                    div { class: ClassesBuilder::default().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::default()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Section without Title"
                        }
                        Section {
                            div { class: ClassesBuilder::default().add(TextColor::Secondary).build(),
                                "Sections can also be used without titles for simple content grouping."
                            }
                        }
                    }
                }

                // Row Examples
                Section {
                    title: Some("Row".to_string()),
                    class: ClassesBuilder::default().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::default().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::default()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Row Layout"
                        }
                        p { class: ClassesBuilder::default().add(TextColor::Secondary).build(),
                            "Row component for horizontal layouts with configurable gaps"
                        }
                        Row { gap: "md".to_string(),
                            div {
                                class: ClassesBuilder::default()
                                    .add(Padding::P4)
                                    .add(BorderRadius::Rounded)
                                    .add(BgColor::White)
                                    .add(TextColor::Primary)
                                    .build(),
                                "Item 1"
                            }
                            div {
                                class: ClassesBuilder::default()
                                    .add(Padding::P4)
                                    .add(BorderRadius::Rounded)
                                    .add(BgColor::White)
                                    .add(TextColor::Primary)
                                    .build(),
                                "Item 2"
                            }
                            div {
                                class: ClassesBuilder::default()
                                    .add(Padding::P4)
                                    .add(BorderRadius::Rounded)
                                    .add(BgColor::White)
                                    .add(TextColor::Primary)
                                    .build(),
                                "Item 3"
                            }
                        }
                    }
                }

                // Usage Examples
                Section {
                    title: Some("Usage Examples".to_string()),
                    class: ClassesBuilder::default().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::default().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::default()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Layout Structure"
                        }
                        div {
                            class: ClassesBuilder::default()
                                .add(Padding::P4)
                                .add(BorderRadius::Rounded)
                                .add(BgColor::Surface)
                                .add(TextColor::Muted)
                                .build(),
                            code {
                                r#"HikariLayout {{
    header: rsx! {{ Header {{ ... }} }},
    aside: rsx! {{ Aside {{ ... }} }},
    Content {{
        // Your content here
    }}
}}"#
                            }
                        }
                    }
                }
            }
        }
    }
}
