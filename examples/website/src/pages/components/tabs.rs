// website/src/pages/components/tabs.rs
// Tabs component showcase page with real rendered examples

extern crate components as hikari_components;

use components::{
    layout::{Container, Section},
    TabPane, TabPosition, Tabs,
};
use dioxus::prelude::*;
use icons::{Icon, LucideIcon};
use palette::classes::{
    BgColor, BorderRadius, ClassesBuilder, FontSize, FontWeight, Margin, MarginBottom, Padding,
    PaddingLeft, TextColor,
};

use crate::{app::Route, components::Layout};

#[allow(non_snake_case)]
pub fn ComponentsTabs() -> Element {
    rsx! {
        Layout { current_route: Route::ComponentsNavigation {},

            Container {
                // Page header
                div { class: ClassesBuilder::default().add(MarginBottom::Mb8).build(),
                    h1 {
                        class: ClassesBuilder::default()
                            .add(FontSize::X4xl)
                            .add(FontWeight::Bold)
                            .add(Margin::M0)
                            .add(MarginBottom::Mb2)
                            .build(),
                        "Tabs"
                    }
                    p { class: ClassesBuilder::default().add(Margin::M0).add(TextColor::Gray600).build(),
                        "Tabbed interface for organizing content into separate panels with FUI aesthetics"
                    }
                }

                // Overview
                Section {
                    title: Some("Overview".to_string()),
                    class: ClassesBuilder::default().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::default().add(TextColor::Gray600).build(),
                        p {
                            "Tabs organize content into separate panels, showing one panel at a time. They support:"
                        }
                        ul { class: ClassesBuilder::default().add(PaddingLeft::Pl6).add(Margin::M0).build(),
                            li {
                                strong { "Multiple positions" }
                                " - Top, Bottom, Left, Right"
                            }
                            li {
                                strong { "Smooth animations" }
                                " - Animated ink bar indicator"
                            }
                            li {
                                strong { "Icons" }
                                " - Optional icons for tab labels"
                            }
                            li {
                                strong { "Disabled tabs" }
                                " - Non-interactive tabs"
                            }
                            li {
                                strong { "Style variants" }
                                " - Line, Card, Border Card, Segment"
                            }
                        }
                    }
                }

                // Basic Tabs
                Section {
                    title: Some("Basic Tabs".to_string()),
                    class: ClassesBuilder::default().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::default().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::default()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Gray700)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Default Tabs"
                        }
                        p { class: ClassesBuilder::default().add(TextColor::Gray600).build(),
                            "Basic tabs with top positioning and ink bar animation"
                        }
                        div { class: ClassesBuilder::default().add(Padding::P6).build(),
                            Tabs { default_active: "1".to_string(),
                                TabPane {
                                    item_key: "1".to_string(),
                                    tab: "Overview".to_string(),
                                    div { class: ClassesBuilder::default().add(TextColor::Gray600).build(),
                                        "Overview content goes here. This is the first tab panel."
                                    }
                                }
                                TabPane {
                                    item_key: "2".to_string(),
                                    tab: "Details".to_string(),
                                    div { class: ClassesBuilder::default().add(TextColor::Gray600).build(),
                                        "Detailed information is displayed in this tab."
                                    }
                                }
                                TabPane {
                                    item_key: "3".to_string(),
                                    tab: "Reviews".to_string(),
                                    div { class: ClassesBuilder::default().add(TextColor::Gray600).build(),
                                        "User reviews and ratings appear in this section."
                                    }
                                }
                            }
                        }
                    }

                    div { class: ClassesBuilder::default().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::default()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Gray700)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Tabs with Icons"
                        }
                        p { class: ClassesBuilder::default().add(TextColor::Gray600).build(),
                            "Enhanced tabs with visual icons"
                        }
                        div { class: ClassesBuilder::default().add(Padding::P6).build(),
                            Tabs { default_active: "1".to_string(),
                                TabPane {
                                    item_key: "1".to_string(),
                                    tab: "Home".to_string(),
                                    icon: rsx! {
                                        Icon { icon: LucideIcon::badge, size: 16 }
                                    },
                                    div { class: ClassesBuilder::default().add(TextColor::Gray600).build(),
                                        "Home page content"
                                    }
                                }
                                TabPane {
                                    item_key: "2".to_string(),
                                    tab: "Profile".to_string(),
                                    icon: rsx! {
                                        Icon { icon: LucideIcon::badge, size: 16 }
                                    },
                                    div { class: ClassesBuilder::default().add(TextColor::Gray600).build(),
                                        "User profile information"
                                    }
                                }
                                TabPane {
                                    item_key: "3".to_string(),
                                    tab: "Settings".to_string(),
                                    icon: rsx! {
                                        Icon { icon: LucideIcon::badge, size: 16 }
                                    },
                                    div { class: ClassesBuilder::default().add(TextColor::Gray600).build(),
                                        "Application settings"
                                    }
                                }
                            }
                        }
                    }

                    div { class: ClassesBuilder::default().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::default()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Gray700)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Tabs with Disabled State"
                        }
                        p { class: ClassesBuilder::default().add(TextColor::Gray600).build(),
                            "Tabs that cannot be activated"
                        }
                        div { class: ClassesBuilder::default().add(Padding::P6).build(),
                            Tabs { default_active: "1".to_string(),
                                TabPane {
                                    item_key: "1".to_string(),
                                    tab: "Active".to_string(),
                                    div { class: ClassesBuilder::default().add(TextColor::Gray600).build(),
                                        "This tab is active"
                                    }
                                }
                                TabPane {
                                    item_key: "2".to_string(),
                                    tab: "Disabled".to_string(),
                                    disabled: true,
                                    div { class: ClassesBuilder::default().add(TextColor::Gray600).build(),
                                        "This tab is disabled"
                                    }
                                }
                                TabPane {
                                    item_key: "3".to_string(),
                                    tab: "Another Active".to_string(),
                                    div { class: ClassesBuilder::default().add(TextColor::Gray600).build(),
                                        "This tab is also active"
                                    }
                                }
                            }
                        }
                    }
                }

                // Tab Positions
                Section {
                    title: Some("Tab Positions".to_string()),
                    class: ClassesBuilder::default().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::default().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::default()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Gray700)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Top Tabs (Default)"
                        }
                        p { class: ClassesBuilder::default().add(TextColor::Gray600).build(),
                            "Tabs positioned above content"
                        }
                        div { class: ClassesBuilder::default().add(Padding::P6).build(),
                            Tabs {
                                default_active: "1".to_string(),
                                tab_position: TabPosition::Top,
                                TabPane {
                                    item_key: "1".to_string(),
                                    tab: "Tab 1".to_string(),
                                    div { class: ClassesBuilder::default().add(TextColor::Gray600).build(),
                                        "Top tabs content"
                                    }
                                }
                                TabPane {
                                    item_key: "2".to_string(),
                                    tab: "Tab 2".to_string(),
                                    div { class: ClassesBuilder::default().add(TextColor::Gray600).build(),
                                        "More content here"
                                    }
                                }
                            }
                        }
                    }

                    div { class: ClassesBuilder::default().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::default()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Gray700)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Bottom Tabs"
                        }
                        p { class: ClassesBuilder::default().add(TextColor::Gray600).build(),
                            "Tabs positioned below content"
                        }
                        div { class: ClassesBuilder::default().add(Padding::P6).build(),
                            Tabs {
                                default_active: "1".to_string(),
                                tab_position: TabPosition::Bottom,
                                TabPane {
                                    item_key: "1".to_string(),
                                    tab: "Tab 1".to_string(),
                                    div { class: ClassesBuilder::default().add(TextColor::Gray600).build(),
                                        "Bottom tabs content"
                                    }
                                }
                                TabPane {
                                    item_key: "2".to_string(),
                                    tab: "Tab 2".to_string(),
                                    div { class: ClassesBuilder::default().add(TextColor::Gray600).build(),
                                        "Second tab content"
                                    }
                                }
                            }
                        }
                    }

                    div { class: ClassesBuilder::default().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::default()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Gray700)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Left Tabs"
                        }
                        p { class: ClassesBuilder::default().add(TextColor::Gray600).build(),
                            "Tabs positioned on the left side"
                        }
                        div { class: ClassesBuilder::default().add(Padding::P6).build(),
                            Tabs {
                                default_active: "1".to_string(),
                                tab_position: TabPosition::Left,
                                TabPane {
                                    item_key: "1".to_string(),
                                    tab: "Overview".to_string(),
                                    div { class: ClassesBuilder::default().add(TextColor::Gray600).build(),
                                        "Overview content with left tabs"
                                    }
                                }
                                TabPane {
                                    item_key: "2".to_string(),
                                    tab: "Details".to_string(),
                                    div { class: ClassesBuilder::default().add(TextColor::Gray600).build(),
                                        "Details content with left tabs"
                                    }
                                }
                            }
                        }
                    }

                    div { class: ClassesBuilder::default().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::default()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Gray700)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Right Tabs"
                        }
                        p { class: ClassesBuilder::default().add(TextColor::Gray600).build(),
                            "Tabs positioned on the right side"
                        }
                        div { class: ClassesBuilder::default().add(Padding::P6).build(),
                            Tabs {
                                default_active: "1".to_string(),
                                tab_position: TabPosition::Right,
                                TabPane {
                                    item_key: "1".to_string(),
                                    tab: "Tab 1".to_string(),
                                    div { class: ClassesBuilder::default().add(TextColor::Gray600).build(),
                                        "Content with right tabs"
                                    }
                                }
                                TabPane {
                                    item_key: "2".to_string(),
                                    tab: "Tab 2".to_string(),
                                    div { class: ClassesBuilder::default().add(TextColor::Gray600).build(),
                                        "More content here"
                                    }
                                }
                            }
                        }
                    }
                }

                // Style Variants
                Section {
                    title: Some("Style Variants".to_string()),
                    class: ClassesBuilder::default().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::default().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::default()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Gray700)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Card Style Tabs"
                        }
                        p { class: ClassesBuilder::default().add(TextColor::Gray600).build(),
                            "Card-like container with background"
                        }
                        div { class: ClassesBuilder::default().add(Padding::P6).build(),
                            Tabs {
                                default_active: "1".to_string(),
                                class: "hi-tabs-card".to_string(),
                                TabPane {
                                    item_key: "1".to_string(),
                                    tab: "Settings".to_string(),
                                    div { class: ClassesBuilder::default().add(TextColor::Gray600).build(),
                                        "Settings options"
                                    }
                                }
                                TabPane {
                                    item_key: "2".to_string(),
                                    tab: "Privacy".to_string(),
                                    div { class: ClassesBuilder::default().add(TextColor::Gray600).build(),
                                        "Privacy settings"
                                    }
                                }
                            }
                        }
                    }

                    div { class: ClassesBuilder::default().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::default()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Gray700)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Border Card Style"
                        }
                        p { class: ClassesBuilder::default().add(TextColor::Gray600).build(),
                            "Card with visible borders"
                        }
                        div { class: ClassesBuilder::default().add(Padding::P6).build(),
                            Tabs {
                                default_active: "1".to_string(),
                                class: "hi-tabs-border-card".to_string(),
                                TabPane {
                                    item_key: "1".to_string(),
                                    tab: "Profile".to_string(),
                                    div { class: ClassesBuilder::default().add(TextColor::Gray600).build(),
                                        "Profile information"
                                    }
                                }
                                TabPane {
                                    item_key: "2".to_string(),
                                    tab: "Security".to_string(),
                                    div { class: ClassesBuilder::default().add(TextColor::Gray600).build(),
                                        "Security settings"
                                    }
                                }
                            }
                        }
                    }

                    div { class: ClassesBuilder::default().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::default()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Gray700)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Segment Style (Pill-shaped)"
                        }
                        p { class: ClassesBuilder::default().add(TextColor::Gray600).build(),
                            "Pill-shaped tab container for compact layouts"
                        }
                        div { class: ClassesBuilder::default().add(Padding::P6).build(),
                            Tabs {
                                default_active: "1".to_string(),
                                class: "hi-tabs-segment".to_string(),
                                TabPane {
                                    item_key: "1".to_string(),
                                    tab: "Day".to_string(),
                                    div { class: ClassesBuilder::default().add(TextColor::Gray600).build(),
                                        "Day view content"
                                    }
                                }
                                TabPane {
                                    item_key: "2".to_string(),
                                    tab: "Week".to_string(),
                                    div { class: ClassesBuilder::default().add(TextColor::Gray600).build(),
                                        "Week view content"
                                    }
                                }
                                TabPane {
                                    item_key: "3".to_string(),
                                    tab: "Month".to_string(),
                                    div { class: ClassesBuilder::default().add(TextColor::Gray600).build(),
                                        "Month view content"
                                    }
                                }
                            }
                        }
                    }
                }

                // Usage Examples
                Section {
                    title: Some("Usage Examples".to_string()),
                    class: ClassesBuilder::default().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::default().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::default()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Gray700)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Basic Tabs"
                        }
                        div {
                            class: ClassesBuilder::new()
                                .add(Padding::P4)
                                .add(BgColor::Gray900)
                                .add(BorderRadius::Rounded)
                                .build(),
                            code {
                                r#"Tabs {{
    default_active: "1".to_string(),
    TabPane {{
        item_key: "1".to_string(),
        tab: "Overview".to_string(),
        "Overview content"
    }}
    TabPane {{
        item_key: "2".to_string(),
        tab: "Details".to_string(),
        "Details content"
    }}
}}"#
                            }
                        }
                    }

                    div { class: ClassesBuilder::default().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::default()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Gray700)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Tabs with Icons"
                        }
                        div {
                            class: ClassesBuilder::new()
                                .add(Padding::P4)
                                .add(BgColor::Gray900)
                                .add(BorderRadius::Rounded)
                                .build(),
                            code {
                                r#"Tabs {{
    default_active: "1".to_string(),
    TabPane {{
        item_key: "1".to_string(),
        tab: "Home".to_string(),
        icon: rsx! {{
            Icon {{ icon: LucideIcon::badge, size: 16 }}
        }},
        "Home content"
    }}
}}"#
                            }
                        }
                    }

                    div { class: ClassesBuilder::default().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::default()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Gray700)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Left Positioned Tabs"
                        }
                        div {
                            class: ClassesBuilder::new()
                                .add(Padding::P4)
                                .add(BgColor::Gray900)
                                .add(BorderRadius::Rounded)
                                .build(),
                            code {
                                r#"Tabs {{
    default_active: "1".to_string(),
    tab_position: TabPosition::Left,
    TabPane {{
        item_key: "1".to_string(),
        tab: "Tab 1".to_string(),
        "Content"
    }}
}}"#
                            }
                        }
                    }

                    div { class: ClassesBuilder::default().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::default()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Gray700)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Card Style Tabs"
                        }
                        div {
                            class: ClassesBuilder::new()
                                .add(Padding::P4)
                                .add(BgColor::Gray900)
                                .add(BorderRadius::Rounded)
                                .build(),
                            code {
                                r#"Tabs {{
    default_active: "1".to_string(),
    class: "hi-tabs-card".to_string(),
    TabPane {{
        item_key: "1".to_string(),
        tab: "Settings".to_string(),
        "Settings content"
    }}
}}"#
                            }
                        }
                    }
                }

                // Best Practices
                Section {
                    title: Some("Best Practices".to_string()),
                    class: ClassesBuilder::default().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::default().add(TextColor::Gray600).build(),
                        h3 {
                            class: ClassesBuilder::default()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Gray700)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "When to Use Tabs"
                        }
                        ul { class: ClassesBuilder::default().add(PaddingLeft::Pl6).add(Margin::M0).build(),
                            li {
                                strong { "Content organization" }
                                " - Grouping related content"
                            }
                            li {
                                strong { "Data views" }
                                " - Switching between different views"
                            }
                            li {
                                strong { "Settings" }
                                " - Organizing configuration options"
                            }
                            li {
                                strong { "Multi-step processes" }
                                " - Breaking down complex workflows"
                            }
                        }

                        h3 {
                            class: ClassesBuilder::default()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Gray700)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Tab Organization Guidelines"
                        }
                        ul { class: ClassesBuilder::default().add(PaddingLeft::Pl6).add(Margin::M0).build(),
                            li {
                                strong { "Keep it concise" }
                                " - 3-7 tabs maximum"
                            }
                            li {
                                strong { "Clear labels" }
                                " - Use short, descriptive text"
                            }
                            li {
                                strong { "Logical order" }
                                " - Arrange tabs by importance or workflow"
                            }
                            li {
                                strong { "Consistent content" }
                                " - Each tab should have equal weight"
                            }
                        }

                        h3 {
                            class: ClassesBuilder::default()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Gray700)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Position Guidelines"
                        }
                        ul { class: ClassesBuilder::default().add(PaddingLeft::Pl6).add(Margin::M0).build(),
                            li {
                                strong { "Top" }
                                " - Most common, default choice"
                            }
                            li {
                                strong { "Left/Right" }
                                " - For side-by-side comparisons"
                            }
                            li {
                                strong { "Bottom" }
                                " - Mobile-friendly, less common"
                            }
                        }
                    }
                }
            }
        }
    }
}
