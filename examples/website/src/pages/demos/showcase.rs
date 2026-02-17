// website/src/pages/demos/showcase.rs
// Demo showcase pages

use dioxus::prelude::*;
use dioxus_router::components::Link;

use crate::{
    app::Route,
    components::PageContainer,
    hooks::{use_i18n, use_language},
};
use _icons::{Icon, MdiIcon};
use _palette::classes::{
    BgColor, ClassesBuilder, Display, FlexDirection, FontSize, FontWeight, Gap, GridCols, Padding,
    TextColor,
};

#[component]
pub fn DemosOverview() -> Element {
    let i18n = use_i18n();
    let lang_ctx = use_language();
    let lang = (*lang_ctx.language.read()).url_prefix().to_string();

    let (page_title, page_desc, view_demo) = match i18n {
        Some(ctx) => {
            let keys = &ctx.keys;
            (
                keys.sidebar.demos.title.clone(),
                "Complete application examples showcasing Hikari components in real scenarios."
                    .to_string(),
                "View Demo ->".to_string(),
            )
        }
        None => (
            "Demos".to_string(),
            "完整的应用示例，展示 Hikari 组件在实际场景中的使用".to_string(),
            "查看演示 ->".to_string(),
        ),
    };

    let demos = vec![
        (
            "Animation",
            "Animation system demonstration",
            MdiIcon::Play,
            Route::AnimationDemo { lang: lang.clone() },
        ),
        (
            "Layer 1 Form",
            "Basic form components example",
            MdiIcon::TextBoxEdit,
            Route::FormDemo { lang: lang.clone() },
        ),
        (
            "Layer 2 Dashboard",
            "Data visualization dashboard",
            MdiIcon::ViewDashboard,
            Route::DashboardDemo { lang: lang.clone() },
        ),
        (
            "Layer 3 Video",
            "Video player example",
            MdiIcon::Play,
            Route::VideoDemo { lang: lang.clone() },
        ),
    ];

    rsx! {
        PageContainer {
            current_route: Route::DemosOverview { lang },
            title: page_title,
            description: page_desc,

            div {
                class: ClassesBuilder::new()
                    .add(Display::Grid)
                    .add(GridCols::Col2)
                    .add(Gap::Gap6)
                    .build(),

                for (name, description, icon, route) in demos {
                    Link {
                        to: route.clone(),
                        div {
                            class: ClassesBuilder::new()
                                .add(BgColor::Surface)
                                .add(Padding::P6)
                                .add(Display::Flex)
                                .add(FlexDirection::Column)
                                .add(Gap::Gap2)
                                .build(),

                            Icon {
                                icon,
                                size: 32,
                            }

                            h3 {
                                class: ClassesBuilder::new()
                                    .add(FontSize::Lg)
                                    .add(FontWeight::Semibold)
                                    .add(TextColor::Primary)
                                    .build(),
                                "{name}"
                            }

                            p {
                                class: ClassesBuilder::new()
                                    .add(TextColor::Secondary)
                                    .add(FontSize::Sm)
                                    .build(),
                                "{description}"
                            }

                            span {
                                class: ClassesBuilder::new()
                                    .add(TextColor::Primary)
                                    .add(FontSize::Sm)
                                    .build(),
                                "{view_demo}"
                            }
                        }
                    }
                }
            }
        }
    }
}
