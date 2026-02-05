// website/src/pages/demos/showcase.rs
// Demo showcase pages

use dioxus::prelude::*;

use crate::{app::Route, components::Layout};
use _icons::{Icon, MdiIcon};
use _palette::classes::{
    BgColor, ClassesBuilder, Display, FlexDirection, FontSize, FontWeight, Gap, MarginBottom,
    Padding, TextColor,
};

/// Demo overview page
#[component]
pub fn DemosOverview() -> Element {
    let demos = vec![
        (
            "Animation",
            "动画演示",
            "展示 Hikari 动画系统",
            MdiIcon::Play,
            Route::AnimationDemo {},
        ),
        (
            "Layer 1 Form",
            "Layer 1 表单",
            "基础表单组件示例",
            MdiIcon::TextBoxEdit,
            Route::FormDemo {},
        ),
        (
            "Layer 2 Dashboard",
            "Layer 2 仪表板",
            "数据可视化仪表板",
            MdiIcon::ViewDashboard,
            Route::DashboardDemo {},
        ),
        (
            "Layer 3 Video",
            "Layer 3 视频",
            "视频播放器示例",
            MdiIcon::Music,
            Route::VideoDemo {},
        ),
    ];

    rsx! {
        Layout {
            current_route: Route::DemosOverview {},
            children: rsx! {
                div {
                    class: ClassesBuilder::new().add_raw("page-container").build(),

                    div {
                        class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h1 {
                            class: ClassesBuilder::new()
                                .add(FontSize::X4xl)
                                .add(FontWeight::Bold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb0)
                                .build(),
                            "Demos"
                        }
                        p {
                            class: ClassesBuilder::new()
                                .add(TextColor::Secondary)
                                .add(FontSize::Xl)
                                .build(),
                            "完整的应用示例，展示 Hikari 组件在实际场景中的使用"
                        }
                    }

                    div {
                        class: ClassesBuilder::new()
                            .add_raw("grid grid-cols-1 md:grid-cols-2 gap-6")
                            .build(),

                        for (name, cn_name, description, icon, route) in demos {
                            div {
                                class: ClassesBuilder::new()
                                    .add_raw("demo-card")
                                    .add(BgColor::Surface)
                                    .add(Padding::P6)
                                    .build(),

                                div {
                                    class: ClassesBuilder::new()
                                        .add(Display::Flex)
                                        .add(FlexDirection::Row)
                                        .add(Gap::Gap4)
                                        .build(),

                                    Icon {
                                        icon,
                                        size: 48,
                                        class: "demo-icon"
                                    }
                                }

                                h3 {
                                    class: ClassesBuilder::new()
                                        .add(FontSize::Lg)
                                        .add(FontWeight::Semibold)
                                        .add(TextColor::Primary)
                                        .add(MarginBottom::Mb2)
                                        .build(),
                                    "{name}"
                                }

                                p {
                                    class: ClassesBuilder::new()
                                        .add(TextColor::Secondary)
                                        .add(FontSize::Sm)
                                        .add(MarginBottom::Mb4)
                                        .build(),
                                    "{description}"
                                }

                                a {
                                    class: ClassesBuilder::new()
                                        .add_raw("demo-link")
                                        .build(),
                                    href: "{route}",
                                    "查看演示 →"
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
