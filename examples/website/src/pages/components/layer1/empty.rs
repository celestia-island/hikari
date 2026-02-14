// website/src/pages/components/display/empty.rs
// Empty component showcase page with real rendered examples

use dioxus::prelude::*;

use crate::{app::Route, components::Layout};
use _components::{
    display::Empty as EmptyComponent,
    layout::{Container, Section},
    Button, ButtonVariant,
};
use _palette::classes::{ClassesBuilder, FontSize, FontWeight, MarginBottom, Padding, TextColor};

#[allow(non_snake_case)]
pub fn Empty() -> Element {
    rsx! {
        Layout {
            current_route: Route::Empty {},

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
                        "Empty"
                    }
                    p { class: ClassesBuilder::new().add(MarginBottom::Mb0).add(TextColor::Secondary).build(),
                        "Empty state placeholders for lists, tables, and data displays"
                    }
                }

                // Overview
                Section {
                    title: Some("Overview".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                        p {
                            "Empty components provide visual feedback when no data is available. They support:"
                        }
                        ul { class: ClassesBuilder::new().add_raw("pl-6").add(MarginBottom::Mb0).build(),
                            li {
                                strong { "Custom images" }
                                " - Optional illustration or icon"
                            }
                            li {
                                strong { "Title and description" }
                                " - Clear messaging about empty state"
                            }
                            li {
                                strong { "Action buttons" }
                                " - Call-to-action to guide users"
                            }
                            li {
                                strong { "Flexible styling" }
                                " - Custom classes and inline styles"
                            }
                        }
                    }
                }

                // Basic Empty
                Section {
                    title: Some("Basic Empty States".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Description Only"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Simple empty state with just a description"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            EmptyComponent {
                                description: "No data available".to_string(),
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
                            "With Title"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Empty state with title and description"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            EmptyComponent {
                                title: Some("No Results Found".to_string()),
                                description: "Try adjusting your search or filters".to_string(),
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
                            "With Image"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Empty state with illustration image"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            EmptyComponent {
                                image: Some("https://cdn-icons-png.flaticon.com/512/7486/7486747.png".to_string()),
                                title: Some("No Files".to_string()),
                                description: "Upload files to get started".to_string(),
                            }
                        }
                    }
                }

                // Empty with Actions
                Section {
                    title: Some("Empty with Actions".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Single Action"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Empty state with a primary action button"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            EmptyComponent {
                                title: Some("No Notifications".to_string()),
                                description: "You're all caught up!".to_string(),
                                action: rsx! {
                                    Button {
                                        variant: ButtonVariant::Primary,
                                        "Refresh"
                                    }
                                },
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
                            "Multiple Actions"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Empty state with multiple action options"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            EmptyComponent {
                                title: Some("No Projects Yet".to_string()),
                                description: "Create your first project to get started".to_string(),
                                action: rsx! {
                                    div { style: "display: flex; gap: 0.5rem;",
                                        Button {
                                            variant: ButtonVariant::Primary,
                                            "Create Project"
                                        }
                                        Button {
                                            variant: ButtonVariant::Secondary,
                                            "Learn More"
                                        }
                                    }
                                },
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
                            "Search No Results"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "When search returns no results"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            EmptyComponent {
                                image: Some("https://cdn-icons-png.flaticon.com/512/7486/7486747.png".to_string()),
                                title: Some("No Results Found".to_string()),
                                description: "We couldn't find anything matching your search".to_string(),
                                action: rsx! {
                                    Button {
                                        variant: ButtonVariant::Secondary,
                                        "Clear Filters"
                                    }
                                },
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
                            "Empty List"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "When a list is empty"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            EmptyComponent {
                                description: "List is empty".to_string(),
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
                            "No Internet Connection"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Offline state"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            EmptyComponent {
                                image: Some("https://cdn-icons-png.flaticon.com/512/564/564619.png".to_string()),
                                title: Some("No Internet Connection".to_string()),
                                description: "Please check your internet connection and try again".to_string(),
                                action: rsx! {
                                    Button {
                                        variant: ButtonVariant::Primary,
                                        "Retry"
                                    }
                                },
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
                            "Basic Empty"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            code { r#"EmptyComponent {{ description: "No data available".to_string() }}"# }
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
                            "Empty with Image and Action"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            code {
                                r#"EmptyComponent {{
    image: Some("icon.png".to_string()),
    title: Some("No Results".to_string()),
    description: "Try adjusting your search".to_string(),
    action: rsx! {{
        Button {{ variant: ButtonVariant::Primary, "Search Again" }}
    }},
}}"#
                            }
                        }
                    }
                }
            }
        }
    }
}
