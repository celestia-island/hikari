// website/src/pages/components/extra/user_guide_doc.rs
// UserGuide component documentation page

use dioxus::prelude::*;

use crate::{app::Route, components::Layout};
use _components::layout::{Container, Section};
use _extra_components::extra::{GuidePosition, GuideStep, UserGuide as UserGuideComponent};
use _palette::classes::{ClassesBuilder, FontSize, FontWeight, MarginBottom, TextColor};

// Code examples as constants
const CODE_BASIC: &str = r#"UserGuideComponent {
    title: "Welcome to Hikari!".to_string(),
    description: "Let's get you started with a quick tour.".to_string(),
    steps: vec![
        GuideStep {
            title: "Step 1".to_string(),
            description: "Learn about components".to_string(),
            icon: "🎨".to_string(),
            target_selector: ".hi-button".to_string(),
            completed: false,
        }
    ],
    visible: true,
}"#;

const CODE_POSITION: &str = r#"UserGuideComponent {
    title: "Quick Tour".to_string(),
    description: "A 3-step tour of the interface.".to_string(),
    steps: vec![...],
    visible: true,
    position: GuidePosition::TopRight,
}"#;

const CODE_SKIP: &str = r#"UserGuideComponent {
    title: "Onboarding".to_string(),
    description: "Welcome aboard!".to_string(),
    steps: vec![...],
    visible: true,
    allow_skip: true,
    allow_close: true,
}"#;

#[allow(non_snake_case)]
pub fn UserGuide() -> Element {
    let mut show_guide1 = use_signal(|| false);
    let mut show_guide2 = use_signal(|| false);
    let mut show_guide3 = use_signal(|| false);

    rsx! {
        Layout {
            current_route: Route::UserGuide {},

            Container {
                // Page header
                div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                    h1 {
                        class: ClassesBuilder::new()
                            .add(FontSize::X4xl)
                            .add(FontWeight::Bold)
                            .add(MarginBottom::Mb2)
                            .build(),
                        "UserGuide"
                    }
                    p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                        "Step-by-step user onboarding with guided tours"
                    }
                }

                // Overview
                Section {
                    title: Some("Overview".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                        p {
                            "UserGuide is an onboarding component that supports:"
                        }
                        ul { class: ClassesBuilder::new().add_raw("pl-6").build(),
                            li { "Multiple guide steps" }
                            li { "Progress tracking (1/N, 2/N, etc.)" }
                            li { "5 position options (Center, TopLeft, TopRight, BottomLeft, BottomRight)" }
                            li { "Skip and close functionality" }
                            li { "Icon support for each step" }
                            li { "Smooth animations" }
                        }
                    }
                }

                // Basic Usage
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
                            "3-Step Guide"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Click the button to start the guide"
                        }
                        div { class: ClassesBuilder::new().add_raw("p-6").add_raw("border").add_raw("rounded-lg").build(),
                            button {
                                class: "hi-button hi-button-primary",
                                onclick: move |_| show_guide1.set(true),
                                "Start Guide"
                            }
                            UserGuideComponent {
                                title: "Welcome to Hikari!".to_string(),
                                description: "Let's get you started with a quick tour.".to_string(),
                                steps: vec![
                                    GuideStep {
                                        title: "Components".to_string(),
                                        description: "Discover the wide range of UI components available in Hikari.".to_string(),
                                        icon: "🎨".to_string(),
                                        target_selector: ".hi-button".to_string(),
                                        completed: false,
                                    },
                                    GuideStep {
                                        title: "Theming".to_string(),
                                        description: "Learn about our color system and theme support.".to_string(),
                                        icon: "🎭".to_string(),
                                        target_selector: ".hi-badge".to_string(),
                                        completed: false,
                                    },
                                    GuideStep {
                                        title: "Get Started".to_string(),
                                        description: "You're all set! Start building amazing UIs.".to_string(),
                                        icon: "🚀".to_string(),
                                        target_selector: ".hi-card".to_string(),
                                        completed: false,
                                    },
                                ],
                                visible: show_guide1(),
                            }
                        }
                    }
                }

                // Position Options
                Section {
                    title: Some("Position Options".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Top Right Position"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Guide positioned in top right corner"
                        }
                        div { class: ClassesBuilder::new().add_raw("p-6").add_raw("border").add_raw("rounded-lg").build(),
                            button {
                                class: "hi-button hi-button-secondary",
                                onclick: move |_| show_guide2.set(true),
                                "Show Top Right Guide"
                            }
                            UserGuideComponent {
                                title: "Quick Tour".to_string(),
                                description: "A 2-step tour of the interface.".to_string(),
                                steps: vec![
                                    GuideStep {
                                        title: "Navigation".to_string(),
                                        description: "Use the navigation menu to explore.".to_string(),
                                        icon: "🧭".to_string(),
                                        target_selector: ".hi-menu".to_string(),
                                        completed: false,
                                    },
                                    GuideStep {
                                        title: "Actions".to_string(),
                                        description: "Perform actions using the buttons.".to_string(),
                                        icon: "⚡".to_string(),
                                        target_selector: ".hi-button".to_string(),
                                        completed: false,
                                    },
                                ],
                                visible: show_guide2(),
                                position: GuidePosition::TopRight,
                            }
                        }
                    }
                }

                // Skip and Close
                Section {
                    title: Some("Skip and Close".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Allow Skip and Close"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Users can skip the guide or close it at any time"
                        }
                        div { class: ClassesBuilder::new().add_raw("p-6").add_raw("border").add_raw("rounded-lg").build(),
                            button {
                                class: "hi-button hi-button-ghost",
                                onclick: move |_| show_guide3.set(true),
                                "Show Guide with Skip"
                            }
                            UserGuideComponent {
                                title: "Onboarding".to_string(),
                                description: "Welcome aboard! Let's show you around.".to_string(),
                                steps: vec![
                                    GuideStep {
                                        title: "Welcome".to_string(),
                                        description: "Welcome to Hikari UI framework!".to_string(),
                                        icon: "👋".to_string(),
                                        target_selector: ".hi-card".to_string(),
                                        completed: false,
                                    },
                                    GuideStep {
                                        title: "Explore".to_string(),
                                        description: "Explore the documentation and examples.".to_string(),
                                        icon: "📚".to_string(),
                                        target_selector: ".hi-card".to_string(),
                                        completed: false,
                                    },
                                ],
                                visible: show_guide3(),
                                allow_skip: true,
                                allow_close: true,
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
                            "Basic UserGuide"
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
                            "Position Options"
                        }
                        div { class: ClassesBuilder::new().add_raw("p-6").build(),
                            code { "{CODE_POSITION}" }
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
                            "Skip and Close"
                        }
                        div { class: ClassesBuilder::new().add_raw("p-6").build(),
                            code { "{CODE_SKIP}" }
                        }
                    }
                }
            }
        }
    }
}
