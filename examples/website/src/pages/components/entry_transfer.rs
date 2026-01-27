// website/src/pages/components/entry_transfer.rs
// Transfer component example page

use dioxus::prelude::*;

use crate::components::Layout;
use _palette::classes::{ ClassesBuilder, Display, FontSize, FontWeight, Gap, MarginBottom, Padding, PaddingX, TextColor, };
use _components::{SelectChangeEvent, Transfer, TransferItem};

/// Transfer component example page
#[allow(non_snake_case)]
pub fn EntryTransfer() -> Element {
    let mut target_keys = use_signal(|| vec!["item3".to_string(), "item4".to_string()]);
    let mut source_selected = use_signal(Vec::new);
    let mut target_selected = use_signal(Vec::new);

    let all_data = vec![
        TransferItem {
            item_key: "item1".to_string(),
            label: "选项 1 - 基础样式".to_string(),
            ..Default::default()
        },
        TransferItem {
            item_key: "item2".to_string(),
            label: "选项 2 - 表单验证".to_string(),
            ..Default::default()
        },
        TransferItem {
            item_key: "item3".to_string(),
            label: "选项 3 - 数据绑定".to_string(),
            ..Default::default()
        },
        TransferItem {
            item_key: "item4".to_string(),
            label: "选项 4 - 事件处理".to_string(),
            ..Default::default()
        },
        TransferItem {
            item_key: "item5".to_string(),
            label: "选项 5 - 动画效果".to_string(),
            ..Default::default()
        },
        TransferItem {
            item_key: "item6".to_string(),
            label: "选项 6 - 响应式设计".to_string(),
            ..Default::default()
        },
        TransferItem {
            item_key: "item7".to_string(),
            label: "选项 7 - 无障碍访问".to_string(),
            ..Default::default()
        },
        TransferItem {
            item_key: "item8".to_string(),
            label: "选项 8 - 主题系统".to_string(),
            ..Default::default()
        },
        TransferItem {
            item_key: "item9".to_string(),
            label: "选项 9 - 国际化支持".to_string(),
            ..Default::default()
        },
        TransferItem {
            item_key: "item10".to_string(),
            label: "选项 10 - 性能优化".to_string(),
            ..Default::default()
        },
    ];

    rsx! {
        Layout {
            current_route: crate::app::Route::EntryTransfer {},
            h1 { class: ClassesBuilder::new().add(FontSize::X4xl).add(FontWeight::Bold).build(), "Transfer 穿梭框" }
            p { class: ClassesBuilder::new().add(TextColor::Secondary).build(), "在两个列表之间移动项目的穿梭框，支持搜索过滤" }

            div { class: ClassesBuilder::new().add(Display::Grid).add(Gap::Gap6).add(PaddingX::Px6).build(),
                div { class: ClassesBuilder::new().add_raw("component-card").add(Padding::P6).build(),
                    h3 { class: ClassesBuilder::new().add(MarginBottom::Mb4).add(FontSize::Lg).add(FontWeight::Semibold).build(), "基础用法" }
                    p { class: ClassesBuilder::new().add(TextColor::Secondary).build(), "点击移动按钮在左右列表间移动项目" }

                    Transfer {
                        data: all_data.clone(),
                        target_keys: target_keys(),
                        source_selected_keys: source_selected(),
                        target_selected_keys: target_selected(),
                        titles: Some(["可用选项".to_string(), "已选选项".to_string()]),
                        on_select_change: None,
                        on_change: None,
                    }
                }

                div { class: ClassesBuilder::new().add_raw("component-card").add(Padding::P6).build(),
                    h3 { class: ClassesBuilder::new().add(MarginBottom::Mb4).add(FontSize::Lg).add(FontWeight::Semibold).build(), "带搜索" }
                    p { class: ClassesBuilder::new().add(TextColor::Secondary).build(), "使用搜索功能过滤列表项" }

                    Transfer {
                        data: all_data.clone(),
                        target_keys: target_keys(),
                        source_selected_keys: source_selected(),
                        target_selected_keys: target_selected(),
                        titles: Some(["可用选项".to_string(), "已选选项".to_string()]),
                        show_search: true,
                        on_select_change: move |event: SelectChangeEvent| {
                            match event.list_type {
                                0 => source_selected.set(event.keys),
                                1 => target_selected.set(event.keys),
                                _ => {}
                            }
                        },
                        on_change: move |keys| target_keys.set(keys),
                    }
                }

                div { class: ClassesBuilder::new().add_raw("component-card").add(Padding::P6).build(),
                    h3 { class: ClassesBuilder::new().add(MarginBottom::Mb4).add(FontSize::Lg).add(FontWeight::Semibold).build(), "单向模式" }
                    p { class: ClassesBuilder::new().add(TextColor::Secondary).build(), "仅允许向目标列表移动项目" }

                    Transfer {
                        data: all_data.clone(),
                        target_keys: target_keys(),
                        source_selected_keys: source_selected(),
                        target_selected_keys: target_selected(),
                        titles: Some(["可用选项".to_string(), "已选选项".to_string()]),
                        one_way: true,
                        on_select_change: move |event: SelectChangeEvent| {
                            match event.list_type {
                                0 => source_selected.set(event.keys),
                                1 => target_selected.set(event.keys),
                                _ => {}
                            }
                        },
                        on_change: move |keys| target_keys.set(keys),
                    }
                }
            }
        }
    }
}
