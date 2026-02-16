use _components::basic::avatar::Avatar as AvatarComponent;
use _components::basic::badge::Badge;
use _components::basic::button::Button;
use _components::basic::card::Card;
use _components::basic::checkbox::Checkbox;
use _components::basic::divider::Divider;
use _components::basic::image::Image as ImageComponent;
use _components::basic::input::Input;
use _components::basic::radio_group::{RadioButton, RadioDirection, RadioGroup};
use _components::basic::select::{Select, SelectOption, SelectSize};
use _components::basic::slider::Slider;
use _components::basic::switch::Switch;
use _components::layout::Section;
use _components::{
    AvatarSize, AvatarVariant, BadgeVariant, ButtonVariant, IconButton, IconButtonSize,
};
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
                ("layer1", "form", Some("select")) => rsx! {
                    div { class: flex_col_gap(),
                        Select {
                            placeholder: "Select city".to_string(),
                            options: vec![
                                SelectOption { label: "Beijing".to_string(), value: "bj".to_string() },
                                SelectOption { label: "Shanghai".to_string(), value: "sh".to_string() },
                                SelectOption { label: "Guangzhou".to_string(), value: "gz".to_string() },
                            ],
                        }
                    }
                },
                ("layer1", "form", Some("checkbox")) => rsx! {
                    div { class: flex_col_gap(),
                        Checkbox { checked: false, on_change: move |_| {}, "Remember me" }
                        Checkbox { checked: true, on_change: move |_| {}, "Agree to terms" }
                    }
                },
                ("layer1", "form", Some("radio")) => rsx! {
                    div { class: flex_col_gap(),
                        RadioGroup {
                            name: "gender".to_string(),
                            value: "male".to_string(),
                            on_change: move |_| {},
                            direction: RadioDirection::Horizontal,
                            RadioButton { value: "male".to_string(), "Male" }
                            RadioButton { value: "female".to_string(), "Female" }
                        }
                    }
                },
                ("layer1", "form", _) => rsx! {
                    div { class: flex_col_gap(),
                        Input { placeholder: Some("Basic input".to_string()) }
                    }
                },

                // ========== Display / Badge ==========
                ("layer1", "display", Some("badge")) => rsx! {
                    div { class: flex_row_wrap(),
                        Badge { "Default" }
                        Badge { variant: BadgeVariant::Success, "Success" }
                        Badge { variant: BadgeVariant::Warning, "Warning" }
                        Badge { variant: BadgeVariant::Danger, "Danger" }
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
                        Divider {}
                        p { "Content below" }
                    }
                },
                ("layer1", "display", _) => rsx! {
                    div { class: flex_row_wrap(),
                        Badge { "Badge" }
                        Badge { variant: BadgeVariant::Success, "Success" }
                    }
                },

                // ========== Feedback ==========
                ("layer1", "feedback", Some("alert")) => rsx! {
                    div { class: placeholder_box(),
                        p { "Alert component - coming soon" }
                    }
                },
                ("layer1", "feedback", Some("toast")) => rsx! {
                    div { class: placeholder_box(),
                        p { "Toast component - coming soon" }
                    }
                },
                ("layer1", "feedback", Some("tooltip")) => rsx! {
                    div { class: placeholder_box(),
                        p { "Tooltip component - coming soon" }
                    }
                },
                ("layer1", "feedback", _) => rsx! {
                    div { class: placeholder_box(),
                        p { "Feedback components: Alert, Toast, Tooltip" }
                    }
                },

                // ========== Switch ==========
                ("layer1", "switch", Some("switch")) => rsx! {
                    div { class: flex_row_wrap(),
                        Switch { checked: false, on_change: move |_| {} }
                        Switch { checked: true, on_change: move |_| {} }
                    }
                },
                ("layer1", "switch", Some("progress")) => rsx! {
                    div { class: placeholder_box(),
                        p { "Progress component - coming soon" }
                    }
                },
                ("layer1", "switch", Some("slider")) => rsx! {
                    div { class: flex_col_gap(),
                        Slider { value: 50, min: 0, max: 100, on_change: move |_| {} }
                    }
                },
                ("layer1", "switch", _) => rsx! {
                    div { class: flex_row_wrap(),
                        Switch { checked: false, on_change: move |_| {} }
                        Switch { checked: true, on_change: move |_| {} }
                    }
                },

                // ========== Tag ==========
                ("layer1", "tag", Some("basic")) => rsx! {
                    div { class: flex_row_wrap(),
                        span { class: "hi-tag", "Tag 1" }
                        span { class: "hi-tag", "Tag 2" }
                        span { class: "hi-tag", "Tag 3" }
                    }
                },
                ("layer1", "tag", Some("closable")) => rsx! {
                    div { class: flex_row_wrap(),
                        span { class: "hi-tag hi-tag-closable", "Closable " }
                        span { class: "hi-tag hi-tag-closable", "Tags " }
                    }
                },
                ("layer1", "tag", _) => rsx! {
                    div { class: flex_row_wrap(),
                        span { class: "hi-tag", "Tag 1" }
                        span { class: "hi-tag", "Tag 2" }
                    }
                },

                // ========== Image ==========
                ("layer1", "image", Some("basic")) => rsx! {
                    div { class: flex_row_wrap(),
                        ImageComponent { src: "https://via.placeholder.com/150".to_string(), alt: "Placeholder".to_string() }
                    }
                },
                ("layer1", "image", Some("placeholder")) => rsx! {
                    div { class: flex_row_wrap(),
                        ImageComponent { src: "https://via.placeholder.com/150".to_string(), alt: "Placeholder image".to_string() }
                    }
                },
                ("layer1", "image", _) => rsx! {
                    div { class: flex_row_wrap(),
                        ImageComponent { src: "https://via.placeholder.com/150".to_string(), alt: "Placeholder".to_string() }
                    }
                },

                // ========== Empty ==========
                ("layer1", "empty", _) => rsx! {
                    div { class: placeholder_box(),
                        p { "No data available" }
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
                ("layer2", "navigation", Some("menu")) => rsx! {
                    div { class: placeholder_box(), p { "Menu component - coming soon" } }
                },
                ("layer2", "navigation", Some("tabs")) => rsx! {
                    div { class: placeholder_box(), p { "Tabs component - coming soon" } }
                },
                ("layer2", "navigation", Some("breadcrumb")) => rsx! {
                    div { class: placeholder_box(), p { "Breadcrumb component - coming soon" } }
                },
                ("layer2", "navigation", _) => rsx! {
                    div { class: placeholder_box(), p { "Navigation components: Menu, Tabs, Breadcrumb" } }
                },

                ("layer2", "data", Some("table")) => rsx! {
                    div { class: placeholder_box(), p { "Table component - coming soon" } }
                },
                ("layer2", "data", Some("tree")) => rsx! {
                    div { class: placeholder_box(), p { "Tree component - coming soon" } }
                },
                ("layer2", "data", Some("pagination")) => rsx! {
                    div { class: placeholder_box(), p { "Pagination component - coming soon" } }
                },
                ("layer2", "data", _) => rsx! {
                    div { class: placeholder_box(), p { "Data components: Table, Tree, Pagination" } }
                },

                ("layer2", "form", Some("form")) => rsx! {
                    div { class: placeholder_box(), p { "Form component - coming soon" } }
                },
                ("layer2", "form", Some("dropdown")) => rsx! {
                    div { class: placeholder_box(), p { "Dropdown component - coming soon" } }
                },
                ("layer2", "form", Some("modal")) => rsx! {
                    div { class: placeholder_box(), p { "Modal component - coming soon" } }
                },
                ("layer2", "form", Some("collapse")) => rsx! {
                    div { class: placeholder_box(), p { "Collapse component - coming soon" } }
                },
                ("layer2", "form", _) => rsx! {
                    div { class: placeholder_box(), p { "Form components: Form, Dropdown, Modal, Collapse" } }
                },

                ("layer2", "feedback", Some("drawer")) => rsx! {
                    div { class: placeholder_box(), p { "Drawer component - coming soon" } }
                },
                ("layer2", "feedback", Some("popover")) => rsx! {
                    div { class: placeholder_box(), p { "Popover component - coming soon" } }
                },
                ("layer2", "feedback", Some("upload")) => rsx! {
                    div { class: placeholder_box(), p { "Upload component - coming soon" } }
                },
                ("layer2", "feedback", _) => rsx! {
                    div { class: placeholder_box(), p { "Feedback components: Drawer, Popover, Upload" } }
                },

                // ========== Layer 2 - Specific ==========
                ("layer2", "cascader", _) => rsx! {
                    div { class: placeholder_box(), p { "Cascader: Multi-level cascading selection" } }
                },
                ("layer2", "collapsible", _) => rsx! {
                    div { class: placeholder_box(), p { "Collapsible: Expandable/collapsible panel" } }
                },
                ("layer2", "pagination", _) => rsx! {
                    div { class: placeholder_box(), p { "Pagination: Page navigation for data lists" } }
                },
                ("layer2", "qrcode", _) => rsx! {
                    div { class: placeholder_box(), p { "QRCode: QR code generation" } }
                },
                ("layer2", "table", _) => rsx! {
                    div { class: placeholder_box(), p { "Table: Data table with sorting and pagination" } }
                },
                ("layer2", "timeline", _) => rsx! {
                    div { class: placeholder_box(), p { "Timeline: Event timeline display" } }
                },
                ("layer2", "transfer", _) => rsx! {
                    div { class: placeholder_box(), p { "Transfer: Dual-column transfer selection" } }
                },
                ("layer2", "tree", _) => rsx! {
                    div { class: placeholder_box(), p { "Tree: Hierarchical tree structure" } }
                },

                // ========== Layer 3 ==========
                ("layer3", "media", Some("video")) => rsx! {
                    div { class: placeholder_box(), p { "VideoPlayer component - coming soon" } }
                },
                ("layer3", "media", Some("audio")) => rsx! {
                    div { class: placeholder_box(), p { "AudioPlayer component - coming soon" } }
                },
                ("layer3", "media", _) => rsx! {
                    div { class: placeholder_box(), p { "Media components: VideoPlayer, AudioPlayer" } }
                },

                ("layer3", "editor", Some("markdown")) => rsx! {
                    div { class: placeholder_box(), p { "MarkdownEditor component - coming soon" } }
                },
                ("layer3", "editor", Some("code")) => rsx! {
                    div { class: placeholder_box(), p { "CodeEditor component - coming soon" } }
                },
                ("layer3", "editor", Some("richtext")) => rsx! {
                    div { class: placeholder_box(), p { "RichTextEditor component - coming soon" } }
                },
                ("layer3", "editor", _) => rsx! {
                    div { class: placeholder_box(), p { "Editor components: Markdown, Code, RichText" } }
                },

                ("layer3", "visualization", Some("draglayer")) => rsx! {
                    div { class: placeholder_box(), p { "DragLayer component - coming soon" } }
                },
                ("layer3", "visualization", Some("timeline")) => rsx! {
                    div { class: placeholder_box(), p { "Timeline component - coming soon" } }
                },
                ("layer3", "visualization", Some("userguide")) => rsx! {
                    div { class: placeholder_box(), p { "UserGuide component - coming soon" } }
                },
                ("layer3", "visualization", _) => rsx! {
                    div { class: placeholder_box(), p { "Visualization components: DragLayer, Timeline, UserGuide" } }
                },

                ("layer3", "user_guide", _) => rsx! {
                    div { class: placeholder_box(), p { "UserGuide: Step-by-step user onboarding and feature tours" } }
                },
                ("layer3", "zoom_controls", _) => rsx! {
                    div { class: placeholder_box(), p { "ZoomControls: Zoom in/out controls with keyboard shortcuts" } }
                },

                // ========== System ==========
                ("system", "css", Some("display")) => rsx! {
                    div { class: placeholder_box(), p { "Display utilities: block, flex, grid, hidden" } }
                },
                ("system", "css", Some("flex")) => rsx! {
                    div { class: placeholder_box(), p { "Flex utilities: flex-row, flex-col, items-center, justify-between" } }
                },
                ("system", "css", Some("spacing")) => rsx! {
                    div { class: placeholder_box(), p { "Spacing utilities: p-4, m-2, gap-4" } }
                },
                ("system", "css", Some("typography")) => rsx! {
                    div { class: placeholder_box(), p { "Typography utilities: text-sm, font-bold, text-center" } }
                },
                ("system", "css", Some("colors")) => rsx! {
                    div { class: placeholder_box(), p { "Color utilities: bg-primary, text-secondary" } }
                },
                ("system", "css", _) => rsx! {
                    div { class: placeholder_box(), p { "CSS Utilities: Tailwind-compatible utility classes" } }
                },

                ("system", "i18n", Some("basic")) => rsx! {
                    div { class: placeholder_box(), p { "i18n basic usage - coming soon" } }
                },
                ("system", "i18n", Some("switch")) => rsx! {
                    div { class: placeholder_box(), p { "i18n language switching - coming soon" } }
                },
                ("system", "i18n", _) => rsx! {
                    div { class: placeholder_box(), p { "i18n internationalization system" } }
                },

                _ => rsx! {
                    div { class: "component-error", style: "padding: 1rem; background: #fee; border-radius: 0.5rem;",
                        h3 { style: "color: #c00; margin-bottom: 0.5rem;", "Component Not Found" }
                        p { style: "color: #666;", "{layer}/{name}#{component_id:?}" }
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
                    div { class: "component-error", style: "padding: 1rem; background: #fee; border-radius: 0.5rem;",
                        h3 { style: "color: #c00; margin-bottom: 0.5rem;", "Demo Not Found" }
                        p { style: "color: #666;", "{category}/{name}" }
                    }
                },
            }
        }

        ComponentType::Code(content) => rsx! {
            pre { class: "hi-code-block", style: "background: #f5f5f5; padding: 1rem; border-radius: 0.5rem; overflow-x: auto;",
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

fn placeholder_box() -> String {
    ClassesBuilder::new()
        .add(Padding::P4)
        .add(TextColor::Secondary)
        .add(Display::Flex)
        .add(FlexDirection::Column)
        .add(Gap::Gap2)
        .add_raw("items-center justify-center")
        .add_raw("bg-gray-100 dark:bg-gray-800 rounded-lg")
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
