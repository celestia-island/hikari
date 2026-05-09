use crate::components::demo_page::{render_api_table, render_demo_block, render_demo_page};
use crate::components::glow::{glow_wrap, GlowColor, GlowConfig, GlowIntensity};
use hikari_components::style_builder::{CssProperty, StyleStringBuilder};
use tairitsu_macros::rsx;
use tairitsu_vdom::VNode;

pub fn render() -> VNode {
    render_demo_page("page-component-user-guide", "User Guide", "Step-by-step interactive guide for onboarding users and feature discovery.", rsx! [
        {render_demo_block("Getting Started Guide", rsx!{
            div { class: "hi-user-guide",
                div { class: "hi-user-guide__header",
                    h4 { "Welcome to Hikari UI" }
                    p { class: "hi-user-guide__desc", "Follow these steps to set up your first project." }
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
        })}
        {render_demo_block("Feature Tour", rsx!{
            div { class: "hi-user-guide",
                div { class: "hi-user-guide__header",
                    h4 { "Feature Spotlight" }
                    p { class: "hi-user-guide__desc", "Discover the key features of this release." }
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
                    div { class: "hi-user-guide__progress__bar", style: StyleStringBuilder::new().add_percent(CssProperty::Width, 66).build_clean() }
                    span { "2 of 3 completed" }
                }
            }
        })}
        {render_demo_block("Vertical Stepper & Spotlight", rsx!{
            div { class: "hi-user-guide__spotlight",
                div { class: "hi-user-guide__stepper",
                    h5 { "Vertical Steps" }
                    div { class: "hi-stepper",
                        div { class: "hi-stepper__item hi-stepper__item--active",
                            div { class: "hi-stepper__dot hi-stepper__dot--primary", "1" }
                            div { class: "hi-stepper__connector" }
                            div {
                                h6 { class: "hi-stepper__title", "Account Setup" }
                                p { class: "hi-stepper__desc", "Create your account" }
                            }
                        }
                        div { class: "hi-stepper__item",
                            div { class: "hi-stepper__dot hi-stepper__dot--success", "✓" }
                            div { class: "hi-stepper__connector hi-stepper__connector--done" }
                            div {
                                h6 { class: "hi-stepper__title", "Verify Email" }
                                p { class: "hi-stepper__desc", "Check your inbox" }
                            }
                        }
                        div { class: "hi-stepper__item",
                            div { class: "hi-stepper__dot hi-stepper__dot--pending", "3" }
                            div {
                                h6 { class: "hi-stepper__title", "Configure Profile" }
                                p { class: "hi-stepper__desc", "Set your preferences" }
                            }
                        }
                    }
                }
                div { class: "hi-user-guide__spotlight-panel",
                    h5 { "Spotlight Overlay" }
                    div { class: "hi-spotlight-card",
                        div { class: "hi-spotlight-card__badge", "New Feature!" }
                        div { class: "hi-spotlight-card__title", "Dark Mode Toggle" }
                        p { class: "hi-spotlight-card__desc", "Switch between light and dark themes. Your preference is saved automatically." }
                        div { class: "hi-spotlight-card__actions",
                            {glow_wrap(
                                rsx! { button { class: "hi-button hi-button-primary hi-button-sm", "Got it!" } },
                                GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Primary, ..Default::default()},
                            )}
                        }
                    }
                }
            }
        })}
        {render_demo_block("API", rsx!{
            div {
                {render_api_table(&[
                ("steps", "GuideStep[]", "-", "Array of step objects"),
                ("current", "number", "0", "Current active step index"),
                ("closable", "bool", "true", "Show close button"),
                ("showProgress", "bool", "true", "Show progress bar"),
                ("mask", "bool", "false", "Show backdrop mask"),
            ])}
            }
        })}
    ])
}
