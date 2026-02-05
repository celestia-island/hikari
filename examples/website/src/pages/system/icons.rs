// website/src/pages/system/icons.rs
// Icons system page

use dioxus::prelude::*;

use crate::{
    app::Route,
    components::{CodeBlock, Layout},
};
use _icons::{Icon, MdiIcon};
use _palette::classes::{
    BgColor as Bg, BorderRadius as Radius, ClassesBuilder as Classes, Display as Disp,
    FlexDirection as Flex, FontSize as FontSz, FontWeight as FWeight, Gap as Gp,
    MarginBottom as MBot, Padding as Pdg, TextColor as TColor,
};
use _palette::classes::{
    BgColor, BorderRadius, ClassesBuilder, Display, FlexDirection, FontSize, FontWeight, Gap,
    MarginBottom, Padding, TextColor,
};

/// Icons showcase page
#[allow(non_snake_case)]
#[component]
pub fn SystemIcons() -> Element {
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
                            "Powered by Lucide - 1000+ beautifully crafted icons for modern web apps"
                        }
                    }

                    // Icon categories
                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h2 {
                            class: ClassesBuilder::new()
                                .add(FontSize::X2xl)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb4)
                                .build(),
                            "Icon Categories"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Muted).add(FontSize::Lg).add(MarginBottom::Mb4).build(),
                            "Browse icons by category"
                        }
                    }

                    // Categories
                    div { class: ClassesBuilder::new()
                        .add_raw("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6")
                        .build(),

                        // Navigation Icons
                        div { class: ClassesBuilder::new().add(BgColor::White).add(BorderRadius::Rounded).add(Padding::P6).build(),
                            h3 {
                                class: ClassesBuilder::new()
                                    .add(FontSize::Lg)
                                    .add(FontWeight::Semibold)
                                    .add(TextColor::Primary)
                                    .add(MarginBottom::Mb2)
                                    .build(),
                                "Navigation"
                            }
                            p { class: ClassesBuilder::new().add(TextColor::Muted).add(FontSize::Sm).add(MarginBottom::Mb4).build(),
                                "Home, menu items, breadcrumbs"
                            }
                            div { class: ClassesBuilder::new().add(Display::Grid).add(Gap::Gap4).build(),
                                Icon { icon: MdiIcon::Home, size: 32 }
                                Icon { icon: MdiIcon::Menu, size: 32 }
                                Icon { icon: MdiIcon::ChevronLeft, size: 32 }
                                Icon { icon: MdiIcon::ChevronRight, size: 32 }
                                Icon { icon: MdiIcon::ChevronUp, size: 32 }
                                Icon { icon: MdiIcon::ChevronDown, size: 32 }
                            }
                        }

                        // Actions Icons
                        div { class: ClassesBuilder::new().add(BgColor::White).add(BorderRadius::Rounded).add(Padding::P6).build(),
                            h3 {
                                class: ClassesBuilder::new()
                                    .add(FontSize::Lg)
                                    .add(FontWeight::Semibold)
                                    .add(TextColor::Primary)
                                    .add(MarginBottom::Mb2)
                                    .build(),
                                "Actions"
                            }
                            p { class: ClassesBuilder::new().add(TextColor::Muted).add(FontSize::Sm).add(MarginBottom::Mb4).build(),
                                "Search, settings, user actions"
                            }
                            div { class: ClassesBuilder::new().add(Display::Grid).add(Gap::Gap4).build(),
                                Icon { icon: MdiIcon::Search, size: 32 }
                                Icon { icon: MdiIcon::Cog, size: 32 }
                                Icon { icon: MdiIcon::Bell, size: 32 }
                                Icon { icon: MdiIcon::Check, size: 32 }
                                Icon { icon: MdiIcon::X, size: 32 }
                            }
                        }

                        // Status Icons
                        div { class: ClassesBuilder::new().add(BgColor::White).add(BorderRadius::Rounded).add(Padding::P6).build(),
                            h3 {
                                class: ClassesBuilder::new()
                                    .add(FontSize::Lg)
                                    .add(FontWeight::Semibold)
                                    .add(TextColor::Primary)
                                    .add(MarginBottom::Mb2)
                                    .build(),
                                "Status"
                            }
                            p { class: ClassesBuilder::new().add(TextColor::Muted).add(FontSize::Sm).add(MarginBottom::Mb4).build(),
                                "Success, warning, error indicators"
                            }
                            div { class: ClassesBuilder::new().add(Display::Grid).add(Gap::Gap4).build(),
                                Icon { icon: MdiIcon::CheckCircle, size: 32, class: "text-green-500" }
                                Icon { icon: MdiIcon::AlertTriangle, size: 32, class: "text-yellow-500" }
                                Icon { icon: MdiIcon::AlertCircle, size: 32, class: "text-red-500" }
                                Icon { icon: MdiIcon::Info, size: 32, class: "text-blue-500" }
                            }
                        }

                        // Media Icons
                        div { class: ClassesBuilder::new().add(BgColor::White).add(BorderRadius::Rounded).add(Padding::P6).build(),
                            h3 {
                                class: ClassesBuilder::new()
                                    .add(FontSize::Lg)
                                    .add(FontWeight::Semibold)
                                    .add(TextColor::Primary)
                                    .add(MarginBottom::Mb2)
                                    .build(),
                                "Media"
                            }
                            p { class: ClassesBuilder::new().add(TextColor::Muted).add(FontSize::Sm).add(MarginBottom::Mb4).build(),
                                "Image, audio, video controls"
                            }
                            div { class: ClassesBuilder::new().add(Display::Grid).add(Gap::Gap4).build(),
                                Icon { icon: MdiIcon::Play, size: 32 }
                                Icon { icon: MdiIcon::Pause, size: 32 }
                                Icon { icon: MdiIcon::VolumeHigh, size: 32 }
                                Icon { icon: MdiIcon::VolumeMute, size: 32 }
                                Icon { icon: MdiIcon::Maximize, size: 32 }
                            }
                        }

                        // Data Icons
                        div { class: ClassesBuilder::new().add(BgColor::White).add(BorderRadius::Rounded).add(Padding::P6).build(),
                            h3 {
                                class: ClassesBuilder::new()
                                    .add(FontSize::Lg)
                                    .add(FontWeight::Semibold)
                                    .add(TextColor::Primary)
                                    .add(MarginBottom::Mb2)
                                    .build(),
                                "Data"
                            }
                            p { class: ClassesBuilder::new().add(TextColor::Muted).add(FontSize::Sm).add(MarginBottom::Mb4).build(),
                                "Table, chart, database items"
                            }
                            div { class: ClassesBuilder::new().add(Display::Grid).add(Gap::Gap4).build(),
                                Icon { icon: MdiIcon::Table, size: 32 }
                                Icon { icon: MdiIcon::Graph, size: 32 }
                                Icon { icon: MdiIcon::Database, size: 32 }
                                Icon { icon: MdiIcon::SortAscending, size: 32 }
                                Icon { Icon { icon: MdiIcon::Filter, size: 32 } }
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
                            "Usage Example"
                        }
                        div {
                            class: ClassesBuilder::new()
                                .add(BgColor::Surface)
                                .add(BorderRadius::Rounded)
                                .add(Padding::P6)
                                .build(),
                            p { class: ClassesBuilder::new().add(TextColor::Muted).add(MarginBottom::Mb4).build(),
                                "Use icons directly in your components:"
                            }
                            CodeBlock {
                                language: "rust".to_string(),
                                code: "use hikari_icons::{Icon, MdiIcon};\n\nrsx! {\n    Icon { icon: MdiIcon::Home, size: 24 }\n    Icon { icon: MdiIcon::Search, size: 24, class: \"text-primary\" }\n}"
                            }
                        }
                    }
                }
            }
        }
    }
}
