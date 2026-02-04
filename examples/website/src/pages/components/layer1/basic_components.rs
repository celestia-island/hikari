// website/src/pages/components/layer1/basic_components.rs
// Individual component renderers for basic components

use dioxus::prelude::*;

use _components::{
    Badge, Button, ButtonVariant, Card, Checkbox, Divider, DividerOrientation, DividerTextPosition,
    Input, RadioButton, RadioDirection, RadioGroup, Select, SelectOption,
};
use _palette::classes::{
    AlignItems, FlexWrap, {ClassesBuilder, Display, FlexDirection, Gap, Margin, Padding},
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
            Button {
                variant: ButtonVariant::Primary,
                "Primary Button"
            }

            // Secondary button
            Button {
                variant: ButtonVariant::Secondary,
                "Secondary Button"
            }

            // Ghost button
            Button {
                variant: ButtonVariant::Ghost,
                "Ghost Button"
            }

            // Danger button
            Button {
                variant: ButtonVariant::Danger,
                "Danger Button"
            }
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

                label {
                    "用户名:"
                }

                Input {
                    placeholder: Some("请输入用户名".to_string())
                }
            }

            div {
                class: ClassesBuilder::new()
                    .add(Display::Flex)
                    .add(FlexDirection::Row)
                    .add(AlignItems::Center)
                    .add(Gap::Gap2)
                    .build(),

                label {
                    "密码:"
                }

                Input {
                    input_type: Some("password".to_string()),
                    placeholder: Some("请输入密码".to_string())
                }
            }

            div {
                class: ClassesBuilder::new()
                    .add(Display::Flex)
                    .add(FlexDirection::Row)
                    .add(AlignItems::Center)
                    .add(Gap::Gap2)
                    .build(),

                label {
                    "搜索:"
                }

                Input {
                    placeholder: Some("搜索内容...".to_string())
                }
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

            // Basic card
            Card {
                title: Some("基础卡片".to_string()),
                "这是一个基础的卡片组件"
            }

            // Card with actions
            Card {
                title: Some("带操作的卡片".to_string()),
                div {
                    class: "hi-card-footer",
                    Button {
                        variant: ButtonVariant::Ghost,
                        "取消"
                    }
                    Button {
                        variant: ButtonVariant::Primary,
                        "确认"
                    }
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

                "消息",

                Badge { count: Some(5) }
            }

            div {
                class: ClassesBuilder::new()
                    .add(Display::Flex)
                    .add(FlexDirection::Row)
                    .add(AlignItems::Center)
                    .add(Gap::Gap2)
                    .build(),

                "状态",

                Badge {
                    "在线"
                }
            }

            div {
                class: ClassesBuilder::new()
                    .add(Display::Flex)
                    .add(FlexDirection::Row)
                    .add(AlignItems::Center)
                    .add(Gap::Gap2)
                    .build(),

                "警告",

                Badge { count: Some(3) }
            }

            div {
                class: ClassesBuilder::new()
                    .add(Display::Flex)
                    .add(FlexDirection::Row)
                    .add(AlignItems::Center)
                    .add(Gap::Gap2)
                    .build(),

                "错误",

                Badge { count: Some(2) }
            }
        }
    }
}

/// Select component demonstration
#[allow(non_snake_case)]
pub fn BasicSelect() -> Element {
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

                label {
                    "城市:"
                }

                Select {
                    options: vec![
                        SelectOption { label: "北京".to_string(), value: "bj".to_string() },
                        SelectOption { label: "上海".to_string(), value: "sh".to_string() },
                        SelectOption { label: "广州".to_string(), value: "gz".to_string() },
                        SelectOption { label: "深圳".to_string(), value: "sz".to_string() },
                    ],
                }
            }

            div {
                class: ClassesBuilder::new()
                    .add(Display::Flex)
                    .add(FlexDirection::Row)
                    .add(AlignItems::Center)
                    .add(Gap::Gap2)
                    .build(),

                label {
                    "分类:"
                }

                Select {
                    size: _components::SelectSize::Lg,
                    options: vec![
                        SelectOption { label: "科技".to_string(), value: "tech".to_string() },
                        SelectOption { label: "艺术".to_string(), value: "art".to_string() },
                        SelectOption { label: "体育".to_string(), value: "sports".to_string() },
                    ],
                }
            }
        }
    }
}

/// Checkbox component demonstration
#[allow(non_snake_case)]
pub fn BasicCheckbox() -> Element {
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
                    on_change: move |_| {},
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
                    checked: true,
                    on_change: move |_| {},
                    "选项 2（已选中）"
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
                    disabled: true,
                    on_change: move |_| {},
                    "选项 3（禁用）"
                }
            }
        }
    }
}

/// Radio component demonstration
#[allow(non_snake_case)]
pub fn BasicRadio() -> Element {
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
                value: "option1".to_string(),
                on_change: move |_| {},
                direction: RadioDirection::Vertical,

                RadioButton {
                    value: "option1".to_string(),
                    "选项 1"
                }

                RadioButton {
                    value: "option2".to_string(),
                    "选项 2"
                }

                RadioButton {
                    value: "option3".to_string(),
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
