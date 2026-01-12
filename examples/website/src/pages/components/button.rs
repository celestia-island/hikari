// website/src/pages/components/button.rs
// Button component showcase page with real rendered examples

use dioxus::prelude::*;

use crate::{app::Route, components::Layout};
use _components::{
    layout::{Container, Section},
    Button, ButtonAnimation, ButtonSize, ButtonVariant,
};
use _icons::{Icon, MdiIcon};
use _palette::classes::{
    ClassesBuilder, FontSize, FontWeight, MarginBottom, Padding, PaddingLeft, TextColor,
};

#[allow(non_snake_case)]
pub fn ComponentsButton() -> Element {
    rsx! {
        Layout { current_route: Route::ComponentsBasic {},

            Container {
                // Page header
                div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                    h1 {
                        class: ClassesBuilder::new()
                            .add(FontSize::X4xl)
                            .add(FontWeight::Bold)
                            .add(MarginBottom::Mb0)
                            .add(MarginBottom::Mb2)
                            .build(),
                        "Button"
                    }
                    p { class: ClassesBuilder::new().add(MarginBottom::Mb0).add(TextColor::Secondary).build(),
                        "Buttons trigger actions and come in various styles with FUI aesthetics"
                    }
                }

                // Overview
                Section {
                    title: Some("Overview".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                        p {
                            "Buttons allow users to take actions, make choices, and navigate through your application. They support:"
                        }
                        ul { class: ClassesBuilder::new().add(PaddingLeft::Pl6).add(MarginBottom::Mb0).build(),
                            li {
                                strong { "Multiple variants" }
                                " - Primary, Secondary, Ghost, Danger, Success"
                            }
                            li {
                                strong { "Size options" }
                                " - Small, Medium, Large"
                            }
                            li {
                                strong { "States" }
                                " - Loading, Disabled, Normal"
                            }
                            li {
                                strong { "Spotlight effect" }
                                " - FUI-style cursor-following glow"
                            }
                            li {
                                strong { "Animations" }
                                " - Scale, Ripple, Icon rotation"
                            }
                            li {
                                strong { "Icons" }
                                " - With prefix or suffix icons"
                            }
                        }
                    }
                }

                // Button Variants
                Section {
                    title: Some("Button Variants".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Primary Button"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Use for the main action in a page or dialog"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            Button {
                                variant: ButtonVariant::Primary,
                                spotlight: true,
                                "Primary Action"
                            }
                            Button {
                                variant: ButtonVariant::Primary,
                                size: ButtonSize::Small,
                                spotlight: true,
                                Icon { icon: MdiIcon::Alert, size: 16 }
                                " Add New"
                            }
                        }
                    }

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Secondary Button"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Use for alternative or secondary actions"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            Button {
                                variant: ButtonVariant::Secondary,
                                spotlight: true,
                                "Secondary"
                            }
                            Button {
                                variant: ButtonVariant::Secondary,
                                spotlight: true,
                                Icon { icon: MdiIcon::Alert, size: 16 }
                                " Settings"
                            }
                        }
                    }

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Ghost Button"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Minimal button for low-emphasis actions"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            Button {
                                variant: ButtonVariant::Ghost,
                                spotlight: true,
                                "Ghost"
                            }
                            Button {
                                variant: ButtonVariant::Ghost,
                                spotlight: true,
                                Icon { icon: MdiIcon::Alert, size: 16 }
                                " Edit"
                            }
                        }
                    }

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Danger Button"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Use for destructive or dangerous actions"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            Button {
                                variant: ButtonVariant::Danger,
                                spotlight: true,
                                "Delete"
                            }
                            Button {
                                variant: ButtonVariant::Danger,
                                spotlight: true,
                                Icon { icon: MdiIcon::Alert, size: 16 }
                                " Remove"
                            }
                        }
                    }

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Success Button"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Use for positive or confirm actions"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            Button {
                                variant: ButtonVariant::Success,
                                spotlight: true,
                                "Confirm"
                            }
                            Button {
                                variant: ButtonVariant::Success,
                                spotlight: true,
                                Icon { icon: MdiIcon::Alert, size: 16 }
                                " Approve"
                            }
                        }
                    }
                }

                // Button Sizes
                Section {
                    title: Some("Button Sizes".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Size Variants"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Buttons come in three sizes for different contexts"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            Button {
                                variant: ButtonVariant::Primary,
                                size: ButtonSize::Small,
                                spotlight: true,
                                "Small"
                            }
                            Button {
                                variant: ButtonVariant::Primary,
                                size: ButtonSize::Medium,
                                spotlight: true,
                                "Medium"
                            }
                            Button {
                                variant: ButtonVariant::Primary,
                                size: ButtonSize::Large,
                                spotlight: true,
                                "Large"
                            }
                        }
                    }
                }

                // Button States
                Section {
                    title: Some("Button States".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Loading State"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Buttons can show a loading spinner during async operations"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            Button {
                                variant: ButtonVariant::Primary,
                                loading: true,
                                "Loading..."
                            }
                            Button {
                                variant: ButtonVariant::Secondary,
                                loading: true,
                                "Processing..."
                            }
                        }
                    }

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Disabled State"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Disabled buttons prevent user interaction"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            Button {
                                variant: ButtonVariant::Primary,
                                disabled: true,
                                "Disabled"
                            }
                            Button {
                                variant: ButtonVariant::Secondary,
                                disabled: true,
                                "Cannot Click"
                            }
                        }
                    }

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Block Button"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Full-width button for mobile or form contexts"
                        }
                        Button {
                            variant: ButtonVariant::Primary,
                            block: true,
                            spotlight: true,
                            "Full Width Button"
                        }
                    }
                }

                // Spotlight Effect
                Section {
                    title: Some("Spotlight Effect".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                        p {
                            "The spotlight effect creates a FUI-style glow that follows your cursor. Hover over the buttons below to see the effect in action."
                        }
                    }

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "With Spotlight"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            Button {
                                variant: ButtonVariant::Primary,
                                spotlight: true,
                                "Hover Me"
                            }
                            Button {
                                variant: ButtonVariant::Secondary,
                                spotlight: true,
                                "And Me"
                            }
                            Button {
                                variant: ButtonVariant::Ghost,
                                spotlight: true,
                                "Me Too"
                            }
                        }
                    }

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Without Spotlight"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            Button { variant: ButtonVariant::Primary, "No Spotlight" }
                            Button { variant: ButtonVariant::Secondary, "Standard Style" }
                        }
                    }
                }

                // Button Animations
                Section {
                    title: Some("Button Animations".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                        p {
                            "Buttons support various hover animations for enhanced interactivity. Hover over the buttons to see the animations."
                        }
                    }

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Scale Animation"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            Button {
                                variant: ButtonVariant::Primary,
                                animation: ButtonAnimation::Scale,
                                spotlight: true,
                                "Scale (1.0 → 1.05)"
                            }
                        }
                    }

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Scale + Elevate Animation"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            Button {
                                variant: ButtonVariant::Primary,
                                animation: ButtonAnimation::ScaleElevate,
                                spotlight: true,
                                "Scale + Elevate"
                            }
                        }
                    }

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Ripple Animation"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            Button {
                                variant: ButtonVariant::Primary,
                                animation: ButtonAnimation::Ripple,
                                spotlight: true,
                                "Ripple Effect"
                            }
                        }
                    }

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Icon Rotation Animation"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            Button {
                                variant: ButtonVariant::Primary,
                                animation: ButtonAnimation::IconRotate,
                                icon: rsx! {
                                    Icon { icon: MdiIcon::Alert, size: 16 }
                                },
                                spotlight: true,
                                "Icon Rotate"
                            }
                        }
                    }
                }

                // Icon Buttons
                Section {
                    title: Some("Icon Buttons".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Button with Prefix Icon"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Icons can be placed before the text"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            Button {
                                variant: ButtonVariant::Primary,
                                spotlight: true,
                                icon: rsx! {
                                    Icon { icon: MdiIcon::Alert, size: 16 }
                                },
                                "Download"
                            }
                            Button {
                                variant: ButtonVariant::Secondary,
                                spotlight: true,
                                icon: rsx! {
                                    Icon { icon: MdiIcon::Alert, size: 16 }
                                },
                                "Upload"
                            }
                        }
                    }

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Icon-Only Buttons"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Compact buttons with only an icon"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            Button {
                                variant: ButtonVariant::Primary,
                                size: ButtonSize::Medium,
                                spotlight: true,
                                icon: rsx! {
                                    Icon { icon: MdiIcon::Alert, size: 18 }
                                },
                            }
                            Button {
                                variant: ButtonVariant::Secondary,
                                size: ButtonSize::Medium,
                                spotlight: true,
                                icon: rsx! {
                                    Icon { icon: MdiIcon::Alert, size: 18 }
                                },
                            }
                            Button {
                                variant: ButtonVariant::Ghost,
                                size: ButtonSize::Medium,
                                spotlight: true,
                                icon: rsx! {
                                    Icon { icon: MdiIcon::Alert, size: 18 }
                                },
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
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Basic Button"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            code { r#"Button {{ "Click Me" }}"# }
                        }
                    }

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Primary Button with Spotlight"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            code {
                                r#"Button {{
    variant: ButtonVariant::Primary,
    spotlight: true,
    "Primary Action"
}}"#
                            }
                        }
                    }

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Button with Icon and Handler"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            code {
                                r#"Button {{
    variant: ButtonVariant::Success,
    icon: rsx! {{ Icon {{ icon: MdiIcon::Alert }} }},
    onclick: move |_| println!("Clicked!"),
    "Confirm"
}}"#
                            }
                        }
                    }

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Loading Button"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            code {
                                r#"Button {{
    variant: ButtonVariant::Primary,
    loading: true,
    "Processing..."
}}"#
                            }
                        }
                    }
                }
            }
        }
    }
}
