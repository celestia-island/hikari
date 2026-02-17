use dioxus::prelude::*;

use crate::components::{DemoSection, PageContainer};
use crate::hooks::{use_i18n, use_language};
use _components::{Button, Card, Table};
use _palette::classes::{
    ClassesBuilder, Display, Flex, FontSize, Gap, MarginBottom, Padding, TextColor,
};

#[component]
pub fn DashboardDemo() -> Element {
    let i18n = use_i18n();
    let lang_ctx = use_language();
    let lang = (*lang_ctx.language.read()).url_prefix().to_string();

    let (page_title, page_desc) = match i18n {
        Some(_) => (
            "Dashboard Demo".to_string(),
            "Demonstrates how to build a data dashboard using Layer 2 composite components."
                .to_string(),
        ),
        None => (
            "仪表盘示例".to_string(),
            "展示如何使用 Layer 2 复合组件构建数据仪表盘".to_string(),
        ),
    };

    rsx! {
        PageContainer {
            current_route: crate::app::Route::DashboardDemo { lang },
            title: page_title,
            description: page_desc,

            DemoSection {
                title: match i18n {
                    Some(_) => "Statistics".to_string(),
                    None => "统计数据".to_string(),
                },
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
            }

            DemoSection {
                title: match i18n {
                    Some(_) => "Charts".to_string(),
                    None => "图表".to_string(),
                },
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
            }

            DemoSection {
                title: match i18n {
                    Some(_) => "Recent Activity".to_string(),
                    None => "最近活动".to_string(),
                },
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
