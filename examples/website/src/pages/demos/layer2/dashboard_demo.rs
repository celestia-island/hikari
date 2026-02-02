// website/src/pages/demos/layer2/dashboard_demo.rs
// Layer 2: Dashboard demo example

use dioxus::prelude::*;

use crate::components::Layout;
use _components::{Button, Card, Table};
use _palette::classes::{ ClassesBuilder, Display, Flex, FontSize, Gap, MarginBottom, Padding, TextColor, };

/// Dashboard demo
#[component]
pub fn DashboardDemo() -> Element {
    rsx! {
        Layout {
            current_route: crate::app::Route::DashboardDemo {},
            div {
                class: ClassesBuilder::new()
                    .add_raw("page-container")
                    .build(),

                div {
                    class: ClassesBuilder::new()
                        .add_raw("page-header")
                        .build(),

                    h1 {
                        class: ClassesBuilder::new()
                            .add_raw("page-title")
                            .add(FontSize::X4xl)
                            .build(),
                        "仪表盘示例"
                    }

                    p {
                        class: ClassesBuilder::new()
                            .add_raw("page-description")
                            .add(TextColor::Muted)
                            .add(FontSize::Xl)
                            .build(),
                        "展示如何使用 Layer 2 复合组件构建数据仪表盘"
                    }
                }

                // Dashboard Content
                div {
                    class: "dashboard-content",

                    // Stats Cards
                    div {
                        class: ClassesBuilder::new()
                            .add(Display::Grid)
                            .add_raw("grid-cols-1 md:grid-cols-4 gap-6")
                            .add(MarginBottom::Mb6)
                            .build(),

                        div { class: "stat-card",
                            div { class: "stat-title", "总用户数" }
                            div { class: "stat-value", "12,543" }
                            div { class: "stat-trend", "+12.5%" }
                        }

                        div { class: "stat-card",
                            div { class: "stat-title", "活跃用户" }
                            div { class: "stat-value", "8,234" }
                            div { class: "stat-trend", "+8.2%" }
                        }

                        div { class: "stat-card",
                            div { class: "stat-title", "今日访问" }
                            div { class: "stat-value", "1,234" }
                            div { class: "stat-trend trend-down", "-2.3%" }
                        }

                        div { class: "stat-card",
                            div { class: "stat-title", "转化率" }
                            div { class: "stat-value", "3.42%" }
                            div { class: "stat-trend", "+5.1%" }
                        }
                    }

                    // Chart Section
                    div {
                        class: ClassesBuilder::new()
                            .add_raw("grid-cols-1 md:grid-cols-2 gap-6")
                            .add(MarginBottom::Mb6)
                            .build(),

                        Card {
                            class: "chart-card",
                            div { class: "card-header",
                                h3 { "访问趋势" }
                                Button { "导出 Export" }
                            }
                            div { class: "chart-placeholder", "📊 Chart Placeholder" }
                        }

                        Card {
                            class: "chart-card",
                            div { class: "card-header",
                                h3 { "用户分布" }
                                Button { "更多 More" }
                            }
                            div { class: "chart-placeholder", "🥧 Pie Chart Placeholder" }
                        }
                    }

                    // Data Table
                    Card {
                        class: "table-card",
                        div { class: "card-header",
                            h3 { "最近活动" }
                            Button { "查看全部 View All" }
                        }
                        Table {
                            data: vec![
                                vec!["用户登录".to_string(), "张三".to_string(), "2分钟前".to_string()],
                                vec!["订单创建".to_string(), "李四".to_string(), "5分钟前".to_string()],
                                vec!["数据同步".to_string(), "王五".to_string(), "10分钟前".to_string()],
                            ]
                        }
                    }
                }
            }
        }
    }
}
