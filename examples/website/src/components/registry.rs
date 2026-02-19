use dioxus::prelude::*;

use _components::{
    basic::{
        avatar::{Avatar as AvatarComponent, AvatarFallbackMode},
        badge::Badge,
        button::Button,
        card::Card,
        checkbox::Checkbox,
        divider::Divider,
        file_upload::FileUpload,
        image::{Image as ImageComponent, ImagePlaceholder},
        input::Input,
        radio_group::{RadioButton, RadioDirection, RadioGroup},
        select::{Select, SelectOption},
        slider::Slider,
        switch::Switch,
    },
    data::{
        collapse::Collapse,
        pagination::Pagination,
        table::{ColumnAlign, ColumnDef, Table},
        tree::Tree,
        TreeNodeData,
    },
    display::{
        drag_layer::{DragItem, DragLayer},
        empty::Empty,
        qrcode::QRCode,
        skeleton::{Skeleton, SkeletonCard, SkeletonTable, SkeletonVariant},
        timeline::{Timeline, TimelineItem, TimelinePosition},
        user_guide::{GuidePlacement, GuideStep, UserGuide},
        zoom_controls::ZoomControls,
    },
    entry::{
        cascader::{Cascader, CascaderOption, CascaderSize},
        number_input::{NumberInput, NumberInputSize},
        search::Search,
        transfer::{Transfer, TransferItem},
    },
    feedback::{
        alert::{Alert, AlertVariant},
        modal::{use_modal, ModalContent},
        popover::Popover,
        progress::{Progress, ProgressStatus},
        toast::{Toast, ToastVariant},
        tooltip::{Tooltip, TooltipPlacement},
    },
    layout::{Direction, FlexBox, FlexGap},
    navigation::{
        breadcrumb::{Breadcrumb, BreadcrumbItem},
        menu::{Menu, MenuItem, MenuMode},
        tabs::{TabPane, Tabs},
    },
    production::{
        audio_player::AudioPlayer,
        code_highlight::CodeHighlight,
        markdown_editor::{MarkdownEditor, MarkdownEditorMode},
        rich_text_editor::RichTextEditor,
        video_player::VideoPlayer,
    },
    AvatarSize, AvatarVariant, BadgeVariant, ButtonVariant, IconButton, IconButtonSize,
    IconButtonVariant,
};
use _icons::MdiIcon;
use _palette::classes::{
    AlignItems, ClassesBuilder, Display, FlexDirection, FlexWrap, FontWeight, Gap, Padding,
    TextColor,
};

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
                ("layer1", "button", Some("icon-sizes")) => rsx! {
                    div { class: flex_row_wrap(),
                        IconButton { icon: MdiIcon::Cog, size: IconButtonSize::Small, variant: IconButtonVariant::Primary, onclick: move |_| {} }
                        IconButton { icon: MdiIcon::Cog, size: IconButtonSize::Medium, variant: IconButtonVariant::Primary, onclick: move |_| {} }
                        IconButton { icon: MdiIcon::Cog, size: IconButtonSize::Large, variant: IconButtonVariant::Primary, onclick: move |_| {} }
                    }
                },
                ("layer1", "button", Some("icon-variants")) => rsx! {
                    div { class: flex_row_wrap(),
                        IconButton { icon: MdiIcon::Cog, size: IconButtonSize::Medium, variant: IconButtonVariant::Ghost, onclick: move |_| {} }
                        IconButton { icon: MdiIcon::Heart, size: IconButtonSize::Medium, variant: IconButtonVariant::Primary, onclick: move |_| {} }
                        IconButton { icon: MdiIcon::Star, size: IconButtonSize::Medium, variant: IconButtonVariant::Secondary, onclick: move |_| {} }
                        IconButton { icon: MdiIcon::Alert, size: IconButtonSize::Medium, variant: IconButtonVariant::Danger, onclick: move |_| {} }
                        IconButton { icon: MdiIcon::Check, size: IconButtonSize::Medium, variant: IconButtonVariant::Success, onclick: move |_| {} }
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
                        AvatarComponent { src: Some("/images/logo.png".to_string()), alt: "Xs".to_string(), size: AvatarSize::Xs, variant: AvatarVariant::Circular }
                        AvatarComponent { src: Some("/images/logo.png".to_string()), alt: "Sm".to_string(), size: AvatarSize::Sm, variant: AvatarVariant::Circular }
                        AvatarComponent { src: Some("/images/logo.png".to_string()), alt: "Md".to_string(), size: AvatarSize::Md, variant: AvatarVariant::Circular }
                        AvatarComponent { src: Some("/images/logo.png".to_string()), alt: "Lg".to_string(), size: AvatarSize::Lg, variant: AvatarVariant::Circular }
                        AvatarComponent { src: Some("/images/logo.png".to_string()), alt: "Xl".to_string(), size: AvatarSize::Xl, variant: AvatarVariant::Circular }
                    }
                },
                ("layer1", "avatar", Some("variants")) => rsx! {
                    div { class: flex_row_wrap(),
                        AvatarComponent { src: Some("/images/logo.png".to_string()), alt: "Circular".to_string(), size: AvatarSize::Lg, variant: AvatarVariant::Circular }
                        AvatarComponent { src: Some("/images/logo.png".to_string()), alt: "Rounded".to_string(), size: AvatarSize::Lg, variant: AvatarVariant::Rounded }
                        AvatarComponent { src: Some("/images/logo.png".to_string()), alt: "Square".to_string(), size: AvatarSize::Lg, variant: AvatarVariant::Square }
                    }
                },
                ("layer1", "avatar", Some("fallback")) => rsx! {
                    div { class: flex_row_wrap(),
                        AvatarComponent { alt: "Alice Smith".to_string(), size: AvatarSize::Lg, variant: AvatarVariant::Circular, fallback_mode: AvatarFallbackMode::Initial }
                        AvatarComponent { alt: "Bob Johnson".to_string(), size: AvatarSize::Lg, variant: AvatarVariant::Circular, fallback_mode: AvatarFallbackMode::Initial }
                        AvatarComponent { alt: "User".to_string(), size: AvatarSize::Lg, variant: AvatarVariant::Circular, fallback_mode: AvatarFallbackMode::Icon }
                    }
                },
                ("layer1", "avatar", _) => rsx! {
                    div { class: flex_row_wrap(),
                        AvatarComponent { src: Some("/images/logo.png".to_string()), alt: "User".to_string(), size: AvatarSize::Md, variant: AvatarVariant::Circular }
                        AvatarComponent { src: Some("/images/logo.png".to_string()), alt: "User".to_string(), size: AvatarSize::Md, variant: AvatarVariant::Rounded }
                        AvatarComponent { alt: "John Doe".to_string(), size: AvatarSize::Md, variant: AvatarVariant::Circular, fallback_mode: AvatarFallbackMode::Icon }
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
                    div { class: flex_col_gap(),
                        // 所有颜色变体
                        div { class: flex_row_wrap(),
                            Badge { "Default" }
                            Badge { variant: BadgeVariant::Primary, "Primary" }
                            Badge { variant: BadgeVariant::Secondary, "Secondary" }
                            Badge { variant: BadgeVariant::Success, "Success" }
                            Badge { variant: BadgeVariant::Warning, "Warning" }
                            Badge { variant: BadgeVariant::Danger, "Danger" }
                            Badge { variant: BadgeVariant::Info, "Info" }
                        }
                        // 头像 + 徽章（数字）
                        div { class: flex_row_wrap(),
                            p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                                "Avatar + Count Badge:"
                            }
                            Badge {
                                count: 5,
                                AvatarComponent {
                                    alt: "User".to_string(),
                                    size: AvatarSize::Md,
                                }
                            }
                            Badge {
                                count: 99,
                                max: 99,
                                AvatarComponent {
                                    alt: "Admin".to_string(),
                                    size: AvatarSize::Md,
                                    variant: AvatarVariant::Rounded,
                                }
                            }
                            Badge {
                                count: 100,
                                max: 99,
                                AvatarComponent {
                                    src: "https://api.dicebear.com/7.x/avataaars/svg?seed=badge".to_string(),
                                    alt: "Avatar".to_string(),
                                    size: AvatarSize::Md,
                                }
                            }
                        }
                        // 头像 + 圆点
                        div { class: flex_row_wrap(),
                            p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                                "Avatar + Dot Badge:"
                            }
                            Badge {
                                dot: true,
                                variant: BadgeVariant::Success,
                                AvatarComponent {
                                    alt: "Online".to_string(),
                                    size: AvatarSize::Md,
                                }
                            }
                            Badge {
                                dot: true,
                                variant: BadgeVariant::Danger,
                                AvatarComponent {
                                    alt: "Busy".to_string(),
                                    size: AvatarSize::Md,
                                }
                            }
                            Badge {
                                dot: true,
                                variant: BadgeVariant::Warning,
                                AvatarComponent {
                                    alt: "Away".to_string(),
                                    size: AvatarSize::Md,
                                }
                            }
                            Badge {
                                dot: true,
                                AvatarComponent {
                                    alt: "Offline".to_string(),
                                    size: AvatarSize::Md,
                                }
                            }
                        }
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
                        Badge { variant: BadgeVariant::Primary, "Primary" }
                        Badge { variant: BadgeVariant::Secondary, "Secondary" }
                    }
                },

                // ========== Feedback ==========
                ("layer1", "feedback", Some("alert")) => rsx! {
                    div { class: flex_col_gap(),
                        Alert {
                            variant: AlertVariant::Info,
                            title: "Information".to_string(),
                            description: "This is an informational message.".to_string(),
                        }
                        Alert {
                            variant: AlertVariant::Success,
                            title: "Success".to_string(),
                            description: "Operation completed successfully.".to_string(),
                            closable: true,
                        }
                        Alert {
                            variant: AlertVariant::Warning,
                            title: "Warning".to_string(),
                            description: "Please review before proceeding.".to_string(),
                        }
                        Alert {
                            variant: AlertVariant::Error,
                            title: "Error".to_string(),
                            description: "Something went wrong.".to_string(),
                            closable: true,
                        }
                    }
                },
                ("layer1", "feedback", Some("toast")) => rsx! {
                    div { class: flex_col_gap(),
                        Toast {
                            variant: ToastVariant::Info,
                            message: "This is an info toast".to_string(),
                            title: Some("Info".to_string()),
                        }
                        Toast {
                            variant: ToastVariant::Success,
                            message: "Operation successful!".to_string(),
                        }
                        Toast {
                            variant: ToastVariant::Warning,
                            message: "Please check your input".to_string(),
                        }
                        Toast {
                            variant: ToastVariant::Error,
                            message: "Failed to save changes".to_string(),
                        }
                    }
                },
                ("layer1", "feedback", Some("tooltip")) => rsx! {
                    div { class: flex_row_wrap(),
                        Tooltip {
                            content: "Tooltip on top".to_string(),
                            placement: TooltipPlacement::Top,
                            Button { variant: ButtonVariant::Primary, "Top" }
                        }
                        Tooltip {
                            content: "Tooltip on bottom".to_string(),
                            placement: TooltipPlacement::Bottom,
                            Button { variant: ButtonVariant::Secondary, "Bottom" }
                        }
                        Tooltip {
                            content: "Tooltip on left".to_string(),
                            placement: TooltipPlacement::Left,
                            Button { variant: ButtonVariant::Ghost, "Left" }
                        }
                        Tooltip {
                            content: "Tooltip on right".to_string(),
                            placement: TooltipPlacement::Right,
                            Button { variant: ButtonVariant::Ghost, "Right" }
                        }
                    }
                },
                ("layer1", "feedback", _) => rsx! {
                    div { class: flex_col_gap(),
                        Alert {
                            variant: AlertVariant::Info,
                            title: "Feedback Components".to_string(),
                            description: "Alert, Toast, Tooltip components".to_string(),
                        }
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
                    div { class: flex_col_gap(),
                        Progress {
                            value: 30.0,
                            show_info: true,
                        }
                        Progress {
                            value: 70.0,
                            status: ProgressStatus::Active,
                            show_info: true,
                        }
                        Progress {
                            value: 100.0,
                            status: ProgressStatus::Success,
                            show_info: true,
                        }
                        Progress {
                            value: 50.0,
                            status: ProgressStatus::Exception,
                            show_info: true,
                        }
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
                        ImageComponent {
                            src: "/images/logo.png".to_string(),
                            alt: "Hikari Logo".to_string(),
                            width: Some(150),
                            height: Some(150),
                        }
                    }
                },
                ("layer1", "image", Some("placeholder")) => rsx! {
                    div { class: flex_row_wrap(),
                        ImageComponent {
                            src: "/images/logo.png".to_string(),
                            alt: "Hikari Logo".to_string(),
                            width: Some(200),
                            height: Some(150),
                            placeholder: ImagePlaceholder::Skeleton,
                        }
                    }
                },
                ("layer1", "image", Some("icon-placeholder")) => rsx! {
                    div { class: flex_row_wrap(),
                        ImageComponent {
                            src: "/images/logo.png".to_string(),
                            alt: "Hikari Logo".to_string(),
                            width: Some(200),
                            height: Some(150),
                            placeholder: ImagePlaceholder::Icon,
                        }
                    }
                },
                ("layer1", "image", _) => rsx! {
                    div { class: flex_row_wrap(),
                        ImageComponent {
                            src: "/images/logo.png".to_string(),
                            alt: "Hikari Logo".to_string(),
                            width: Some(100),
                            height: Some(100),
                        }
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

                // ========== Number Input ==========
                ("layer1", "number_input", Some("basic")) => {
                    let mut value = use_signal(|| 0);
                    rsx! {
                        div { class: flex_col_gap(),
                            NumberInput {
                                value: value(),
                                on_change: move |v| value.set(v),
                                min: Some(0),
                                max: Some(100),
                            }
                        }
                    }
                }
                ("layer1", "number_input", Some("sizes")) => {
                    let mut v1 = use_signal(|| 10);
                    let mut v2 = use_signal(|| 50);
                    let mut v3 = use_signal(|| 100);
                    rsx! {
                        div { class: flex_col_gap(),
                            div { style: "display: flex; align-items: center; gap: 0.5rem;",
                                span { style: "width: 60px;", "Small:" }
                                NumberInput {
                                    value: v1(),
                                    on_change: move |v| v1.set(v),
                                    size: NumberInputSize::Small,
                                }
                            }
                            div { style: "display: flex; align-items: center; gap: 0.5rem;",
                                span { style: "width: 60px;", "Medium:" }
                                NumberInput {
                                    value: v2(),
                                    on_change: move |v| v2.set(v),
                                    size: NumberInputSize::Medium,
                                }
                            }
                            div { style: "display: flex; align-items: center; gap: 0.5rem;",
                                span { style: "width: 60px;", "Large:" }
                                NumberInput {
                                    value: v3(),
                                    on_change: move |v| v3.set(v),
                                    size: NumberInputSize::Large,
                                }
                            }
                        }
                    }
                }
                ("layer1", "number_input", _) => {
                    let mut value = use_signal(|| 0);
                    rsx! {
                        div { class: flex_col_gap(),
                            NumberInput {
                                value: value(),
                                on_change: move |v| value.set(v),
                                min: Some(0),
                                max: Some(100),
                            }
                        }
                    }
                }

                // ========== Search ==========
                ("layer1", "search", Some("basic")) => {
                    let mut value = use_signal(|| String::new());
                    rsx! {
                        Search {
                            value: value(),
                            placeholder: "Search...".to_string(),
                            suggestions: vec![
                                "Hikari Components".to_string(),
                                "Rust Programming".to_string(),
                                "Dioxus Framework".to_string(),
                                "WebAssembly".to_string(),
                            ],
                            on_search: move |v| value.set(v),
                            on_clear: Some(Callback::new(move |_| value.set(String::new()))),
                        }
                    }
                }
                ("layer1", "search", _) => {
                    let mut value = use_signal(|| String::new());
                    rsx! {
                        Search {
                            value: value(),
                            placeholder: "Search...".to_string(),
                            suggestions: vec![
                                "Hikari Components".to_string(),
                                "Rust Programming".to_string(),
                                "Dioxus Framework".to_string(),
                            ],
                            on_search: move |v| value.set(v),
                            on_clear: Some(Callback::new(move |_| value.set(String::new()))),
                        }
                    }
                }

                // ========== Skeleton ==========
                ("layer1", "empty", Some("skeleton")) => rsx! {
                    div { class: flex_col_gap(),
                        Skeleton { variant: SkeletonVariant::Text, rows: Some(3) }
                    }
                },
                ("layer1", "empty", Some("card")) => rsx! {
                    div { style: "width: 100%; max-width: 400px;",
                        SkeletonCard { show_avatar: true, rows: 3 }
                    }
                },
                ("layer1", "empty", Some("table")) => rsx! {
                    div { style: "width: 100%;",
                        SkeletonTable { columns: 4, rows: 3 }
                    }
                },
                ("layer1", "empty", _) => rsx! {
                    div { class: flex_col_gap(),
                        Skeleton { variant: SkeletonVariant::Text, rows: Some(3) }
                        div { style: "height: 16px;" }
                        SkeletonCard { show_avatar: true, rows: 2 }
                    }
                },

                // ========== FlexBox / Layout ==========
                ("layer1", "flexbox", Some("row")) => rsx! {
                    FlexBox {
                        direction: Direction::Row,
                        gap: FlexGap::Gap4,
                        class: "hi-flexbox-demo".to_string(),
                        div { class: "hi-demo-box", "Box 1" }
                        div { class: "hi-demo-box", "Box 2" }
                        div { class: "hi-demo-box", "Box 3" }
                    }
                },
                ("layer1", "flexbox", Some("col")) => rsx! {
                    FlexBox {
                        direction: Direction::Column,
                        gap: FlexGap::Gap4,
                        class: "hi-flexbox-demo".to_string(),
                        div { class: "hi-demo-box", "Item 1" }
                        div { class: "hi-demo-box", "Item 2" }
                        div { class: "hi-demo-box", "Item 3" }
                    }
                },
                ("layer1", "flexbox", Some("align")) => rsx! {
                    div { style: "display: flex; flex-direction: column; gap: 1rem;",
                        div { "Align: Start" }
                        FlexBox {
                            direction: Direction::Row,
                            align: _components::layout::Align::Start,
                            gap: FlexGap::Gap2,
                            div { class: "hi-demo-box-sm hi-demo-box-tall", "1" }
                            div { class: "hi-demo-box-sm", "2" }
                            div { class: "hi-demo-box-sm hi-demo-box-tall", "3" }
                        }
                        div { "Align: Center" }
                        FlexBox {
                            direction: Direction::Row,
                            align: _components::layout::Align::Center,
                            gap: FlexGap::Gap2,
                            div { class: "hi-demo-box-sm hi-demo-box-tall", "1" }
                            div { class: "hi-demo-box-sm", "2" }
                            div { class: "hi-demo-box-sm hi-demo-box-tall", "3" }
                        }
                    }
                },
                ("layer1", "flexbox", _) => rsx! {
                    FlexBox {
                        direction: Direction::Row,
                        gap: FlexGap::Gap4,
                        div { class: "hi-demo-box", "Box 1" }
                        div { class: "hi-demo-box", "Box 2" }
                        div { class: "hi-demo-box", "Box 3" }
                    }
                },

                // ========== Layer 2 ==========
                ("layer2", "navigation", Some("menu")) => rsx! {
                    div { class: flex_col_gap(), style: "max-width: 240px;",
                        Menu {
                            mode: MenuMode::Vertical,
                            MenuItem { item_key: "1", "Dashboard" }
                            MenuItem { item_key: "2", "Settings" }
                            MenuItem { item_key: "3", "Profile" }
                            MenuItem { item_key: "4", disabled: true, "Disabled" }
                        }
                    }
                },
                ("layer2", "navigation", Some("tabs")) => rsx! {
                    div { style: "width: 100%;",
                        Tabs {
                            default_active: "1".to_string(),
                            TabPane {
                                item_key: "1".to_string(),
                                tab: "Tab 1".to_string(),
                                div { class: flex_col_gap(), "Content of Tab 1" }
                            }
                            TabPane {
                                item_key: "2".to_string(),
                                tab: "Tab 2".to_string(),
                                div { class: flex_col_gap(), "Content of Tab 2" }
                            }
                            TabPane {
                                item_key: "3".to_string(),
                                tab: "Tab 3".to_string(),
                                div { class: flex_col_gap(), "Content of Tab 3" }
                            }
                        }
                    }
                },
                ("layer2", "navigation", Some("breadcrumb")) => rsx! {
                    Breadcrumb {
                        BreadcrumbItem { item_key: "1".to_string(), "Home" }
                        BreadcrumbItem { item_key: "2".to_string(), "Library" }
                        BreadcrumbItem { item_key: "3".to_string(), "Data" }
                    }
                },
                ("layer2", "navigation", _) => rsx! {
                    div { class: flex_col_gap(),
                        Breadcrumb {
                            BreadcrumbItem { item_key: "1".to_string(), "Home" }
                            BreadcrumbItem { item_key: "2".to_string(), "Components" }
                        }
                    }
                },

                ("layer2", "data", Some("table")) => rsx! {
                    div { style: "width: 100%;",
                        Table {
                            columns: vec![
                                ColumnDef::new("name", "Name").sortable(true),
                                ColumnDef::new("role", "Role"),
                                ColumnDef::new("level", "Level").align(ColumnAlign::Center),
                            ],
                            data: vec![
                                vec!["Amiya".to_string(), "Guard".to_string(), "6".to_string()],
                                vec!["SilverAsh".to_string(), "Guard".to_string(), "6".to_string()],
                                vec!["Exusiai".to_string(), "Sniper".to_string(), "6".to_string()],
                                vec!["Eyjafjalla".to_string(), "Caster".to_string(), "6".to_string()],
                            ],
                            bordered: true,
                            striped: true,
                            hoverable: true,
                        }
                    }
                },
                ("layer2", "data", Some("tree")) => rsx! {
                    div { style: "width: 100%; max-width: 300px;",
                        Tree {
                            data: vec![
                                TreeNodeData {
                                    key: "1".to_string(),
                                    label: "Parent 1".to_string(),
                                    children: Some(vec![
                                        TreeNodeData {
                                            key: "1-1".to_string(),
                                            label: "Child 1-1".to_string(),
                                            children: None,
                                            disabled: false,
                                        },
                                        TreeNodeData {
                                            key: "1-2".to_string(),
                                            label: "Child 1-2".to_string(),
                                            children: None,
                                            disabled: false,
                                        },
                                    ]),
                                    disabled: false,
                                },
                                TreeNodeData {
                                    key: "2".to_string(),
                                    label: "Parent 2".to_string(),
                                    children: Some(vec![
                                        TreeNodeData {
                                            key: "2-1".to_string(),
                                            label: "Child 2-1".to_string(),
                                            children: None,
                                            disabled: false,
                                        },
                                    ]),
                                    disabled: false,
                                },
                            ],
                            default_expanded_keys: vec!["1".to_string()],
                        }
                    }
                },
                ("layer2", "data", Some("pagination")) => rsx! {
                    Pagination {
                        current: 3,
                        total: 100,
                        page_size: 10,
                        show_total: true,
                    }
                },
                ("layer2", "data", _) => rsx! {
                    div { class: flex_col_gap(),
                        Pagination {
                            current: 1,
                            total: 50,
                            page_size: 10,
                            show_total: true,
                        }
                    }
                },

                ("layer2", "form", Some("form")) => rsx! {
                    div { class: flex_col_gap(), style: "max-width: 320px;",
                        Input { placeholder: Some("Username".to_string()) }
                        Input { placeholder: Some("Password".to_string()), input_type: Some("password".to_string()) }
                        Checkbox { checked: false, on_change: move |_| {}, "Remember me" }
                        Button { variant: ButtonVariant::Primary, block: true, "Submit" }
                    }
                },
                ("layer2", "form", Some("dropdown")) => rsx! {
                    div { class: flex_row_wrap(),
                        Popover {
                            trigger: rsx! {
                                Button { variant: ButtonVariant::Primary, "Click me" }
                            },
                            div { style: "padding: 8px;", "Dropdown content here" }
                        }
                    }
                },
                ("layer2", "form", Some("modal")) => {
                    let modal = use_modal(Default::default());
                    rsx! {
                        div { class: flex_row_wrap(),
                            Button {
                                variant: ButtonVariant::Primary,
                                onclick: move |_| {
                                    modal.open.call(ModalContent {
                                        title: Some("Modal Title".to_string()),
                                        children: rsx! {
                                            div { style: "padding: 16px;",
                                                p { "This is a modal dialog using the Portal system." }
                                                p { style: "margin-top: 12px;", "Modal content can include any components." }
                                                div { style: "margin-top: 16px; display: flex; gap: 8px; justify-content: flex-end;",
                                                    Button {
                                                        variant: ButtonVariant::Ghost,
                                                        onclick: move |_| modal.close.call(()),
                                                        "Cancel"
                                                    }
                                                    Button {
                                                        variant: ButtonVariant::Primary,
                                                        onclick: move |_| modal.close.call(()),
                                                        "Confirm"
                                                    }
                                                }
                                            }
                                        },
                                    });
                                },
                                "Open Modal"
                            }
                        }
                    }
                }
                ("layer2", "form", Some("collapse")) => rsx! {
                    div { style: "width: 100%; max-width: 400px;",
                        Collapse {
                            expanded: false,
                            "Expandable content panel"
                        }
                    }
                },
                ("layer2", "form", _) => rsx! {
                    div { class: flex_col_gap(), style: "max-width: 320px;",
                        Input { placeholder: Some("Form components".to_string()) }
                    }
                },

                ("layer2", "feedback", Some("drawer")) => rsx! {
                    div { class: flex_row_wrap(),
                        Popover {
                            trigger: rsx! {
                                Button { variant: ButtonVariant::Primary, "Open Drawer" }
                            },
                            div { style: "padding: 16px; min-width: 250px;",
                                h3 { style: "margin-bottom: 12px;", "Drawer Preview" }
                                p { "This is a simplified drawer demonstration." }
                                p { style: "margin-top: 8px;", "Full drawer slides in from edge." }
                            }
                        }
                    }
                },
                ("layer2", "feedback", Some("popover")) => rsx! {
                    div { class: flex_row_wrap(),
                        Popover {
                            title: Some("Popover Title".to_string()),
                            trigger: rsx! {
                                Button { variant: ButtonVariant::Secondary, "Hover or Click" }
                            },
                            div { style: "padding: 8px;",
                                p { "Popover content with title" }
                            }
                        }
                    }
                },
                ("layer2", "feedback", Some("upload")) => rsx! {
                    div { style: "width: 100%; max-width: 400px;",
                        FileUpload {
                            upload_text: "Click or drag file to upload".to_string(),
                            multiple: true,
                        }
                    }
                },
                ("layer2", "feedback", _) => rsx! {
                    div { class: flex_col_gap(),
                        Popover {
                            trigger: rsx! {
                                Button { variant: ButtonVariant::Primary, "Open Popover" }
                            },
                            div { style: "padding: 8px;", "Feedback: Drawer, Popover, Upload" }
                        }
                    }
                },

                // ========== Layer 2 - Specific ==========
                ("layer2", "cascader", _) => rsx! {
                    div { style: "width: 100%; max-width: 300px;",
                        Cascader {
                            placeholder: "Select location".to_string(),
                            size: CascaderSize::Md,
                            options: vec![
                                CascaderOption {
                                    label: "Zhejiang".to_string(),
                                    value: "zhejiang".to_string(),
                                    children: Some(vec![
                                        CascaderOption {
                                            label: "Hangzhou".to_string(),
                                            value: "hangzhou".to_string(),
                                            ..Default::default()
                                        },
                                        CascaderOption {
                                            label: "Ningbo".to_string(),
                                            value: "ningbo".to_string(),
                                            ..Default::default()
                                        },
                                    ]),
                                    ..Default::default()
                                },
                                CascaderOption {
                                    label: "Jiangsu".to_string(),
                                    value: "jiangsu".to_string(),
                                    children: Some(vec![
                                        CascaderOption {
                                            label: "Nanjing".to_string(),
                                            value: "nanjing".to_string(),
                                            ..Default::default()
                                        },
                                        CascaderOption {
                                            label: "Suzhou".to_string(),
                                            value: "suzhou".to_string(),
                                            ..Default::default()
                                        },
                                    ]),
                                    ..Default::default()
                                },
                            ],
                        }
                    }
                },
                ("layer2", "collapsible", _) => rsx! {
                    div { style: "width: 100%; max-width: 400px;",
                        Collapse {
                            expanded: true,
                            animated: true,
                            "This is collapsible content that can be expanded or collapsed"
                        }
                    }
                },
                ("layer2", "pagination", _) => rsx! {
                    Pagination {
                        current: 5,
                        total: 500,
                        page_size: 20,
                        show_total: true,
                        show_size_changer: true,
                    }
                },
                ("layer2", "qrcode", _) => rsx! {
                    div { style: "width: 100%; display: flex; justify-content: center;",
                        QRCode {
                            value: "https://github.com/celestia-island/hikari".to_string(),
                            size: 180,
                            title: Some("Scan to visit Hikari".to_string()),
                        }
                    }
                },
                ("layer2", "table", _) => rsx! {
                    div { style: "width: 100%;",
                        Table {
                            columns: vec![
                                ColumnDef::new("id", "ID").align(ColumnAlign::Center),
                                ColumnDef::new("name", "Name").sortable(true),
                                ColumnDef::new("status", "Status"),
                            ],
                            data: vec![
                                vec!["001".to_string(), "Item A".to_string(), "Active".to_string()],
                                vec!["002".to_string(), "Item B".to_string(), "Inactive".to_string()],
                                vec!["003".to_string(), "Item C".to_string(), "Active".to_string()],
                            ],
                            hoverable: true,
                        }
                    }
                },
                ("layer2", "timeline", _) => rsx! {
                    Timeline {
                        position: TimelinePosition::Left,
                        TimelineItem {
                            time: "2024-01-01".to_string(),
                            title: "Project Started".to_string(),
                            "Initial project setup"
                        }
                        TimelineItem {
                            time: "2024-02-15".to_string(),
                            title: "First Milestone".to_string(),
                            "Completed core features"
                        }
                        TimelineItem {
                            time: "2024-03-20".to_string(),
                            title: "Beta Release".to_string(),
                            last: true,
                            "Public beta testing"
                        }
                    }
                },
                ("layer2", "transfer", _) => rsx! {
                    div { style: "width: 100%;",
                        Transfer {
                            data: vec![
                                TransferItem { item_key: "1".to_string(), label: "Option 1".to_string(), ..Default::default() },
                                TransferItem { item_key: "2".to_string(), label: "Option 2".to_string(), ..Default::default() },
                                TransferItem { item_key: "3".to_string(), label: "Option 3".to_string(), ..Default::default() },
                                TransferItem { item_key: "4".to_string(), label: "Option 4".to_string(), ..Default::default() },
                            ],
                            target_keys: vec!["3".to_string()],
                            titles: Some(["Source".to_string(), "Target".to_string()]),
                        }
                    }
                },
                ("layer2", "tree", _) => rsx! {
                    div { style: "width: 100%; max-width: 280px;",
                        Tree {
                            data: vec![
                                TreeNodeData {
                                    key: "root".to_string(),
                                    label: "Root Node".to_string(),
                                    children: Some(vec![
                                        TreeNodeData {
                                            key: "child1".to_string(),
                                            label: "Child 1".to_string(),
                                            children: None,
                                            disabled: false,
                                        },
                                        TreeNodeData {
                                            key: "child2".to_string(),
                                            label: "Child 2".to_string(),
                                            children: None,
                                            disabled: false,
                                        },
                                    ]),
                                    disabled: false,
                                },
                            ],
                            show_line: true,
                        }
                    }
                },

                // ========== Layer 3 ==========
                ("layer3", "media", Some("video")) => rsx! {
                    div { style: "width: 100%; max-width: 480px;",
                        VideoPlayer {
                            src: "https://www.w3schools.com/html/mov_bbb.mp4".to_string(),
                            controls: true,
                        }
                    }
                },
                ("layer3", "media", Some("audio")) => rsx! {
                    div { style: "width: 100%; max-width: 400px;",
                        AudioPlayer {
                            src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3".to_string(),
                            title: Some("Sample Track".to_string()),
                            artist: Some("SoundHelix".to_string()),
                            controls: true,
                        }
                    }
                },
                ("layer3", "media", _) => rsx! {
                    div { class: flex_col_gap(),
                        VideoPlayer {
                            src: "https://www.w3schools.com/html/mov_bbb.mp4".to_string(),
                            controls: true,
                        }
                    }
                },

                ("layer3", "editor", Some("markdown")) => rsx! {
                    div { style: "width: 100%; height: 300px;",
                        MarkdownEditor {
                            value: "# Hello World\n\nThis is **markdown** content.".to_string(),
                            placeholder: "Write your markdown here...".to_string(),
                            mode: MarkdownEditorMode::Split,
                            toolbar: true,
                        }
                    }
                },
                ("layer3", "editor", Some("code")) => rsx! {
                    div { style: "width: 100%; max-width: 500px;",
                        CodeHighlight {
                            language: "rust".to_string(),
                            code: r#"fn main() {
    println!("Hello, World!");
}"#.to_string(),
                            line_numbers: true,
                            copyable: true,
                        }
                    }
                },
                ("layer3", "editor", Some("richtext")) => rsx! {
                    div { style: "width: 100%; max-width: 500px;",
                        RichTextEditor {
                            toolbar: true,
                            placeholder: "Start typing...".to_string(),
                        }
                    }
                },
                ("layer3", "editor", _) => rsx! {
                    div { class: flex_col_gap(),
                        RichTextEditor {
                            toolbar: true,
                            placeholder: "Rich text editor".to_string(),
                        }
                    }
                },

                ("layer3", "visualization", Some("draglayer")) => rsx! {
                    div { style: "width: 100%; height: 200px; position: relative; background: var(--hi-surface); border-radius: 8px;",
                        DragLayer {
                            is_dragging: true,
                            drag_item: Some(DragItem {
                                id: "item-1".to_string(),
                                label: "Draggable Component".to_string(),
                                item_type: "component".to_string(),
                            }),
                            position: (150, 100),
                            show_drop_zones: true,
                        }
                    }
                },
                ("layer3", "visualization", Some("timeline")) => rsx! {
                    Timeline {
                        position: TimelinePosition::Alternate,
                        TimelineItem {
                            position: TimelinePosition::Left,
                            time: "Step 1".to_string(),
                            title: "Design Phase".to_string(),
                            "Initial design and planning"
                        }
                        TimelineItem {
                            position: TimelinePosition::Right,
                            time: "Step 2".to_string(),
                            title: "Development".to_string(),
                            "Core feature implementation"
                        }
                        TimelineItem {
                            position: TimelinePosition::Left,
                            time: "Step 3".to_string(),
                            title: "Testing".to_string(),
                            last: true,
                            "Quality assurance and testing"
                        }
                    }
                },
                ("layer3", "visualization", Some("userguide")) => rsx! {
                    div { style: "width: 100%; max-width: 400px; position: relative; min-height: 200px;",
                        UserGuide {
                            steps: vec![
                                GuideStep {
                                    target: String::new(),
                                    title: "Welcome to Hikari".to_string(),
                                    description: "This is a step-by-step guide to introduce new features.".to_string(),
                                    placement: GuidePlacement::Bottom,
                                },
                                GuideStep {
                                    target: String::new(),
                                    title: "Explore Components".to_string(),
                                    description: "Browse our comprehensive component library.".to_string(),
                                    placement: GuidePlacement::Bottom,
                                },
                                GuideStep {
                                    target: String::new(),
                                    title: "Get Started".to_string(),
                                    description: "Start building your application with Hikari!".to_string(),
                                    placement: GuidePlacement::Bottom,
                                },
                            ],
                            current: 0,
                            visible: true,
                        }
                    }
                },
                ("layer3", "visualization", _) => rsx! {
                    div { class: flex_col_gap(),
                        Timeline {
                            position: TimelinePosition::Left,
                            TimelineItem {
                                time: "1".to_string(),
                                title: "Step 1".to_string(),
                                "First step"
                            }
                            TimelineItem {
                                time: "2".to_string(),
                                title: "Step 2".to_string(),
                                last: true,
                                "Final step"
                            }
                        }
                    }
                },

                ("layer3", "user_guide", _) => rsx! {
                    div { style: "width: 100%; max-width: 400px; position: relative; min-height: 200px;",
                        UserGuide {
                            steps: vec![
                                GuideStep {
                                    target: String::new(),
                                    title: "Welcome".to_string(),
                                    description: "This is a step-by-step guide".to_string(),
                                    placement: GuidePlacement::Bottom,
                                },
                            ],
                            current: 0,
                            visible: true,
                        }
                    }
                },
                ("layer3", "zoom_controls", _) => rsx! {
                    div { style: "width: 100%; display: flex; justify-content: center;",
                        ZoomControls {
                            zoom: 100,
                            min_zoom: 25,
                            max_zoom: 200,
                            show_percentage: true,
                        }
                    }
                },

                // ========== System ==========
                ("system", "css", Some("display")) => rsx! {
                    div { class: flex_col_gap(),
                        p { class: ClassesBuilder::new().add(FontWeight::Semibold).build(), "Display Utilities" }
                        div { class: flex_row_wrap(),
                            div { class: "hi-flex hi-items-center hi-gap-2 hi-p-2", "flex items-center" }
                            div { class: "hi-block hi-p-2", "block" }
                            div { class: "hi-inline hi-p-2", "inline" }
                        }
                    }
                },
                ("system", "css", Some("flex")) => rsx! {
                    div { class: flex_col_gap(),
                        p { class: ClassesBuilder::new().add(FontWeight::Semibold).build(), "Flex Utilities" }
                        div { class: "hi-flex hi-flex-row hi-gap-4",
                            div { class: "hi-p-2 hi-bg-gray-100", "Row" }
                            div { class: "hi-p-2 hi-bg-gray-100", "Layout" }
                        }
                    }
                },
                ("system", "css", Some("spacing")) => rsx! {
                    div { class: flex_col_gap(),
                        p { class: ClassesBuilder::new().add(FontWeight::Semibold).build(), "Spacing Utilities" }
                        div { class: "hi-flex hi-gap-2",
                            div { class: "hi-p-2 hi-bg-gray-100", "p-2" }
                            div { class: "hi-p-4 hi-bg-gray-100", "p-4" }
                            div { class: "hi-p-6 hi-bg-gray-100", "p-6" }
                        }
                    }
                },
                ("system", "css", Some("typography")) => rsx! {
                    div { class: flex_col_gap(),
                        p { class: ClassesBuilder::new().add(FontWeight::Semibold).build(), "Typography Utilities" }
                        p { class: "hi-text-sm", "Small text (text-sm)" }
                        p { class: "hi-text-base", "Base text (text-base)" }
                        p { class: "hi-text-lg", "Large text (text-lg)" }
                    }
                },
                ("system", "css", Some("colors")) => rsx! {
                    div { class: flex_col_gap(),
                        p { class: ClassesBuilder::new().add(FontWeight::Semibold).build(), "Color Utilities" }
                        div { class: flex_row_wrap(),
                            div { class: "hi-p-2 hi-bg-primary hi-text-white", "primary" }
                            div { class: "hi-p-2 hi-bg-secondary hi-text-white", "secondary" }
                            div { class: "hi-p-2 hi-bg-danger hi-text-white", "danger" }
                        }
                    }
                },
                ("system", "css", _) => rsx! {
                    div { class: flex_col_gap(),
                        p { "CSS Utility System" }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Tailwind-compatible utility classes for rapid UI development"
                        }
                    }
                },

                ("system", "i18n", Some("basic")) => rsx! {
                    div { class: flex_col_gap(),
                        p { class: ClassesBuilder::new().add(TextColor::Primary).build(),
                            "i18n system provides internationalization support with:"
                        }
                        ul { style: "margin-left: 1.5rem;",
                            li { "I18nProvider - Context provider for language data" }
                            li { "use_i18n() - Hook to access translations" }
                            li { "LanguageSwitcher - UI component for language selection" }
                            li { "TOML-based translation files" }
                        }
                    }
                },
                ("system", "i18n", Some("switch")) => rsx! {
                    div { class: flex_col_gap(),
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Language switcher component (demo):"
                        }
                        div {
                            style: "display: flex; gap: 8px; padding: 8px; background: var(--hi-surface); border-radius: 8px; width: fit-content;",
                            button {
                                class: "hi-button hi-button-sm hi-button-primary",
                                "EN"
                            }
                            button {
                                class: "hi-button hi-button-sm hi-button-ghost",
                                "简"
                            }
                            button {
                                class: "hi-button hi-button-sm hi-button-ghost",
                                "繁"
                            }
                        }
                    }
                },
                ("system", "i18n", _) => rsx! {
                    div { class: flex_col_gap(),
                        p { class: ClassesBuilder::new().add(TextColor::Primary).build(),
                            "i18n internationalization system"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Supports: English, Chinese Simplified, Chinese Traditional"
                        }
                    }
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
        .add(AlignItems::Center)
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
