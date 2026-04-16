use crate::components::glow::{glow_wrap, GlowColor, GlowConfig, GlowIntensity};
use tairitsu_macros::rsx;
use tairitsu_vdom::VNode;

pub fn render() -> VNode {
    let pg_prev = glow_wrap(
        rsx! { button { class: "hi-pagination__btn", "‹" } },
        GlowConfig {
            intensity: GlowIntensity::Soft,
            color: GlowColor::Ghost,
            ..Default::default()
        },
    );
    let pg_1 = glow_wrap(
        rsx! { button { class: "hi-pagination__btn hi-pagination__btn--active", "1" } },
        GlowConfig {
            intensity: GlowIntensity::Soft,
            color: GlowColor::Primary,
            ..Default::default()
        },
    );
    let pg_2 = glow_wrap(
        rsx! { button { class: "hi-pagination__btn", "2" } },
        GlowConfig {
            intensity: GlowIntensity::Soft,
            color: GlowColor::Ghost,
            ..Default::default()
        },
    );
    let pg_3 = glow_wrap(
        rsx! { button { class: "hi-pagination__btn", "3" } },
        GlowConfig {
            intensity: GlowIntensity::Soft,
            color: GlowColor::Ghost,
            ..Default::default()
        },
    );
    let pg_dots = glow_wrap(
        rsx! { button { class: "hi-pagination__btn hi-pagination__btn--dots", "…" } },
        GlowConfig {
            intensity: GlowIntensity::Soft,
            color: GlowColor::Ghost,
            ..Default::default()
        },
    );
    let pg_10 = glow_wrap(
        rsx! { button { class: "hi-pagination__btn", "10" } },
        GlowConfig {
            intensity: GlowIntensity::Soft,
            color: GlowColor::Ghost,
            ..Default::default()
        },
    );
    let pg_next = glow_wrap(
        rsx! { button { class: "hi-pagination__btn", "›" } },
        GlowConfig {
            intensity: GlowIntensity::Soft,
            color: GlowColor::Ghost,
            ..Default::default()
        },
    );

    rsx! {
        div { id: "page-component-pagination", class: "hikari-page",
            div { class: "page-header",
                h1 { class: "page-header__title", "Pagination" }
                p { class: "page-header__subtitle",
                    "Page navigation control with total count display and quick jump support."
                }
            }
            div { class: "page-section",
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "Basic Pagination" }
                    div { class: "demo-block__body",
                        div { class: "hi-pagination",
                            {pg_prev}
                            {pg_1}
                            {pg_2}
                            {pg_3}
                            {pg_next}
                        }
                    }
                }
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "With Total Count" }
                    div { class: "demo-block__body",
                        div { style: "display:flex;align-items:center;gap:16px;",
                            div { class: "hi-pagination",
                                {glow_wrap(
                                    rsx! { button { class: "hi-pagination__btn", "‹" } },
                                    GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Ghost, ..Default::default() },
                                )}
                                {glow_wrap(
                                    rsx! { button { class: "hi-pagination__btn", "1" } },
                                    GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Ghost, ..Default::default() },
                                )}
                                {glow_wrap(
                                    rsx! { button { class: "hi-pagination__btn hi-pagination__btn--active", "2" } },
                                    GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Primary, ..Default::default() },
                                )}
                                {glow_wrap(
                                    rsx! { button { class: "hi-pagination__btn", "3" } },
                                    GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Ghost, ..Default::default() },
                                )}
                                {glow_wrap(
                                    rsx! { button { class: "hi-pagination__btn", "›" } },
                                    GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Ghost, ..Default::default() },
                                )}
                            }
                            span { class: "hi-pagination__total", "Total: 86 items" }
                        }
                    }
                }
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "With Ellipsis" }
                    div { class: "demo-block__body",
                        div { class: "hi-pagination",
                            {glow_wrap(
                                rsx! { button { class: "hi-pagination__btn", "‹" } },
                                GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Ghost, ..Default::default() },
                            )}
                            {glow_wrap(
                                rsx! { button { class: "hi-pagination__btn hi-pagination__btn--active", "1" } },
                                GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Primary, ..Default::default() },
                            )}
                            {pg_dots}
                            {glow_wrap(
                                rsx! { button { class: "hi-pagination__btn", "10" } },
                                GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Ghost, ..Default::default() },
                            )}
                            {glow_wrap(
                                rsx! { button { class: "hi-pagination__btn", "›" } },
                                GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Ghost, ..Default::default() },
                            )}
                        }
                    }
                }
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "Simple Mode" }
                    div { class: "demo-block__body",
                        div { class: "hi-pagination",
                            {glow_wrap(
                                rsx! { button { class: "hi-pagination__btn", "‹ Previous" } },
                                GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Ghost, ..Default::default() },
                            )}
                            {glow_wrap(
                                rsx! { button { class: "hi-pagination__btn", "Next ›" } },
                                GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Ghost, ..Default::default() },
                            )}
                        }
                    }
                }
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "API" }
                    div { class: "demo-block__body",
                        table { class: "api-table",
                            thead { tr { th { "Property" } th { "Type" } th { "Default" } th { "Description" } } }
                            tbody {
                                tr { td { code { "current" } } td { code { "number" } } td { code { "1" } } td { "Current active page" } }
                                tr { td { code { "total" } } td { code { "number" } } td { code { "-" } } td { "Total number of items" } }
                                tr { td { code { "pageSize" } } td { code { "number" } } td { code { "10" } } td { "Items per page" } }
                                tr { td { code { "showTotal" } } td { code { "bool" } } td { code { "false" } } td { "Show total item count" } }
                                tr { td { code { "simple" } } td { code { "bool" } } td { code { "false" } } td { "Show only prev/next buttons" } }
                            }
                        }
                    }
                }
            }
        }
    }
}
