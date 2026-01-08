// demo-app/src/pages/components/layout.rs
// Layout components showcase page

extern crate components as hikari_components;

use components::layout::{Container, Row, Section};
use dioxus::prelude::*;
use palette::classes::{
    BgColor, BorderRadius, ClassesBuilder, Display, FlexDirection, FontSize, FontWeight, Gap,
    Margin, MarginBottom, Padding, PaddingLeft, TextColor,
};

use crate::{app::Route, components::Layout};

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
                            .add(Margin::M0)
                            .add(MarginBottom::Mb2)
                            .build(),
                        "Layout Components"
                    }
                    p { class: ClassesBuilder::default().add(Margin::M0).add(TextColor::Gray600).build(),
                        "Structural components for building application layouts with FUI aesthetics"
                    }
                }

                // Layout System Overview
                Section {
                    title: Some("Layout System".to_string()),
                    class: ClassesBuilder::default().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::default().add(TextColor::Gray600).build(),
                        p {
                            "The Hikari Layout system provides a flexible set of components for building responsive application layouts. It includes:"
                        }
                        ul { class: ClassesBuilder::default().add(PaddingLeft::Pl6).add(Margin::M0).build(),
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
                                .add(TextColor::Gray700)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Basic Container"
                        }
                        p { class: ClassesBuilder::default().add(TextColor::Gray600).build(),
                            "Container provides consistent spacing and max-width for content"
                        }
                        Container {
                            div {
                                class: ClassesBuilder::default()
                                    .add(Padding::P6)
                                    .add(BorderRadius::Lg)
                                    .add(BgColor::White)
                                    .add(TextColor::Gray700)
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
                                .add(TextColor::Gray700)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Section with Title"
                        }
                        Section { title: Some("Section Title".to_string()),
                            div { class: ClassesBuilder::default().add(TextColor::Gray600).build(),
                                "Sections provide themed styling with optional headers. Perfect for grouping related content."
                            }
                        }
                    }

                    div { class: ClassesBuilder::default().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::default()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Gray700)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Section without Title"
                        }
                        Section {
                            div { class: ClassesBuilder::default().add(TextColor::Gray600).build(),
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
                                .add(TextColor::Gray700)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Row Layout"
                        }
                        p { class: ClassesBuilder::default().add(TextColor::Gray600).build(),
                            "Row component for horizontal layouts with configurable gaps"
                        }
                        Row { gap: "md".to_string(),
                            div {
                                class: ClassesBuilder::default()
                                    .add(Padding::P4)
                                    .add(BorderRadius::Rounded)
                                    .add(BgColor::White)
                                    .add(TextColor::Gray700)
                                    .build(),
                                "Item 1"
                            }
                            div {
                                class: ClassesBuilder::default()
                                    .add(Padding::P4)
                                    .add(BorderRadius::Rounded)
                                    .add(BgColor::White)
                                    .add(TextColor::Gray700)
                                    .build(),
                                "Item 2"
                            }
                            div {
                                class: ClassesBuilder::default()
                                    .add(Padding::P4)
                                    .add(BorderRadius::Rounded)
                                    .add(BgColor::White)
                                    .add(TextColor::Gray700)
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
                                .add(TextColor::Gray700)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Layout Structure"
                        }
                        div {
                            class: ClassesBuilder::default()
                                .add(Padding::P4)
                                .add(BorderRadius::Rounded)
                                .add(BgColor::Gray900)
                                .add(TextColor::Gray400)
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
