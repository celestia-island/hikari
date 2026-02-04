// website/src/pages/system/css.rs
// CSS utilities system page

use dioxus::prelude::*;

use crate::{app::Route, components::Layout};
use _palette::classes::{BgColor, BorderRadius, ClassesBuilder, Display, FlexDirection, FontSize, FontWeight, Gap, MarginBottom, Padding, TextColor};

/// CSS utilities showcase page
#[allow(non_snake_case)]
#[component]
pub fn SystemCSS() -> Element {
    rsx! {
        Layout {
            current_route: Route::SystemCSS {},
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
                            "CSS Utilities"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Tailwind-compatible utility classes for rapid styling"
                        }
                    }

                    // Display utilities
                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h2 {
                            class: ClassesBuilder::new()
                                .add(FontSize::X2xl)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb4)
                                .build(),
                            "Display"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Muted).add(MarginBottom::Mb4).build(),
                            "Control element visibility"
                        }
                        div {
                            class: ClassesBuilder::new()
                                .add_raw("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4")
                                .build(),

                            div {
                                class: ClassesBuilder::new().add(BgColor::White).add(BorderRadius::Md).add(Padding::P4).build(),
                                div { class: ClassesBuilder::new().add(Display::Block).add(MarginBottom::Mb2).build(), "Block" }
                                div { class: ClassesBuilder::new().add(Display::Inline).add(MarginBottom::Mb2).build(), "Inline" }
                                div { class: ClassesBuilder::new().add(Display::Inline).add(Display::Hidden).add(MarginBottom::Mb2).build(), "Inline + Hidden" }
                            }
                            div {
                                class: ClassesBuilder::new().add(BgColor::White).add(BorderRadius::Md).add(Padding::P4).build(),
                                div { class: ClassesBuilder::new().add(Display::Flex).add(MarginBottom::Mb2).build(), "Flex" }
                                div { class: ClassesBuilder::new().add(Display::Grid).add(MarginBottom::Mb2).build(), "Grid" }
                            }
                            div {
                                class: ClassesBuilder::new().add(BgColor::White).add(BorderRadius::Md).add(Padding::P4).build(),
                                div { class: ClassesBuilder::new().add(Display::None).add(MarginBottom::Mb2).build(), "None" }
                            }
                        }
                    }

                    // Layout utilities
                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h2 {
                            class: ClassesBuilder::new()
                                .add(FontSize::X2xl)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb4)
                                .build(),
                            "Layout"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Muted).add(MarginBottom::Mb4).build(),
                            "Flexbox layouts"
                        }
                        div {
                            class: ClassesBuilder::new()
                                .add_raw("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4")
                                .build(),

                            div {
                                class: ClassesBuilder::new().add(BgColor::White).add(BorderRadius::Md).add(Padding::P4).build(),
                                h3 { class: ClassesBuilder::new().add(FontSize::Lg).add(FontWeight::Semibold).add(MarginBottom::Mb2).build(), "Flex Row" }
                                div { class: ClassesBuilder::new().add(Display::Flex).add(FlexDirection::Row).add(Gap::Gap2).build(),
                                    div { class: ClassesBuilder::new().add(BgColor::Surface).add(Padding::Px3).add(MarginBottom::Mb2).build(), "Item 1" }
                                    div { class: ClassesBuilder::new().add(BgColor::Surface).add(Padding::Px3).add(MarginBottom::Mb2).build(), "Item 2" }
                                }
                            }
                            div {
                                class: ClassesBuilder::new().add(BgColor::White).add(BorderRadius::Md).add(Padding::P4).build(),
                                h3 { class: ClassesBuilder::new().add(FontSize::Lg).add(FontWeight::Semibold).add(MarginBottom::Mb2).build(), "Flex Column" }
                                div { class: ClassesBuilder::new().add(Display::Flex).add(FlexDirection::Column).add(Gap::Gap2).build(),
                                    div { class: ClassesBuilder::new().add(BgColor::Surface).add(Padding::Px3).add(MarginBottom::Mb2).build(), "Item 1" }
                                    div { class: ClassesBuilder::new().add(BgColor::Surface).add(Padding::Px3).add(MarginBottom::Mb2).build(), "Item 2" }
                                }
                            }
                        }
                    }

                    // Spacing utilities
                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h2 {
                            class: ClassesBuilder::new()
                                .add(FontSize::X2xl)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb4)
                                .build(),
                            "Spacing"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Muted).add(MarginBottom::Mb4).build(),
                            "Padding and margins"
                        }
                        div {
                            class: ClassesBuilder::new()
                                .add_raw("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4")
                                .build(),

                            div {
                                class: ClassesBuilder::new().add(BgColor::White).add(BorderRadius::Md).add(Padding::P4).build(),
                                h3 { class: ClassesBuilder::new().add(FontSize::Lg).add(FontWeight::Semibold).add(MarginBottom::Mb2).build(), "Padding" }
                                div { class: ClassesBuilder::new().add(Display::Flex).add(Gap::Gap3).build(),
                                    div { class: ClassesBuilder::new().add(BgColor::Primary).add(TextColor::White).add(Padding::P3).build(), "P3" }
                                    div { class: ClassesBuilder::new().add(BgColor::Primary).add(TextColor::White).add(Padding::P4).build(), "P4" }
                                    div { class: ClassesBuilder::new().add(BgColor::Primary).add(TextColor::White).add(Padding::P6).build(), "P6" }
                                }
                            }
                            div {
                                class: ClassesBuilder::new().add(BgColor::White).add(BorderRadius::Md).add(Padding::P4).build(),
                                h3 { class: ClassesBuilder::new().add(FontSize::Lg).add(FontWeight::Semibold).add(MarginBottom::Mb2).build(), "Margin" }
                                div { class: ClassesBuilder::new().add(Display::Flex).add(Gap::Gap3).build(),
                                    div { class: ClassesBuilder::new().add(BgColor::Surface).add(Padding::Px3).build(), "M0" }
                                    div { class: ClassesBuilder::new().add(BgColor::Surface).add(Padding::Px3).build(), "M2" }
                                    div { class: ClassesBuilder::new().add(BgColor::Surface).add(Padding::Px3).build(), "M4" }
                                }
                            }
                        }
                    }

                    // Typography utilities
                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h2 {
                            class: ClassesBuilder::new()
                                .add(FontSize::X2xl)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb4)
                                .build(),
                            "Typography"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Muted).add(MarginBottom::Mb4).build(),
                            "Font size, weight, and alignment"
                        }
                        div {
                            class: ClassesBuilder::new()
                                .add_raw("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4")
                                .build(),

                            div {
                                class: ClassesBuilder::new().add(BgColor::White).add(BorderRadius::Md).add(Padding::P4).build(),
                                h3 { class: ClassesBuilder::new().add(FontSize::Lg).add(FontWeight::Semibold).add(MarginBottom::Mb2).build(), "Font Size" }
                                div { class: ClassesBuilder::new().add(FontSize::Xs).add(MarginBottom::Mb2).build(), "XS Text" }
                                div { class: ClassesBuilder::new().add(FontSize::Sm).add(MarginBottom::Mb2).build(), "SM Text" }
                                div { class: ClassesBuilder::new().add(FontSize::Base).add(MarginBottom::Mb2).build(), "Base Text" }
                                div { class: ClassesBuilder::new().add(FontSize::Lg).add(MarginBottom::Mb2).build(), "LG Text" }
                                div { class: ClassesBuilder::new().add(FontSize::Xl).add(MarginBottom::Mb2).build(), "XL Text" }
                            }
                            div {
                                class: ClassesBuilder::new().add(BgColor::White).add(BorderRadius::Md).add(Padding::P4).build(),
                                h3 { class: ClassesBuilder::new().add(FontSize::Lg).add(FontWeight::Semibold).add(MarginBottom::Mb2).build(), "Font Weight" }
                                div { class: ClassesBuilder::new().add(FontWeight::Medium).add(MarginBottom::Mb2).build(), "Medium" }
                                div { class: ClassesBuilder::new().add(FontWeight::Bold).add(MarginBottom::Mb2).build(), "Bold" }
                            }
                        }
                    }

                    // Color utilities
                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h2 {
                            class: ClassesBuilder::new()
                                .add(FontSize::X2xl)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb4)
                                .build(),
                            "Colors"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Muted).add(MarginBottom::Mb4).build(),
                            "Text and background colors"
                        }
                        div {
                            class: ClassesBuilder::new()
                                .add_raw("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4")
                                .build(),

                            div {
                                class: ClassesBuilder::new().add(BgColor::White).add(BorderRadius::Md).add(Padding::P4).build(),
                                h3 { class: ClassesBuilder::new().add(FontSize::Lg).add(FontWeight::Semibold).add(MarginBottom::Mb2).build(), "Text Colors" }
                                div { class: ClassesBuilder::new().add(TextColor::Primary).add(MarginBottom::Mb2).build(), "Primary" }
                                div { class: ClassesBuilder::new().add(TextColor::Secondary).add(MarginBottom::Mb2).build(), "Secondary" }
                                div { class: ClassesBuilder::new().add(TextColor::White).add(MarginBottom::Mb2).build(), "White" }
                                div { class: ClassesBuilder::new().add(TextColor::Muted).add(MarginBottom::Mb2).build(), "Muted" }
                            }
                            div {
                                class: ClassesBuilder::new().add(BgColor::White).add(BorderRadius::Md).add(Padding::P4).build(),
                                h3 { class: ClassesBuilder::new().add(FontSize::Lg).add(FontWeight::Semibold).add(MarginBottom::Mb2).build(), "Background Colors" }
                                div { class: ClassesBuilder::new().add(BgColor::Primary).add(MarginBottom::Mb2).build(), "Primary" }
                                div { class: ClassesBuilder::new().add(BgColor::Surface).add(MarginBottom::Mb2).build(), "Surface" }
                                div { class: ClassesBuilder::new().add(BgColor::White).add(MarginBottom::Mb2).build(), "White" }
                            }
                        }
                    }
                }
            }
        }
    }
}
                        p {
                            class: ClassesBuilder::new().add_raw("page-description").add(TextColor::Secondary).build(),
                            "Tailwind-compatible utility classes for rapid styling"
                        }
                    }

                    div {
                        class: ClassesBuilder::new().add_raw("info-box").add(BgColor::Surface).build(),
                        p {
                            class: ClassesBuilder::new().add_raw("info-box-text").build(),
                            "This page is under construction. Check back soon for detailed documentation and examples!"
                        }
                    }
                }
            }
        }
    }
}
