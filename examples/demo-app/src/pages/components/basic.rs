// demo-app/src/pages/basic_components.rs
// Basic components demonstration page

use dioxus::prelude::*;
use hikari_components::*;

use crate::{app::Route, components::{Layout, Section}};

#[component]
pub fn ComponentsBasic() -> Element {
    rsx! {
        Layout {
            current_route: Route::ComponentsBasic {},

            h1 { class: "text-3xl lg:text-4xl font-bold mb-8 text-[#1a1a2e]",
                "Basic Components"
            }

            Section {
                title: "Buttons".to_string(),
                children: rsx! {
                    div { class: "flex flex-wrap gap-3 items-center",
                        Button { variant: ButtonVariant::Primary, "Primary Button" }
                        Button { variant: ButtonVariant::Secondary, "Secondary Button" }
                        Button { variant: ButtonVariant::Ghost, "Ghost Button" }
                        Button { variant: ButtonVariant::Danger, "Danger Button" }
                        Button { variant: ButtonVariant::Success, "Success Button" }
                    }

                    div { class: "flex flex-wrap gap-3 items-center mt-5",
                        Button { size: ButtonSize::Small, "Small" }
                        Button { size: ButtonSize::Medium, "Medium" }
                        Button { size: ButtonSize::Large, "Large" }
                    }

                    div { class: "flex flex-wrap gap-3 items-center mt-5",
                        Button { loading: true, "Loading..." }
                        Button { disabled: true, "Disabled" }
                    }
                }
            }

            Section {
                title: "Inputs".to_string(),
                children: rsx! {
                    div { class: "flex flex-col gap-4 max-w-md",
                        div {
                            label { class: "block mb-1.5 font-medium text-gray-700", "Default Input" }
                            Input { placeholder: "Enter text..." }
                        }

                        div {
                            label { class: "block mb-1.5 font-medium text-gray-700", "Disabled Input" }
                            Input { disabled: true, value: "Disabled input" }
                        }
                    }
                }
            }

            Section {
                title: "Cards".to_string(),
                children: rsx! {
                    div { class: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(250px,1fr))] gap-5",
                        Card {
                            title: "Card Title".to_string(),
                            div { class: "m-0 text-gray-600", "This is a simple card with header and content." }
                        }

                        Card {
                            h3 { class: "m-0 mb-2.5", "Simple Card" }
                            p { class: "m-0 text-gray-600", "Card without header, just content." }
                        }
                    }
                }
            }

            Section {
                title: "Badges".to_string(),
                children: rsx! {
                    div { class: "flex flex-wrap gap-3 items-center",
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
