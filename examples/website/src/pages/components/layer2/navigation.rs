use crate::components::demo_page::{render_api_table, render_demo_block, render_demo_page};
use crate::components::glow::{glow_wrap, GlowColor, GlowConfig, GlowIntensity};
use tairitsu_macros::rsx;
use tairitsu_vdom::VNode;

pub fn render() -> VNode {
    render_demo_page("page-component-navigation", "Navigation", "Tabs, breadcrumbs, and steps for guiding users through application structure and workflows.", rsx! [
        {render_demo_block("Tabs", rsx! {
            nav { class: "hi-tabs",
                div { {glow_wrap(
                    rsx! { button { class: "hi-tab hi-tab--active", "Overview" } },
                    GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Primary, ..Default::default() },
                )} }
                div { {glow_wrap(
                    rsx! { button { class: "hi-tab", "Components" } },
                    GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Ghost, ..Default::default() },
                )} }
                div { {glow_wrap(
                    rsx! { button { class: "hi-tab", "API Reference" } },
                    GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Ghost, ..Default::default() },
                )} }
                div { {glow_wrap(
                    rsx! { button { class: "hi-tab", "Changelog" } },
                    GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Ghost, ..Default::default() },
                )} }
            }
        })}
        {render_demo_block("Tabs with Icons", rsx! {
            nav { class: "hi-tabs",
                div { {glow_wrap(
                    rsx! { button { class: "hi-tab hi-tab--active", "🏠 Home" } },
                    GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Primary, ..Default::default() },
                )} }
                div { {glow_wrap(
                    rsx! { button { class: "hi-tab", "\u{1F4E6} Components" } },
                    GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Ghost, ..Default::default() },
                )} }
                div { {glow_wrap(
                    rsx! { button { class: "hi-tab", "⚙️ Settings" } },
                    GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Ghost, ..Default::default() },
                )} }
            }
        })}
        {render_demo_block("Breadcrumbs", rsx! {
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
        })}
        {render_demo_block("Steps", rsx! {
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
        })}
        {render_demo_block("API", rsx! {
            div {
                {render_api_table(&[
                    ("Tabs", "active", "number", "Index of active tab"),
                    ("Tabs", "variant", "line | card | pill", "Tab style variant"),
                    ("Breadcrumb", "separator", "string", "Character between items"),
                    ("Steps", "current", "number", "Current active step"),
                    ("Steps", "direction", "horizontal | vertical", "Step layout direction"),
                ])}
            }
        })}
    ])
}
