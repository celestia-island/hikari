use _components::basic::avatar::Avatar as AvatarComponent;
use _components::basic::badge::Badge;
use _components::basic::button::Button;
use _components::basic::card::Card;
use _components::basic::input::Input;
use _components::layout::Section;
use _components::{AvatarSize, AvatarVariant, ButtonVariant, IconButton, IconButtonSize};
use _icons::MdiIcon;
use _palette::classes::{
    ClassesBuilder, Display, FlexDirection, FlexWrap, FontSize, FontWeight, Gap, MarginBottom,
    Padding, TextColor,
};
use dioxus::prelude::*;

#[derive(Debug, Clone, PartialEq)]
pub enum ComponentType {
    Layer(String, String, Option<String>),
    Demo(String, String, Option<String>),
    Code(String),
}

#[allow(non_snake_case)]
pub fn render_component(component_type: ComponentType) -> Element {
    match component_type {
        ComponentType::Layer(ref layer, ref name, ref component_id) => {
            match (layer.as_str(), name.as_str(), component_id.as_deref()) {
                // ========== Button ==========
                ("layer1", "button", Some("variants")) => rsx! {
                    div { class: flex_row_wrap(),
                        Button { variant: ButtonVariant::Primary, "Primary" }
                        Button { variant: ButtonVariant::Secondary, "Secondary" }
                        Button { variant: ButtonVariant::Ghost, "Ghost" }
                        Button { variant: ButtonVariant::Danger, "Danger" }
                    }
                },
                ("layer1", "button", Some("disabled")) => rsx! {
                    div { class: flex_row_wrap(),
                        Button { variant: ButtonVariant::Primary, disabled: true, "Primary" }
                        Button { variant: ButtonVariant::Secondary, disabled: true, "Secondary" }
                        Button { variant: ButtonVariant::Ghost, disabled: true, "Ghost" }
                        Button { variant: ButtonVariant::Danger, disabled: true, "Danger" }
                    }
                },
                ("layer1", "button", Some("icon")) => rsx! {
                    div { class: flex_row_wrap(),
                        IconButton { icon: MdiIcon::Check, size: IconButtonSize::Small, onclick: move |_| {} }
                        IconButton { icon: MdiIcon::Pencil, size: IconButtonSize::Medium, onclick: move |_| {} }
                        IconButton { icon: MdiIcon::Close, size: IconButtonSize::Large, onclick: move |_| {} }
                    }
                },
                ("layer1", "button", _) => rsx! {
                    div { class: flex_row_wrap(),
                        Button { variant: ButtonVariant::Primary, "Primary" }
                        Button { variant: ButtonVariant::Secondary, "Secondary" }
                        Button { variant: ButtonVariant::Ghost, "Ghost" }
                        Button { variant: ButtonVariant::Danger, "Danger" }
                    }
                },

                // ========== Avatar ==========
                ("layer1", "avatar", Some("sizes")) => rsx! {
                    div { class: flex_row_wrap(),
                        AvatarComponent { src: Some("https://i.pravatar.cc/100?img=1".to_string()), alt: "Xs".to_string(), size: AvatarSize::Xs, variant: AvatarVariant::Circular }
                        AvatarComponent { src: Some("https://i.pravatar.cc/100?img=2".to_string()), alt: "Sm".to_string(), size: AvatarSize::Sm, variant: AvatarVariant::Circular }
                        AvatarComponent { src: Some("https://i.pravatar.cc/100?img=3".to_string()), alt: "Md".to_string(), size: AvatarSize::Md, variant: AvatarVariant::Circular }
                        AvatarComponent { src: Some("https://i.pravatar.cc/100?img=4".to_string()), alt: "Lg".to_string(), size: AvatarSize::Lg, variant: AvatarVariant::Circular }
                        AvatarComponent { src: Some("https://i.pravatar.cc/100?img=5".to_string()), alt: "Xl".to_string(), size: AvatarSize::Xl, variant: AvatarVariant::Circular }
                    }
                },
                ("layer1", "avatar", Some("variants")) => rsx! {
                    div { class: flex_row_wrap(),
                        AvatarComponent { src: Some("https://i.pravatar.cc/100?img=10".to_string()), alt: "Circular".to_string(), size: AvatarSize::Lg, variant: AvatarVariant::Circular }
                        AvatarComponent { src: Some("https://i.pravatar.cc/100?img=11".to_string()), alt: "Rounded".to_string(), size: AvatarSize::Lg, variant: AvatarVariant::Rounded }
                        AvatarComponent { src: Some("https://i.pravatar.cc/100?img=12".to_string()), alt: "Square".to_string(), size: AvatarSize::Lg, variant: AvatarVariant::Square }
                    }
                },
                ("layer1", "avatar", Some("fallback")) => rsx! {
                    div { class: flex_row_wrap(),
                        AvatarComponent { alt: "Alice Smith".to_string(), size: AvatarSize::Lg, variant: AvatarVariant::Circular }
                        AvatarComponent { alt: "Bob Johnson".to_string(), size: AvatarSize::Lg, variant: AvatarVariant::Circular }
                        AvatarComponent { fallback: Some("N/A".to_string()), alt: "Unknown".to_string(), size: AvatarSize::Lg, variant: AvatarVariant::Circular }
                    }
                },
                ("layer1", "avatar", _) => rsx! {
                    div { class: flex_row_wrap(),
                        AvatarComponent { src: Some("https://i.pravatar.cc/100?img=1".to_string()), alt: "User".to_string(), size: AvatarSize::Md, variant: AvatarVariant::Circular }
                        AvatarComponent { src: Some("https://i.pravatar.cc/100?img=2".to_string()), alt: "User".to_string(), size: AvatarSize::Md, variant: AvatarVariant::Rounded }
                        AvatarComponent { alt: "John Doe".to_string(), size: AvatarSize::Md, variant: AvatarVariant::Circular }
                    }
                },

                // ========== Form / Input ==========
                ("layer1", "form", Some("input")) => rsx! {
                    div { class: flex_col_gap(),
                        Input { placeholder: Some("Basic input".to_string()) }
                        Input { placeholder: Some("Password".to_string()), input_type: Some("password".to_string()) }
                        Input { placeholder: Some("Disabled".to_string()), disabled: true }
                    }
                },

                // ========== Display / Badge ==========
                ("layer1", "display", Some("badge")) => rsx! {
                    div { class: flex_row_wrap(),
                        Badge { "Default" }
                        Badge { variant: _components::BadgeVariant::Success, "Success" }
                        Badge { variant: _components::BadgeVariant::Warning, "Warning" }
                        Badge { variant: _components::BadgeVariant::Danger, "Danger" }
                    }
                },
                ("layer1", "display", Some("card")) => rsx! {
                    div { class: flex_row_wrap(),
                        Card {
                            h3 { "Card Title" }
                            p { "Card content goes here." }
                        }
                    }
                },
                ("layer1", "display", Some("divider")) => rsx! {
                    div { style: "width: 100%;",
                        p { "Content above" }
                        hr { style: "border: none; border-top: 1px solid var(--hi-color-border); margin: 1rem 0;" }
                        p { "Content below" }
                    }
                },
                ("layer1", "display", _) => rsx! {
                    div { class: flex_row_wrap(),
                        Badge { "Badge" }
                        Badge { variant: _components::BadgeVariant::Success, "Success" }
                    }
                },

                // ========== Feedback ==========
                ("layer1", "feedback", _) => rsx! {
                    div { class: ClassesBuilder::new().add(Padding::P4).add(TextColor::Secondary).build(),
                        p { "Feedback components: Alert, Toast, Tooltip" }
                    }
                },

                // ========== Switch ==========
                ("layer1", "switch", _) => rsx! {
                    div { class: ClassesBuilder::new().add(Padding::P4).add(TextColor::Secondary).build(),
                        p { "Switch components: Switch, Progress, Slider" }
                    }
                },

                // ========== Tag ==========
                ("layer1", "tag", _) => rsx! {
                    div { class: flex_row_wrap(),
                        span { class: "hi-tag", "Tag 1" }
                        span { class: "hi-tag", "Tag 2" }
                        span { class: "hi-tag", "Tag 3" }
                    }
                },

                // ========== Image ==========
                ("layer1", "image", _) => rsx! {
                    div { class: flex_row_wrap(),
                        img { src: "https://via.placeholder.com/150", alt: "Placeholder", style: "border-radius: 0.5rem;" }
                    }
                },

                // ========== Empty ==========
                ("layer1", "empty", _) => rsx! {
                    div { class: ClassesBuilder::new().add(Padding::P8).add(Display::Flex).add(FlexDirection::Column).add_raw("items-center").add(TextColor::Secondary).build(),
                        p { "No data" }
                    }
                },

                // ========== Comment ==========
                ("layer1", "comment", _) => rsx! {
                    div { class: flex_col_gap(),
                        div { class: flex_row_gap(),
                            AvatarComponent { alt: "User".to_string(), size: AvatarSize::Sm, variant: AvatarVariant::Circular }
                            div {
                                p { class: ClassesBuilder::new().add(FontWeight::Semibold).build(), "Username" }
                                p { class: ClassesBuilder::new().add(TextColor::Secondary).build(), "This is a comment." }
                            }
                        }
                    }
                },

                // ========== Description List ==========
                ("layer1", "description_list", _) => rsx! {
                    div { class: flex_col_gap(),
                        div { class: flex_row_wrap(),
                            span { class: ClassesBuilder::new().add(TextColor::Secondary).build(), "Key: " }
                            span { "Value" }
                        }
                        div { class: flex_row_wrap(),
                            span { class: ClassesBuilder::new().add(TextColor::Secondary).build(), "Name: " }
                            span { "John Doe" }
                        }
                    }
                },

                // ========== Number Input ==========
                ("layer1", "number_input", _) => rsx! {
                    div { class: flex_col_gap(),
                        Input { placeholder: Some("0".to_string()), input_type: Some("number".to_string()) }
                    }
                },

                // ========== Search ==========
                ("layer1", "search", _) => rsx! {
                    Input { placeholder: Some("Search...".to_string()) }
                },

                // ========== Layer 2 ==========
                ("layer2", "navigation", _) => rsx! {
                    div { class: ClassesBuilder::new().add(Padding::P4).add(TextColor::Secondary).build(),
                        p { "Navigation components: Menu, Tabs, Breadcrumb" }
                    }
                },
                ("layer2", "data", _) => rsx! {
                    div { class: ClassesBuilder::new().add(Padding::P4).add(TextColor::Secondary).build(),
                        p { "Data components: Table, Tree, Pagination" }
                    }
                },
                ("layer2", "form", _) => rsx! {
                    div { class: ClassesBuilder::new().add(Padding::P4).add(TextColor::Secondary).build(),
                        p { "Form components: Form, Dropdown, Modal, Collapse" }
                    }
                },
                ("layer2", "feedback", _) => rsx! {
                    div { class: ClassesBuilder::new().add(Padding::P4).add(TextColor::Secondary).build(),
                        p { "Feedback components: Drawer, Popover, Upload" }
                    }
                },

                // ========== Layer 3 ==========
                ("layer3", "media", _) => rsx! {
                    div { class: ClassesBuilder::new().add(Padding::P4).add(TextColor::Secondary).build(),
                        p { "Media components: VideoPlayer, AudioPlayer" }
                    }
                },
                ("layer3", "editor", _) => rsx! {
                    div { class: ClassesBuilder::new().add(Padding::P4).add(TextColor::Secondary).build(),
                        p { "Editor components: Markdown, Code, RichText" }
                    }
                },
                ("layer3", "visualization", _) => rsx! {
                    div { class: ClassesBuilder::new().add(Padding::P4).add(TextColor::Secondary).build(),
                        p { "Visualization components: DragLayer, Timeline, UserGuide" }
                    }
                },
                ("layer3", "user_guide", _) => rsx! {
                    div { class: ClassesBuilder::new().add(Padding::P4).add(TextColor::Secondary).build(),
                        p { "UserGuide: Step-by-step user onboarding and feature tours" }
                    }
                },
                ("layer3", "zoom_controls", _) => rsx! {
                    div { class: ClassesBuilder::new().add(Padding::P4).add(TextColor::Secondary).build(),
                        p { "ZoomControls: Zoom in/out controls with keyboard shortcuts" }
                    }
                },

                // ========== Layer 2 - New ==========
                ("layer2", "cascader", _) => rsx! {
                    div { class: ClassesBuilder::new().add(Padding::P4).add(TextColor::Secondary).build(),
                        p { "Cascader: Multi-level cascading selection" }
                    }
                },
                ("layer2", "collapsible", _) => rsx! {
                    div { class: ClassesBuilder::new().add(Padding::P4).add(TextColor::Secondary).build(),
                        p { "Collapsible: Expandable/collapsible panel" }
                    }
                },
                ("layer2", "pagination", _) => rsx! {
                    div { class: ClassesBuilder::new().add(Padding::P4).add(TextColor::Secondary).build(),
                        p { "Pagination: Page navigation for data lists" }
                    }
                },
                ("layer2", "qrcode", _) => rsx! {
                    div { class: ClassesBuilder::new().add(Padding::P4).add(TextColor::Secondary).build(),
                        p { "QRCode: QR code generation" }
                    }
                },
                ("layer2", "table", _) => rsx! {
                    div { class: ClassesBuilder::new().add(Padding::P4).add(TextColor::Secondary).build(),
                        p { "Table: Data table with sorting and pagination" }
                    }
                },
                ("layer2", "timeline", _) => rsx! {
                    div { class: ClassesBuilder::new().add(Padding::P4).add(TextColor::Secondary).build(),
                        p { "Timeline: Event timeline display" }
                    }
                },
                ("layer2", "transfer", _) => rsx! {
                    div { class: ClassesBuilder::new().add(Padding::P4).add(TextColor::Secondary).build(),
                        p { "Transfer: Dual-column transfer selection" }
                    }
                },
                ("layer2", "tree", _) => rsx! {
                    div { class: ClassesBuilder::new().add(Padding::P4).add(TextColor::Secondary).build(),
                        p { "Tree: Hierarchical tree structure" }
                    }
                },

                // ========== System ==========
                ("system", "css", _) => rsx! {
                    div { class: ClassesBuilder::new().add(Padding::P4).add(TextColor::Secondary).build(),
                        p { "CSS Utilities: Tailwind-compatible utility classes" }
                    }
                },

                _ => rsx! {
                    div { class: "component-error",
                        h3 { "Component Not Found" }
                        p { "Unknown: {layer}/{name}#{component_id:?}" }
                    }
                },
            }
        }

        ComponentType::Demo(ref category, ref name, _) => {
            match (category.as_str(), name.as_str()) {
                ("layer1", "form_demo") => rsx! {
                    crate::pages::demos::layer1::FormDemo {}
                },
                _ => rsx! {
                    div { class: "component-error",
                        h3 { "Demo Not Found" }
                        p { "Unknown demo: {category}/{name}" }
                    }
                },
            }
        }

        ComponentType::Code(content) => rsx! {
            pre { class: "hi-code-block",
                code { class: "hi-code-content", "{content}" }
            }
        },
    }
}

fn flex_row_wrap() -> String {
    ClassesBuilder::new()
        .add(Display::Flex)
        .add(FlexDirection::Row)
        .add(Gap::Gap4)
        .add(FlexWrap::Wrap)
        .add(Padding::P4)
        .build()
}

fn flex_col_gap() -> String {
    ClassesBuilder::new()
        .add(Display::Flex)
        .add(FlexDirection::Column)
        .add(Gap::Gap4)
        .add(Padding::P4)
        .build()
}

fn flex_row_gap() -> String {
    ClassesBuilder::new()
        .add(Display::Flex)
        .add(FlexDirection::Row)
        .add(Gap::Gap3)
        .build()
}

pub fn parse_component_path(path: &str) -> Option<ComponentType> {
    let path = path.trim().strip_prefix("pages/components/")?;

    let (base_path, component_id) = if let Some(idx) = path.find('#') {
        let base = &path[..idx];
        let id = path[idx + 1..].trim();
        (base, Some(id.to_string()))
    } else {
        (path, None)
    };

    let parts: Vec<&str> = base_path.split('/').collect();

    if parts.len() != 2 {
        return None;
    }

    let category = parts[0].to_string();
    let name = parts[1].to_string();

    if category.starts_with("demos/") {
        let demo_category = category.strip_prefix("demos/")?.to_string();
        return Some(ComponentType::Demo(demo_category, name, component_id));
    }

    Some(ComponentType::Layer(category, name, component_id))
}
