// demo-app/src/pages/basic_components.rs
// Basic components demonstration page

use dioxus::prelude::*;
use components::*;

use crate::{app::Route, components::{Layout, Section}};

#[component]
pub fn ComponentsBasic() -> Element {
    rsx! {
        Layout {
            current_route: Route::ComponentsBasic {},

            h1 { class: "hi-text-3xl lg:text-4xl hi-font-bold mb-8 hi-text-dark-theme",
                "Basic Components"
            }

            Section {
                title: "Buttons".to_string(),
                children: rsx! {
                    div { class: "hi-flex hi-flex-wrap gap-3 hi-items-center",
                        Button { variant: ButtonVariant::Primary, "Primary Button" }
                        Button { variant: ButtonVariant::Secondary, "Secondary Button" }
                        Button { variant: ButtonVariant::Ghost, "Ghost Button" }
                        Button { variant: ButtonVariant::Danger, "Danger Button" }
                        Button { variant: ButtonVariant::Success, "Success Button" }
                    }

                    div { class: "hi-flex hi-flex-wrap gap-3 hi-items-center mt-5",
                        Button { size: ButtonSize::Small, "Small" }
                        Button { size: ButtonSize::Medium, "Medium" }
                        Button { size: ButtonSize::Large, "Large" }
                    }

                    div { class: "hi-flex hi-flex-wrap gap-3 hi-items-center mt-5",
                        Button { loading: true, "Loading..." }
                        Button { disabled: true, "Disabled" }
                    }
                }
            }

            Section {
                title: "Inputs".to_string(),
                children: rsx! {
                    div { class: "hi-flex hi-flex-col gap-4 max-w-md",
                        div {
                            label { class: "hi-block mb-1.5 hi-font-medium hi-text-gray-700", "Default Input" }
                            Input { placeholder: "Enter text..." }
                        }

                        div {
                            label { class: "hi-block mb-1.5 hi-font-medium hi-text-gray-700", "Disabled Input" }
                            Input { disabled: true, value: "Disabled input" }
                        }
                    }
                }
            }

            Section {
                title: "Cards".to_string(),
                children: rsx! {
                    div { class: "hi-grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(250px,1fr))] gap-5",
                        Card {
                            title: "Card Title".to_string(),
                            div { class: "hi-m-0 hi-text-gray-600", "This is a simple card with header and content." }
                        }

                        Card {
                            h3 { class: "hi-m-0 mb-2.5", "Simple Card" }
                            p { class: "hi-m-0 hi-text-gray-600", "Card without header, just content." }
                        }
                    }
                }
            }

            Section {
                title: "Badges".to_string(),
                children: rsx! {
                    div { class: "hi-flex hi-flex-wrap gap-3 hi-items-center",
                        Badge { variant: BadgeVariant::Default, "Default" }
                        Badge { variant: BadgeVariant::Primary, "Primary" }
                        Badge { variant: BadgeVariant::Success, "Success" }
                        Badge { variant: BadgeVariant::Warning, "Warning" }
                        Badge { variant: BadgeVariant::Danger, "Danger" }
                    }
                }
            }
        }
    }
}
