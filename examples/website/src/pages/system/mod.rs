//! System design documentation pages.

pub mod palette;

use tairitsu_macros::rsx;
use tairitsu_vdom::VNode;

use crate::components::demo_page::{render_demo_page, render_demo_block, render_demo_row};

fn render_overview() -> VNode {
    render_demo_page(
        "page-system-overview",
        "Design System",
        "The foundational layer of Hikari: colour palette, CSS utilities, icon library, animations, and internationalisation.",
        rsx! {
            div { class: "card-grid",
                a { href: "/system/palette", class: "card card--link",
                    h3 { class: "card__title", "Color Palette" }
                    p { class: "card__body", "500+ traditional Chinese colors with rich historical context." }
                }
                a { href: "/system/css", class: "card card--link",
                    h3 { class: "card__title", "CSS Utilities" }
                    p { class: "card__body", "Type-safe utility classes inspired by Tailwind CSS." }
                }
                a { href: "/system/icons", class: "card card--link",
                    h3 { class: "card__title", "Icons" }
                    p { class: "card__body", "Material Design Icons rendered as inline SVG — no webfont required." }
                }
                a { href: "/system/animations", class: "card card--link",
                    h3 { class: "card__title", "Animations" }
                    p { class: "card__body", "Spring-physics animation system with preset transitions." }
                }
                a { href: "/system/i18n", class: "card card--link",
                    h3 { class: "card__title", "i18n" }
                    p { class: "card__body", "Multi-language support: en, zhs, zht, ja, ko, fr, es, ru, ar." }
                }
            }
        },
    )
}

fn render_css() -> VNode {
    render_demo_page(
        "page-system-css",
        "CSS Utilities",
        "Type-safe utility class system. All classes are prefixed with hi- to prevent conflicts.",
        rsx! [
            {render_demo_block("Layout",
                rsx! {
                    p { "Flexbox and grid utilities:" }
                    div { {render_demo_row(
                        rsx! {
                            code { "hi-flex" }
                            code { "hi-flex-row" }
                            code { "hi-flex-col" }
                            code { "hi-grid" }
                            code { "hi-gap-4" }
                        }
                    )} }
                }
            )}
            {render_demo_block("Spacing",
                rsx! {
                    p { "Margin and padding scale (0\u{2013}16, with semantic names):" }
                    div { {render_demo_row(
                        rsx! {
                            code { "hi-m-4" }
                            code { "hi-p-6" }
                            code { "hi-mt-2" }
                            code { "hi-pb-8" }
                        }
                    )} }
                }
            )}
            {render_demo_block("Typography",
                render_demo_row(
                    rsx! {
                        code { "hi-text-sm" }
                        code { "hi-text-base" }
                        code { "hi-text-lg" }
                        code { "hi-text-xl" }
                        code { "hi-text-2xl" }
                        code { "hi-font-bold" }
                    }
                )
            )}
            {render_demo_block("Colors",
                rsx! {
                    p { "Text and background color utilities follow the palette color names." }
                    div { {render_demo_row(
                        rsx! {
                            code { "hi-text-primary" }
                            code { "hi-text-secondary" }
                            code { "hi-bg-surface" }
                            code { "hi-bg-background" }
                        }
                    )} }
                }
            )}
        ]
    )
}

fn render_icons() -> VNode {
    use crate::components::icon_utils::icon_el;
    use hikari_icons::mdi_minimal::MdiIcon;

    render_demo_page(
        "page-system-icons",
        "Icons",
        "Hikari ships with Material Design Icons (MDI) and a custom Hikari icon set. All icons are rendered as inline SVG.",
        rsx! [
            {render_demo_block("Usage",
                rsx! {
                    p { "Icons are referenced by name. The icon system supports solid, outline, and duo-tone variants. All icons render as inline SVG — no webfont required." }
                    div { {render_demo_row(
                        rsx! {
                            {icon_el(MdiIcon::Home, 24)}
                            {icon_el(MdiIcon::Account, 24)}
                            {icon_el(MdiIcon::Cog, 24)}
                            {icon_el(MdiIcon::BellOutline, 24)}
                            {icon_el(MdiIcon::Heart, 24)}
                            {icon_el(MdiIcon::Star, 24)}
                        }
                    )} }
                }
            )}
            {render_demo_block("Sizes",
                render_demo_row(
                    rsx! {
                        {icon_el(MdiIcon::Star, 16)}
                        {icon_el(MdiIcon::Star, 24)}
                        {icon_el(MdiIcon::Star, 32)}
                        {icon_el(MdiIcon::Star, 48)}
                    }
                )
            )}
            {render_demo_block("Common Icons",
                render_demo_row(
                    rsx! {
                        {icon_el(MdiIcon::Magnify, 24)}
                        {icon_el(MdiIcon::Menu, 24)}
                        {icon_el(MdiIcon::Close, 24)}
                        {icon_el(MdiIcon::ChevronLeft, 24)}
                        {icon_el(MdiIcon::ChevronRight, 24)}
                        {icon_el(MdiIcon::Check, 24)}
                        {icon_el(MdiIcon::Calendar, 24)}
                        {icon_el(MdiIcon::ClockOutline, 24)}
                    }
                )
            )}
        ]
    )
}

fn render_animations() -> VNode {
    render_demo_page(
        "page-system-animations",
        "Animations",
        "Spring-physics animation system with configurable presets.",
        rsx! [
            {render_demo_block("Keyframe Animations",
                rsx! {
                    p { "CSS keyframe animations available as utility classes:" }
                    div { class: "demo-grid",
                        div { class: "demo-card hikari-anim--slide-in-left", "slide-in-left" }
                        div { class: "demo-card hikari-anim--slide-in-right", "slide-in-right" }
                        div { class: "demo-card hikari-anim--fade-in-scale", "fade-in-scale" }
                        div { class: "demo-card hikari-anim--pulse", "pulse" }
                    }
                }
            )}
            {render_demo_block("Spring Physics",
                rsx! {
                    p { "The hikari-animation crate exposes a spring solver for programmatic animations. Parameters:" }
                    div { {render_demo_row(
                        rsx! {
                            code { "stiffness" }
                            code { "damping" }
                            code { "mass" }
                            code { "velocity" }
                        }
                    )} }
                }
            )}
        ]
    )
}

fn render_i18n() -> VNode {
    render_demo_page(
        "page-system-i18n",
        "Internationalisation",
        "Hikari supports 8 locales with structured translation keys.",
        rsx! [
            {render_demo_block("Supported Locales",
                rsx! {
                    table { class: "hi-table",
                        thead {
                            tr {
                                th { "Code" }
                                th { "Language" }
                                th { "Status" }
                            }
                        }
                        tbody {
                            tr {
                                td { "en" }
                                td { "English" }
                                td { span { class: "hi-tag hi-tag--success", "Complete" } }
                            }
                            tr {
                                td { "zhs" }
                                td { "Chinese Simplified" }
                                td { span { class: "hi-tag hi-tag--success", "Complete" } }
                            }
                            tr {
                                td { "zht" }
                                td { "Chinese Traditional" }
                                td { span { class: "hi-tag hi-tag--success", "Complete" } }
                            }
                            tr {
                                td { "ja" }
                                td { "Japanese" }
                                td { span { class: "hi-tag hi-tag--success", "Complete" } }
                            }
                            tr {
                                td { "ko" }
                                td { "Korean" }
                                td { span { class: "hi-tag hi-tag--success", "Complete" } }
                            }
                            tr {
                                td { "fr" }
                                td { "French" }
                                td { span { class: "hi-tag hi-tag--success", "Complete" } }
                            }
                            tr {
                                td { "es" }
                                td { "Spanish" }
                                td { span { class: "hi-tag hi-tag--success", "Complete" } }
                            }
                            tr {
                                td { "ru" }
                                td { "Russian" }
                                td { span { class: "hi-tag hi-tag--success", "Complete" } }
                            }
                            tr {
                                td { "ar" }
                                td { "Arabic" }
                                td { span { class: "hi-tag hi-tag--success", "Complete" } }
                            }
                        }
                    }
                }
            )}
        ]
    )
}

/// Returns all system pages as a Vec for inclusion in the full page tree.
pub fn render_all() -> Vec<VNode> {
    let mut pages = vec![
        render_overview(),
        render_css(),
        render_icons(),
        render_animations(),
        render_i18n(),
    ];
    pages.push(palette::render());
    pages
}
