use crate::components::glow::{glow_wrap, GlowColor, GlowConfig, GlowIntensity};
use tairitsu_macros::rsx;
use tairitsu_vdom::VNode;

pub fn render() -> VNode {
    rsx! {
        div { id: "page-component-user-guide", class: "hikari-page",
            div { class: "page-header",
                h1 { class: "page-header__title", "User Guide" }
                p { class: "page-header__subtitle",
                    "Step-by-step interactive guide for onboarding users and feature discovery."
                }
            }
            div { class: "page-section",
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "Getting Started Guide" }
                    div { class: "demo-block__body",
                        div { class: "hi-user-guide",
                            div { class: "hi-user-guide__header",
                                h4 { "Welcome to Hikari UI" }
                                p { style: "font-size:14px;color:var(--hi-color-text-secondary);", "Follow these steps to set up your first project." }
                            }
                            div { class: "hi-user-guide__steps",
                                div { class: "hi-user-guide__step hi-user-guide__step--active",
                                    div { class: "hi-user-guide__step__number", "1" }
                                    div { class: "hi-user-guide__step__content",
                                        h5 { "Install the CLI" }
                                        p { "Run the following command to install the Hikari CLI tool globally." }
                                        code { class: "hi-code-block", "cargo install hikari-cli" }
                                    }
                                }
                                div { class: "hi-user-guide__step",
                                    div { class: "hi-user-guide__step__number", "2" }
                                    div { class: "hi-user-guide__step__content",
                                        h5 { "Create a new project" }
                                        p { "Scaffold a new project with the default template." }
                                        code { class: "hi-code-block", "hikari new my-app" }
                                    }
                                }
                                div { class: "hi-user-guide__step",
                                    div { class: "hi-user-guide__step__number", "3" }
                                    div { class: "hi-user-guide__step__content",
                                        h5 { "Start development" }
                                        p { "Launch the dev server with hot reload." }
                                        code { class: "hi-code-block", "cd my-app && hikari dev" }
                                    }
                                }
                                div { class: "hi-user-guide__step",
                                    div { class: "hi-user-guide__step__number", "4" }
                                    div { class: "hi-user-guide__step__content",
                                        h5 { "Build for production" }
                                        p { "Create an optimized build ready for deployment." }
                                        code { class: "hi-code-block", "hikari build" }
                                    }
                                }
                            }
                            div { class: "hi-user-guide__footer",
                                {glow_wrap(
                                    rsx! { button { class: "hi-button hi-button-secondary", "Skip" } },
                                    GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Secondary, ..Default::default() },
                                )}
                                {glow_wrap(
                                    rsx! { button { class: "hi-button hi-button-primary", "Next Step" } },
                                    GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Primary, ..Default::default() },
                                )}
                            }
                        }
                    }
                }
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "Feature Tour" }
                    div { class: "demo-block__body",
                        div { class: "hi-user-guide",
                            div { class: "hi-user-guide__header",
                                h4 { "Feature Spotlight" }
                                p { style: "font-size:14px;color:var(--hi-color-text-secondary);", "Discover the key features of this release." }
                            }
                            div { class: "hi-user-guide__steps",
                                div { class: "hi-user-guide__step hi-user-guide__step--completed",
                                    div { class: "hi-user-guide__step__number", "✓" }
                                    div { class: "hi-user-guide__step__content",
                                        h5 { "Dark Mode" }
                                        p { "Switch between light and dark themes from the settings panel." }
                                    }
                                }
                                div { class: "hi-user-guide__step hi-user-guide__step--active",
                                    div { class: "hi-user-guide__step__number", "2" }
                                    div { class: "hi-user-guide__step__content",
                                        h5 { "Keyboard Shortcuts" }
                                        p { "Use Ctrl+K for quick search and Ctrl+/ for the command palette." }
                                    }
                                }
                                div { class: "hi-user-guide__step",
                                    div { class: "hi-user-guide__step__number", "3" }
                                    div { class: "hi-user-guide__step__content",
                                        h5 { "Custom Themes" }
                                        p { "Create and apply custom color themes to personalize your workspace." }
                                    }
                                }
                            }
                            div { class: "hi-user-guide__progress",
                                div { class: "hi-user-guide__progress__bar", style: "width: 66%;" }
                                span { "2 of 3 completed" }
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
                                tr { td { code { "steps" } } td { code { "GuideStep[]" } } td { code { "-" } } td { "Array of step objects" } }
                                tr { td { code { "current" } } td { code { "number" } } td { code { "0" } } td { "Current active step index" } }
                                tr { td { code { "closable" } } td { code { "bool" } } td { code { "true" } } td { "Show close button" } }
                                tr { td { code { "showProgress" } } td { code { "bool" } } td { code { "true" } } td { "Show progress bar" } }
                                tr { td { code { "mask" } } td { code { "bool" } } td { code { "false" } } td { "Show backdrop mask" } }
                            }
                        }
                    }
                }
            }
        }
    }
}
