// website/src/pages/components/extra/collapsible_doc.rs
// Collapsible component documentation page

use dioxus::prelude::*;

use crate::{app::Route, components::Layout};
use _components::layout::{Container, Section};
use _extra_components::extra::{Collapsible, CollapsiblePosition};
use _palette::classes::{ClassesBuilder, FontSize, FontWeight, MarginBottom, TextColor};

// Code examples as constants
const CODE_BASIC: &str = r#"Collapsible {
    title: "Settings Panel".to_string(),
    position: CollapsiblePosition::Right,
    expanded: true,
    "Settings content goes here"
}"#;

const CODE_LEFT: &str = r#"Collapsible {
    title: "Left Panel".to_string(),
    position: CollapsiblePosition::Left,
    expanded: true,
    "Left panel content"
}"#;

const CODE_CUSTOM_WIDTH: &str = r#"Collapsible {
    title: "Wide Panel".to_string(),
    position: CollapsiblePosition::Right,
    expanded: true,
    width: "500".to_string(),
    "Wide panel content"
}"#;

const CODE_NOT_COLLAPSIBLE: &str = r#"Collapsible {
    title: "Fixed Panel".to_string(),
    position: CollapsiblePosition::Right,
    expanded: true,
    collapsible: false,
    "This panel cannot be collapsed"
}"#;

#[allow(non_snake_case)]
pub fn CollapsibleDoc() -> Element {
    let mut expanded1 = use_signal(|| true);
    let mut expanded2 = use_signal(|| false);
    let mut expanded3 = use_signal(|| true);
    let expanded4 = use_signal(|| true);

    rsx! {
        Layout {
            current_route: Route::CollapsibleDoc {},

            Container {
                // Page header
                div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                    h1 {
                        class: ClassesBuilder::new()
                            .add(FontSize::X4xl)
                            .add(FontWeight::Bold)
                            .add(MarginBottom::Mb2)
                            .build(),
                        "Collapsible"
                    }
                    p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                        "Collapsible panel component with slide-in/out animation"
                    }
                }

                // Overview
                Section {
                    title: Some("Overview".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                        p {
                            "Collapsible is a panel component that supports:"
                        }
                        ul { class: ClassesBuilder::new().add_raw("pl-6").build(),
                            li { "Left and right positioning" }
                            li { "Slide-in/out animation" }
                            li { "Customizable width" }
                            li { "Optional collapse/expand" }
                            li { "Keyboard accessible" }
                        }
                    }
                }

                // Basic Collapsible
                Section {
                    title: Some("Basic Usage".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Right Panel"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Collapsible panel on the right side"
                        }
                        div { class: ClassesBuilder::new().add_raw("p-6").add_raw("border").add_raw("rounded-lg").build(),
                            Collapsible {
                                title: "Settings Panel".to_string(),
                                position: CollapsiblePosition::Right,
                                expanded: expanded1(),
                                on_change: move |state| expanded1.set(state),
                                div { class: ClassesBuilder::new().add_raw("p-4").build(),
                                    "Settings content goes here"
                                    ul { class: ClassesBuilder::new().add_raw("pl-6").build(),
                                        li { "Option 1" }
                                        li { "Option 2" }
                                        li { "Option 3" }
                                    }
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
                            "Left Panel"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Collapsible panel on the left side"
                        }
                        div { class: ClassesBuilder::new().add_raw("p-6").add_raw("border").add_raw("rounded-lg").build(),
                            Collapsible {
                                title: "Navigation".to_string(),
                                position: CollapsiblePosition::Left,
                                expanded: expanded2(),
                                on_change: move |state| expanded2.set(state),
                                div { class: ClassesBuilder::new().add_raw("p-4").build(),
                                    "Navigation menu"
                                    ul { class: ClassesBuilder::new().add_raw("pl-6").build(),
                                        li { "Home" }
                                        li { "About" }
                                        li { "Contact" }
                                    }
                                }
                            }
                        }
                    }
                }

                // Custom Width
                Section {
                    title: Some("Custom Width".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Wide Panel"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Collapsible panel with custom width"
                        }
                        div { class: ClassesBuilder::new().add_raw("p-6").add_raw("border").add_raw("rounded-lg").build(),
                            Collapsible {
                                title: "Details Panel".to_string(),
                                position: CollapsiblePosition::Right,
                                expanded: expanded3(),
                                width: "500".to_string(),
                                on_change: move |state| expanded3.set(state),
                                div { class: ClassesBuilder::new().add_raw("p-4").build(),
                                    "Wide panel content with more space"
                                    p { "This panel has a width of 500px instead of the default 300px." }
                                }
                            }
                        }
                    }
                }

                // Not Collapsible
                Section {
                    title: Some("Not Collapsible".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Fixed Panel"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Panel that cannot be collapsed"
                        }
                        div { class: ClassesBuilder::new().add_raw("p-6").add_raw("border").add_raw("rounded-lg").build(),
                            Collapsible {
                                title: "Information Panel".to_string(),
                                position: CollapsiblePosition::Right,
                                expanded: expanded4(),
                                collapsible: false,
                                div { class: ClassesBuilder::new().add_raw("p-4").build(),
                                    "This panel cannot be collapsed"
                                    p { "Use collapsible: false to prevent the user from collapsing the panel." }
                                }
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
                            "Basic Collapsible"
                        }
                        div { class: ClassesBuilder::new().add_raw("p-6").build(),
                            code { "{CODE_BASIC}" }
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
                            "Left Position"
                        }
                        div { class: ClassesBuilder::new().add_raw("p-6").build(),
                            code { "{CODE_LEFT}" }
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
                            "Custom Width"
                        }
                        div { class: ClassesBuilder::new().add_raw("p-6").build(),
                            code { "{CODE_CUSTOM_WIDTH}" }
                        }
                    }

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb0).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Not Collapsible"
                        }
                        div { class: ClassesBuilder::new().add_raw("p-6").build(),
                            code { "{CODE_NOT_COLLAPSIBLE}" }
                        }
                    }
                }
            }
        }
    }
}
