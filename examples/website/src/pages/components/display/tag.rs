// website/src/pages/components/display/tag.rs
// Tag component showcase page with real rendered examples

use dioxus::prelude::*;

use crate::{app::Route, components::Layout};
use _components::{display::{Tag, TagVariant}, layout::{Container, Section}};
use _palette::classes::{ ClassesBuilder, Display, FontSize, FontWeight, Gap, MarginBottom, Padding, TextColor, };

#[allow(non_snake_case)]
pub fn ComponentsTag() -> Element {
    rsx! {
        Layout {
            current_route: Route::DisplayTag {},

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
                        "Tag"
                    }
                    p { class: ClassesBuilder::new().add(MarginBottom::Mb0).add(TextColor::Secondary).build(),
                        "Tag labels with optional close button for keywords and status"
                    }
                }

                // Overview
                Section {
                    title: Some("Overview".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                        p {
                            "Tags are used to categorize and label content. They support:"
                        }
                        ul { class: ClassesBuilder::new().add_raw("pl-6").add(MarginBottom::Mb0).build(),
                            li {
                                strong { "Multiple variants" }
                                " - Default, Primary, Success, Warning, Danger, Info"
                            }
                            li {
                                strong { "Closable" }
                                " - Optional close button for removing tags"
                            }
                            li {
                                strong { "Event handlers" }
                                " - Close event callbacks"
                            }
                            li {
                                strong { "Hover effects" }
                                " - Subtle background and glow transitions"
                            }
                        }
                    }
                }

                // Tag Variants
                Section {
                    title: Some("Tag Variants".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Default Tag"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Neutral gray tag for general use"
                        }
                        div { class: ClassesBuilder::new().add(Display::Flex).add(Gap::Gap4).add(Padding::P6).build(),
                            Tag { variant: TagVariant::Default, "JavaScript" }
                            Tag { variant: TagVariant::Default, "TypeScript" }
                            Tag { variant: TagVariant::Default, "CSS" }
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
                            "Primary Tag"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Blue tag for primary categories"
                        }
                        div { class: ClassesBuilder::new().add(Display::Flex).add(Gap::Gap4).add(Padding::P6).build(),
                            Tag { variant: TagVariant::Primary, "Frontend" }
                            Tag { variant: TagVariant::Primary, "Backend" }
                            Tag { variant: TagVariant::Primary, "DevOps" }
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
                            "Success Tag"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Green tag for positive status"
                        }
                        div { class: ClassesBuilder::new().add(Display::Flex).add(Gap::Gap4).add(Padding::P6).build(),
                            Tag { variant: TagVariant::Success, "Completed" }
                            Tag { variant: TagVariant::Success, "Active" }
                            Tag { variant: TagVariant::Success, "Passed" }
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
                            "Warning Tag"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Yellow/orange tag for warnings"
                        }
                        div { class: ClassesBuilder::new().add(Display::Flex).add(Gap::Gap4).add(Padding::P6).build(),
                            Tag { variant: TagVariant::Warning, "Pending" }
                            Tag { variant: TagVariant::Warning, "Review" }
                            Tag { variant: TagVariant::Warning, "Beta" }
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
                            "Danger Tag"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Red tag for dangerous or critical items"
                        }
                        div { class: ClassesBuilder::new().add(Display::Flex).add(Gap::Gap4).add(Padding::P6).build(),
                            Tag { variant: TagVariant::Danger, "Error" }
                            Tag { variant: TagVariant::Danger, "Failed" }
                            Tag { variant: TagVariant::Danger, "Deleted" }
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
                            "Info Tag"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Cyan tag for informational content"
                        }
                        div { class: ClassesBuilder::new().add(Display::Flex).add(Gap::Gap4).add(Padding::P6).build(),
                            Tag { variant: TagVariant::Info, "Info" }
                            Tag { variant: TagVariant::Info, "Note" }
                            Tag { variant: TagVariant::Info, "Documentation" }
                        }
                    }
                }

                // Closable Tags
                Section {
                    title: Some("Closable Tags".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Removable Tags"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Tags with close button that trigger on_close callback"
                        }
                        div { class: ClassesBuilder::new().add(Display::Flex).add(Gap::Gap4).add(Padding::P6).build(),
                            Tag {
                                variant: TagVariant::Primary,
                                closable: true,
                                "React"
                            }
                            Tag {
                                variant: TagVariant::Primary,
                                closable: true,
                                "Vue"
                            }
                            Tag {
                                variant: TagVariant::Primary,
                                closable: true,
                                "Angular"
                            }
                            Tag {
                                variant: TagVariant::Success,
                                closable: true,
                                "Svelte"
                            }
                        }
                    }
                }

                // Tag Combinations
                Section {
                    title: Some("Tag Combinations".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Multiple Variants Together"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Combining different tag variants for categorization"
                        }
                        div { class: ClassesBuilder::new().add(Display::Flex).add(Gap::Gap4).add(Padding::P6).build(),
                            Tag { variant: TagVariant::Default, "JavaScript" }
                            Tag { variant: TagVariant::Primary, "Frontend" }
                            Tag { variant: TagVariant::Success, "Active" }
                            Tag { variant: TagVariant::Warning, "Beta" }
                            Tag { variant: TagVariant::Info, "v2.0" }
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
                            "Closable Mix"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Mix of closable and non-closable tags"
                        }
                        div { class: ClassesBuilder::new().add(Display::Flex).add(Gap::Gap4).add(Padding::P6).build(),
                            Tag { variant: TagVariant::Default, "Rust" }
                            Tag {
                                variant: TagVariant::Primary,
                                closable: true,
                                "WebAssembly"
                            }
                            Tag { variant: TagVariant::Success, "Stable" }
                            Tag {
                                variant: TagVariant::Warning,
                                closable: true,
                                "Experimental"
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
                            "Basic Tag"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            code { r#"Tag {{ "Label" }}"# }
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
                            "Primary Tag"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            code { r#"Tag {{ variant: TagVariant::Primary, "Category" }}"# }
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
                            "Closable Tag"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            code {
                                r#"Tag {{
    variant: TagVariant::Success,
    closable: true,
    on_close: move |_| println!("Tag closed"),
    "Label"
}}"#
                            }
                        }
                    }
                }
            }
        }
    }
}
