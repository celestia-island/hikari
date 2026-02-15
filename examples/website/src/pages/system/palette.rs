// website/src/pages/system/palette.rs
// Chinese traditional color palette system page

use dioxus::prelude::*;

use crate::{
    app::Route,
    components::{CodeBlock, Layout},
};
use _palette::{
    classes::{
        BgColor, BorderRadius, ClassesBuilder, Display, FlexDirection, FontSize, FontWeight, Gap,
        MarginBottom, Padding, TextColor,
    },
    colors::*,
    themes::*,
};

/// Palette showcase page
#[allow(non_snake_case)]
#[component]
pub fn SystemPalette() -> Element {
    rsx! {
        Layout {
            current_route: Route::SystemPalette {},
            children: rsx! {
                div {
                    class: ClassesBuilder::new()
                        .add(Display::Flex)
                        .add(FlexDirection::Column)
                        .add(Gap::Gap6)
                        .build(),

                    // Page header
                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h1 {
                            class: ClassesBuilder::new()
                                .add(FontSize::X4xl)
                                .add(FontWeight::Bold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb0)
                                .build(),
                            "Chinese Traditional Colors"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "500+ traditional colors from Chinese culture and history"
                        }
                    }

                    // Color systems overview
                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h2 {
                            class: ClassesBuilder::new()
                                .add(FontSize::X2xl)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb4)
                                .build(),
                            "Color Systems"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Muted).add(FontSize::Lg).add(MarginBottom::Mb4).build(),
                            "Hikari provides seven color systems, each with 20-30 traditional colors"
                        }
                        div {
                            class: ClassesBuilder::new()
                                .add(Display::Grid)
                                .add_raw("grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6")
                                .add(MarginBottom::Mb8)
                                .build(),

                            // Red system
                            div {
                                class: ClassesBuilder::new().add(BgColor::Surface).add(BorderRadius::Lg).add(Padding::P6).build(),
                                h3 {
                                    class: ClassesBuilder::new()
                                        .add(FontSize::Lg)
                                        .add(FontWeight::Semibold)
                                        .add(TextColor::Primary)
                                        .add(MarginBottom::Mb2)
                                        .build(),
                                    "Red (28 colors)"
                                }
                                p {
                                    class: ClassesBuilder::new().add(TextColor::Muted).add(FontSize::Sm).add(MarginBottom::Mb4).build(),
                                    "朱砂, 绯红, 胭脂, 丹色, 银朱, 珊瑚, 胭红, 玫瑰, 绛红, 胭脂红, 桃红, 柿红, 杏红, 褐红, 深红, 绛红, 绛红, 胭脂红, 玫瑰, 绯红, 杏红, 茜红, 茜红"
                                }
                                div {
                                    class: ClassesBuilder::new()
                                        .add_raw("flex gap-2 mt-4")
                                        .build(),

                                    div {
                                        class: ClassesBuilder::new()
                                            .add_raw("w-8 h-8 rounded")
                                            .add_raw("bg-朱砂")
                                            .build(),
                                    }
                                    div {
                                        class: ClassesBuilder::new()
                                            .add_raw("w-8 h-8 rounded")
                                            .add_raw("bg-绯红")
                                            .build(),
                                    }
                                    div {
                                        class: ClassesBuilder::new()
                                            .add_raw("w-8 h-8 rounded")
                                            .add_raw("bg-胭脂")
                                            .build(),
                                    }
                                    div {
                                        class: ClassesBuilder::new()
                                            .add_raw("w-8 h-8 rounded")
                                            .add_raw("bg-朱砂")
                                            .build(),
                                    }
                                }
                            }

                            // Yellow system
                            div {
                                class: ClassesBuilder::new().add(BgColor::Surface).add(BorderRadius::Lg).add(Padding::P6).build(),
                                h3 {
                                    class: ClassesBuilder::new()
                                        .add(FontSize::Lg)
                                        .add(FontWeight::Semibold)
                                        .add(TextColor::Primary)
                                        .add(MarginBottom::Mb2)
                                        .build(),
                                    "Yellow (28 colors)"
                                }
                                p {
                                    class: ClassesBuilder::new().add(TextColor::Muted).add(FontSize::Sm).add(MarginBottom::Mb4).build(),
                                    "藤黄, 鹅黄, 栀子, 杏黄, 藤黄, 璨黄, 鹅黄, 柠黄, 乳鹅黄, 茶黄, 缃黄, 丁香, 姜黄, 米黄, 土黄, 杏黄, 姜黄, 赭黄, 咖黄, 丁香, 姜黄, 鹅黄"
                                }
                                div {
                                    class: ClassesBuilder::new()
                                        .add_raw("flex gap-2 mt-4")
                                        .build(),

                                    div {
                                        class: ClassesBuilder::new()
                                            .add_raw("w-8 h-8 rounded")
                                            .add_raw("bg-藤黄")
                                            .build(),
                                    }
                                    div {
                                        class: ClassesBuilder::new()
                                            .add_raw("w-8 h-8 rounded")
                                            .add_raw("bg-鹅黄")
                                            .build(),
                                    }
                                    div {
                                        class: ClassesBuilder::new()
                                            .add_raw("w-8 h-8 rounded")
                                            .add_raw("bg-栀子")
                                            .build(),
                                    }
                                    div {
                                        class: ClassesBuilder::new()
                                            .add_raw("w-8 h-8 rounded")
                                            .add_raw("bg-藤黄")
                                            .build(),
                                    }
                                }
                            }

                            // Green system
                            div {
                                class: ClassesBuilder::new().add(BgColor::Surface).add(BorderRadius::Lg).add(Padding::P6).build(),
                                h3 {
                                    class: ClassesBuilder::new()
                                        .add(FontSize::Lg)
                                        .add(FontWeight::Semibold)
                                        .add(TextColor::Primary)
                                        .add(MarginBottom::Mb2)
                                        .build(),
                                    "Green (30 colors)"
                                }
                                p {
                                    class: ClassesBuilder::new().add(TextColor::Muted).add(FontSize::Sm).add(MarginBottom::Mb4).build(),
                                    "葱倩, 竹青, 碧色, 翠翠, 青绿, 柳绿, 草绿, 青碧, 水绿, 翠翠, 湖绿, 碧色, 孔雀绿, 翠翠, 翠翠, 青绿, 柳绿, 草绿"
                                }
                                div {
                                    class: ClassesBuilder::new()
                                        .add_raw("flex gap-2 mt-4")
                                        .build(),

                                    div {
                                        class: ClassesBuilder::new()
                                            .add_raw("w-8 h-8 rounded")
                                            .add_raw("bg-葱倩")
                                            .build(),
                                    }
                                    div {
                                        class: ClassesBuilder::new()
                                            .add_raw("w-8 h-8 rounded")
                                            .add_raw("bg-竹青")
                                            .build(),
                                    }
                                    div {
                                        class: ClassesBuilder::new()
                                            .add_raw("w-8 h-8 rounded")
                                            .add_raw("bg-碧色")
                                            .build(),
                                    }
                                    div {
                                        class: ClassesBuilder::new()
                                            .add_raw("w-8 h-8 rounded")
                                            .add_raw("bg-葱倩")
                                            .build(),
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
                                class: ClassesBuilder::new().add(TextColor::Secondary).add(MarginBottom::Mb2).build(),
                                "Use colors directly from the palette:"
                            }
                            CodeBlock {
                                language: "rust".to_string(),
                                code: "use hikari_palette::{朱砂, 石青, 藤黄};\n\nlet primary_color = 朱砂;\nlet secondary_color = 石青;\nlet accent_color = 藤黄;\n\nprintln!(\"Primary: {}\", primary_color.hex);\nprintln!(\"Secondary: {}\", secondary_color.hex);".to_string()
                            }
                        }
                    }
                }
            }
        }
    }
}
