use _components::{
    Checkbox, Input, RadioButtonInternal, RadioDirection, RadioGroup, Select, SelectOption,
    SelectSize,
};
use _palette::classes::{AlignItems, ClassesBuilder, Display, FlexDirection, Gap, Padding};
use dioxus::prelude::*;

use crate::components::Layout;

#[allow(non_snake_case)]
pub fn Layer1Form() -> Element {
    let mut checked1 = use_signal(|| false);
    let mut checked2 = use_signal(|| true);
    let mut checked3 = use_signal(|| false);
    let mut radio1 = use_signal(|| "option1".to_string());
    let mut radio2 = use_signal(|| "red".to_string());

    rsx! {
        Layout {
            current_route: crate::app::Route::Layer1Form {},
            div {
                class: ClassesBuilder::new()
                    .add_raw("page-container")
                    .build(),

                h1 {
                    class: ClassesBuilder::new()
                        .add_raw("page-title")
                        .build(),
                    "Form 表单组件"
                }

                p {
                    class: ClassesBuilder::new()
                        .add_raw("page-description")
                        .build(),
                    "表单相关的基础组件，包括输入框、选择器、复选框和单选框。"
                }

                section {
                    class: ClassesBuilder::new()
                        .add_raw("demo-section")
                        .build(),

                    h2 {
                        class: ClassesBuilder::new()
                            .add_raw("section-title")
                            .build(),
                        "Input 输入框"
                    }

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

                section {
                    class: ClassesBuilder::new()
                        .add_raw("demo-section")
                        .build(),

                    h2 {
                        class: ClassesBuilder::new()
                            .add_raw("section-title")
                            .build(),
                        "Select 选择器"
                    }

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
                                .add(Gap::Gap3)
                                .build(),

                            label { "城市:" }
                            Select {
                                placeholder: "请选择城市".to_string(),
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
                                .add(Gap::Gap3)
                                .build(),

                            label { "分类:" }
                            Select {
                                size: SelectSize::Lg,
                                placeholder: "请选择分类".to_string(),
                                options: vec![
                                    SelectOption { label: "科技".to_string(), value: "tech".to_string() },
                                    SelectOption { label: "艺术".to_string(), value: "art".to_string() },
                                    SelectOption { label: "体育".to_string(), value: "sports".to_string() },
                                ],
                            }
                        }

                        div {
                            class: ClassesBuilder::new()
                                .add(Display::Flex)
                                .add(FlexDirection::Row)
                                .add(AlignItems::Center)
                                .add(Gap::Gap3)
                                .build(),

                            label { "状态:" }
                            Select {
                                size: SelectSize::Sm,
                                disabled: true,
                                placeholder: "不可选择".to_string(),
                                options: vec![
                                    SelectOption { label: "启用".to_string(), value: "on".to_string() },
                                    SelectOption { label: "禁用".to_string(), value: "off".to_string() },
                                ],
                            }
                        }
                    }
                }

                section {
                    class: ClassesBuilder::new()
                        .add_raw("demo-section")
                        .build(),

                    h2 {
                        class: ClassesBuilder::new()
                            .add_raw("section-title")
                            .build(),
                        "Checkbox 复选框"
                    }

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
                            }
                            label { "记住密码" }
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
                            }
                            label { "同意服务条款" }
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
                                on_change: move |v| checked3.set(v),
                            }
                            label { "订阅新闻通讯" }
                        }
                    }
                }

                section {
                    class: ClassesBuilder::new()
                        .add_raw("demo-section")
                        .build(),

                    h2 {
                        class: ClassesBuilder::new()
                            .add_raw("section-title")
                            .build(),
                        "Radio 单选框"
                    }

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
                                .add(FlexDirection::Column)
                                .add(Gap::Gap2)
                                .build(),

                            label { "性别:" }
                            RadioGroup {
                                name: "gender".to_string(),
                                value: radio1(),
                                on_change: move |v| radio1.set(v),
                                direction: RadioDirection::Horizontal,

                                RadioButtonInternal {
                                    value: "option1".to_string(),
                                    selected_value: radio1(),
                                    on_select: move |v| radio1.set(v),
                                    "男"
                                }
                                RadioButtonInternal {
                                    value: "option2".to_string(),
                                    selected_value: radio1(),
                                    on_select: move |v| radio1.set(v),
                                    "女"
                                }
                                RadioButtonInternal {
                                    value: "option3".to_string(),
                                    selected_value: radio1(),
                                    on_select: move |v| radio1.set(v),
                                    "其他"
                                }
                            }
                        }

                        div {
                            class: ClassesBuilder::new()
                                .add(Display::Flex)
                                .add(FlexDirection::Column)
                                .add(Gap::Gap2)
                                .build(),

                            label { "颜色:" }
                            RadioGroup {
                                name: "color".to_string(),
                                value: radio2(),
                                on_change: move |v| radio2.set(v),
                                direction: RadioDirection::Horizontal,

                                RadioButtonInternal {
                                    value: "red".to_string(),
                                    selected_value: radio2(),
                                    on_select: move |v| radio2.set(v),
                                    "红色"
                                }
                                RadioButtonInternal {
                                    value: "green".to_string(),
                                    selected_value: radio2(),
                                    on_select: move |v| radio2.set(v),
                                    "绿色"
                                }
                                RadioButtonInternal {
                                    value: "blue".to_string(),
                                    selected_value: radio2(),
                                    on_select: move |v| radio2.set(v),
                                    "蓝色"
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
