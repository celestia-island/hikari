// website/src/pages/components/entry/search_doc.rs
// Search component documentation page

use dioxus::prelude::*;

use crate::{app::Route, components::Layout};
use _components::{entry::Search, layout::{Container, Section}};
use _palette::classes::{ClassesBuilder, FontSize, FontWeight, MarginBottom, TextColor};

// Code examples as constants
const CODE_BASIC: &str = r#"let mut search = use_signal(|| String::new());

Search {
    value: search(),
    placeholder: "Search...".to_string(),
    on_search: move |v| {
        println!("Searching for: {}", v);
    },
    on_clear: |_| {},
}"#;

const CODE_CLEAR: &str = r#"let mut search = use_signal(|| String::new);

Search {
    value: search(),
    placeholder: "Search...".to_string(),
    allow_clear: true,
    on_search: move |v| search.set(v),
    on_clear: |_| search.set(String::new()),
}"#;

const CODE_LOADING: &str = r#"let mut search = use_signal(|| String::new);
let mut loading = use_signal(|| false);

Search {
    value: search(),
    placeholder: "Search...".to_string(),
    loading: loading(),
    allow_clear: true,
    on_search: move |v| {
        search.set(v);
        loading.set(true);
        spawn(async move {
            // search logic
            loading.set(false);
        });
    },
    on_clear: |_| search.set(String::new()),
}"#;

const CODE_DISABLED: &str = r#"Search {
    value: "Search query".to_string(),
    placeholder: "Search...".to_string(),
    disabled: true,
    on_search: |_| {},
    on_clear: |_| {},
}"#;

#[allow(non_snake_case)]
pub fn SearchDoc() -> Element {
    let mut search1 = use_signal(|| String::new());
    let mut search2 = use_signal(|| String::new());
    let mut loading1 = use_signal(|| false);
    let mut search3 = use_signal(|| String::new());
    let mut search4 = use_signal(|| "Search query".to_string());

    rsx! {
        Layout {
            current_route: Route::ComponentsOverview {}, // Using existing route for now

            Container {
                // Page header
                div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                    h1 {
                        class: ClassesBuilder::new()
                            .add(FontSize::X4xl)
                            .add(FontWeight::Bold)
                            .add(MarginBottom::Mb2)
                            .build(),
                        "Search"
                    }
                    p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                        "Search input component with optional clear button and loading state"
                    }
                }

                // Overview
                Section {
                    title: Some("Overview".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                        p {
                            "Search is a dedicated search input component that supports:"
                        }
                        ul { class: ClassesBuilder::new().add_raw("pl-6").build(),
                            li { "Loading state indicator" }
                            li { "Clear button" }
                            li { "Disabled state" }
                            li { "Custom placeholder" }
                            li { "Real-time search callbacks" }
                        }
                    }
                }

                // Basic Search
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
                            "Simple Search"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Basic search input with default placeholder"
                        }
                        div { class: ClassesBuilder::new().add_raw("p-6").build(),
                            Search {
                                value: search1(),
                                placeholder: "Search...".to_string(),
                                on_search: move |v| {
                                    println!("Searching for: {}", v);
                                },
                                on_clear: |_| {},
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
                            "With Clear Button"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Search with clear button to reset input"
                        }
                        div { class: ClassesBuilder::new().add_raw("p-6").build(),
                            Search {
                                value: search2(),
                                placeholder: "Search...".to_string(),
                                allow_clear: true,
                                on_search: move |v| {
                                    search2.set(v);
                                },
                                on_clear: move |_| {
                                    search2.set(String::new());
                                },
                            }
                            if !search2().is_empty() {
                                div { class: ClassesBuilder::new().add_raw("mt-4").add(TextColor::Secondary).build(),
                                    "Searching: {search2()}"
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
                            "With Loading State"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Search with loading indicator"
                        }
                        div { class: ClassesBuilder::new().add_raw("p-6").build(),
                            Search {
                                value: search3(),
                                placeholder: "Search...".to_string(),
                                loading: loading1(),
                                allow_clear: true,
                                on_search: move |v| {
                                    search3.set(v);
                                    loading1.set(true);
                                    // In real usage, you would spawn an async task here
                                    loading1.set(false);
                                },
                                on_clear: move |_| {
                                    search3.set(String::new());
                                },
                            }
                        }
                    }
                }

                // Disabled State
                Section {
                    title: Some("Disabled State".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Disabled Search"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Disabled search cannot be interacted with"
                        }
                        div { class: ClassesBuilder::new().add_raw("p-6").build(),
                            Search {
                                value: search4(),
                                placeholder: "Search...".to_string(),
                                disabled: true,
                                on_search: |_| {},
                                on_clear: |_| {},
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
                            "Basic Search"
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
                            "With Clear Button"
                        }
                        div { class: ClassesBuilder::new().add_raw("p-6").build(),
                            code { "{CODE_CLEAR}" }
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
                            "With Loading State"
                        }
                        div { class: ClassesBuilder::new().add_raw("p-6").build(),
                            code { "{CODE_LOADING}" }
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
                            "Disabled"
                        }
                        div { class: ClassesBuilder::new().add_raw("p-6").build(),
                            code { "{CODE_DISABLED}" }
                        }
                    }
                }
            }
        }
    }
}
