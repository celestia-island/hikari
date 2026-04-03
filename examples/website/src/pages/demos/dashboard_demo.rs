use tairitsu_vdom::{VElement, VNode, VText};

use crate::components::page_layout::{render_demo_section, render_page_container};

fn txt(s: &str) -> VNode {
    VNode::Text(VText::new(s))
}

fn stat_card(value: &str, label: &str, delta: &str, is_negative: bool) -> VNode {
    let tag_class = if is_negative {
        "hi-tag hi-tag--danger"
    } else {
        "hi-tag hi-tag--success"
    };
    VNode::Element(
        VElement::new("div")
            .class("stat-card")
            .child(VNode::Element(
                VElement::new("span")
                    .class("stat-card__value")
                    .child(txt(value)),
            ))
            .child(VNode::Element(
                VElement::new("span")
                    .class("stat-card__label")
                    .child(txt(label)),
            ))
            .child(VNode::Element(
                VElement::new("span").class(tag_class).child(txt(delta)),
            )),
    )
}

pub fn render_dashboard_demo() -> VNode {
    let stats_grid = VNode::Element(
        VElement::new("div")
            .class("stats-grid")
            .child(stat_card("12,543", "Total Users", "+12.5%", false))
            .child(stat_card("8,234", "Active Users", "+8.2%", false))
            .child(stat_card("1,234", "Today Visits", "-2.3%", true))
            .child(stat_card("3.42%", "Conversion", "+5.1%", false)),
    );

    let stats_section = render_demo_section("Statistics", stats_grid);

    let table = VNode::Element(
        VElement::new("table")
            .class("hi-table hi-table--striped")
            .child(VNode::Element(
                VElement::new("thead").child(VNode::Element(
                    VElement::new("tr")
                        .child(VNode::Element(VElement::new("th").child(txt("User"))))
                        .child(VNode::Element(VElement::new("th").child(txt("Action"))))
                        .child(VNode::Element(VElement::new("th").child(txt("Component"))))
                        .child(VNode::Element(VElement::new("th").child(txt("Date"))))
                        .child(VNode::Element(VElement::new("th").child(txt("Status")))),
                )),
            ))
            .child(VNode::Element(
                VElement::new("tbody")
                    .child(table_row(
                        "Alice",
                        "Viewed",
                        "Button",
                        "2025-01-10",
                        "OK",
                        false,
                    ))
                    .child(table_row(
                        "Bob",
                        "Downloaded",
                        "Icon Set",
                        "2025-01-10",
                        "OK",
                        false,
                    ))
                    .child(table_row(
                        "Carol",
                        "Reported",
                        "Transfer",
                        "2025-01-09",
                        "Pending",
                        true,
                    ))
                    .child(table_row(
                        "Dave",
                        "Submitted",
                        "Form Demo",
                        "2025-01-09",
                        "OK",
                        false,
                    )),
            )),
    );

    let table_section = render_demo_section("Recent Activity", table);

    let charts = VNode::Element(
        VElement::new("div")
            .style("display:grid;grid-template-columns:1fr 1fr;gap:1.5rem")
            .child(VNode::Element(
                VElement::new("div")
                    .class("card")
                    .child(VNode::Element(
                        VElement::new("div")
                            .style("display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem")
                            .child(VNode::Element(
                                VElement::new("h3")
                                    .class("card__title")
                                    .child(txt("Visit Trends")),
                            ))
                            .child(VNode::Element(
                                VElement::new("button")
                                    .class("hi-btn hi-btn--secondary hi-btn--sm")
                                    .child(txt("Export")),
                            )),
                    ))
                    .child(VNode::Element(
                        VElement::new("div")
                            .style("height:200px;display:flex;align-items:center;justify-content:center;border:1px dashed var(--hi-color-border);border-radius:0.5rem;color:var(--hi-color-secondary)")
                            .child(txt("Chart Placeholder")),
                    )),
            ))
            .child(VNode::Element(
                VElement::new("div")
                    .class("card")
                    .child(VNode::Element(
                        VElement::new("div")
                            .style("display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem")
                            .child(VNode::Element(
                                VElement::new("h3")
                                    .class("card__title")
                                    .child(txt("User Distribution")),
                            ))
                            .child(VNode::Element(
                                VElement::new("button")
                                    .class("hi-btn hi-btn--secondary hi-btn--sm")
                                    .child(txt("More")),
                            )),
                    ))
                    .child(VNode::Element(
                        VElement::new("div")
                            .style("height:200px;display:flex;align-items:center;justify-content:center;border:1px dashed var(--hi-color-border);border-radius:0.5rem;color:var(--hi-color-secondary)")
                            .child(txt("Pie Chart Placeholder")),
                    )),
            )),
    );

    let charts_section = render_demo_section("Charts", charts);

    let all_sections = VNode::Element(
        VElement::new("div")
            .child(stats_section)
            .child(charts_section)
            .child(table_section),
    );

    render_page_container(
        Some("Dashboard Demo"),
        Some("Demonstrates how to build a data dashboard using Layer 2 composite components."),
        VNode::Element(
            VElement::new("div")
                .attr("id", "page-demos-dashboard")
                .class("hikari-page")
                .child(all_sections),
        ),
    )
}

fn table_row(
    user: &str,
    action: &str,
    component: &str,
    date: &str,
    status: &str,
    is_warning: bool,
) -> VNode {
    let tag_class = if is_warning {
        "hi-tag hi-tag--warning"
    } else {
        "hi-tag hi-tag--success"
    };
    VNode::Element(
        VElement::new("tr")
            .child(VNode::Element(VElement::new("td").child(txt(user))))
            .child(VNode::Element(VElement::new("td").child(txt(action))))
            .child(VNode::Element(VElement::new("td").child(txt(component))))
            .child(VNode::Element(VElement::new("td").child(txt(date))))
            .child(VNode::Element(VElement::new("td").child(VNode::Element(
                VElement::new("span").class(tag_class).child(txt(status)),
            )))),
    )
}
