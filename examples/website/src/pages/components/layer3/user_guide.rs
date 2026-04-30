use crate::components::demo_page::{render_api_table, render_demo_block, render_demo_page};
use crate::components::glow::{glow_wrap, GlowColor, GlowConfig, GlowIntensity};
use tairitsu_macros::rsx;
use tairitsu_vdom::VNode;

pub fn render() -> VNode {
    render_demo_page("page-component-user-guide", "User Guide", "Step-by-step interactive guide for onboarding users and feature discovery.", rsx! [
        {render_demo_block("Getting Started Guide", rsx!{
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
        })}
        {render_demo_block("Feature Tour", rsx!{
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
        })}
        {render_demo_block("Vertical Stepper & Spotlight", rsx!{
            div { style: "display:flex;gap:32px;",
                div { style: "flex:1;max-width:320px;",
                    h5 { style: "margin-bottom:16px;font-size:14px;", "Vertical Steps" }
                    div { style: "display:flex;flex-direction:column;gap:0;",
                        div { style: "display:flex;gap:12px;",
                            div { style: "display:flex;flex-direction:column;align-items:center;gap:4px;",
                                div { style: "width:28px;height:28px;border-radius:50%;background:#f472b6;color:white;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600;", "1" }
                                div { style: "width:2px;height:32px;background:#f472b6;" }
                            }
                            div {
                                h6 { style: "margin:0;font-size:14px;", "Account Setup" }
                                p { style: "margin:2px 0 0;font-size:12px;color:var(--hi-gray-500);", "Create your account" }
                            }
                        }
                        div { style: "display:flex;gap:12px;",
                            div { style: "display:flex;flex-direction:column;align-items:center;gap:4px;",
                                div { style: "width:28px;height:28px;border-radius:50%;background:#22c55e;color:white;display:flex;align-items:center;justify-content:center;font-size:13px;", "✓" }
                                div { style: "width:2px;height:32px;background:#e5e7eb;" }
                            }
                            div {
                                h6 { style: "margin:0;font-size:14px;", "Verify Email" }
                                p { style: "margin:2px 0 0;font-size:12px;color:var(--hi-gray-500);", "Check your inbox" }
                            }
                        }
                        div { style: "display:flex;gap:12px;",
                            div { style: "display:flex;flex-direction:column;align-items:center;gap:4px;",
                                div { style: "width:28px;height:28px;border-radius:50%;background:#e5e7eb;color:var(--hi-gray-500);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600;", "3" }
                            }
                            div {
                                h6 { style: "margin:0;font-size:14px;", "Configure Profile" }
                                p { style: "margin:2px 0 0;font-size:12px;color:var(--hi-gray-500);", "Set your preferences" }
                            }
                        }
                    }
                }
                div { style: "flex:1;",
                    h5 { style: "margin-bottom:16px;font-size:14px;", "Spotlight Overlay" }
                    div { style: "position:relative;padding:24px;border:2px solid #f472b6;border-radius:12px;background:rgba(244,114,182,0.04);",
                        div { style: "position:absolute;top:-10px;left:20px;background:#f472b6;color:white;padding:2px 10px;border-radius:4px;font-size:12px;font-weight:600;", "New Feature!" }
                        div { style: "font-weight:600;margin-bottom:8px;", "Dark Mode Toggle" }
                        p { style: "font-size:13px;color:var(--hi-gray-600);margin:0 0 12px;", "Switch between light and dark themes. Your preference is saved automatically." }
                        div { style: "display:flex;gap:8px;",
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
