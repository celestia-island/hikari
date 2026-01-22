// website/src/pages/components/display/avatar.rs
// Avatar component showcase page with real rendered examples

use dioxus::prelude::*;

use crate::{app::Route, components::Layout};
use _components::{
    basic::{Avatar, AvatarSize, AvatarVariant},
    layout::{Container, Section},
};
use _icons::{Icon, MdiIcon};
use _palette::classes::{
    ClassesBuilder, Display, FontSize, FontWeight, Gap, MarginBottom, Padding, PaddingX, TextColor,
};

#[allow(non_snake_case)]
pub fn ComponentsAvatar() -> Element {
    rsx! {
        Layout {
            current_route: Route::DisplayAvatar {},

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
                        "Avatar"
                    }
                    p { class: ClassesBuilder::new().add(MarginBottom::Mb0).add(TextColor::Secondary).build(),
                        "Avatars are used to represent users and entities"
                    }
                }

                // Overview
                Section {
                    title: Some("Overview".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                        p {
                            "Avatars are visual representations of users or entities. They support:"
                        }
                        ul { class: ClassesBuilder::new().add_raw("pl-6").add(MarginBottom::Mb0).build(),
                            li {
                                strong { "Multiple sizes" }
                                " - Xs, Sm, Md, Lg, Xl"
                            }
                            li {
                                strong { "Shape variants" }
                                " - Circular, Rounded, Square"
                            }
                            li {
                                strong { "Fallback text" }
                                " - Displays initials when no image provided"
                            }
                            li {
                                strong { "Accessibility" }
                                " - Alt text support for screen readers"
                            }
                        }
                    }
                }

                // Avatar Sizes
                Section {
                    title: Some("Avatar Sizes".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Size Presets"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Avatars come in five predefined sizes for different contexts"
                        }
                        div { class: ClassesBuilder::new().add(Display::Flex).add(Gap::Gap6).add(Padding::P6).build(),
                            Avatar {
                                src: Some("https://i.pravatar.cc/100?img=1".to_string()),
                                alt: "User".to_string(),
                                size: AvatarSize::Xs,
                                variant: AvatarVariant::Circular,
                            }
                            Avatar {
                                src: Some("https://i.pravatar.cc/100?img=2".to_string()),
                                alt: "User".to_string(),
                                size: AvatarSize::Sm,
                                variant: AvatarVariant::Circular,
                            }
                            Avatar {
                                src: Some("https://i.pravatar.cc/100?img=3".to_string()),
                                alt: "User".to_string(),
                                size: AvatarSize::Md,
                                variant: AvatarVariant::Circular,
                            }
                            Avatar {
                                src: Some("https://i.pravatar.cc/100?img=4".to_string()),
                                alt: "User".to_string(),
                                size: AvatarSize::Lg,
                                variant: AvatarVariant::Circular,
                            }
                            Avatar {
                                src: Some("https://i.pravatar.cc/100?img=5".to_string()),
                                alt: "User".to_string(),
                                size: AvatarSize::Xl,
                                variant: AvatarVariant::Circular,
                            }
                        }
                        div { class: ClassesBuilder::new().add(PaddingX::Px6).add(TextColor::Secondary).build(),
                            code { "Xs (24px) - Sm (32px) - Md (40px) - Lg (48px) - Xl (64px)" }
                        }
                    }
                }

                // Avatar Variants
                Section {
                    title: Some("Avatar Variants".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Shape Variants"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Three shape options for different design contexts"
                        }
                        div { class: ClassesBuilder::new().add(Display::Flex).add(Gap::Gap6).add(Padding::P6).build(),
                            Avatar {
                                src: Some("https://i.pravatar.cc/100?img=10".to_string()),
                                alt: "User".to_string(),
                                size: AvatarSize::Lg,
                                variant: AvatarVariant::Circular,
                            }
                            Avatar {
                                src: Some("https://i.pravatar.cc/100?img=11".to_string()),
                                alt: "User".to_string(),
                                size: AvatarSize::Lg,
                                variant: AvatarVariant::Rounded,
                            }
                            Avatar {
                                src: Some("https://i.pravatar.cc/100?img=12".to_string()),
                                alt: "User".to_string(),
                                size: AvatarSize::Lg,
                                variant: AvatarVariant::Square,
                            }
                        }
                        div { class: ClassesBuilder::new().add(PaddingX::Px6).add(TextColor::Secondary).build(),
                            code { "Circular (50%) - Rounded (8px) - Square (0px)" }
                        }
                    }
                }

                // Avatar with Fallback
                Section {
                    title: Some("Fallback Text".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Text Fallback"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "When no image source is provided, the avatar displays the first letter of the alt text or custom fallback"
                        }
                        div { class: ClassesBuilder::new().add(Display::Flex).add(Gap::Gap6).add(Padding::P6).build(),
                            Avatar {
                                alt: "Alice Smith".to_string(),
                                size: AvatarSize::Lg,
                                variant: AvatarVariant::Circular,
                            }
                            Avatar {
                                alt: "Bob Johnson".to_string(),
                                size: AvatarSize::Lg,
                                variant: AvatarVariant::Circular,
                            }
                            Avatar {
                                alt: "Charlie Brown".to_string(),
                                size: AvatarSize::Lg,
                                variant: AvatarVariant::Rounded,
                            }
                            Avatar {
                                alt: "David Wilson".to_string(),
                                size: AvatarSize::Lg,
                                variant: AvatarVariant::Rounded,
                            }
                            Avatar {
                                fallback: Some("123".to_string()),
                                alt: "No Name".to_string(),
                                size: AvatarSize::Lg,
                                variant: AvatarVariant::Circular,
                            }
                        }
                    }
                }

                // Avatar Group
                Section {
                    title: Some("Avatar Group".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Multiple Avatars"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Group avatars together to show team members or collaborators"
                        }
                        div {
                            style: "display: flex; gap: -8px;",
                            Avatar {
                                src: Some("https://i.pravatar.cc/100?img=20".to_string()),
                                alt: "User 1".to_string(),
                                size: AvatarSize::Md,
                                variant: AvatarVariant::Circular,
                            }
                            Avatar {
                                src: Some("https://i.pravatar.cc/100?img=21".to_string()),
                                alt: "User 2".to_string(),
                                size: AvatarSize::Md,
                                variant: AvatarVariant::Circular,
                            }
                            Avatar {
                                src: Some("https://i.pravatar.cc/100?img=22".to_string()),
                                alt: "User 3".to_string(),
                                size: AvatarSize::Md,
                                variant: AvatarVariant::Circular,
                            }
                            Avatar {
                                src: Some("https://i.pravatar.cc/100?img=23".to_string()),
                                alt: "User 4".to_string(),
                                size: AvatarSize::Md,
                                variant: AvatarVariant::Circular,
                            }
                            Avatar {
                                fallback: Some("+5".to_string()),
                                alt: "More".to_string(),
                                size: AvatarSize::Md,
                                variant: AvatarVariant::Circular,
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
                            "Basic Avatar"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            code { r#"Avatar {{ src: "/avatar.jpg".to_string(), alt: "User".to_string() }}"# }
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
                            "Sized Circular Avatar"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            code {
                                r#"Avatar {{
    src: "/avatar.jpg".to_string(),
    alt: "User".to_string(),
    size: AvatarSize::Lg,
    variant: AvatarVariant::Circular,
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
                            "Avatar with Fallback"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            code {
                                r#"Avatar {{
    alt: "John Doe".to_string(),
    size: AvatarSize::Md,
    variant: AvatarVariant::Circular,
}}"#
                            }
                        }
                    }
                }
            }
        }
    }
}
