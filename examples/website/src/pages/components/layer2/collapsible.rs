use crate::components::glow::{glow_wrap, GlowColor, GlowConfig, GlowIntensity};
use tairitsu_macros::rsx;
use tairitsu_vdom::VNode;

pub fn render() -> VNode {
    rsx! {
        div { id: "page-component-collapsible", class: "hikari-page",
            div { class: "page-header",
                h1 { class: "page-header__title", "Collapsible" }
                p { class: "page-header__subtitle",
                    "Accordion and collapse panels with expand/collapse animation."
                }
            }
            div { class: "page-section",
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "Basic Accordion" }
                    div { class: "demo-block__body",
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
                    }
                }
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "Settings Panels" }
                    div { class: "demo-block__body",
                        div { class: "hi-collapse",
                            div { class: "hi-collapse__item hi-collapse__item--active",
                                div { class: "hi-collapse__header",
                                    span { "General" }
                                    span { class: "hi-collapse__arrow", "▼" }
                                }
                                div { class: "hi-collapse__content",
                                    div { style: "display:flex;flex-direction:column;gap:12px;",
                                        div { style: "display:flex;align-items:center;justify-content:space-between;",
                                            span { "Language" }
                                            span { style: "color:var(--hi-color-text-secondary);", "English" }
                                        }
                                        div { style: "display:flex;align-items:center;justify-content:space-between;",
                                            span { "Theme" }
                                            span { style: "color:var(--hi-color-text-secondary);", "Dark" }
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
                    }
                }
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "Nested Panels" }
                    div { class: "demo-block__body",
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
                    }
                }
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "API" }
                    div { class: "demo-block__body",
                        table { class: "api-table",
                            thead { tr { th { "Property" } th { "Type" } th { "Default" } th { "Description" } } }
                            tbody {
                                tr { td { code { "accordion" } } td { code { "bool" } } td { code { "false" } } td { "Only allow one panel open" } }
                                tr { td { code { "activeKey" } } td { code { "string | string[]" } } td { code { "-" } } td { "Active panel key(s)" } }
                                tr { td { code { "bordered" } } td { code { "bool" } } td { code { "true" } } td { "Show border around panels" } }
                                tr { td { code { "expandIcon" } } td { code { "VNode" } } td { code { "▶" } } td { "Custom expand/collapse icon" } }
                                tr { td { code { "collapsible" } } td { code { "header | icon | disabled" } } td { code { "-" } } td { "Trigger area for collapse" } }
                            }
                        }
                    }
                }
            }
        }
    }
}
