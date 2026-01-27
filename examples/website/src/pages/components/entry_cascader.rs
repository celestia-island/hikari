// website/src/pages/components/entry_cascader.rs
// Cascader component example page

use dioxus::prelude::*;

use crate::components::Layout;
use _palette::classes::{ ClassesBuilder, Display, FontSize, FontWeight, Gap, MarginBottom, Padding, TextColor, };
use _components::{Cascader, CascaderOption, CascaderSize};

/// Cascader component example page
#[allow(non_snake_case)]
pub fn EntryCascader() -> Element {
    let mut selected = use_signal(|| Option::<Vec<String>>::None);

    let options = vec![
        CascaderOption {
            label: "浙江".to_string(),
            value: "zhejiang".to_string(),
            children: Some(vec![
                CascaderOption {
                    label: "杭州".to_string(),
                    value: "hangzhou".to_string(),
                    children: Some(vec![
                        CascaderOption {
                            label: "西湖区".to_string(),
                            value: "xihu".to_string(),
                            ..Default::default()
                        },
                        CascaderOption {
                            label: "滨江区".to_string(),
                            value: "binjiang".to_string(),
                            ..Default::default()
                        },
                        CascaderOption {
                            label: "余杭区".to_string(),
                            value: "yuhang".to_string(),
                            ..Default::default()
                        },
                    ]),
                    ..Default::default()
                },
                CascaderOption {
                    label: "宁波".to_string(),
                    value: "ningbo".to_string(),
                    children: Some(vec![
                        CascaderOption {
                            label: "海曙区".to_string(),
                            value: "haishu".to_string(),
                            ..Default::default()
                        },
                        CascaderOption {
                            label: "江北区".to_string(),
                            value: "jiangbei".to_string(),
                            ..Default::default()
                        },
                    ]),
                    ..Default::default()
                },
                CascaderOption {
                    label: "温州".to_string(),
                    value: "wenzhou".to_string(),
                    children: Some(vec![
                        CascaderOption {
                            label: "鹿城区".to_string(),
                            value: "lucheng".to_string(),
                            ..Default::default()
                        },
                        CascaderOption {
                            label: "龙湾区".to_string(),
                            value: "longwan".to_string(),
                            ..Default::default()
                        },
                    ]),
                    ..Default::default()
                },
            ]),
            ..Default::default()
        },
        CascaderOption {
            label: "江苏".to_string(),
            value: "jiangsu".to_string(),
            children: Some(vec![
                CascaderOption {
                    label: "南京".to_string(),
                    value: "nanjing".to_string(),
                    children: Some(vec![
                        CascaderOption {
                            label: "玄武区".to_string(),
                            value: "xuanwu".to_string(),
                            ..Default::default()
                        },
                        CascaderOption {
                            label: "秦淮区".to_string(),
                            value: "qinhuai".to_string(),
                            ..Default::default()
                        },
                    ]),
                    ..Default::default()
                },
                CascaderOption {
                    label: "苏州".to_string(),
                    value: "suzhou".to_string(),
                    children: Some(vec![
                        CascaderOption {
                            label: "姑苏区".to_string(),
                            value: "gusu".to_string(),
                            ..Default::default()
                        },
                        CascaderOption {
                            label: "虎丘区".to_string(),
                            value: "huqiu".to_string(),
                            ..Default::default()
                        },
                    ]),
                    ..Default::default()
                },
            ]),
            ..Default::default()
        },
        CascaderOption {
            label: "广东".to_string(),
            value: "guangdong".to_string(),
            children: Some(vec![
                CascaderOption {
                    label: "广州".to_string(),
                    value: "guangzhou".to_string(),
                    children: Some(vec![
                        CascaderOption {
                            label: "天河区".to_string(),
                            value: "tianhe".to_string(),
                            ..Default::default()
                        },
                        CascaderOption {
                            label: "越秀区".to_string(),
                            value: "yuexiu".to_string(),
                            ..Default::default()
                        },
                    ]),
                    ..Default::default()
                },
                CascaderOption {
                    label: "深圳".to_string(),
                    value: "shenzhen".to_string(),
                    children: Some(vec![
                        CascaderOption {
                            label: "南山区".to_string(),
                            value: "nanshan".to_string(),
                            ..Default::default()
                        },
                        CascaderOption {
                            label: "福田区".to_string(),
                            value: "futian".to_string(),
                            ..Default::default()
                        },
                    ]),
                    ..Default::default()
                },
            ]),
            ..Default::default()
        },
    ];

    rsx! {
        Layout {
            current_route: crate::app::Route::EntryCascader {},
            h1 { class: ClassesBuilder::new().add(FontSize::X4xl).add(FontWeight::Bold).build(), "Cascader 级联选择器" }
            p { class: ClassesBuilder::new().add(TextColor::Secondary).build(), "带层级下拉的级联选择器，支持多级数据选择" }

            div { class: ClassesBuilder::new().add(Display::Grid).add(Gap::Gap6).add(Padding::P6).build(),
                div { class: ClassesBuilder::new().add_raw("component-card").add(Padding::P6).build(),
                    h3 { class: ClassesBuilder::new().add(MarginBottom::Mb4).add(FontSize::Lg).add(FontWeight::Semibold).build(), "基础用法" }
                    p { class: ClassesBuilder::new().add(MarginBottom::Mb4).add(TextColor::Secondary).build(), "点击展开多级菜单进行选择" }

                    Cascader {
                        placeholder: "请选择城市".to_string(),
                        size: CascaderSize::Md,
                        options: options.clone(),
                        on_change: move |values| selected.set(Some(values)),
                    }

                    if let Some(ref values) = selected() {
                        div {
                            class: ClassesBuilder::new().add(MarginBottom::Mb4).add(TextColor::Secondary).build(),
                            "已选值: {values.join(\" / \")}"
                        }
                    }
                }

                div { class: ClassesBuilder::new().add_raw("component-card").add(Padding::P6).build(),
                    h3 { class: ClassesBuilder::new().add(MarginBottom::Mb4).add(FontSize::Lg).add(FontWeight::Semibold).build(), "可清空" }
                    p { class: ClassesBuilder::new().add(MarginBottom::Mb4).add(TextColor::Secondary).build(), "显示清除按钮" }

                    Cascader {
                        placeholder: "请选择城市".to_string(),
                        size: CascaderSize::Md,
                        options: options.clone(),
                        allow_clear: true,
                        on_change: move |values| selected.set(Some(values)),
                    }
                }

                div { class: ClassesBuilder::new().add_raw("component-card").add(Padding::P6).build(),
                    h3 { class: ClassesBuilder::new().add(MarginBottom::Mb4).add(FontSize::Lg).add(FontWeight::Semibold).build(), "禁用状态" }
                    p { class: ClassesBuilder::new().add(MarginBottom::Mb4).add(TextColor::Secondary).build(), "禁用级联选择器" }

                    Cascader {
                        placeholder: "请选择城市".to_string(),
                        size: CascaderSize::Md,
                        options: options.clone(),
                        disabled: true,
                    }
                }

                div { class: ClassesBuilder::new().add_raw("component-card").add(Padding::P6).build(),
                    h3 { class: ClassesBuilder::new().add(MarginBottom::Mb4).add(FontSize::Lg).add(FontWeight::Semibold).build(), "不同尺寸" }
                    p { class: ClassesBuilder::new().add(MarginBottom::Mb4).add(TextColor::Secondary).build(), "提供小、中、大三种尺寸" }

                    div { class: ClassesBuilder::new().add_raw("demo-row").add(Gap::Gap4).build(),
                        Cascader {
                            placeholder: "小尺寸".to_string(),
                            size: CascaderSize::Sm,
                            options: options.clone(),
                        }
                        Cascader {
                            placeholder: "中尺寸".to_string(),
                            size: CascaderSize::Md,
                            options: options.clone(),
                        }
                        Cascader {
                            placeholder: "大尺寸".to_string(),
                            size: CascaderSize::Lg,
                            options: options.clone(),
                        }
                    }
                }
            }
        }
    }
}
