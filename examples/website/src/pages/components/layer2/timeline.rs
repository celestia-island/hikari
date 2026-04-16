use tairitsu_macros::rsx;
use tairitsu_vdom::VNode;

pub fn render() -> VNode {
    rsx! {
        div { id: "page-component-timeline", class: "hikari-page",
            div { class: "page-header",
                h1 { class: "page-header__title", "Timeline" }
                p { class: "page-header__subtitle",
                    "Chronological event display for tracking progress, history, and activity logs."
                }
            }
            div { class: "page-section",
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "Basic Timeline" }
                    div { class: "demo-block__body",
                        div { class: "hi-timeline",
                            div { class: "hi-timeline__item",
                                div { class: "hi-timeline__dot" }
                                div { class: "hi-timeline__content",
                                    div { class: "hi-timeline__title", "Project Created" }
                                    div { class: "hi-timeline__time", "2025-01-15 10:00" }
                                    div { class: "hi-timeline__body", "Initialised the Hikari UI repository with base scaffolding." }
                                }
                            }
                            div { class: "hi-timeline__item",
                                div { class: "hi-timeline__dot" }
                                div { class: "hi-timeline__content",
                                    div { class: "hi-timeline__title", "Alpha Release" }
                                    div { class: "hi-timeline__time", "2025-02-20 14:30" }
                                    div { class: "hi-timeline__body", "Released v0.1.0 with core button and input components." }
                                }
                            }
                            div { class: "hi-timeline__item",
                                div { class: "hi-timeline__dot" }
                                div { class: "hi-timeline__content",
                                    div { class: "hi-timeline__title", "Beta Release" }
                                    div { class: "hi-timeline__time", "2025-03-10 09:00" }
                                    div { class: "hi-timeline__body", "Added form, table, and navigation components." }
                                }
                            }
                        }
                    }
                }
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "With Status Colors" }
                    div { class: "demo-block__body",
                        div { class: "hi-timeline",
                            div { class: "hi-timeline__item",
                                div { class: "hi-timeline__dot hi-timeline__dot--success" }
                                div { class: "hi-timeline__content",
                                    div { class: "hi-timeline__title", "Build Passed" }
                                    div { class: "hi-timeline__time", "5 min ago" }
                                }
                            }
                            div { class: "hi-timeline__item",
                                div { class: "hi-timeline__dot hi-timeline__dot--success" }
                                div { class: "hi-timeline__content",
                                    div { class: "hi-timeline__title", "Tests Passed" }
                                    div { class: "hi-timeline__time", "3 min ago" }
                                }
                            }
                            div { class: "hi-timeline__item",
                                div { class: "hi-timeline__dot hi-timeline__dot--warning" }
                                div { class: "hi-timeline__content",
                                    div { class: "hi-timeline__title", "Deploy Pending" }
                                    div { class: "hi-timeline__time", "Just now" }
                                }
                            }
                            div { class: "hi-timeline__item",
                                div { class: "hi-timeline__dot hi-timeline__dot--default" }
                                div { class: "hi-timeline__content",
                                    div { class: "hi-timeline__title", "Review Required" }
                                    div { class: "hi-timeline__time", "Pending" }
                                }
                            }
                        }
                    }
                }
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "With Avatars" }
                    div { class: "demo-block__body",
                        div { class: "hi-timeline",
                            div { class: "hi-timeline__item",
                                div { class: "hi-avatar hi-avatar--primary hi-avatar--sm", "A" }
                                div { class: "hi-timeline__content",
                                    div { class: "hi-timeline__title", "Alice commented" }
                                    div { class: "hi-timeline__body", "\"The new design system looks great!\"" }
                                    div { class: "hi-timeline__time", "Today, 2:30 PM" }
                                }
                            }
                            div { class: "hi-timeline__item",
                                div { class: "hi-avatar hi-avatar--success hi-avatar--sm", "B" }
                                div { class: "hi-timeline__content",
                                    div { class: "hi-timeline__title", "Bob resolved issue #42" }
                                    div { class: "hi-timeline__body", "Fixed layout overflow in responsive mode." }
                                    div { class: "hi-timeline__time", "Today, 1:15 PM" }
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
                                tr { td { code { "mode" } } td { code { "left | right | alternate" } } td { code { "left" } } td { "Timeline placement" } }
                                tr { td { code { "pending" } } td { code { "bool" } } td { code { "false" } } td { "Show pending ghost dot" } }
                                tr { td { code { "reverse" } } td { code { "bool" } } td { code { "false" } } td { "Reverse item order" } }
                                tr { td { code { "color" } } td { code { "string" } } td { code { "-" } } td { "Custom dot color" } }
                            }
                        }
                    }
                }
            }
        }
    }
}
