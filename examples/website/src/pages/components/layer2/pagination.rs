use crate::components::demo_page::{render_api_table, render_demo_block, render_demo_page};
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

    render_demo_page("page-component-pagination", "Pagination", "Page navigation control with total count display and quick jump support.", rsx! {
        render_demo_block("Basic Pagination", rsx! {
            div { class: "hi-pagination",
                {pg_prev}
                {pg_1}
                {pg_2}
                {pg_3}
                {pg_next}
            }
        })
        render_demo_block("With Total Count", rsx! {
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
        })
        render_demo_block("With Ellipsis", rsx! {
            div { class: "hi-pagination",
                {rsx! { a { class: "hi-pagination__item", href: "#", "‹" } }}
                {rsx! { span { class: "hi-pagination__item is-active", "1" } }}
                {pg_dots}
                {rsx! { a { class: "hi-pagination__item", href: "#", "10" } }}
                {rsx! { a { class: "hi-pagination__item", href: "#", "›" } }}
            }
        })
        render_demo_block("Simple Mode", rsx! {
            div { class: "hi-pagination",
                {rsx! { a { class: "hi-pagination__item", href: "#", "‹ Previous" } }}
                {rsx! { a { class: "hi-pagination__item", href: "#", "Next ›" } }}
            }
        })
        render_demo_block("API", rsx! {
            {render_api_table(&[
                ("current", "number", "1", "Current active page"),
                ("total", "number", "-", "Total number of items"),
                ("pageSize", "number", "10", "Items per page"),
                ("showTotal", "bool", "false", "Show total item count"),
                ("simple", "bool", "false", "Show only prev/next buttons"),
            ])}
        })
    })
}
