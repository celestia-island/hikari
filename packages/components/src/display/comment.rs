// packages/components/src/display/comment.rs
// Comment component with Arknights + FUI styling

use dioxus::prelude::*;

use crate::styled::StyledComponent;

/// Comment component type wrapper (for StyledComponent)
pub struct CommentComponent;

/// Comment component with Arknights + FUI styling
///
/// A reusable component for displaying user comments, reviews, or feedback.
/// Supports nested replies through `actions` prop.
///
/// # Examples
///
/// ```rust
/// use dioxus::prelude::*;
/// use hikari_components::{Comment, CommentProps};
///
/// fn app() -> Element {
///     rsx! {
///         Comment {
///             author: Some("Alice".to_string()),
///             avatar: Some("alice.jpg".to_string()),
///             content: "This is a great feature!".to_string(),
///             datetime: Some("2024-01-22 10:30".to_string()),
///         }
///     }
/// }
/// ```
#[derive(Clone, PartialEq, Props)]
pub struct CommentProps {
    #[props(default)]
    pub author: Option<String>,

    #[props(default)]
    pub avatar: Option<String>,

    pub content: String,

    #[props(default)]
    pub datetime: Option<String>,

    #[props(default)]
    pub actions: Option<Element>,

    #[props(default)]
    pub nested: Option<Element>,

    #[props(default)]
    pub class: String,

    #[props(default)]
    pub style: String,
}

impl Default for CommentProps {
    fn default() -> Self {
        Self {
            author: None,
            avatar: None,
            content: String::default(),
            datetime: None,
            actions: None,
            nested: None,
            class: String::default(),
            style: String::default(),
        }
    }
}

#[component]
pub fn Comment(props: CommentProps) -> Element {
    let container_classes = format!("hi-comment {}", props.class);

    rsx! {
        div {
            class: "{container_classes}",
            style: "{props.style}",

            div {
                class: "hi-comment-header",

                if let Some(ref avatar) = props.avatar {
                    img {
                        class: "hi-comment-avatar",
                        src: "{avatar}",
                        alt: "Avatar"
                    }
                }

                div {
                    class: "hi-comment-meta",

                    if let Some(ref author) = props.author {
                        span {
                            class: "hi-comment-author",
                            "{author}"
                        }
                    }

                    if let Some(ref datetime) = props.datetime {
                        span {
                            class: "hi-comment-datetime",
                            "{datetime}"
                        }
                    }
                }
            }

            div {
                class: "hi-comment-content",
                "{props.content}"
            }

            if let Some(actions) = props.actions {
                div {
                    class: "hi-comment-actions",
                    { actions }
                }
            }

            if let Some(nested) = props.nested {
                div {
                    class: "hi-comment-nested",
                    { nested }
                }
            }
        }
    }
}

impl StyledComponent for CommentComponent {
    fn styles() -> &'static str {
        r#"
.hi-comment {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1rem;
    border-radius: 8px;
    background-color: var(--hi-color-surface);
    border: 1px solid var(--hi-color-border);
}

.hi-comment-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
}

.hi-comment-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    object-fit: cover;
}

.hi-comment-meta {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.hi-comment-author {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--hi-color-text-primary);
}

.hi-comment-datetime {
    font-size: 0.75rem;
    color: var(--hi-color-text-secondary);
}

.hi-comment-content {
    font-size: 0.875rem;
    line-height: 1.6;
    color: var(--hi-color-text-primary);
    word-wrap: break-word;
}

.hi-comment-actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.25rem;
}

.hi-comment-nested {
    margin-left: 2rem;
    padding-left: 1rem;
    border-left: 2px solid var(--hi-color-border);
}
"#
    }

    fn name() -> &'static str {
        "comment"
    }
}
