//! System design documentation pages.

pub mod palette;

use tairitsu_macros::rsx;
use tairitsu_vdom::VNode;

fn render_overview() -> VNode {
    rsx! {
        div { id: "page-system-overview", class: "hikari-page",
            div { class: "page-header",
                h1 { class: "page-header__title", "Design System" }
                p { class: "page-header__subtitle",
                    "The foundational layer of Hikari: colour palette, CSS utilities, icon library, animations, and internationalisation."
                }
            }
            div { class: "page-section",
                div { class: "card-grid",
                    a { href: "/system/palette", class: "card card--link",
                        h3 { class: "card__title", "Color Palette" }
                        p { class: "card__body",
                            "500+ traditional Chinese colors with rich historical context."
                        }
                    }
                    a { href: "/system/css", class: "card card--link",
                        h3 { class: "card__title", "CSS Utilities" }
                        p { class: "card__body",
                            "Type-safe utility classes inspired by Tailwind CSS."
                        }
                    }
                    a { href: "/system/icons", class: "card card--link",
                        h3 { class: "card__title", "Icons" }
                        p { class: "card__body", "Material Design Icons and custom Hikari icon set." }
                    }
                    a { href: "/system/animations", class: "card card--link",
                        h3 { class: "card__title", "Animations" }
                        p { class: "card__body",
                            "Spring-physics animation system with preset transitions."
                        }
                    }
                    a { href: "/system/i18n", class: "card card--link",
                        h3 { class: "card__title", "i18n" }
                        p { class: "card__body",
                            "Multi-language support: en-US, zh-CHS, zh-CHT, ja-JP, ko-KR, fr-FR, es-ES, ru-RU."
                        }
                    }
                }
            }
        }
    }
}

fn render_css() -> VNode {
    rsx! {
        div { id: "page-system-css", class: "hikari-page",
            div { class: "page-header",
                h1 { class: "page-header__title", "CSS Utilities" }
                p { class: "page-header__subtitle",
                    "Type-safe utility class system. All classes are prefixed with hi- to prevent conflicts."
                }
            }
            div { class: "page-section",
                h2 { "Layout" }
                p { "Flexbox and grid utilities:" }
                div { class: "demo-row",
                    code { "hi-flex" }
                    code { "hi-flex-row" }
                    code { "hi-flex-col" }
                    code { "hi-grid" }
                    code { "hi-gap-4" }
                }
                h2 { "Spacing" }
                p { "Margin and padding scale (0–16, with semantic names):" }
                div { class: "demo-row",
                    code { "hi-m-4" }
                    code { "hi-p-6" }
                    code { "hi-mt-2" }
                    code { "hi-pb-8" }
                }
                h2 { "Typography" }
                div { class: "demo-row",
                    code { "hi-text-sm" }
                    code { "hi-text-base" }
                    code { "hi-text-lg" }
                    code { "hi-text-xl" }
                    code { "hi-text-2xl" }
                    code { "hi-font-bold" }
                }
                h2 { "Colors" }
                p { "Text and background color utilities follow the palette color names." }
                div { class: "demo-row",
                    code { "hi-text-primary" }
                    code { "hi-text-secondary" }
                    code { "hi-bg-surface" }
                    code { "hi-bg-background" }
                }
            }
        }
    }
}

fn render_icons() -> VNode {
    rsx! {
        div { id: "page-system-icons", class: "hikari-page",
            div { class: "page-header",
                h1 { class: "page-header__title", "Icons" }
                p { class: "page-header__subtitle",
                    "Hikari ships with Material Design Icons (MDI) and a custom Hikari icon set."
                }
            }
            div { class: "page-section",
                h2 { "Usage" }
                p {
                    "Icons are referenced by name. The icon system supports solid, outline, and duo-tone variants."
                }
                div { class: "demo-row",
                    span { class: "hi-icon mdi mdi-home" }
                    span { class: "hi-icon mdi mdi-account" }
                    span { class: "hi-icon mdi mdi-settings" }
                    span { class: "hi-icon mdi mdi-bell" }
                    span { class: "hi-icon mdi mdi-heart" }
                    span { class: "hi-icon mdi mdi-star" }
                }
                h2 { "Sizes" }
                div { class: "demo-row",
                    span { class: "hi-icon hi-icon--sm mdi mdi-star" }
                    span { class: "hi-icon mdi mdi-star" }
                    span { class: "hi-icon hi-icon--lg mdi mdi-star" }
                    span { class: "hi-icon hi-icon--xl mdi mdi-star" }
                }
            }
        }
    }
}

fn render_animations() -> VNode {
    rsx! {
        div { id: "page-system-animations", class: "hikari-page",
            div { class: "page-header",
                h1 { class: "page-header__title", "Animations" }
                p { class: "page-header__subtitle",
                    "Spring-physics animation system with configurable presets."
                }
            }
            div { class: "page-section",
                h2 { "Keyframe Animations" }
                p { "CSS keyframe animations available as utility classes:" }
                div { class: "demo-grid",
                    div { class: "demo-card hikari-anim--slide-in-left", "slide-in-left" }
                    div { class: "demo-card hikari-anim--slide-in-right", "slide-in-right" }
                    div { class: "demo-card hikari-anim--fade-in-scale", "fade-in-scale" }
                    div { class: "demo-card hikari-anim--pulse", "pulse" }
                }
                h2 { "Spring Physics" }
                p {
                    "The hikari-animation crate exposes a spring solver for programmatic animations. Parameters:"
                }
                div { class: "demo-row",
                    code { "stiffness" }
                    code { "damping" }
                    code { "mass" }
                    code { "velocity" }
                }
            }
        }
    }
}

fn render_i18n() -> VNode {
    rsx! {
        div { id: "page-system-i18n", class: "hikari-page",
            div { class: "page-header",
                h1 { class: "page-header__title", "Internationalisation" }
                p { class: "page-header__subtitle",
                    "Hikari supports 8 locales with structured translation keys."
                }
            }
            div { class: "page-section",
                h2 { "Supported Locales" }
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
                            td { "en-US" }
                            td { "English (United States)" }
                            td {
                                span { class: "hi-tag hi-tag--success", "Complete" }
                            }
                        }
                        tr {
                            td { "zh-CHS" }
                            td { "Chinese Simplified" }
                            td {
                                span { class: "hi-tag hi-tag--success", "Complete" }
                            }
                        }
                        tr {
                            td { "zh-CHT" }
                            td { "Chinese Traditional" }
                            td {
                                span { class: "hi-tag hi-tag--success", "Complete" }
                            }
                        }
                        tr {
                            td { "ja-JP" }
                            td { "Japanese" }
                            td {
                                span { class: "hi-tag hi-tag--success", "Complete" }
                            }
                        }
                        tr {
                            td { "ko-KR" }
                            td { "Korean" }
                            td {
                                span { class: "hi-tag hi-tag--success", "Complete" }
                            }
                        }
                        tr {
                            td { "fr-FR" }
                            td { "French" }
                            td {
                                span { class: "hi-tag hi-tag--success", "Complete" }
                            }
                        }
                        tr {
                            td { "es-ES" }
                            td { "Spanish" }
                            td {
                                span { class: "hi-tag hi-tag--success", "Complete" }
                            }
                        }
                        tr {
                            td { "ru-RU" }
                            td { "Russian" }
                            td {
                                span { class: "hi-tag hi-tag--success", "Complete" }
                            }
                        }
                    }
                }
            }
        }
    }
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
