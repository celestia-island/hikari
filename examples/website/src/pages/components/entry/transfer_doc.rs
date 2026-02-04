// website/src/pages/components/entry/transfer_doc.rs
// Transfer component documentation page

use dioxus::prelude::*;

use crate::{app::Route, components::Layout};
use _components::{
    entry::{SelectChangeEvent, Transfer, TransferItem},
    layout::{Container, Section},
};
use _palette::classes::{ClassesBuilder, FontSize, FontWeight, MarginBottom, TextColor};

// Code examples as constants
const CODE_BASIC: &str = r#"let mut target_keys = use_signal(|| vec!["3".to_string()]);
let mut source_selected = use_signal(Vec::new);
let mut target_selected = use_signal(Vec::new);

Transfer {
    data: vec![
        TransferItem { item_key: "1".to_string(), label: "Item 1".to_string(), ..Default::default() },
        TransferItem { item_key: "2".to_string(), label: "Item 2".to_string(), ..Default::default() },
        TransferItem { item_key: "3".to_string(), label: "Item 3".to_string(), ..Default::default() },
    ],
    target_keys: target_keys(),
    source_selected_keys: source_selected(),
    target_selected_keys: target_selected(),
    on_select_change: move |event| {
        match event.list_type {
            0 => source_selected.set(event.keys),
            1 => target_selected.set(event.keys),
            _ => {}
        }
    },
    on_change: move |keys| target_keys.set(keys),
}"#;

const CODE_SEARCH: &str = r#"Transfer {
    data: vec![...],
    target_keys: target_keys(),
    source_selected_keys: source_selected(),
    target_selected_keys: target_selected(),
    show_search: true,
    titles: Some(["Available".to_string(), "Selected".to_string()]),
    on_select_change: move |event| { ... },
    on_change: move |keys| target_keys.set(keys),
}"#;

const CODE_ONE_WAY: &str = r#"Transfer {
    data: vec![...],
    target_keys: target_keys(),
    source_selected_keys: source_selected(),
    target_selected_keys: target_selected(),
    one_way: true,
    titles: Some(["Available".to_string(), "Selected".to_string()]),
    on_select_change: move |event| { ... },
    on_change: move |keys| target_keys.set(keys),
}"#;

#[allow(non_snake_case)]
pub fn TransferDoc() -> Element {
    let mut target_keys = use_signal(|| vec!["3".to_string(), "4".to_string()]);
    let mut source_selected = use_signal(Vec::new);
    let mut target_selected = use_signal(Vec::new);

    let mut target_keys2 = use_signal(Vec::new);
    let mut source_selected2 = use_signal(Vec::new);
    let mut target_selected2 = use_signal(Vec::new);

    let mut target_keys3 = use_signal(Vec::new);
    let mut source_selected3 = use_signal(Vec::new);
    let mut target_selected3 = use_signal(Vec::new);

    rsx! {
        Layout {
            current_route: Route::TransferDoc {},

            Container {
                // Page header
                div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                    h1 {
                        class: ClassesBuilder::new()
                            .add(FontSize::X4xl)
                            .add(FontWeight::Bold)
                            .add(MarginBottom::Mb2)
                            .build(),
                        "Transfer"
                    }
                    p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                        "Transfer component for moving items between two lists"
                    }
                }

                // Overview
                Section {
                    title: Some("Overview".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                        p {
                            "Transfer is a dual-list box component that allows users to move items between source and target lists. It supports:"
                        }
                        ul { class: ClassesBuilder::new().add_raw("pl-6").build(),
                            li { "One-way or two-way transfer" }
                            li { "Search functionality" }
                            li { "Custom titles" }
                            li { "Disabled state" }
                            li { "Select all functionality" }
                        }
                    }
                }

                // Basic Transfer
                Section {
                    title: Some("Basic Usage".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Simple Transfer"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Basic transfer with default settings"
                        }
                        div { class: ClassesBuilder::new().add_raw("p-6").build(),
                            Transfer {
                                data: vec![
                                    TransferItem { item_key: "1".to_string(), label: "Item 1".to_string(), ..Default::default() },
                                    TransferItem { item_key: "2".to_string(), label: "Item 2".to_string(), ..Default::default() },
                                    TransferItem { item_key: "3".to_string(), label: "Item 3".to_string(), ..Default::default() },
                                    TransferItem { item_key: "4".to_string(), label: "Item 4".to_string(), ..Default::default() },
                                    TransferItem { item_key: "5".to_string(), label: "Item 5".to_string(), ..Default::default() },
                                ],
                                target_keys: target_keys(),
                                source_selected_keys: source_selected(),
                                target_selected_keys: target_selected(),
                                titles: Some(["Source".to_string(), "Target".to_string()]),
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

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "With Search"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Transfer with search inputs enabled"
                        }
                        div { class: ClassesBuilder::new().add_raw("p-6").build(),
                            Transfer {
                                data: vec![
                                    TransferItem { item_key: "1".to_string(), label: "Item 1".to_string(), ..Default::default() },
                                    TransferItem { item_key: "2".to_string(), label: "Item 2".to_string(), ..Default::default() },
                                    TransferItem { item_key: "3".to_string(), label: "Item 3".to_string(), ..Default::default() },
                                    TransferItem { item_key: "4".to_string(), label: "Item 4".to_string(), ..Default::default() },
                                    TransferItem { item_key: "5".to_string(), label: "Item 5".to_string(), ..Default::default() },
                                ],
                                target_keys: target_keys2(),
                                source_selected_keys: source_selected2(),
                                target_selected_keys: target_selected2(),
                                show_search: true,
                                titles: Some(["Available".to_string(), "Selected".to_string()]),
                                on_select_change: move |event: SelectChangeEvent| {
                                    match event.list_type {
                                        0 => source_selected2.set(event.keys),
                                        1 => target_selected2.set(event.keys),
                                        _ => {}
                                    }
                                },
                                on_change: move |keys| target_keys2.set(keys),
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
                            "One-way Transfer"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Transfer with only one-way operation (to target)"
                        }
                        div { class: ClassesBuilder::new().add_raw("p-6").build(),
                            Transfer {
                                data: vec![
                                    TransferItem { item_key: "1".to_string(), label: "Item 1".to_string(), ..Default::default() },
                                    TransferItem { item_key: "2".to_string(), label: "Item 2".to_string(), ..Default::default() },
                                    TransferItem { item_key: "3".to_string(), label: "Item 3".to_string(), ..Default::default() },
                                    TransferItem { item_key: "4".to_string(), label: "Item 4".to_string(), ..Default::default() },
                                ],
                                target_keys: target_keys3(),
                                source_selected_keys: source_selected3(),
                                target_selected_keys: target_selected3(),
                                one_way: true,
                                titles: Some(["Available".to_string(), "Selected".to_string()]),
                                on_select_change: move |event: SelectChangeEvent| {
                                    match event.list_type {
                                        0 => source_selected3.set(event.keys),
                                        1 => target_selected3.set(event.keys),
                                        _ => {}
                                    }
                                },
                                on_change: move |keys| target_keys3.set(keys),
                            }
                        }
                    }
                }

                // Disabled Items
                Section {
                    title: Some("Disabled Items".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Individual Disabled Items"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Items can be individually disabled"
                        }
                        div { class: ClassesBuilder::new().add_raw("p-6").build(),
                            Transfer {
                                data: vec![
                                    TransferItem { item_key: "1".to_string(), label: "Item 1".to_string(), disabled: false, ..Default::default() },
                                    TransferItem { item_key: "2".to_string(), label: "Item 2".to_string(), disabled: true, ..Default::default() },
                                    TransferItem { item_key: "3".to_string(), label: "Item 3".to_string(), disabled: false, ..Default::default() },
                                    TransferItem { item_key: "4".to_string(), label: "Item 4".to_string(), disabled: true, ..Default::default() },
                                ],
                                target_keys: vec![],
                                source_selected_keys: vec![],
                                target_selected_keys: vec![],
                                titles: Some(["Source".to_string(), "Target".to_string()]),
                                on_select_change: |_| {},
                                on_change: |_| {},
                            }
                        }
                    }
                }

                // Disabled Transfer
                Section {
                    title: Some("Disabled Transfer".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

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
                            "Disabled transfer cannot be interacted with"
                        }
                        div { class: ClassesBuilder::new().add_raw("p-6").build(),
                            Transfer {
                                data: vec![
                                    TransferItem { item_key: "1".to_string(), label: "Item 1".to_string(), ..Default::default() },
                                    TransferItem { item_key: "2".to_string(), label: "Item 2".to_string(), ..Default::default() },
                                    TransferItem { item_key: "3".to_string(), label: "Item 3".to_string(), ..Default::default() },
                                ],
                                target_keys: vec!["2".to_string()],
                                source_selected_keys: vec![],
                                target_selected_keys: vec![],
                                disabled: true,
                                titles: Some(["Source".to_string(), "Target".to_string()]),
                                on_select_change: |_| {},
                                on_change: |_| {},
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
                            "Basic Transfer"
                        }
                        div { class: ClassesBuilder::new().add_raw("p-6").build(),
                            code { "{CODE_BASIC}" }
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
                            "With Search and Custom Titles"
                        }
                        div { class: ClassesBuilder::new().add_raw("p-6").build(),
                            code { "{CODE_SEARCH}" }
                        }
                    }

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb0).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "One-way Transfer"
                        }
                        div { class: ClassesBuilder::new().add_raw("p-6").build(),
                            code { "{CODE_ONE_WAY}" }
                        }
                    }
                }
            }
        }
    }
}
