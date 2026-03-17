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

#[derive(Clone, PartialEq, Props)]
pub struct CascaderProps {
    pub options: Vec<CascaderOption>,

    #[props(default)]
    pub value: Option<Vec<String>>,

    #[props(default)]
    pub placeholder: Option<String>,

    #[props(default)]
    pub size: CascaderSize,

    #[props(default)]
    pub disabled: bool,

    #[props(default)]
    pub allow_clear: bool,

    #[props(default)]
    pub class: String,

    pub on_change: Option<EventHandler<Vec<String>>>,
}

///
///
///
///
#[component]
pub fn Cascader(props: CascaderProps) -> Element {
    let mut is_open = use_signal(|| false);
    let mut selected_values = use_signal(|| props.value.clone().unwrap_or_default());
    let options = props.options.clone();
    let mut active_level = use_signal(|| 0);
    let mut focused_index = use_signal(|| 0);

    let size_class = match props.size {
        CascaderSize::Sm => CascaderClass::Sm,
        CascaderSize::Md => CascaderClass::Md,
        CascaderSize::Lg => CascaderClass::Lg,
    };

    let handle_keydown = move |e: KeyboardEvent| {
        if props.disabled {
            return;
        }

        match e.key_code() {
            Key::Enter => {
                e.prevent_default();
                is_open.set(!is_open.get());
                if is_open.get() {
                    focused_index.set(0);
                }
            }
            Key::Escape => {
                is_open.set(false);
            }
            Key::ArrowDown if is_open.get() => {
                e.prevent_default();
                let current = focused_index.get();
                let total = options.len();
                focused_index.set((current + 1) % total);
            }
            Key::ArrowUp if is_open.get() => {
                e.prevent_default();
                let current = focused_index.get();
                let total = options.len();
                focused_index.set((current + total - 1) % total);
            }
            _ => {}
        }
    };

    let handle_click = move |e: MouseEvent| {
        if !props.disabled {
            e.stop_propagation();
            is_open.set(!is_open.get());
        }
    };

    let options = props.options.clone();
    let handle_select = EventHandler::new(move |value: String| {
        let mut new_values = selected_values.get().clone();

        new_values.push(value);

        selected_values.set(new_values.clone());
        active_level.set(new_values.len());

        let has_children = find_option_by_path(&options, &new_values)
            .and_then(|opt| opt.children.as_ref())
            .map(|c| !c.is_empty())
            .unwrap_or(false);

        if !has_children {
            is_open.set(false);

            if let Some(handler) = props.on_change.as_ref() {
                handler.call(new_values);
            }
        }
    });

    let handle_clear = move |e: MouseEvent| {
        e.stop_propagation();
        selected_values.set(Vec::new());
        active_level.set(0);

        if let Some(handler) = props.on_change.as_ref() {
            handler.call(Vec::new());
        }
    };

    let display_text = if selected_values.get().is_empty() {
        props
            .placeholder
            .clone()
            .unwrap_or_else(|| "Please select".to_string())
    } else {
        selected_values.get()
            .iter()
            .filter_map(|v| find_option_by_value(&props.options, v))
            .map(|opt| opt.label.clone())
            .collect::<Vec<_>>()
            .join(" / ")
    };

    let _close_dropdown = move |_: Event<()>| {
        is_open.set(false);
    };

    rsx! {
        div { class: "{CascaderClass::Wrapper.as_class()}",
            div {
                class: ClassesBuilder::new()
                    .add(CascaderClass::Cascader)
                    .add(size_class)
                    .add_if(CascaderClass::Disabled, || props.disabled)
                    .add_if(CascaderClass::Open, move || is_open.get())
                    .add_raw(&props.class)
                    .build(),

                onclick: handle_click,
                onkeydown: handle_keydown,
                tabindex: 0,

                div { class: "{CascaderClass::Display.as_class()}",
                    div { class: "{CascaderClass::Text.as_class()}",
                        "{display_text}"
                    }

                    if props.allow_clear && !selected_values.get().is_empty() && !props.disabled {
                        div {
                            class: "{CascaderClass::Clear.as_class()}",
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
                        class: "{CascaderClass::Arrow.as_class()}",
                    }
                }
            }

            if is_open.get() {
                div {
                    class: "{CascaderClass::Dropdown.as_class()}",
                    onclick: |e| e.stop_propagation(),

                    CascaderMenus {
                        options: props.options.clone(),
                        selected_values: selected_values.get(),
                        active_level: active_level.get(),
                        on_select: handle_select,
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
    on_select: EventHandler<String>,
) -> Element {
    let mut level = 0;
    let mut current_options = Some(options);

    let mut menus = Vec::new();

    while let Some(opts) = current_options {
        let opts_clone = opts.clone();
        let selected_at_level = selected_values.get(level).cloned();

        menus.push(rsx! {
            div { class: "{CascaderClass::Menu.as_class()}",
                ul { class: "{CascaderClass::MenuList.as_class()}",
                    {opts_clone.iter().map(|opt| {
                         let opt_value = opt.value.clone();
                        let _opt_label = opt.label.clone();
                        let opt_disabled = opt.disabled;
                        let has_children = opt.children.as_ref().map(|c| !c.is_empty()).unwrap_or(false);
                        let is_selected = selected_at_level.as_ref() == Some(&opt_value);
                        let handler_for_item = on_select;

                        rsx! {
                            li {
                                class: ClassesBuilder::new()
                                    .add(CascaderClass::MenuItem)
                                    .add_if(CascaderClass::MenuItemSelected, || is_selected)
                                    .add_if(CascaderClass::MenuItemDisabled, || opt_disabled)
                                    .build(),

                                onclick: move |_| {
                                    if !opt_disabled {
                                        handler_for_item.call(opt_value.clone());
                                    }
                                },

                                "{opt.label}"

                                if has_children {
                                    Icon {
                                        icon: MdiIcon::ChevronRight,
                                        size: 14,
                                        class: "{CascaderClass::MenuItemArrow.as_class()}",
                                    }
                                }
                            }
                        }
                    })}
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

    rsx! {
        {menus.into_iter()}
    }
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
