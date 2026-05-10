// packages/components/src/display/comment.rs
// Comment component with Arknights + FUI styling

use hikari_palette::classes::{ClassesBuilder, CommentClass, TypedClass};

use crate::{prelude::*, styled::StyledComponent};

pub struct CommentComponent;

/// Props for the Comment component
#[define_props]
pub struct CommentProps {
    #[default]
    pub author: Option<String>,

    #[default]
    pub avatar: Option<String>,

    pub content: String,

    #[default]
    pub datetime: Option<String>,

    #[default]
    pub actions: Option<Element>,

    #[default]
    pub nested: Option<Element>,

    #[default]
    pub class: String,

    #[default]
    pub style: String,
}

/// A comment component for displaying user feedback with avatar, author, and nested replies.
#[component]
pub fn Comment(props: CommentProps) -> Element {
    let container_classes = ClassesBuilder::new()
        .add_typed(CommentClass::Container)
        .add(&props.class)
        .build();

    rsx! {
        div { class: container_classes, style: props.style,

            div { class: CommentClass::Header.class_name(),

                if let Some(ref avatar) = props.avatar {
                    img {
                        class: CommentClass::Avatar.class_name(),
                        src: avatar,
                        alt: "Avatar",
                    }
                }

                div { class: CommentClass::Meta.class_name(),

                    if let Some(ref author) = props.author {
                        span { class: CommentClass::Author.class_name(), "{author}" }
                    }

                    if let Some(ref datetime) = props.datetime {
                        span { class: CommentClass::Datetime.class_name(), "{datetime}" }
                    }
                }
            }

            div { class: CommentClass::Content.class_name(), "{props.content}" }

            if let Some(actions) = props.actions {
                div { class: CommentClass::Actions.class_name(), {actions} }
            }

            if let Some(nested) = props.nested {
                div { class: CommentClass::Nested.class_name(), {nested} }
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
