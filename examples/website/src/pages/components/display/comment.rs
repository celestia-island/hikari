// website/src/pages/components/display/comment.rs
// Comment component showcase page with real rendered examples

use dioxus::prelude::*;

use crate::{app::Route, components::Layout};
use _components::{Button, ButtonVariant, basic::{Avatar, AvatarSize, AvatarVariant}, display::Comment, layout::{Container, Section}};
use _palette::classes::{ ClassesBuilder, Display, FontSize, FontWeight, Gap, MarginBottom, Padding, TextColor, };

#[allow(non_snake_case)]
pub fn ComponentsComment() -> Element {
    rsx! {
        Layout {
            current_route: Route::DisplayComment {},

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
                        "Comment"
                    }
                    p { class: ClassesBuilder::new().add(MarginBottom::Mb0).add(TextColor::Secondary).build(),
                        "Comment/feedback display with nested replies support"
                    }
                }

                // Overview
                Section {
                    title: Some("Overview".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                        p {
                            "Comments are used to display user feedback, reviews, or discussions. They support:"
                        }
                        ul { class: ClassesBuilder::new().add_raw("pl-6").add(MarginBottom::Mb0).build(),
                            li {
                                strong { "Author info" }
                                " - Avatar, name, and timestamp"
                            }
                            li {
                                strong { "Rich content" }
                                " - Multi-line text support"
                            }
                            li {
                                strong { "Actions" }
                                " - Reply, like, delete buttons"
                            }
                            li {
                                strong { "Nested replies" }
                                " - Hierarchical comment threads"
                            }
                        }
                    }
                }

                // Basic Comment
                Section {
                    title: Some("Basic Comments".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Simple Comment"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Comment with author and content"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            Comment {
                                author: Some("Alice Johnson".to_string()),
                                avatar: Some("https://i.pravatar.cc/100?img=1".to_string()),
                                content: "This is a great feature! Really love the design and functionality.".to_string(),
                                datetime: Some("2024-01-22 10:30".to_string()),
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
                            "Comment Without Avatar"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Comment with just author and content"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            Comment {
                                author: Some("Bob Smith".to_string()),
                                content: "I agree with the previous comment. The implementation is solid.".to_string(),
                                datetime: Some("2024-01-22 11:15".to_string()),
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
                            "Minimal Comment"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Comment with only content"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            Comment {
                                content: "Anonymous feedback: Keep up the good work!".to_string(),
                            }
                        }
                    }
                }

                // Comments with Actions
                Section {
                    title: Some("Comments with Actions".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Action Buttons"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Comment with reply, like, and delete actions"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            Comment {
                                author: Some("Carol Davis".to_string()),
                                avatar: Some("https://i.pravatar.cc/100?img=5".to_string()),
                                content: "Would love to see this feature expanded with more options.".to_string(),
                                datetime: Some("2024-01-22 14:20".to_string()),
                                actions: rsx! {
                                    div { style: "display: flex; gap: 0.5rem;",
                                        Button {
                                            variant: ButtonVariant::Ghost,
                                            "Reply"
                                        }
                                        Button {
                                            variant: ButtonVariant::Ghost,
                                            "Like"
                                        }
                                    }
                                },
                            }
                        }
                    }
                }

                // Nested Comments
                Section {
                    title: Some("Nested Comments".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Threaded Discussion"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Comments with nested replies"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            Comment {
                                author: Some("David Wilson".to_string()),
                                avatar: Some("https://i.pravatar.cc/100?img=8".to_string()),
                                content: "What do you think about the new API design?".to_string(),
                                datetime: Some("2024-01-22 09:00".to_string()),
                                actions: rsx! {
                                    Button {
                                        variant: ButtonVariant::Ghost,
                                        "Reply"
                                    }
                                },
                                nested: rsx! {
                                    Comment {
                                        author: Some("Emma Lee".to_string()),
                                        avatar: Some("https://i.pravatar.cc/100?img=9".to_string()),
                                        content: "I think it's much cleaner than the previous version!".to_string(),
                                        datetime: Some("2024-01-22 09:15".to_string()),
                                    }
                                    Comment {
                                        author: Some("Frank Brown".to_string()),
                                        avatar: Some("https://i.pravatar.cc/100?img=10".to_string()),
                                        content: "Agreed. The REST endpoints are much more intuitive now.".to_string(),
                                        datetime: Some("2024-01-22 09:30".to_string()),
                                    }
                                },
                            }
                        }
                    }
                }

                // Comment List
                Section {
                    title: Some("Comment List".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Multiple Comments"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "List of comments stacked vertically"
                        }
                        div {
                            style: "display: flex; flex-direction: column; gap: 1rem;",
                            Comment {
                                author: Some("Grace Kim".to_string()),
                                avatar: Some("https://i.pravatar.cc/100?img=12".to_string()),
                                content: "This component is exactly what I needed for my project!".to_string(),
                                datetime: Some("2024-01-22 15:00".to_string()),
                            }
                            Comment {
                                author: Some("Henry Zhang".to_string()),
                                avatar: Some("https://i.pravatar.cc/100?img=13".to_string()),
                                content: "Great work! Looking forward to future updates.".to_string(),
                                datetime: Some("2024-01-22 15:30".to_string()),
                            }
                            Comment {
                                author: Some("Ivy Chen".to_string()),
                                avatar: Some("https://i.pravatar.cc/100?img=14".to_string()),
                                content: "The documentation is very clear and helpful. Thanks!".to_string(),
                                datetime: Some("2024-01-22 16:00".to_string()),
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
                            "Basic Comment"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            code {
                                r#"Comment {{
    author: Some("Alice".to_string()),
    avatar: Some("alice.jpg".to_string()),
    content: "Great work!".to_string(),
    datetime: Some("2024-01-22 10:30".to_string()),
}}"#
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
                            "Comment with Actions"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            code {
                                r#"Comment {{
    author: Some("Bob".to_string()),
    avatar: Some("bob.jpg".to_string()),
    content: "Nice comment".to_string(),
    datetime: Some("2024-01-22 11:00".to_string()),
    actions: rsx! {{
        Button {{ variant: ButtonVariant::Ghost, "Reply" }}
        Button {{ variant: ButtonVariant::Ghost, "Like" }}
    }},
}}"#
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
                            "Nested Comment"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            code {
                                r#"Comment {{
    author: Some("Carol".to_string()),
    content: "Main comment".to_string(),
    nested: rsx! {{
        Comment {{
            author: Some("Dave".to_string()),
            content: "Reply".to_string(),
        }}
    }},
}}"#
                            }
                        }
                    }
                }
            }
        }
    }
}
