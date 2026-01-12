// website/src/pages/components/card.rs
// Card component showcase page with real rendered examples

use dioxus::prelude::*;

use crate::{app::Route, components::Layout};
use _animation::style::{CssProperty, StyleStringBuilder};
use _components::{
    layout::{Container, Row, Section},
    Badge, BadgeVariant, Button, ButtonSize, ButtonVariant, Card,
};
use _icons::{Icon, MdiIcon};
use _palette::classes::{
    BgColor, BorderRadius, ClassesBuilder, Display, FontSize, FontWeight, Gap, GridCols,
    MarginBottom, Padding, PaddingLeft, TextColor,
};

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
                            .add(MarginBottom::Mb0)
                            .add(MarginBottom::Mb2)
                            .build(),
                        "Card"
                    }
                    p { class: ClassesBuilder::default().add(MarginBottom::Mb0).add(TextColor::Secondary).build(),
                        "Container component for grouping content with FUI aesthetics"
                    }
                }

                // Overview
                Section {
                    title: Some("Overview".to_string()),
                    class: ClassesBuilder::default().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::default().add(TextColor::Secondary).build(),
                        p {
                            "Cards are versatile containers for grouping related content and actions. They support:"
                        }
                        ul { class: ClassesBuilder::default().add(PaddingLeft::Pl6).add(MarginBottom::Mb0).build(),
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
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Card with Title"
                        }
                        p { class: ClassesBuilder::default().add(TextColor::Secondary).build(),
                            "Simple card with header title and content"
                        }
                        div { style: StyleStringBuilder::new().add(CssProperty::MaxWidth, "400px").build_clean(),
                            Card { title: "Card Title".to_string(),
                                p { class: ClassesBuilder::default().add(TextColor::Secondary).add(MarginBottom::Mb4).build(),
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
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Card without Header"
                        }
                        p { class: ClassesBuilder::default().add(TextColor::Secondary).build(),
                            "Minimal card with only content"
                        }
                        div { style: StyleStringBuilder::new().add(CssProperty::MaxWidth, "400px").build_clean(),
                            Card {
                                h3 { class: ClassesBuilder::new().add(MarginBottom::Mb4).add(FontSize::Lg).add(FontWeight::Semibold).add(TextColor::Primary).build(), "Custom Content" }
                                p { class: ClassesBuilder::default().add(TextColor::Secondary).add(MarginBottom::Mb4).build(),
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
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Bordered Card"
                        }
                        p { class: ClassesBuilder::default().add(TextColor::Secondary).build(),
                            "Card with visible border"
                        }
                        div { style: StyleStringBuilder::new().add(CssProperty::MaxWidth, "400px").build_clean(),
                            Card {
                                bordered: true,
                                title: "Bordered Card".to_string(),
                                p { class: ClassesBuilder::default().add(TextColor::Secondary).add(MarginBottom::Mb4).build(),
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
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Hoverable Card"
                        }
                        p { class: ClassesBuilder::default().add(TextColor::Secondary).build(),
                            "Card with hover effect (hover over me)"
                        }
                        div { style: StyleStringBuilder::new().add(CssProperty::MaxWidth, "400px").build_clean(),
                            Card {
                                hoverable: true,
                                title: "Hoverable Card".to_string(),
                                p { class: ClassesBuilder::default().add(TextColor::Secondary).add(MarginBottom::Mb4).build(),
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
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Card with Spotlight"
                        }
                        p { class: ClassesBuilder::default().add(TextColor::Secondary).build(),
                            "Card with FUI-style spotlight effect (hover over me)"
                        }
                        div { style: StyleStringBuilder::new().add(CssProperty::MaxWidth, "400px").build_clean(),
                            Card {
                                spotlight: true,
                                title: "Spotlight Card".to_string(),
                                p { class: ClassesBuilder::default().add(TextColor::Secondary).add(MarginBottom::Mb4).build(),
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
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Card with Title Actions"
                        }
                        p { class: ClassesBuilder::default().add(TextColor::Secondary).build(),
                            "Extra content in the header for actions"
                        }
                        div { style: StyleStringBuilder::new().add(CssProperty::MaxWidth, "400px").build_clean(),
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
                                p { class: ClassesBuilder::default().add(TextColor::Secondary).add(MarginBottom::Mb4).build(),
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
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Interactive Card"
                        }
                        p { class: ClassesBuilder::default().add(TextColor::Secondary).build(),
                            "Card with action buttons in the body"
                        }
                        div { style: StyleStringBuilder::new().add(CssProperty::MaxWidth, "400px").build_clean(),
                            Card { title: "Profile".to_string(),
                                div { class: ClassesBuilder::default().add(TextColor::Secondary).add(MarginBottom::Mb4).build(),
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
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Clickable Card"
                        }
                        p { class: ClassesBuilder::default().add(TextColor::Secondary).build(),
                            "Entire card is clickable (click me)"
                        }
                        div { style: StyleStringBuilder::new().add(CssProperty::MaxWidth, "400px").build_clean(),
                            Card {
                                hoverable: true,
                                title: "Clickable Card".to_string(),
                                div { class: ClassesBuilder::default().add(TextColor::Secondary).add(MarginBottom::Mb4).build(),
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
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Status Badges"
                        }
                        p { class: ClassesBuilder::default().add(TextColor::Secondary).build(),
                            "Cards can display status information using badges"
                        }
                        div { style: StyleStringBuilder::new().add(CssProperty::MaxWidth, "400px").build_clean(),
                            Card {
                                title: "Project Status".to_string(),
                                extra: rsx! {
                                    Badge { variant: BadgeVariant::Success, "Active" }
                                },
                                div { class: ClassesBuilder::default().add(TextColor::Secondary).build(),
                                    p { class: ClassesBuilder::default().add(TextColor::Secondary).add(MarginBottom::Mb4).build(),
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
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Multiple Cards"
                        }
                        p { class: ClassesBuilder::default().add(TextColor::Secondary).build(),
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
                                div { class: ClassesBuilder::default().add(TextColor::Secondary).add(MarginBottom::Mb4).build(),
                                    "Explore all the powerful features Hikari has to offer for your next project."
                                }
                            }

                            // Card 2
                            Card { title: "Documentation".to_string(),
                                div { class: ClassesBuilder::default().add(TextColor::Secondary).add(MarginBottom::Mb4).build(),
                                    "Comprehensive guides and API references to help you get started quickly."
                                }
                            }

                            // Card 3
                            Card { title: "Examples".to_string(),
                                div { class: ClassesBuilder::default().add(TextColor::Secondary).add(MarginBottom::Mb4).build(),
                                    "Browse through our collection of examples and demos to learn by doing."
                                }
                            }

                            // Card 4
                            Card { title: "Community".to_string(),
                                div { class: ClassesBuilder::default().add(TextColor::Secondary).add(MarginBottom::Mb4).build(),
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
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Basic Card"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P4).add(BgColor::Surface).add(BorderRadius::Rounded).build(),
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
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Card with Actions"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P4).add(BgColor::Surface).add(BorderRadius::Rounded).build(),
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
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Hoverable Card with Spotlight"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P4).add(BgColor::Surface).add(BorderRadius::Rounded).build(),
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
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Clickable Card"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P4).add(BgColor::Surface).add(BorderRadius::Rounded).build(),
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
