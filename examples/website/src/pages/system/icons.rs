// website/src/pages/system/icons.rs
// Icons system page

use dioxus::prelude::*;

use crate::{app::Route, components::Layout};
use _palette::classes::{BgColor, BorderRadius, ClassesBuilder, Display, FlexDirection, FontSize, FontWeight, Gap, MarginBottom, Padding, TextColor};
use _icons::{Icon, MdiIcon};

/// Icons showcase page
#[allow(non_snake_case)]
#[component]
pub fn SystemIcons() -> Element {
    let icon_categories = vec![
        ("Navigation", "导航图标", vec![
            MdiIcon::Home,
            MdiIcon::Menu,
            MdiIcon::Search,
            MdiIcon::ChevronDown,
            MdiIcon::ChevronLeft,
            MdiIcon::ChevronRight,
        ]),
        ("Actions", "操作图标", vec![
            MdiIcon::Plus,
            MdiIcon::Minus,
            MdiIcon::Check,
            MdiIcon::X,
            MdiIcon::Pencil,
            MdiIcon::Trash,
            MdiIcon::Refresh,
        ]),
        ("Status", "状态图标", vec![
            MdiIcon::AlertCircle,
            MdiIcon::CheckCircle,
            MdiIcon::Circle,
            MdiIcon::Loader,
            MdiIcon::Star,
            MdiIcon::Heart,
        ]),
        ("Files", "文件图标", vec![
            MdiIcon::File,
            MdiIcon::Folder,
            MdiIcon::Image,
            MdiIcon::Music,
            MdiIcon::Video,
        ]),
        ("Communication", "通讯图标", vec![
            MdiIcon::Message,
            MdiIcon::Mail,
            MdiIcon::Phone,
            MdiIcon::Bell,
            MdiIcon::Wifi,
        ]),
    ];

    rsx! {
        Layout {
            current_route: Route::SystemIcons {},
            children: rsx! {
                div {
                    class: ClassesBuilder::new()
                        .add(Display::Flex)
                        .add(FlexDirection::Column)
                        .add(Gap::Gap6)
                        .build(),

                    // Page header
                    div { class: ClassesBuilder::new().add(MarginBottom::Mb0).build(),
                        h1 {
                            class: ClassesBuilder::new()
                                .add(FontSize::X4xl)
                                .add(FontWeight::Bold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb0)
                                .build(),
                            "Icons"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Powered by Lucide - 1000+ beautifully crafted icons"
                        }
                    }

                    // Icon categories
                    div {
                        class: ClassesBuilder::new()
                            .add_raw("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6")
                            .add(MarginBottom::Mb8)
                            .build(),

                        for (category_name, category_desc, icons) in icon_categories {
                            div {
                                class: ClassesBuilder::new()
                                    .add(BgColor::Surface)
                                    .add(BorderRadius::Lg)
                                    .add(Padding::P6)
                                    .build(),

                                h3 {
                                    class: ClassesBuilder::new()
                                        .add(FontSize::Xl)
                                        .add(FontWeight::Semibold)
                                        .add(TextColor::Primary)
                                        .add(MarginBottom::Mb4)
                                        .build(),
                                    "{category_name}"
                                }
                                p {
                                    class: ClassesBuilder::new()
                                        .add(TextColor::Muted)
                                        .add(FontSize::Sm)
                                        .add(MarginBottom::Mb2)
                                        .build(),
                                    "{category_desc}"
                                }

                                div {
                                    class: ClassesBuilder::new()
                                        .add_raw("flex flex-wrap gap-3")
                                        .build(),

                                    for icon in icons {
                                        div {
                                            class: ClassesBuilder::new()
                                                .add_raw("icon-box")
                                                .add(BgColor::White)
                                                .add(BorderRadius::Md)
                                                .add(Padding::P3)
                                                .build(),

                                            Icon {
                                                icon,
                                                size: 32,
                                                class: "icon-item"
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // Usage example
                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h2 {
                            class: ClassesBuilder::new()
                                .add(FontSize::X2xl)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb4)
                                .build(),
                            "Basic Usage"
                        }
                        div {
                            class: ClassesBuilder::new()
                                .add(BgColor::Surface)
                                .add(BorderRadius::Lg)
                                .add(Padding::P6)
                                .build(),

                            p {
                                class: ClassesBuilder::new().add(TextColor::Secondary).add(MarginBottom::Mb4).build(),
                                "Use icons from the Icon component:"
                            }
                            CodeBlock {
                                language: "rust".to_string(),
                                code: r#"use dioxus::prelude::*;
use hikari_icons::{Icon, LucideIcon};

rsx! {
    Icon {
        icon: LucideIcon::Search,
        size: 24,
        color: "var(--hi-color-primary)"
    }
}"#
                            }
                        }
                    }
                }
            }
        }
    }
}
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Powered by Lucide - 1000+ beautifully crafted icons"
                        }
                    }

                    div {
                        class: ClassesBuilder::new()
                            .add(BgColor::Surface)
                            .add(BorderRadius::Lg)
                            .add(Padding::P6)
                            .build(),
                        p { class: ClassesBuilder::new().add(TextColor::Primary).add(MarginBottom::Mb0).build(),
                            "This page is under construction. Check back soon for detailed documentation and examples!"
                        }
                    }
                }
            },
        }
    }
}
