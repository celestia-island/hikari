use crate::components::glow::{glow_wrap, GlowColor, GlowConfig, GlowIntensity};
use tairitsu_macros::rsx;
use tairitsu_vdom::VNode;

fn page_link(text: &str, href: &str, active: bool) -> VNode {
    if active {
        rsx! { span { class: "is-active", text } }
    } else {
        rsx! { a { href: href, text } }
    }
}

pub fn render() -> VNode {
    let pg_prev = rsx! { a { class: "hi-pagination__item", href: "#", "‹" } };
    let pg_1 = rsx! { span { class: "hi-pagination__item is-active", "1" } };
    let pg_2 = rsx! { a { class: "hi-pagination__item", href: "#", "2" } };
    let pg_3 = rsx! { a { class: "hi-pagination__item", href: "#", "3" } };
    let pg_next = rsx! { a { class: "hi-pagination__item", href: "#", "›" } };
    let pg_dots = rsx! { span { class: "hi-pagination__item hi-pagination__ellipsis", "…" } };
    let pg_10 = rsx! { a { class: "hi-pagination__item", href: "#", "10" } };

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
                                {rsx! { a { class: "hi-pagination__item", href: "#", "‹" } }}
                                {rsx! { a { class: "hi-pagination__item", href: "#", "1" } }}
                                {rsx! { span { class: "hi-pagination__item is-active", "2" } }}
                                {rsx! { a { class: "hi-pagination__item", href: "#", "3" } }}
                                {rsx! { a { class: "hi-pagination__item", href: "#", "›" } }}
                            }
                            span { class: "hi-pagination__total", "Total: 86 items" }
                        }
                    }
                }
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "With Ellipsis" }
                    div { class: "demo-block__body",
                        div { class: "hi-pagination",
                            {rsx! { a { class: "hi-pagination__item", href: "#", "‹" } }}
                            {rsx! { span { class: "hi-pagination__item is-active", "1" } }}
                            {pg_dots}
                            {rsx! { a { class: "hi-pagination__item", href: "#", "10" } }}
                            {rsx! { a { class: "hi-pagination__item", href: "#", "›" } }}
                        }
                    }
                }
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "Simple Mode" }
                    div { class: "demo-block__body",
                        div { class: "hi-pagination",
                            {rsx! { a { class: "hi-pagination__item", href: "#", "‹ Previous" } }}
                            {rsx! { a { class: "hi-pagination__item", href: "#", "Next ›" } }}
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
