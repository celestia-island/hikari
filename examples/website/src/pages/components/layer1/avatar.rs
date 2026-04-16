use tairitsu_macros::rsx;
use tairitsu_vdom::VNode;

pub fn render() -> VNode {
    rsx! {
        div { id: "page-component-avatar", class: "hikari-page",
            div { class: "page-header",
                h1 { class: "page-header__title", "Avatar" }
                p { class: "page-header__subtitle",
                    "User or entity representation with size variants, color options, and initials fallback."
                }
            }
            div { class: "page-section",
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "Avatar Sizes" }
                    div { class: "demo-block__body",
                        div { class: "demo-row",
                            div { class: "hi-avatar hi-avatar--xs", "A" }
                            div { class: "hi-avatar hi-avatar--sm", "B" }
                            div { class: "hi-avatar", "C" }
                            div { class: "hi-avatar hi-avatar--lg", "D" }
                            div { class: "hi-avatar hi-avatar--xl", "E" }
                        }
                    }
                }
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "Avatar Colors" }
                    div { class: "demo-block__body",
                        div { class: "demo-row",
                            div { class: "hi-avatar hi-avatar--primary", "P" }
                            div { class: "hi-avatar hi-avatar--secondary", "S" }
                            div { class: "hi-avatar hi-avatar--success", "G" }
                            div { class: "hi-avatar hi-avatar--danger", "R" }
                            div { class: "hi-avatar hi-avatar--warning", "Y" }
                        }
                    }
                }
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "Avatar with Label" }
                    div { class: "demo-block__body",
                        div { style: "display:flex;flex-direction:column;gap:12px;",
                            div { style: "display:flex;align-items:center;gap:12px;",
                                div { class: "hi-avatar hi-avatar--primary", "A" }
                                div {
                                    div { style: "font-weight:600;", "Alice Chen" }
                                    div { style: "color:var(--hi-color-text-secondary);font-size:13px;", "alice@example.com" }
                                }
                            }
                            div { style: "display:flex;align-items:center;gap:12px;",
                                div { class: "hi-avatar hi-avatar--success", "B" }
                                div {
                                    div { style: "font-weight:600;", "Bob Martinez" }
                                    div { style: "color:var(--hi-color-text-secondary);font-size:13px;", "bob@example.com" }
                                }
                            }
                        }
                    }
                }
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "Avatar Group" }
                    div { class: "demo-block__body",
                        div { class: "demo-row",
                            div { class: "hi-avatar-group",
                                div { class: "hi-avatar hi-avatar--primary", "A" }
                                div { class: "hi-avatar hi-avatar--danger", "B" }
                                div { class: "hi-avatar hi-avatar--success", "C" }
                                div { class: "hi-avatar hi-avatar--warning", "D" }
                                div { class: "hi-avatar hi-avatar--secondary hi-avatar--overflow", "+3" }
                            }
                        }
                    }
                }
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "Avatar Shapes" }
                    div { class: "demo-block__body",
                        div { class: "demo-row",
                            div { class: "hi-avatar hi-avatar--circle", "C" }
                            div { class: "hi-avatar hi-avatar--square", "S" }
                        }
                    }
                }
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "API" }
                    div { class: "demo-block__body",
                        table { class: "api-table",
                            thead { tr { th { "Property" } th { "Type" } th { "Default" } th { "Description" } } }
                            tbody {
                                tr { td { code { "size" } } td { code { "xs | sm | default | lg | xl" } } td { code { "default" } } td { "Avatar diameter" } }
                                tr { td { code { "color" } } td { code { "primary | secondary | success | danger | warning" } } td { code { "-" } } td { "Background color" } }
                                tr { td { code { "shape" } } td { code { "circle | square" } } td { code { "circle" } } td { "Border radius style" } }
                                tr { td { code { "src" } } td { code { "string" } } td { code { "-" } } td { "Image URL (falls back to initials)" } }
                                tr { td { code { "group" } } td { code { "number" } } td { code { "-" } } td { "Max visible count in avatar group" } }
                            }
                        }
                    }
                }
            }
        }
    }
}
