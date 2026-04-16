use crate::components::glow::{glow_wrap, GlowColor, GlowConfig, GlowIntensity};
use tairitsu_macros::rsx;
use tairitsu_vdom::VNode;

pub fn render() -> VNode {
    let tab1 = glow_wrap(
        rsx! { button { class: "hi-tab hi-tab--active", "Overview" } },
        GlowConfig {
            intensity: GlowIntensity::Soft,
            color: GlowColor::Primary,
            ..Default::default()
        },
    );
    let tab2 = glow_wrap(
        rsx! { button { class: "hi-tab", "Components" } },
        GlowConfig {
            intensity: GlowIntensity::Soft,
            color: GlowColor::Ghost,
            ..Default::default()
        },
    );
    let tab3 = glow_wrap(
        rsx! { button { class: "hi-tab", "API Reference" } },
        GlowConfig {
            intensity: GlowIntensity::Soft,
            color: GlowColor::Ghost,
            ..Default::default()
        },
    );
    let tab4 = glow_wrap(
        rsx! { button { class: "hi-tab", "Changelog" } },
        GlowConfig {
            intensity: GlowIntensity::Soft,
            color: GlowColor::Ghost,
            ..Default::default()
        },
    );

    rsx! {
        div { id: "page-component-navigation", class: "hikari-page",
            div { class: "page-header",
                h1 { class: "page-header__title", "Navigation" }
                p { class: "page-header__subtitle",
                    "Tabs, breadcrumbs, and steps for guiding users through application structure and workflows."
                }
            }
            div { class: "page-section",
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "Tabs" }
                    div { class: "demo-block__body",
                        nav { class: "hi-tabs",
                            {tab1}
                            {tab2}
                            {tab3}
                            {tab4}
                        }
                    }
                }
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "Tabs with Icons" }
                    div { class: "demo-block__body",
                        nav { class: "hi-tabs",
                            {glow_wrap(
                                rsx! { button { class: "hi-tab hi-tab--active", "🏠 Home" } },
                                GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Primary, ..Default::default() },
                            )}
                            {glow_wrap(
                                rsx! { button { class: "hi-tab", "📦 Components" } },
                                GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Ghost, ..Default::default() },
                            )}
                            {glow_wrap(
                                rsx! { button { class: "hi-tab", "⚙️ Settings" } },
                                GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Ghost, ..Default::default() },
                            )}
                        }
                    }
                }
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "Breadcrumbs" }
                    div { class: "demo-block__body",
                        div { style: "display:flex;flex-direction:column;gap:12px;",
                            nav { class: "hi-breadcrumb",
                                a { class: "hi-breadcrumb__item", href: "/", "Home" }
                                span { class: "hi-breadcrumb__separator", "/" }
                                a { class: "hi-breadcrumb__item", href: "/components", "Components" }
                                span { class: "hi-breadcrumb__separator", "/" }
                                span { class: "hi-breadcrumb__item hi-breadcrumb__item--active", "Button" }
                            }
                            nav { class: "hi-breadcrumb",
                                a { class: "hi-breadcrumb__item", href: "/", "Dashboard" }
                                span { class: "hi-breadcrumb__separator", "›" }
                                a { class: "hi-breadcrumb__item", href: "/projects", "Projects" }
                                span { class: "hi-breadcrumb__separator", "›" }
                                a { class: "hi-breadcrumb__item", href: "/projects/hikari", "Hikari" }
                                span { class: "hi-breadcrumb__separator", "›" }
                                span { class: "hi-breadcrumb__item hi-breadcrumb__item--active", "Settings" }
                            }
                        }
                    }
                }
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "Steps" }
                    div { class: "demo-block__body",
                        div { class: "hi-steps",
                            div { class: "hi-steps__item hi-steps__item--finished",
                                div { class: "hi-steps__icon", "✓" }
                                div { class: "hi-steps__title", "Account" }
                                div { class: "hi-steps__description", "Create account" }
                            }
                            div { class: "hi-steps__item hi-steps__item--active",
                                div { class: "hi-steps__icon", "2" }
                                div { class: "hi-steps__title", "Profile" }
                                div { class: "hi-steps__description", "Set up profile" }
                            }
                            div { class: "hi-steps__item",
                                div { class: "hi-steps__icon", "3" }
                                div { class: "hi-steps__title", "Preferences" }
                                div { class: "hi-steps__description", "Configure settings" }
                            }
                            div { class: "hi-steps__item",
                                div { class: "hi-steps__icon", "4" }
                                div { class: "hi-steps__title", "Complete" }
                                div { class: "hi-steps__description", "Review and submit" }
                            }
                        }
                    }
                }
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "API" }
                    div { class: "demo-block__body",
                        table { class: "api-table",
                            thead { tr { th { "Component" } th { "Property" } th { "Type" } th { "Description" } } }
                            tbody {
                                tr { td { code { "Tabs" } } td { code { "active" } } td { code { "number" } } td { "Index of active tab" } }
                                tr { td { code { "Tabs" } } td { code { "variant" } } td { code { "line | card | pill" } } td { "Tab style variant" } }
                                tr { td { code { "Breadcrumb" } } td { code { "separator" } } td { code { "string" } } td { "Character between items" } }
                                tr { td { code { "Steps" } } td { code { "current" } } td { code { "number" } } td { "Current active step" } }
                                tr { td { code { "Steps" } } td { code { "direction" } } td { code { "horizontal | vertical" } } td { "Step layout direction" } }
                            }
                        }
                    }
                }
            }
        }
    }
}
