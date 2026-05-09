use crate::components::demo_page::{render_api_table, render_demo_block, render_demo_page};
use tairitsu_macros::rsx;
use tairitsu_vdom::VNode;

pub fn render() -> VNode {
    render_demo_page(
        "page-component-comment",
        "Comment",
        "User comment display with author info, timestamps, content, and nested reply threads.",
        rsx! {
            {render_demo_block("Basic Comment", rsx! {
                div { class: "hi-comment",
                    div { class: "hi-comment__header",
                        div { class: "hi-avatar hi-avatar--primary hi-avatar--sm", "A" }
                        div {
                            span { class: "hi-comment__author", "Alice Chen" }
                            span { class: "hi-comment__time", "2 hours ago" }
                        }
                    }
                    div { class: "hi-comment__content", "This is a great feature! The new design looks much cleaner." }
                    div { class: "hi-comment__actions",
                        span { "Reply" }
                        span { "Like" }
                    }
                }
            })}
            {render_demo_block("Comment Thread", rsx! {
                div { style: "display:flex;flex-direction:column;gap:16px;",
                    div { class: "hi-comment",
                        div { class: "hi-comment__header",
                            div { class: "hi-avatar hi-avatar--success hi-avatar--sm", "B" }
                            div {
                                span { class: "hi-comment__author", "Bob Martinez" }
                                span { class: "hi-comment__time", "1 hour ago" }
                            }
                        }
                        div { class: "hi-comment__content", "Has anyone tested the performance with large datasets?" }
                        div { class: "hi-comment__actions",
                            span { "Reply" }
                            span { "Like (3)" }
                        }
                    }
                    div { class: "hi-comment hi-comment--nested",
                        div { class: "hi-comment__header",
                            div { class: "hi-avatar hi-avatar--danger hi-avatar--sm", "C" }
                            div {
                                span { class: "hi-comment__author", "Carol Wu" }
                                span { class: "hi-comment__time", "45 min ago" }
                            }
                        }
                        div { class: "hi-comment__content", "Tested with 10k rows and it handled it well. Virtual scrolling helps a lot." }
                        div { class: "hi-comment__actions",
                            span { "Reply" }
                            span { "Like (7)" }
                        }
                    }
                    div { class: "hi-comment hi-comment--nested",
                        div { class: "hi-comment__header",
                            div { class: "hi-avatar hi-avatar--warning hi-avatar--sm", "D" }
                            div {
                                span { class: "hi-comment__author", "Dave Lee" }
                                span { class: "hi-comment__time", "30 min ago" }
                            }
                        }
                        div { class: "hi-comment__content", "Agreed, the virtual scroll implementation is solid." }
                        div { class: "hi-comment__actions",
                            span { "Reply" }
                            span { "Like (2)" }
                        }
                    }
                }
            })}
            {render_demo_block("Comment with Input", rsx! {
                div { style: "display:flex;flex-direction:column;gap:16px;",
                    div { class: "hi-comment",
                        div { class: "hi-comment__header",
                            div { class: "hi-avatar hi-avatar--secondary hi-avatar--sm", "E" }
                            div {
                                span { class: "hi-comment__author", "Eve Park" }
                                span { class: "hi-comment__time", "Just now" }
                            }
                        }
                        div { class: "hi-comment__content", "The documentation could use some more examples for the form component." }
                    }
                    div { class: "hi-comment-input",
                        div { class: "hi-avatar hi-avatar--primary hi-avatar--sm", "Y" }
                        div { class: "hi-comment-input__field",
                            textarea { class: "hi-textarea", placeholder: "Write a comment...", style: "resize:none;" }
                            div { style: "display:flex;justify-content:flex-end;margin-top:8px;",
                                button { class: "hi-button hi-button-primary hi-button-sm", attr: "type", "button", "Post" }
                            }
                        }
                    }
                }
            })}
            {render_demo_block("Comment States", rsx! {
                div { style: "display:flex;flex-direction:column;gap:16px;",
                    div { class: "hi-comment",
                        div { class: "hi-comment__header",
                            div { class: "hi-avatar hi-avatar--primary hi-avatar--sm", "A" }
                            div {
                                span { class: "hi-comment__author", "Alice Chen" }
                                span { class: "hi-comment__time", "2 hours ago" }
                                span { style: "font-size:12px;color:var(--hi-color-text-tertiary);margin-left:6px;", "(edited)" }
                            }
                        }
                        div { class: "hi-comment__content", "Updated my earlier comment with more details about the implementation." }
                        div { class: "hi-comment__actions",
                            span { "Reply" }
                            span { "Liked" }
                        }
                    }
                    div { class: "hi-comment",
                        div { class: "hi-comment__header",
                            div { class: "hi-avatar hi-avatar--sm", style: "background:var(--hi-color-fill-secondary);color:var(--hi-color-text-tertiary);", "D" }
                        div {
                            span { class: "hi-comment__author", style: "text-decoration:line-through;color:var(--hi-color-text-tertiary);", "Deleted User" }
                            span { class: "hi-comment__time", style: "color:var(--hi-color-text-tertiary);", "yesterday" }
                        }
                    }
                    div { class: "hi-comment__content", style: "color:var(--hi-color-text-tertiary);font-style:italic;", "This comment has been deleted." }
                    div { class: "hi-comment__actions",
                        span { style: "color:var(--hi-color-text-disabled);", "Restore" }
                        }
                    }
                }
            })}
            {render_demo_block("API",
                render_api_table(&[
                    ("author", "string", "-", "Author display name"),
                    ("avatar", "string", "-", "Avatar initials or image"),
                    ("content", "string", "-", "Comment body text"),
                    ("time", "string", "-", "Relative timestamp"),
                    ("nested", "bool", "false", "Display as a nested reply"),
                    ("actions", "string[]", "-", "Action labels (e.g. Reply, Like)"),
                ])
            )}
        }
    )
}
