use tairitsu_macros::rsx;
use tairitsu_vdom::VNode;

pub fn render() -> VNode {
    rsx! {
        div { id: "page-component-comment", class: "hikari-page",
            div { class: "page-header",
                h1 { class: "page-header__title", "Comment" }
                p { class: "page-header__subtitle",
                    "User comment display with author info, timestamps, content, and nested reply threads."
                }
            }
            div { class: "page-section",
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "Basic Comment" }
                    div { class: "demo-block__body",
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
                    }
                }
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "Comment Thread" }
                    div { class: "demo-block__body",
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
                    }
                }
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "Comment with Input" }
                    div { class: "demo-block__body",
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
                                        button { class: "hi-button hi-button-primary hi-button-sm", "Post" }
                                    }
                                }
                            }
                        }
                    }
                }
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "API" }
                    div { class: "demo-block__body",
                        table { class: "api-table",
                            thead { tr { th { "Property" } th { "Type" } th { "Default" } th { "Description" } } }
                            tbody {
                                tr { td { code { "author" } } td { code { "string" } } td { code { "-" } } td { "Author display name" } }
                                tr { td { code { "avatar" } } td { code { "string" } } td { code { "-" } } td { "Avatar initials or image" } }
                                tr { td { code { "content" } } td { code { "string" } } td { code { "-" } } td { "Comment body text" } }
                                tr { td { code { "time" } } td { code { "string" } } td { code { "-" } } td { "Relative timestamp" } }
                                tr { td { code { "nested" } } td { code { "bool" } } td { code { "false" } } td { "Display as a nested reply" } }
                                tr { td { code { "actions" } } td { code { "string[]" } } td { code { "-" } } td { "Action labels (e.g. Reply, Like)" } }
                            }
                        }
                    }
                }
            }
        }
    }
}
