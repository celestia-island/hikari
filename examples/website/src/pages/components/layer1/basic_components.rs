// website/src/pages/components/layer1/basic_components.rs
// Individual component renderers for basic components

use dioxus::prelude::*;

use _components::{
    Badge, Button, ButtonVariant, Card, CardActions, CardContent, CardHeader, Checkbox, Divider,
    DividerOrientation, DividerTextPosition, Input, RadioButtonInternal, RadioDirection, RadioGroup,
    Select, SelectOption,
};
use _palette::classes::{
    AlignItems, ClassesBuilder, Display, FlexDirection, FlexWrap, Gap, Padding,
};

/// Button component demonstration
#[allow(non_snake_case)]
pub fn BasicButton() -> Element {
    rsx! {
        div {
            class: ClassesBuilder::new()
                .add(Display::Flex)
                .add(FlexDirection::Row)
                .add(Gap::Gap4)
                .add(FlexWrap::Wrap)
                .add(Padding::P4)
                .build(),

            // Primary button
            Button { variant: ButtonVariant::Primary, "Primary Button" }

            // Secondary button
            Button { variant: ButtonVariant::Secondary, "Secondary Button" }

            // Ghost button
            Button { variant: ButtonVariant::Ghost, "Ghost Button" }

            // Danger button
            Button { variant: ButtonVariant::Danger, "Danger Button" }
        }
    }
}

/// Input component demonstration
#[allow(non_snake_case)]
pub fn BasicInput() -> Element {
    rsx! {
        div {
            class: ClassesBuilder::new()
                .add(Display::Flex)
                .add(FlexDirection::Column)
                .add(Gap::Gap4)
                .add(Padding::P4)
                .build(),

            div {
                class: ClassesBuilder::new()
                    .add(Display::Flex)
                    .add(FlexDirection::Row)
                    .add(AlignItems::Center)
                    .add(Gap::Gap2)
                    .build(),

                label { "用户名:" }

                Input { placeholder: Some("请输入用户名".to_string()) }
            }

            div {
                class: ClassesBuilder::new()
                    .add(Display::Flex)
                    .add(FlexDirection::Row)
                    .add(AlignItems::Center)
                    .add(Gap::Gap2)
                    .build(),

                label { "密码:" }

                Input {
                    input_type: Some("password".to_string()),
                    placeholder: Some("请输入密码".to_string()),
                }
            }

            div {
                class: ClassesBuilder::new()
                    .add(Display::Flex)
                    .add(FlexDirection::Row)
                    .add(AlignItems::Center)
                    .add(Gap::Gap2)
                    .build(),

                label { "搜索:" }

                Input { placeholder: Some("搜索内容...".to_string()) }
            }
        }
    }
}

/// Card component demonstration
#[allow(non_snake_case)]
pub fn BasicCard() -> Element {
    rsx! {
        div {
            class: ClassesBuilder::new()
                .add(Display::Flex)
                .add(FlexDirection::Row)
                .add(Gap::Gap4)
                .add(FlexWrap::Wrap)
                .add(Padding::P4)
                .build(),

            // Basic card (legacy pattern - still works)
            Card { title: Some("基础卡片".to_string()), "这是一个基础的卡片组件" }

            // Card with actions (new composition pattern)
            Card {
                CardHeader { title: Some("带操作的卡片".to_string()) }

                CardContent {
                    div { "卡片内容区域" }
                }

                CardActions {
                    Button { variant: ButtonVariant::Ghost, "取消" }
                    Button { variant: ButtonVariant::Primary, "确认" }
                }
            }

            // Full card with all sub-components
            Card {
                CardHeader {
                    title: Some("完整卡片".to_string()),
                    subtitle: Some("带有副标题".to_string()),
                    action: Some(rsx! {
                        _components::IconButton {
                            icon: _icons::MdiIcon::DotsHorizontal,
                            size: _components::IconButtonSize::Small,
                            onclick: move |_| {},
                        }
                    }),
                }

                CardContent {
                    div { "这是一个完整卡片，包含头部、内容和操作区域" }
                }

                CardActions {
                    Button { variant: ButtonVariant::Ghost, "关闭" }
                    Button { variant: ButtonVariant::Secondary, "保存" }
                }
            }
        }
    }
}

/// Badge component demonstration
#[allow(non_snake_case)]
pub fn BasicBadge() -> Element {
    rsx! {
        div {
            class: ClassesBuilder::new()
                .add(Display::Flex)
                .add(FlexDirection::Row)
                .add(AlignItems::Center)
                .add(Gap::Gap4)
                .add(FlexWrap::Wrap)
                .add(Padding::P4)
                .build(),

            div {
                class: ClassesBuilder::new()
                    .add(Display::Flex)
                    .add(FlexDirection::Row)
                    .add(AlignItems::Center)
                    .add(Gap::Gap2)
                    .build(),

                "消息"

                Badge {
                    variant: _components::BadgeVariant::Primary,
                    count: Some(5),
                }
            }

            div {
                class: ClassesBuilder::new()
                    .add(Display::Flex)
                    .add(FlexDirection::Row)
                    .add(AlignItems::Center)
                    .add(Gap::Gap2)
                    .build(),

                "状态"

                Badge { variant: _components::BadgeVariant::Success, "在线" }
            }

            div {
                class: ClassesBuilder::new()
                    .add(Display::Flex)
                    .add(FlexDirection::Row)
                    .add(AlignItems::Center)
                    .add(Gap::Gap2)
                    .build(),

                "警告"

                Badge {
                    variant: _components::BadgeVariant::Warning,
                    count: Some(3),
                }
            }

            div {
                class: ClassesBuilder::new()
                    .add(Display::Flex)
                    .add(FlexDirection::Row)
                    .add(AlignItems::Center)
                    .add(Gap::Gap2)
                    .build(),

                "错误"

                Badge {
                    variant: _components::BadgeVariant::Danger,
                    count: Some(2),
                }
            }
        }
    }
}

/// Select component demonstration
#[allow(non_snake_case)]
pub fn BasicSelect() -> Element {
    let mut modal_open = use_signal(|| false);

    rsx! {
        div {
            class: ClassesBuilder::new()
                .add(Display::Flex)
                .add(FlexDirection::Column)
                .add(Gap::Gap4)
                .add(Padding::P4)
                .build(),

            // Row: city select
            div {
                class: ClassesBuilder::new()
                    .add(Display::Flex)
                    .add(FlexDirection::Row)
                    .add(AlignItems::Center)
                    .add(Gap::Gap3)
                    .build(),

                label { "城市:" }

                Select {
                    placeholder: "请选择城市".to_string(),
                    options: vec![
                        SelectOption {
                            label: "北京".to_string(),
                            value: "bj".to_string(),
                        },
                        SelectOption {
                            label: "上海".to_string(),
                            value: "sh".to_string(),
                        },
                        SelectOption {
                            label: "广州".to_string(),
                            value: "gz".to_string(),
                        },
                        SelectOption {
                            label: "深圳".to_string(),
                            value: "sz".to_string(),
                        },
                    ],
                }
            }

            // Row: category select (large size)
            div {
                class: ClassesBuilder::new()
                    .add(Display::Flex)
                    .add(FlexDirection::Row)
                    .add(AlignItems::Center)
                    .add(Gap::Gap3)
                    .build(),

                label { "分类:" }

                Select {
                    size: _components::SelectSize::Lg,
                    placeholder: "请选择分类".to_string(),
                    options: vec![
                        SelectOption {
                            label: "科技".to_string(),
                            value: "tech".to_string(),
                        },
                        SelectOption {
                            label: "艺术".to_string(),
                            value: "art".to_string(),
                        },
                        SelectOption {
                            label: "体育".to_string(),
                            value: "sports".to_string(),
                        },
                    ],
                }
            }

            // Row: small disabled select
            div {
                class: ClassesBuilder::new()
                    .add(Display::Flex)
                    .add(FlexDirection::Row)
                    .add(AlignItems::Center)
                    .add(Gap::Gap3)
                    .build(),

                label { "状态:" }

                Select {
                    size: _components::SelectSize::Sm,
                    disabled: true,
                    placeholder: "不可选择".to_string(),
                    options: vec![
                        SelectOption {
                            label: "启用".to_string(),
                            value: "on".to_string(),
                        },
                        SelectOption {
                            label: "禁用".to_string(),
                            value: "off".to_string(),
                        },
                    ],
                }
            }

            // Select detail modal
            _layer1::SelectDetailModal {
                open: modal_open(),
                on_close: move |_| modal_open.set(false),
            }
        }
    }
}

/// Checkbox component demonstration
#[allow(non_snake_case)]
pub fn BasicCheckbox() -> Element {
    let mut checked1 = use_signal(|| false);
    let mut checked2 = use_signal(|| true);
    let mut checked3 = use_signal(|| false);

    rsx! {
        div {
            class: ClassesBuilder::new()
                .add(Display::Flex)
                .add(FlexDirection::Column)
                .add(Gap::Gap4)
                .add(Padding::P4)
                .build(),

            div {
                class: ClassesBuilder::new()
                    .add(Display::Flex)
                    .add(FlexDirection::Row)
                    .add(AlignItems::Center)
                    .add(Gap::Gap2)
                    .build(),

                Checkbox {
                    checked: checked1(),
                    on_change: move |v| checked1.set(v),
                    "选项 1"
                }
            }

            div {
                class: ClassesBuilder::new()
                    .add(Display::Flex)
                    .add(FlexDirection::Row)
                    .add(AlignItems::Center)
                    .add(Gap::Gap2)
                    .build(),

                Checkbox {
                    checked: checked2(),
                    on_change: move |v| checked2.set(v),
                    "选项 2（默认选中）"
                }
            }

            div {
                class: ClassesBuilder::new()
                    .add(Display::Flex)
                    .add(FlexDirection::Row)
                    .add(AlignItems::Center)
                    .add(Gap::Gap2)
                    .build(),

                Checkbox {
                    checked: checked3(),
                    disabled: true,
                    on_change: move |v| checked3.set(v),
                    "选项 3（禁用）"
                }
            }
        }
    }
}

/// Radio component demonstration
#[allow(non_snake_case)]
pub fn BasicRadio() -> Element {
    let mut selected_value = use_signal(|| "option1".to_string());

    rsx! {
        div {
            class: ClassesBuilder::new()
                .add(Display::Flex)
                .add(FlexDirection::Column)
                .add(Gap::Gap4)
                .add(Padding::P4)
                .build(),

            RadioGroup {
                name: "group1".to_string(),
                value: selected_value.clone(),
                on_change: move |v| selected_value.set(v),
                direction: RadioDirection::Vertical,

                RadioButtonInternal {
                    value: "option1".to_string(),
                    group_name: "group1".to_string(),
                    selected_value: selected_value.clone(),
                    on_select: move |v| selected_value.set(v),
                    "选项 1"
                }

                RadioButtonInternal {
                    value: "option2".to_string(),
                    group_name: "group1".to_string(),
                    selected_value: selected_value.clone(),
                    on_select: move |v| selected_value.set(v),
                    "选项 2"
                }

                RadioButtonInternal {
                    value: "option3".to_string(),
                    group_name: "group1".to_string(),
                    selected_value: selected_value.clone(),
                    on_select: move |v| selected_value.set(v),
                    disabled: true,
                    "选项 3（禁用）"
                }
            }
        }
    }
}

/// Divider component demonstration
#[allow(non_snake_case)]
pub fn BasicDivider() -> Element {
    rsx! {
        div {
            class: ClassesBuilder::new()
                .add(Display::Flex)
                .add(FlexDirection::Column)
                .add(Gap::Gap4)
                .add(Padding::P4)
                .build(),

            div { "内容区域 1" }

            Divider {}

            div { "内容区域 2" }

            Divider {
                text: "分割线标题",
                text_position: DividerTextPosition::Center,
            }

            div { "内容区域 3" }

            Divider {
                text: "左侧标题",
                text_position: DividerTextPosition::Left,
            }

            div { "内容区域 4" }

            Divider {
                text: "右侧标题",
                text_position: DividerTextPosition::Right,
            }

            div { "内容区域 5" }
        }
    }
}
