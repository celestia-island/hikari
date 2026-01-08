// website/src/pages/components/input.rs
// Input component showcase page with real rendered examples

extern crate components as hikari_components;

use dioxus::prelude::*;
use components::{
    Input, InputSize,
    layout::{Container, Section}
};
use icons::{Icon, LucideIcon};
use palette::classes::{
    ClassesBuilder, MarginBottom, FontSize, FontWeight, TextColor,
    Padding, PaddingLeft, Margin,
};

use crate::{app::Route, components::Layout};

#[allow(non_snake_case)]
pub fn ComponentsInput() -> Element {
    rsx! {
        Layout { current_route: Route::ComponentsBasic {},

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
                        "Input"
                    }
                    p { class: ClassesBuilder::new().add(Margin::M0).add(TextColor::Gray600).build(),
                        "Text input fields for user data entry with FUI aesthetics"
                    }
                }

                // Overview
                Section {
                    title: Some("Overview".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(TextColor::Gray600).build(),
                        p { "Input fields allow users to enter and edit text. They support:" }
                        ul { class: ClassesBuilder::new().add(PaddingLeft::Pl6).add(Margin::M0).build(),
                            li {
                                strong { "Multiple sizes" }
                                " - Small, Medium, Large"
                            }
                            li {
                                strong { "States" }
                                " - Disabled, Readonly, Normal"
                            }
                            li {
                                strong { "Spotlight effect" }
                                " - FUI-style cursor-following glow"
                            }
                            li {
                                strong { "Icons" }
                                " - Prefix and suffix icons"
                            }
                            li {
                                strong { "Events" }
                                " - oninput, onfocus, onblur, onkeydown"
                            }
                        }
                    }
                }

                // Basic Input
                Section {
                    title: Some("Basic Input".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Gray700)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Default Input"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Gray600).build(),
                            "Basic text input with placeholder"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            Input { placeholder: "Enter text..." }
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
                            "Input with Value"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Gray600).build(),
                            "Input with pre-filled value"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            Input { value: "Hello, Hikari!".to_string() }
                        }
                    }
                }

                // Input Sizes
                Section {
                    title: Some("Input Sizes".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Gray700)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Size Variants"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Gray600).build(),
                            "Inputs come in three sizes for different contexts"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            Input {
                                size: InputSize::Small,
                                placeholder: "Small input",
                            }
                            Input {
                                size: InputSize::Medium,
                                placeholder: "Medium input",
                            }
                            Input {
                                size: InputSize::Large,
                                placeholder: "Large input",
                            }
                        }
                    }
                }

                // Input States
                Section {
                    title: Some("Input States".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Gray700)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Disabled Input"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Gray600).build(),
                            "Disabled inputs cannot be edited"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            Input {
                                disabled: true,
                                value: "Disabled input".to_string(),
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
                            "Readonly Input"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Gray600).build(),
                            "Readonly inputs can be focused but not edited"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            Input {
                                readonly: true,
                                value: "Readonly input".to_string(),
                            }
                        }
                    }
                }

                // Spotlight Effect
                Section {
                    title: Some("Spotlight Effect".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(TextColor::Gray600).build(),
                        p {
                            "The spotlight effect creates a FUI-style glow that follows your cursor when hovering over the input field."
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
                            "Input with Spotlight"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            Input {
                                placeholder: "Hover over me...",
                                spotlight: true,
                            }
                        }
                    }
                }

                // Input with Icons
                Section {
                    title: Some("Input with Icons".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Gray700)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Prefix Icon"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Gray600).build(),
                            "Icon displayed before the input text"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            Input {
                                placeholder: "Search...",
                                prefix_icon: rsx! {
                                    Icon { icon: LucideIcon::badge, size: 16 }
                                },
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
                            "Suffix Icon"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Gray600).build(),
                            "Icon displayed after the input text"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            Input {
                                placeholder: "Enter email...",
                                suffix_icon: rsx! {
                                    Icon { icon: LucideIcon::badge, size: 16 }
                                },
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
                            "Both Prefix and Suffix Icons"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Gray600).build(),
                            "Icons on both sides of the input"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            Input {
                                placeholder: "https://example.com",
                                prefix_icon: rsx! {
                                    Icon { icon: LucideIcon::badge, size: 16 }
                                },
                                suffix_icon: rsx! {
                                    Icon { icon: LucideIcon::badge, size: 16 }
                                },
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
                            "Icons with Spotlight"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Gray600).build(),
                            "Combined icon and spotlight effect"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            Input {
                                placeholder: "Search with spotlight...",
                                prefix_icon: rsx! {
                                    Icon { icon: LucideIcon::badge, size: 16 }
                                },
                                spotlight: true,
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
                            "Basic Input"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            code { r#"Input {{
    placeholder: "Enter text..."
}}"# }
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
                            "Controlled Input"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            code {
                                r#"let mut text = use_signal(|| String::new());

Input {{
    value: text.read().clone(),
    placeholder: "Type something...",
    oninput: move |e| text.set(e.data.value()),
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
                            "Input with Icons"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            code {
                                r#"Input {{
    placeholder: "Search...",
    prefix_icon: rsx! {{
        Icon {{ icon: LucideIcon::badge, size: 16 }}
    }},
    spotlight: true,
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
                            "Input with Event Handlers"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            code {
                                r#"Input {{
    placeholder: "Press Enter...",
    onfocus: move |_| println!("Focused"),
    onblur: move |_| println!("Blurred"),
    onkeydown: move |e| {{
        if e.data.key() == "Enter" {{
            println!("Enter pressed!");
        }}
    }},
}}"#
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
                                .add(TextColor::Gray700)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Search Input"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            Input {
                                placeholder: "Search...",
                                prefix_icon: rsx! {
                                    Icon { icon: LucideIcon::badge, size: 16 }
                                },
                                spotlight: true,
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
                            "Email Input"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            Input {
                                placeholder: "your@email.com",
                                prefix_icon: rsx! {
                                    Icon { icon: LucideIcon::badge, size: 16 }
                                },
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
                            "URL Input"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            Input {
                                placeholder: "https://",
                                prefix_icon: rsx! {
                                    Icon { icon: LucideIcon::badge, size: 16 }
                                },
                                suffix_icon: rsx! {
                                    Icon { icon: LucideIcon::badge, size: 16 }
                                },
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
                            "Password Input"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            Input {
                                placeholder: "Enter password...",
                                prefix_icon: rsx! {
                                    Icon { icon: LucideIcon::badge, size: 16 }
                                },
                                suffix_icon: rsx! {
                                    Icon { icon: LucideIcon::badge, size: 16 }
                                },
                            }
                        }
                    }
                }
            }
        }
    }
}
