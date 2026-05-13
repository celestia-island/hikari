use crate::components::demo_page::{render_api_table, render_demo_block, render_demo_page};
use tairitsu_macros::rsx;
use tairitsu_vdom::VNode;

pub fn render() -> VNode {
    render_demo_page("page-component-collapsible", "Collapsible", "Accordion and collapse panels with expand/collapse animation.", rsx! [
        {render_demo_block("Basic Accordion", rsx! {
            div { class: "hi-collapse",
                div { class: "hi-collapse__item hi-collapse__item--active",
                    div { class: "hi-collapse__header",
                        span { "What is Hikari?" }
                        span { class: "hi-collapse__arrow", "▼" }
                    }
                    div { class: "hi-collapse__content",
                        p { "Hikari is a modern UI component library built with Rust and WebAssembly, designed for Tauri applications." }
                    }
                }
                div { class: "hi-collapse__item",
                    div { class: "hi-collapse__header",
                        span { "How do I get started?" }
                        span { class: "hi-collapse__arrow", "▶" }
                    }
                    div { class: "hi-collapse__content",
                        p { "Install the CLI, create a new project, and start building with the component library." }
                    }
                }
                div { class: "hi-collapse__item",
                    div { class: "hi-collapse__header",
                        span { "Is it open source?" }
                        span { class: "hi-collapse__arrow", "▶" }
                    }
                    div { class: "hi-collapse__content",
                        p { "Yes, Hikari is released under the MIT license." }
                    }
                }
            }
        })}
        {render_demo_block("Settings Panels", rsx! {
            div { class: "hi-collapse",
                div { class: "hi-collapse__item hi-collapse__item--active",
                    div { class: "hi-collapse__header",
                        span { "General" }
                        span { class: "hi-collapse__arrow", "▼" }
                    }
                    div { class: "hi-collapse__content",
                        div { class: "hi-settings-list",
                            div { class: "hi-settings-list__row",
                                span { "Language" }
                                span { class: "hi-settings-list__value", "English" }
                            }
                            div { class: "hi-settings-list__row",
                                span { "Theme" }
                                span { class: "hi-settings-list__value", "Dark" }
                            }
                        }
                    }
                }
                div { class: "hi-collapse__item",
                    div { class: "hi-collapse__header",
                        span { "Notifications" }
                        span { class: "hi-collapse__arrow", "▶" }
                    }
                    div { class: "hi-collapse__content",
                        p { "Configure notification preferences." }
                    }
                }
                div { class: "hi-collapse__item",
                    div { class: "hi-collapse__header",
                        span { "Privacy" }
                        span { class: "hi-collapse__arrow", "▶" }
                    }
                    div { class: "hi-collapse__content",
                        p { "Manage data and privacy settings." }
                    }
                }
            }
        })}
        {render_demo_block("Nested Panels", rsx! {
            div { class: "hi-collapse",
                div { class: "hi-collapse__item hi-collapse__item--active",
                    div { class: "hi-collapse__header",
                        span { "Advanced Settings" }
                        span { class: "hi-collapse__arrow", "▼" }
                    }
                    div { class: "hi-collapse__content",
                        div { class: "hi-collapse",
                            div { class: "hi-collapse__item",
                                div { class: "hi-collapse__header",
                                    span { "Performance" }
                                    span { class: "hi-collapse__arrow", "▶" }
                                }
                                div { class: "hi-collapse__content",
                                    p { "Tune rendering and caching options." }
                                }
                            }
                            div { class: "hi-collapse__item",
                                div { class: "hi-collapse__header",
                                    span { "Developer" }
                                    span { class: "hi-collapse__arrow", "▶" }
                                }
                                div { class: "hi-collapse__content",
                                    p { "Debug mode, hot reload, and logging." }
                                }
                            }
                        }
                    }
                }
            }
        })}
        {render_demo_block("API", rsx! {
            div {
                {render_api_table(&[
                    ("accordion", "bool", "false", "Only allow one panel open"),
                    ("activeKey", "string | string[]", "-", "Active panel key(s)"),
                    ("bordered", "bool", "true", "Show border around panels"),
                    ("expandIcon", "VNode", "▶", "Custom expand/collapse icon"),
                    ("collapsible", "header | icon | disabled", "-", "Trigger area for collapse"),
                ])}
            }
        })}
    ])
}
