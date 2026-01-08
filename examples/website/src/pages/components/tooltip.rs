// website/src/pages/components/tooltip.rs
// Tooltip component showcase page with documentation


use dioxus::prelude::*;

use _components::{Button, ButtonVariant, Tooltip, TooltipPlacement, layout::{Container, Row, Section}};
use _icons::{Icon, LucideIcon};
use _palette::classes::{ ClassesBuilder, MarginBottom, FontSize, FontWeight, TextColor, Padding, PaddingLeft, Margin, BgColor, BorderRadius, };
use crate::{app::Route, components::Layout};

#[allow(non_snake_case)]
pub fn ComponentsTooltip() -> Element {
    rsx! {
        Layout { current_route: Route::ComponentsFeedback {},

            Container {
                // Page header
                div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                    h1 {
                        class: ClassesBuilder::new()
                            .add(FontSize::X4xl)
                            .add(FontWeight::Bold)
                            .add(Margin::M0)
                            .add(MarginBottom::Mb2)
                            .build(),
                        "Tooltip"
                    }
                    p { class: ClassesBuilder::new().add(Margin::M0).add(TextColor::Gray600).build(),
                        "Floating labels for additional context with FUI aesthetics"
                    }
                }

                // Overview
                Section {
                    title: Some("Overview".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(TextColor::Gray600).build(),
                        p {
                            "Tooltips provide additional context when users hover over or focus on elements. They support:"
                        }
                        ul { class: ClassesBuilder::new().add(PaddingLeft::Pl6).add(Margin::M0).build(),
                            li {
                                strong { "Multiple placements" }
                                " - Top, Bottom, Left, Right"
                            }
                            li {
                                strong { "Optional arrow" }
                                " - Visual indicator pointing to element"
                            }
                            li {
                                strong { "Custom delay" }
                                " - Control appearance timing"
                            }
                            li {
                                strong { "Rich content" }
                                " - Any text content"
                            }
                        }
                    }
                }

                // Tooltip Placements
                Section {
                    title: Some("Tooltip Placements".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Gray700)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Top Placement"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Gray600).build(),
                            "Tooltip appears above the element (default)"
                        }
                        div { style: "padding: 40px;",
                            Tooltip {
                                content: "This tooltip appears above the button".to_string(),
                                placement: TooltipPlacement::Top,
                                Button { variant: ButtonVariant::Primary, "Hover Me (Top)" }
                            }
                        }
                    }

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Gray700)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Bottom Placement"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Gray600).build(),
                            "Tooltip appears below the element"
                        }
                        div { style: "padding: 40px;",
                            Tooltip {
                                content: "This tooltip appears below the button".to_string(),
                                placement: TooltipPlacement::Bottom,
                                Button { variant: ButtonVariant::Secondary, "Hover Me (Bottom)" }
                            }
                        }
                    }

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Gray700)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Left Placement"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Gray600).build(),
                            "Tooltip appears to the left of the element"
                        }
                        div { style: "padding: 40px;",
                            Tooltip {
                                content: "This tooltip appears on the left".to_string(),
                                placement: TooltipPlacement::Left,
                                Button { variant: ButtonVariant::Ghost, "Hover Me (Left)" }
                            }
                        }
                    }

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Gray700)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Right Placement"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Gray600).build(),
                            "Tooltip appears to the right of the element"
                        }
                        div { style: "padding: 40px;",
                            Tooltip {
                                content: "This tooltip appears on the right".to_string(),
                                placement: TooltipPlacement::Right,
                                Button { variant: ButtonVariant::Success, "Hover Me (Right)" }
                            }
                        }
                    }
                }

                // Tooltip Options
                Section {
                    title: Some("Tooltip Options".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Gray700)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "With Arrow"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Gray600).build(),
                            "Arrow indicator pointing to the element (default: true)"
                        }
                        div { style: "padding: 40px;",
                            Tooltip {
                                content: "Tooltip with arrow".to_string(),
                                placement: TooltipPlacement::Top,
                                arrow: true,
                                Button { variant: ButtonVariant::Primary, "With Arrow" }
                            }
                        }
                    }

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Gray700)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Without Arrow"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Gray600).build(),
                            "Clean tooltip without arrow indicator"
                        }
                        div { style: "padding: 40px;",
                            Tooltip {
                                content: "Tooltip without arrow".to_string(),
                                placement: TooltipPlacement::Top,
                                arrow: false,
                                Button { variant: ButtonVariant::Secondary, "No Arrow" }
                            }
                        }
                    }
                }

                // Tooltip with Different Elements
                Section {
                    title: Some("Tooltip with Different Elements".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Gray700)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Icon Tooltips"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Gray600).build(),
                            "Add tooltips to icon buttons for clarity"
                        }
                        Row { gap: "lg".to_string(),
                            Tooltip {
                                content: "Edit this item".to_string(),
                                placement: TooltipPlacement::Top,
                                Button {
                                    variant: ButtonVariant::Ghost,
                                    icon: rsx! {
                                        Icon { icon: LucideIcon::badge, size: 18 }
                                    },
                                }
                            }
                            Tooltip {
                                content: "Delete this item".to_string(),
                                placement: TooltipPlacement::Top,
                                Button {
                                    variant: ButtonVariant::Ghost,
                                    icon: rsx! {
                                        Icon { icon: LucideIcon::badge, size: 18 }
                                    },
                                }
                            }
                            Tooltip {
                                content: "Download file".to_string(),
                                placement: TooltipPlacement::Top,
                                Button {
                                    variant: ButtonVariant::Ghost,
                                    icon: rsx! {
                                        Icon { icon: LucideIcon::badge, size: 18 }
                                    },
                                }
                            }
                        }
                    }

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Gray700)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Text Tooltips"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Gray600).build(),
                            "Provide additional context for text elements"
                        }
                        div { style: "padding: 20px;",
                            Tooltip {
                                content: "This is an important term that needs explanation".to_string(),
                                placement: TooltipPlacement::Top,
                                span { style: "border-bottom: 1px dotted; cursor: help;",
                                    "Hover over this text"
                                }
                            }
                        }
                    }

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Gray700)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Long Content"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Gray600).build(),
                            "Tooltips can contain longer text descriptions"
                        }
                        div { style: "padding: 40px;",
                            Tooltip {
                                content: "This is a much longer tooltip that provides detailed information about the element. It can contain multiple sentences and will wrap appropriately."
                                    .to_string(),
                                placement: TooltipPlacement::Top,
                                Button { variant: ButtonVariant::Primary, "Long Tooltip" }
                            }
                        }
                    }
                }

                // Usage Examples
                Section {
                    title: Some("Usage Examples".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Gray700)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Basic Tooltip"
                        }
                        div {
                            class: ClassesBuilder::new()
                                .add(Padding::P4)
                                .add(BgColor::Gray900)
                                .add(BorderRadius::Rounded)
                                .build(),
                            code {
                                r#"Tooltip {{
    content: "Helpful information".to_string(),
    placement: TooltipPlacement::Top,
    Button {{ "Hover me" }}
}}"#
                            }
                        }
                    }

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Gray700)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Tooltip without Arrow"
                        }
                        div {
                            class: ClassesBuilder::new()
                                .add(Padding::P4)
                                .add(BgColor::Gray900)
                                .add(BorderRadius::Rounded)
                                .build(),
                            code {
                                r#"Tooltip {{
    content: "Clean tooltip".to_string(),
    placement: TooltipPlacement::Bottom,
    arrow: false,
    Button {{ "No Arrow" }}
}}"#
                            }
                        }
                    }

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Gray700)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Icon Button with Tooltip"
                        }
                        div {
                            class: ClassesBuilder::new()
                                .add(Padding::P4)
                                .add(BgColor::Gray900)
                                .add(BorderRadius::Rounded)
                                .build(),
                            code {
                                r#"Tooltip {{
    content: "Delete item".to_string(),
    placement: TooltipPlacement::Top,
    Button {{
        variant: ButtonVariant::Ghost,
        icon: rsx! {{
            Icon {{ icon: LucideIcon::badge }}
        }},
    }}
}}"#
                            }
                        }
                    }

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Gray700)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Side Placement"
                        }
                        div {
                            class: ClassesBuilder::new()
                                .add(Padding::P4)
                                .add(BgColor::Gray900)
                                .add(BorderRadius::Rounded)
                                .build(),
                            code {
                                r#"Tooltip {{
    content: "Appears on the right".to_string(),
    placement: TooltipPlacement::Right,
    Button {{ "Right Tooltip" }}
}}"#
                            }
                        }
                    }
                }

                // Best Practices
                Section {
                    title: Some("Best Practices".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(TextColor::Gray600).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Gray700)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "When to Use Tooltips"
                        }
                        ul { class: ClassesBuilder::new().add(PaddingLeft::Pl6).add(Margin::M0).build(),
                            li {
                                strong { "Icon buttons" }
                                " - Explain icon actions"
                            }
                            li {
                                strong { "Abbreviations" }
                                " - Define technical terms"
                            }
                            li {
                                strong { "Supplementary info" }
                                " - Add context without clutter"
                            }
                            li {
                                strong { "Form help" }
                                " - Provide input guidance"
                            }
                        }

                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Gray700)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Content Guidelines"
                        }
                        ul { class: ClassesBuilder::new().add(PaddingLeft::Pl6).add(Margin::M0).build(),
                            li {
                                strong { "Keep it brief" }
                                " - 1-2 sentences maximum"
                            }
                            li {
                                strong { "Be descriptive" }
                                " - Explain what, not just state"
                            }
                            li {
                                strong { "Use plain language" }
                                " - Avoid jargon"
                            }
                            li {
                                strong { "No critical info" }
                                " - Tooltips can be missed"
                            }
                        }

                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Gray700)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Placement Guidelines"
                        }
                        ul { class: ClassesBuilder::new().add(PaddingLeft::Pl6).add(Margin::M0).build(),
                            li {
                                strong { "Top" }
                                " - Default, most common choice"
                            }
                            li {
                                strong { "Bottom" }
                                " - When top space is limited"
                            }
                            li {
                                strong { "Left/Right" }
                                " - For side-by-side layouts"
                            }
                            li {
                                strong { "Avoid overlap" }
                                " - Don't cover other interactive elements"
                            }
                        }
                    }
                }
            }
        }
    }
}
