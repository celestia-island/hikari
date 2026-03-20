// hi-components/src/entry/cascader.rs
// Cascader component with Arknights + FUI styling

use crate::prelude::*;
use hikari_icons::{Icon, MdiIcon};
use hikari_palette::classes::{CascaderClass, ClassesBuilder, UtilityClass};

use crate::styled::StyledComponent;

pub struct CascaderComponent;

#[derive(Clone, PartialEq, Debug, Default)]
pub struct CascaderOption {
    pub label: String,
    pub value: String,
    pub children: Option<Vec<CascaderOption>>,
    pub disabled: bool,
}

#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum CascaderSize {
    #[default]
    Md,
    Sm,
    Lg,
}

#[define_props]
pub struct CascaderProps {
    pub options: Vec<CascaderOption>,

    pub value: Option<Vec<String>>,

    pub placeholder: Option<String>,

    pub size: CascaderSize,

    pub disabled: bool,

    pub allow_clear: bool,

    pub class: String,

    pub on_change: Option<EventHandler<Vec<String>>>,
}

///
///
///
///
#[component]
pub fn Cascader(props: CascaderProps) -> Element {
    let is_open = use_signal(|| false);
    let selected_values = use_signal(|| props.value.clone().unwrap_or_default());
    let options = props.options.clone();
    let active_level = use_signal(|| 0);
    let focused_index = use_signal(|| 0);

    let size_class = match props.size {
        CascaderSize::Sm => CascaderClass::Sm,
        CascaderSize::Md => CascaderClass::Md,
        CascaderSize::Lg => CascaderClass::Lg,
    };

    // Clone signals for handle_keydown
    let is_open_for_keydown = is_open.clone();
    let focused_index_for_keydown = focused_index.clone();
    let options_for_keydown = options.clone();
    let handle_keydown = move |e: KeyboardEvent| {
        if props.disabled {
            return;
        }

        match e.key_code() {
            Key::Enter => {
                e.prevent_default();
                is_open_for_keydown.set(!is_open_for_keydown.get());
                if is_open_for_keydown.get() {
                    focused_index_for_keydown.set(0);
                }
            }
            Key::Escape => {
                is_open_for_keydown.set(false);
            }
            Key::ArrowDown if is_open_for_keydown.get() => {
                e.prevent_default();
                let current = focused_index_for_keydown.get();
                let total = options_for_keydown.len();
                focused_index_for_keydown.set((current + 1) % total);
            }
            Key::ArrowUp if is_open_for_keydown.get() => {
                e.prevent_default();
                let current = focused_index_for_keydown.get();
                let total = options_for_keydown.len();
                focused_index_for_keydown.set((current + total - 1) % total);
            }
            _ => {}
        }
    };

    // Clone signals for handle_click
    let is_open_for_click = is_open.clone();
    let handle_click = move |e: MouseEvent| {
        if !props.disabled {
            e.stop_propagation();
            is_open_for_click.set(!is_open_for_click.get());
        }
    };

    // Clone signals for handle_select
    let selected_values_for_select = selected_values.clone();
    let active_level_for_select = active_level.clone();
    let is_open_for_select = is_open.clone();
    let on_change_for_select = props.on_change.clone();
    let options_for_select = options.clone();
    let handle_select = EventHandler::new(move |value: String| {
        let mut new_values = selected_values_for_select.get().clone();

        new_values.push(value);

        selected_values_for_select.set(new_values.clone());
        active_level_for_select.set(new_values.len());

        let has_children = find_option_by_path(&options_for_select, &new_values)
            .and_then(|opt| opt.children.as_ref())
            .map(|c| !c.is_empty())
            .unwrap_or(false);

        if !has_children {
            is_open_for_select.set(false);

            if let Some(handler) = on_change_for_select.as_ref() {
                handler.call(new_values);
            }
        }
    });

    // Clone signals for handle_clear
    let selected_values_for_clear = selected_values.clone();
    let active_level_for_clear = active_level.clone();
    let on_change_for_clear = props.on_change.clone();
    let handle_clear = move |e: MouseEvent| {
        e.stop_propagation();
        selected_values_for_clear.set(Vec::new());
        active_level_for_clear.set(0);

        if let Some(handler) = on_change_for_clear.as_ref() {
            handler.call(Vec::new());
        }
    };

    let selected_values_for_display = selected_values.clone();
    let display_text = if selected_values_for_display.get().is_empty() {
        props
            .placeholder
            .clone()
            .unwrap_or_else(|| "Please select".to_string())
    } else {
        selected_values_for_display.get()
            .iter()
            .filter_map(|v| find_option_by_value(&props.options, v))
            .map(|opt| opt.label.clone())
            .collect::<Vec<_>>()
            .join(" / ")
    };

    let is_open_for_close = is_open.clone();
    let _close_dropdown = move |_: Event| {
        is_open_for_close.set(false);
    };

    let is_open_for_classes = is_open.clone();
    let selected_values_for_clear_check = selected_values.clone();
    rsx! {
        div { class: CascaderClass::Wrapper.as_class(),
            div {
                class: ClassesBuilder::new()
                    .add(CascaderClass::Cascader)
                    .add(size_class)
                    .add_if(CascaderClass::Disabled, || props.disabled)
                    .add_if(CascaderClass::Open, move || is_open_for_classes.get())
                    .add_raw(&props.class)
                    .build(),

                onclick: handle_click,
                onkeydown: handle_keydown,
                tabindex: 0,

                div { class: CascaderClass::Display.as_class(),
                    div { class: CascaderClass::Text.as_class(),
                        "{display_text}"
                    }

                    if props.allow_clear && !selected_values_for_clear_check.get().is_empty() && !props.disabled {
                        div {
                            class: CascaderClass::Clear.as_class(),
                            onclick: handle_clear,
                            Icon {
                                icon: MdiIcon::Close,
                                size: 14,
                            }
                        }
                    }

                    Icon {
                        icon: MdiIcon::ChevronDown,
                        size: 16,
                        class: CascaderClass::Arrow.as_class(),
                    }
                }
            }

            if is_open.get() {
                div {
                    class: CascaderClass::Dropdown.as_class(),
                    onclick: |e: MouseEvent| e.stop_propagation(),

                    CascaderMenus {
                        options: Some(props.options.clone()),
                        selected_values: Some(selected_values.get()),
                        active_level: Some(active_level.get()),
                        on_select: Some(handle_select),
                    }
                }
            }
        }
    }
}

#[component]
fn CascaderMenus(
    options: Vec<CascaderOption>,
    selected_values: Vec<String>,
    active_level: usize,
    #[props(default)]
    on_select: Option<EventHandler<String>>,
) -> Element {
    let mut level = 0;
    let mut current_options = Some(options);

    let mut menus = Vec::new();

    while let Some(opts) = current_options {
        // Only show menus up to and including the active level
        if level > active_level {
            break;
        }
        let opts_clone = opts.clone();
        let selected_at_level = selected_values.get(level).cloned();

        // Pre-compute menu items outside of rsx! macro
        let menu_items: Vec<Element> = opts_clone
            .iter()
            .enumerate()
            .map(|(idx, opt)| {
                let opt_value = opt.value.clone();
                let opt_label = opt.label.clone();
                let opt_disabled = opt.disabled;
                let has_children = opt.children.as_ref().map(|c| !c.is_empty()).unwrap_or(false);
                let is_selected = selected_at_level.as_ref() == Some(&opt_value);
                let handler_for_item = on_select.clone();

                // Pre-compute the optional icon
                let arrow_icon: Option<Element> = if has_children {
                    Some(rsx! {
                        Icon {
                            icon: MdiIcon::ChevronRight,
                            size: 14,
                            class: CascaderClass::MenuItemArrow.as_class(),
                        }
                    })
                } else {
                    None
                };

                let item_class = ClassesBuilder::new()
                    .add(CascaderClass::MenuItem)
                    .add_if(CascaderClass::MenuItemSelected, || is_selected)
                    .add_if(CascaderClass::MenuItemDisabled, || opt_disabled)
                    .build();

                rsx! {
                    li {
                        key: format!("item-{}-{}", level, idx),
                        class: item_class,

                        onclick: move |_| {
                            if !opt_disabled {
                                if let Some(handler) = handler_for_item.as_ref() {
                                    handler.call(opt_value.clone());
                                }
                            }
                        },

                        "{opt_label}"

                        if let Some(icon) = arrow_icon {
                            { icon }
                        }
                    }
                }
            })
            .collect();

        menus.push(rsx! {
            div {
                class: CascaderClass::Menu.as_class(),
                key: format!("menu-{}", level),
                ul { class: CascaderClass::MenuList.as_class(),
                    ..menu_items
                }
            }
        });

        if let Some(selected_val) = selected_at_level {
            let found = opts.iter().find(|o| o.value == selected_val);
            current_options = found.and_then(|o| o.children.clone());
        } else {
            current_options = None;
        }

        level += 1;

        if level > 10 {
            break;
        }
    }

    VNode::Fragment(menus)
}

fn find_option_by_value<'a>(
    options: &'a [CascaderOption],
    value: &str,
) -> Option<&'a CascaderOption> {
    for opt in options {
        if opt.value == value {
            return Some(opt);
        }
        if let Some(ref children) = opt.children
            && let Some(found) = find_option_by_value(children, value)
        {
            return Some(found);
        }
    }
    None
}

fn find_option_by_path<'a>(
    options: &'a [CascaderOption],
    path: &[String],
) -> Option<&'a CascaderOption> {
    if path.is_empty() {
        return None;
    }

    let first = path.first()?;
    let opt = options.iter().find(|o| o.value == *first)?;

    if path.len() == 1 {
        return Some(opt);
    }

    if let Some(ref children) = opt.children {
        find_option_by_path(children, &path[1..])
    } else {
        None
    }
}

impl StyledComponent for CascaderComponent {
    fn styles() -> &'static str {
        include_str!(concat!(env!("OUT_DIR"), "/styles/cascader.css"))
    }

    fn name() -> &'static str {
        "cascader"
    }
}
