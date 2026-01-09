// website/src/pages/components/card.rs
// Card component showcase page with real rendered examples


use dioxus::prelude::*;

use _components::{Badge, BadgeVariant, Button, ButtonSize, ButtonVariant, Card, layout::{Container, Row, Section}};
use _icons::{Icon, MdiIcon};
use _palette::classes::{ ClassesBuilder, MarginBottom, FontSize, FontWeight, TextColor, Padding, PaddingLeft, Margin, Display, GridCols, Gap, };
use crate::{app::Route, components::Layout};

#[allow(non_snake_case)]
pub fn ComponentsCard() -> Element {
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
                        "Card"
                    }
                    p { class: ClassesBuilder::default().add(Margin::M0).add(TextColor::Gray600).build(),
                        "Container component for grouping content with FUI aesthetics"
                    }
                }

                // Overview
                Section {
                    title: Some("Overview".to_string()),
                    class: ClassesBuilder::default().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::default().add(TextColor::Gray600).build(),
                        p {
                            "Cards are versatile containers for grouping related content and actions. They support:"
                        }
                        ul { class: ClassesBuilder::default().add(PaddingLeft::Pl6).add(Margin::M0).build(),
                            li {
                                strong { "Header" }
                                " - Optional title and extra content"
                            }
                            li {
                                strong { "Variants" }
                                " - Bordered, Hoverable, Spotlight"
                            }
                            li {
                                strong { "Flexible content" }
                                " - Any child elements"
                            }
                            li {
                                strong { "Click handler" }
                                " - Optional onclick event"
                            }
                        }
                    }
                }

                // Basic Card
                Section {
                    title: Some("Basic Card".to_string()),
                    class: ClassesBuilder::default().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::default().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::default()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Gray700)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Card with Title"
                        }
                        p { class: ClassesBuilder::default().add(TextColor::Gray600).build(),
                            "Simple card with header title and content"
                        }
                        div { style: "max-width: 400px;",
                            Card { title: "Card Title".to_string(),
                                p { class: "demo-description",
                                    "This is a simple card with a title. Cards are great for grouping related content and actions."
                                }
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
                            "Card without Header"
                        }
                        p { class: ClassesBuilder::default().add(TextColor::Gray600).build(),
                            "Minimal card with only content"
                        }
                        div { style: "max-width: 400px;",
                            Card {
                                h3 { class: "section-subtitle", "Custom Content" }
                                p { class: "demo-description",
                                    "Cards without headers are perfect for simple content display with minimal styling."
                                }
                            }
                        }
                    }
                }

                // Card Variants
                Section {
                    title: Some("Card Variants".to_string()),
                    class: ClassesBuilder::default().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::default().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::default()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Gray700)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Bordered Card"
                        }
                        p { class: ClassesBuilder::default().add(TextColor::Gray600).build(),
                            "Card with visible border"
                        }
                        div { style: "max-width: 400px;",
                            Card {
                                bordered: true,
                                title: "Bordered Card".to_string(),
                                p { class: "demo-description",
                                    "This card has a visible border for clearer separation from the background."
                                }
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
                            "Hoverable Card"
                        }
                        p { class: ClassesBuilder::default().add(TextColor::Gray600).build(),
                            "Card with hover effect (hover over me)"
                        }
                        div { style: "max-width: 400px;",
                            Card {
                                hoverable: true,
                                title: "Hoverable Card".to_string(),
                                p { class: "demo-description",
                                    "This card has a hover effect that highlights it when you move your mouse over it."
                                }
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
                            "Card with Spotlight"
                        }
                        p { class: ClassesBuilder::default().add(TextColor::Gray600).build(),
                            "Card with FUI-style spotlight effect (hover over me)"
                        }
                        div { style: "max-width: 400px;",
                            Card {
                                spotlight: true,
                                title: "Spotlight Card".to_string(),
                                p { class: "demo-description",
                                    "This card has a spotlight effect that follows your cursor, creating a futuristic FUI aesthetic."
                                }
                            }
                        }
                    }
                }

                // Card with Actions
                Section {
                    title: Some("Card with Actions".to_string()),
                    class: ClassesBuilder::default().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::default().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::default()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Gray700)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Card with Title Actions"
                        }
                        p { class: ClassesBuilder::default().add(TextColor::Gray600).build(),
                            "Extra content in the header for actions"
                        }
                        div { style: "max-width: 400px;",
                            Card {
                                title: "Settings".to_string(),
                                extra: rsx! {
                                    Row { gap: "sm".to_string(),
                                        Button {
                                            size: ButtonSize::Small,
                                            variant: ButtonVariant::Ghost,
                                            icon: rsx! {
                                                Icon { icon: MdiIcon::Alert, size: 16 }
                                            },
                                        }
                                    }
                                },
                                p { class: "demo-description",
                                    "The extra slot allows you to add actions or other elements to the card header."
                                }
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
                            "Interactive Card"
                        }
                        p { class: ClassesBuilder::default().add(TextColor::Gray600).build(),
                            "Card with action buttons in the body"
                        }
                        div { style: "max-width: 400px;",
                            Card { title: "Profile".to_string(),
                                div { class: "demo-description mb-4",
                                    "John Doe"
                                    br {}
                                    "Software Engineer"
                                }
                                Row { gap: "md".to_string(),
                                    Button {
                                        size: ButtonSize::Small,
                                        variant: ButtonVariant::Primary,
                                        "Follow"
                                    }
                                    Button {
                                        size: ButtonSize::Small,
                                        variant: ButtonVariant::Ghost,
                                        "Message"
                                    }
                                }
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
                            "Clickable Card"
                        }
                        p { class: ClassesBuilder::default().add(TextColor::Gray600).build(),
                            "Entire card is clickable (click me)"
                        }
                        div { style: "max-width: 400px;",
                            Card {
                                hoverable: true,
                                title: "Clickable Card".to_string(),
                                div { class: "demo-description",
                                    "Click anywhere on this card to trigger the action. Great for navigation or selection."
                                }
                            }
                        }
                    }
                }

                // Card with Badges
                Section {
                    title: Some("Card with Badges".to_string()),
                    class: ClassesBuilder::default().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::default().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::default()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Gray700)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Status Badges"
                        }
                        p { class: ClassesBuilder::default().add(TextColor::Gray600).build(),
                            "Cards can display status information using badges"
                        }
                        div { style: "max-width: 400px;",
                            Card {
                                title: "Project Status".to_string(),
                                extra: rsx! {
                                    Badge { variant: BadgeVariant::Success, "Active" }
                                },
                                div { class: ClassesBuilder::default().add(TextColor::Gray600).build(),
                                    p { class: "demo-description mb-4",
                                        "This card uses badges to indicate the status of the project or item."
                                    }
                                    Row { gap: "sm".to_string(),
                                        Badge { variant: BadgeVariant::Primary, "Feature" }
                                        Badge { variant: BadgeVariant::Success, "Completed" }
                                        Badge { variant: BadgeVariant::Warning, "Pending" }
                                    }
                                }
                            }
                        }
                    }
                }

                // Card Grid Examples
                Section {
                    title: Some("Card Grid Examples".to_string()),
                    class: ClassesBuilder::default().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::default().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::default()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Gray700)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Multiple Cards"
                        }
                        p { class: ClassesBuilder::default().add(TextColor::Gray600).build(),
                            "Cards work well in grid layouts for displaying multiple items"
                        }
                        div {
                            class: ClassesBuilder::default()
                                .add(Display::Grid)
                                .add(GridCols::Col3)
                                .add(Gap::Gap6)
                                .build(),

                            // Card 1
                            Card { title: "Features".to_string(),
                                div { class: "demo-description",
                                    "Explore all the powerful features Hikari has to offer for your next project."
                                }
                            }

                            // Card 2
                            Card { title: "Documentation".to_string(),
                                div { class: "demo-description",
                                    "Comprehensive guides and API references to help you get started quickly."
                                }
                            }

                            // Card 3
                            Card { title: "Examples".to_string(),
                                div { class: "demo-description",
                                    "Browse through our collection of examples and demos to learn by doing."
                                }
                            }

                            // Card 4
                            Card { title: "Community".to_string(),
                                div { class: "demo-description",
                                    "Join our community to connect with other developers and share your work."
                                }
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
                            "Basic Card"
                        }
                        div { class: "code-example",
                            code {
                                r#"Card {{
    title: "Card Title".to_string(),
    div {{ "Card content goes here" }}
}}"#
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
                            "Card with Actions"
                        }
                        div { class: "code-example",
                            code {
                                r#"Card {{
    title: "Settings".to_string(),
    extra: rsx! {{
        Button {{
            size: ButtonSize::Small,
            "Action"
        }}
    }},
    div {{ "Content" }}
}}"#
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
                            "Hoverable Card with Spotlight"
                        }
                        div { class: "code-example",
                            code {
                                r#"Card {{
    hoverable: true,
    spotlight: true,
    title: "Interactive Card".to_string(),
    div {{ "Content" }}
}}"#
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
                            "Clickable Card"
                        }
                        div { class: "code-example",
                            code {
                                r#"Card {{
    hoverable: true,
    onclick: move |_| {{
        println!("Card clicked!");
    }},
    title: "Click Me".to_string(),
    div {{ "Content" }}
}}"#
                            }
                        }
                    }
                }
            }
        }
    }
}
