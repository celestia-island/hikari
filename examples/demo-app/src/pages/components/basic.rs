// demo-app/src/pages/components/basic.rs
// Basic components demonstration page with FUI styling

extern crate components as hikari_components;

use dioxus::prelude::*;
use components::{
    Button, ButtonVariant, ButtonSize, ButtonAnimation, Input, Card, Badge, BadgeVariant,
    layout::{Container, Section, Row}
};

use crate::{app::Route, components::Layout};

#[component]
pub fn ComponentsBasic() -> Element {
    rsx! {
        Layout {
            current_route: Route::ComponentsBasic {},

            Container {
                // Page header
                div {
                    class: "showcase-header",
                    h1 {
                        class: "showcase-page-title",
                        "Basic Components"
                    }
                    p {
                        class: "showcase-page-description",
                        "Essential UI building blocks with FUI aesthetics"
                    }
                }

                // Buttons Section
                Section {
                    title: Some("Buttons".to_string()),
                    class: "showcase-section",

                    // Button variants
                    div {
                        class: "showcase-subsection",
                        h3 {
                            class: "showcase-subtitle",
                            "Button Variants"
                        }
                        Row {
                            gap: "md".to_string(),
                            Button { variant: ButtonVariant::Primary, spotlight: true, "Primary" }
                            Button { variant: ButtonVariant::Secondary, spotlight: true, "Secondary" }
                            Button { variant: ButtonVariant::Ghost, spotlight: true, "Ghost" }
                            Button { variant: ButtonVariant::Danger, spotlight: true, "Danger" }
                            Button { variant: ButtonVariant::Success, spotlight: true, "Success" }
                        }
                    }

                    // Button sizes
                    div {
                        class: "showcase-subsection",
                        h3 {
                            class: "showcase-subtitle",
                            "Button Sizes"
                        }
                        Row {
                            gap: "md".to_string(),
                            Button { size: ButtonSize::Small, spotlight: true, "Small" }
                            Button { size: ButtonSize::Medium, spotlight: true, "Medium" }
                            Button { size: ButtonSize::Large, spotlight: true, "Large" }
                        }
                    }

                    // Button states
                    div {
                        class: "showcase-subsection",
                        h3 {
                            class: "showcase-subtitle",
                            "Button States"
                        }
                        Row {
                            gap: "md".to_string(),
                            Button { loading: true, "Loading..." }
                            Button { disabled: true, "Disabled" }
                        }
                    }

                    // Button animations
                    div {
                        class: "showcase-subsection",
                        h3 {
                            class: "showcase-subtitle",
                            "Button Animations (Hover to see effects)"
                        }
                        p {
                            class: "showcase-description",
                            "Move your mouse over the buttons to see the spotlight effect that follows your cursor."
                        }
                        Row {
                            gap: "md".to_string(),
                            Button {
                                variant: ButtonVariant::Primary,
                                spotlight: true,
                                "Spotlight Effect"
                            }
                        }
                    }
                }

                // Inputs Section
                Section {
                    title: Some("Inputs".to_string()),
                    class: "showcase-section",

                    div {
                        class: "demo-card-grid",

                        // Default input
                        div {
                            label {
                                class: "showcase-label",
                                "Default Input"
                            }
                            Input {
                                placeholder: "Enter text..."
                            }
                        }

                        // Disabled input
                        div {
                            label {
                                class: "showcase-label",
                                "Disabled Input"
                            }
                            Input {
                                disabled: true,
                                value: "Disabled input"
                            }
                        }

                        // Search input with spotlight
                        div {
                            label {
                                class: "showcase-label",
                                "Search Input with Spotlight"
                            }
                            Input {
                                placeholder: "Search...",
                                spotlight: true,
                            }
                        }

                        // Password input
                        div {
                            label {
                                class: "showcase-label",
                                "Password Input"
                            }
                            Input {
                                placeholder: "Enter password..."
                            }
                        }
                    }
                }

                // Cards Section
                Section {
                    title: Some("Cards".to_string()),
                    class: "showcase-section",

                    div {
                        class: "showcase-grid",

                        // Basic card with header
                        Card {
                            title: "Card Title".to_string(),
                            div {
                                class: "demo-description",
                                "This is a simple card with header and content. Perfect for displaying grouped information."
                            }
                        }

                        // Card without header
                        Card {
                            h3 {
                                class: "section-subtitle",
                                "Simple Card"
                            }
                            p {
                                class: "demo-description",
                                "Card without header, just content. Flexible and minimal design."
                            }
                        }

                        // Card with action buttons
                        Card {
                            title: "Interactive Card".to_string(),
                            div {
                                class: "demo-description mb-4",
                                "This card includes action buttons for user interactions."
                            }
                            div {
                                class: "showcase-vertical-stack",
                                Button { size: ButtonSize::Small, variant: ButtonVariant::Primary, "Action" }
                                Button { size: ButtonSize::Small, variant: ButtonVariant::Ghost, "Cancel" }
                            }
                        }

                        // Card with badge
                        Card {
                            title: "Card with Badge".to_string(),
                            div {
                                class: "showcase-vertical-stack mb-4",
                                Badge { variant: BadgeVariant::Primary, "New" }
                                Badge { variant: BadgeVariant::Success, "Active" }
                            }
                            p {
                                class: "demo-description",
                                "Cards can include badges to show status or other metadata."
                            }
                        }
                    }
                }

                // Badges Section
                Section {
                    title: Some("Badges".to_string()),
                    class: "showcase-section",

                    // Badge variants
                    div {
                        class: "showcase-subsection",
                        h3 {
                            class: "showcase-subtitle",
                            "Badge Variants"
                        }
                        Row {
                            gap: "md".to_string(),
                            Badge { variant: BadgeVariant::Default, "Default" }
                            Badge { variant: BadgeVariant::Primary, "Primary" }
                            Badge { variant: BadgeVariant::Success, "Success" }
                            Badge { variant: BadgeVariant::Warning, "Warning" }
                            Badge { variant: BadgeVariant::Danger, "Danger" }
                        }
                    }

                    // Badge styles
                    div {
                        class: "showcase-subsection",
                        h3 {
                            class: "showcase-subtitle",
                            "Badge with Dots"
                        }
                        Row {
                            gap: "md".to_string(),
                            Badge { variant: BadgeVariant::Primary, dot: true, "Online" }
                            Badge { variant: BadgeVariant::Success, dot: true, "Completed" }
                            Badge { variant: BadgeVariant::Warning, dot: true, "Pending" }
                            Badge { variant: BadgeVariant::Danger, dot: true, "Error" }
                        }
                    }

                    // Badge counts
                    div {
                        class: "showcase-subsection",
                        h3 {
                            class: "showcase-subtitle",
                            "Badge Counts"
                        }
                        Row {
                            gap: "md".to_string(),
                            Badge { variant: BadgeVariant::Primary, "5" }
                            Badge { variant: BadgeVariant::Success, "99+" }
                            Badge { variant: BadgeVariant::Danger, "1" }
                            Badge { variant: BadgeVariant::Warning, "12" }
                        }
                    }
                }
            }
        }
    }
}
