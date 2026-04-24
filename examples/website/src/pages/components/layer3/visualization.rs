use crate::components::demo_page::{render_api_table, render_demo_block, render_demo_page, render_demo_row};
use tairitsu_macros::rsx;
use tairitsu_vdom::VNode;

pub fn render() -> VNode {
    render_demo_page("page-component-visualization", "Visualization", "Charts, graphs, and data visualization primitives for representing data visually.", rsx! [
        {render_demo_block("Bar Chart", rsx!{
            div { class: "hi-chart",
                div { class: "hi-chart__title", "Weekly Activity" }
                div { class: "hi-chart__bars",
                    div { class: "hi-chart__bar", style: "height: 40%;",
                        span { class: "hi-chart__bar__label", "Mon" }
                    }
                    div { class: "hi-chart__bar", style: "height: 70%;",
                        span { class: "hi-chart__bar__label", "Tue" }
                    }
                    div { class: "hi-chart__bar", style: "height: 55%;",
                        span { class: "hi-chart__bar__label", "Wed" }
                    }
                    div { class: "hi-chart__bar", style: "height: 85%;",
                        span { class: "hi-chart__bar__label", "Thu" }
                    }
                    div { class: "hi-chart__bar", style: "height: 60%;",
                        span { class: "hi-chart__bar__label", "Fri" }
                    }
                    div { class: "hi-chart__bar", style: "height: 30%;",
                        span { class: "hi-chart__bar__label", "Sat" }
                    }
                    div { class: "hi-chart__bar", style: "height: 20%;",
                        span { class: "hi-chart__bar__label", "Sun" }
                    }
                }
            }
        })}
        {render_demo_block("Progress Ring", rsx!{
            div { style: "display:flex;gap:24px;flex-wrap:wrap;",
                div { class: "hi-progress-ring",
                    svg { width: "120", height: "120", viewBox: "0 0 120 120",
                        circle { cx: "60", cy: "60", r: "50", fill: "none", stroke: "var(--hi-color-surface)", stroke_width: "8" }
                        circle { cx: "60", cy: "60", r: "50", fill: "none", stroke: "var(--hi-color-primary)", stroke_width: "8",
                            stroke_dasharray: "314", stroke_dashoffset: "94", stroke_linecap: "round",
                            transform: "rotate(-90 60 60)"
                        }
                    }
                    div { class: "hi-progress-ring__text", "70%" }
                }
                div { class: "hi-progress-ring",
                    svg { width: "120", height: "120", viewBox: "0 0 120 120",
                        circle { cx: "60", cy: "60", r: "50", fill: "none", stroke: "var(--hi-color-surface)", stroke_width: "8" }
                        circle { cx: "60", cy: "60", r: "50", fill: "none", stroke: "var(--hi-color-success)", stroke_width: "8",
                            stroke_dasharray: "314", stroke_dashoffset: "31", stroke_linecap: "round",
                            transform: "rotate(-90 60 60)"
                        }
                    }
                    div { class: "hi-progress-ring__text", "90%" }
                }
                div { class: "hi-progress-ring",
                    svg { width: "120", height: "120", viewBox: "0 0 120 120",
                        circle { cx: "60", cy: "60", r: "50", fill: "none", stroke: "var(--hi-color-surface)", stroke_width: "8" }
                        circle { cx: "60", cy: "60", r: "50", fill: "none", stroke: "var(--hi-color-danger)", stroke_width: "8",
                            stroke_dasharray: "314", stroke_dashoffset: "219", stroke_linecap: "round",
                            transform: "rotate(-90 60 60)"
                        }
                    }
                    div { class: "hi-progress-ring__text", "30%" }
                }
            }
        })}
        {render_demo_block("Horizontal Bar Chart", rsx!{
            div { class: "hi-chart hi-chart--horizontal",
                div { class: "hi-chart__title", "Language Popularity" }
                div { style: "display:flex;flex-direction:column;gap:12px;",
                    div { style: "display:flex;align-items:center;gap:12px;",
                        span { style: "width:80px;font-size:13px;text-align:right;", "Rust" }
                        div { class: "hi-chart__h-bar", style: "width: 85%;", "85%" }
                    }
                    div { style: "display:flex;align-items:center;gap:12px;",
                        span { style: "width:80px;font-size:13px;text-align:right;", "Go" }
                        div { class: "hi-chart__h-bar", style: "width: 72%;", "72%" }
                    }
                    div { style: "display:flex;align-items:center;gap:12px;",
                        span { style: "width:80px;font-size:13px;text-align:right;", "TypeScript" }
                        div { class: "hi-chart__h-bar", style: "width: 68%;", "68%" }
                    }
                    div { style: "display:flex;align-items:center;gap:12px;",
                        span { style: "width:80px;font-size:13px;text-align:right;", "Python" }
                        div { class: "hi-chart__h-bar", style: "width: 60%;", "60%" }
                    }
                }
            }
        })}
        {render_demo_block("API", rsx!{
            div {
                {render_api_table(&[
                ("BarChart", "data", "number[]", "Array of values for each bar"),
                ("BarChart", "labels", "string[]", "Labels for each bar"),
                ("BarChart", "direction", "vertical | horizontal", "Bar orientation"),
                ("ProgressRing", "percent", "number", "Completion percentage (0-100)"),
                ("ProgressRing", "size", "number", "Ring diameter in pixels"),
                ("ProgressRing", "strokeWidth", "number", "Ring thickness"),
            ])}
            }
        })}
    ])
}
