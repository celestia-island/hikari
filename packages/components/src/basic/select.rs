// hi-components/src/basic/select.rs
// Custom Select component with Portal-based dropdown and FUI styling

use dioxus::prelude::*;
use palette::classes::{ClassesBuilder, Display, Position, SelectClass};
#[cfg(target_arch = "wasm32")]
use wasm_bindgen::JsCast;

use crate::{
    glow::Glow,
    portal::{
        generate_portal_id, use_portal, PortalEntry, PortalMaskMode, PortalPositionStrategy,
        TriggerPlacement,
    },
    styled::StyledComponent,
};

/// Select 组件的类型包装器（用于实现 StyledComponent）
pub struct SelectComponent;

#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum SelectSize {
    #[default]
    Md,
    Sm,
    Lg,
}

#[derive(Clone, PartialEq, Props, Default)]
pub struct SelectOption {
    pub label: String,
    pub value: String,
}

#[derive(Clone, PartialEq, Props, Default)]
pub struct SelectProps {
    #[props(default)]
    pub options: Vec<SelectOption>,

    #[props(default)]
    pub placeholder: Option<String>,

    #[props(default)]
    pub size: SelectSize,

    #[props(default)]
    pub disabled: bool,

    #[props(default)]
    pub class: String,

    /// Current selected value (controlled mode)
    #[props(default)]
    pub value: Option<String>,

    #[props(default)]
    pub on_change: Option<EventHandler<String>>,
}

/// Custom Select component with Portal-based dropdown and FUI styling
///
/// Uses the Portal system to render dropdown options as an overlay layer,
/// ensuring proper z-index stacking and click-outside-to-close behavior.
///
/// # Examples
///
/// ```rust
/// use dioxus::prelude::*;
/// use hikari_components::{Select, SelectOption, SelectSize};
///
/// fn app() -> Element {
///     let mut selected = use_signal(|| String::new());
///
///     rsx! {
///         Select {
///             placeholder: "Select an option".to_string(),
///             size: SelectSize::Md,
///             options: vec![
///                 SelectOption { label: "Option 1".to_string(), value: "1".to_string() },
///                 SelectOption { label: "Option 2".to_string(), value: "2".to_string() },
///             ],
///             on_change: move |value| selected.set(value),
///         }
///     }
/// }
/// ```
#[component]
pub fn Select(props: SelectProps) -> Element {
    let portal = use_portal();
    let mut internal_value = use_signal(|| props.value.clone().unwrap_or_default());
    let mut dropdown_id = use_signal(String::new);
    let open = use_signal(|| false);

    // Sync controlled value
    let controlled_value = props.value.clone();
    use_effect(move || {
        if let Some(ref v) = controlled_value {
            internal_value.set(v.clone());
        }
    });

    // Track open state from portal entries
    let entries = portal.entries;
    let dropdown_id_sync = dropdown_id;
    let open_sync = open;
    use_effect(move || {
        let current_id = dropdown_id_sync.read();
        if !current_id.is_empty() {
            let is_in_entries = entries.read().iter().any(|entry| {
                if let PortalEntry::Dropdown { id, .. } = entry {
                    id == &*current_id
                } else {
                    false
                }
            });
            let mut open_ref = open_sync;
            open_ref.set(is_in_entries);
        }
    });

    let current_value = internal_value();
    let selected_label = props
        .options
        .iter()
        .find(|o| o.value == current_value)
        .map(|o| o.label.clone());

    let size_class = match props.size {
        SelectSize::Sm => SelectClass::Sm,
        SelectSize::Md => SelectClass::Md,
        SelectSize::Lg => SelectClass::Lg,
    };

    let trigger_classes = ClassesBuilder::new()
        .add(SelectClass::SelectTrigger)
        .add(size_class)
        .add_if(SelectClass::Disabled, || props.disabled)
        .add_if(SelectClass::Open, move || open())
        .add_raw(&props.class)
        .build();

    // Build the options menu for sharing in the click handler
    let options_for_menu = props.options.clone();
    let on_change = props.on_change;

    let handle_trigger_click = move |e: MouseEvent| {
        e.stop_propagation();

        if props.disabled {
            return;
        }

        let current_open = open();

        if current_open {
            // Close
            let id = dropdown_id();
            if !id.is_empty() {
                portal.remove_entry.call(id);
            }
        } else {
            // Open dropdown via Portal
            let id = generate_portal_id();
            dropdown_id.set(id.clone());

            // Get trigger rect for positioning
            let trigger_rect_opt = {
                #[cfg(target_arch = "wasm32")]
                {
                    if let Some(web_event) = e.downcast::<web_sys::MouseEvent>() {
                        if let Some(target) = web_event.target() {
                            if let Some(element) = target.dyn_ref::<web_sys::Element>() {
                                let trigger_el = element
                                    .closest(".hi-select-trigger")
                                    .ok()
                                    .flatten()
                                    .unwrap_or_else(|| element.clone());
                                if let Some(html_el) = trigger_el.dyn_ref::<web_sys::HtmlElement>()
                                {
                                    let rect = html_el.get_bounding_client_rect();
                                    Some((rect.x(), rect.y(), rect.width(), rect.height()))
                                } else {
                                    None
                                }
                            } else {
                                None
                            }
                        } else {
                            None
                        }
                    } else {
                        None
                    }
                }

                #[cfg(not(target_arch = "wasm32"))]
                {
                    None::<(f64, f64, f64, f64)>
                }
            };

            let opts = options_for_menu.clone();
            let on_change_inner = on_change;
            let portal_inner = portal.clone();
            let id_inner = id.clone();
            let internal_value_clone2 = internal_value;

            let menu_content = rsx! {
                div {
                    class: "hi-select-dropdown",
                    // Match trigger width via inline style if we have the rect
                    style: if let Some((_, _, w, _)) = trigger_rect_opt { format!("width: {w}px;") } else { String::new() },

                    for opt in opts.iter() {
                        {
                            let value = opt.value.clone();
                            let label = opt.label.clone();
                            let is_selected = value == *internal_value_clone2.read();
                            let value_for_click = value.clone();
                            let on_change_item = on_change_inner;
                            let portal_close = portal_inner.clone();
                            let id_close = id_inner.clone();

                            // Create click handler for this option
                            let mut internal_value_clone3 = internal_value;
                            let click_handler = EventHandler::new(move |e: MouseEvent| {
                                e.stop_propagation();
                                internal_value_clone3.set(value_for_click.clone());
                                if let Some(handler) = on_change_item.as_ref() {
                                    handler.call(value_for_click.clone());
                                }
                                portal_close.remove_entry.call(id_close.clone());
                            });

                            rsx! {
                                Glow {
                                    block: true,
                                    blur: crate::GlowBlur::Light,
                                    intensity: crate::GlowIntensity::Soft,

                                    div {
                                        class: if is_selected { "hi-select-option hi-select-option-selected" } else { "hi-select-option" },
                                        onclick: click_handler,
                                        "{label}"
                                    }
                                }
                            }
                        }
                    }
                }
            };

            let entry = PortalEntry::Dropdown {
                id,
                strategy: PortalPositionStrategy::TriggerBased {
                    placement: TriggerPlacement::BottomLeft,
                },
                mask_mode: PortalMaskMode::Transparent,
                children: menu_content,
                trigger_rect: trigger_rect_opt,
                close_on_select: true,
            };

            portal.add_entry.call(entry);
        }
    };

    let wrapper_classes = ClassesBuilder::new()
        .add(Position::Relative)
        .add(Display::InlineBlock)
        .build();

    rsx! {
        div { class: "{wrapper_classes}",

            div { class: "{trigger_classes}", onclick: handle_trigger_click,

                span { class: if selected_label.is_some() { "hi-select-value" } else { "hi-select-placeholder" },
                    {
                        if let Some(label) = &selected_label {
                            label.clone()
                        } else {
                            props.placeholder.clone().unwrap_or_else(|| "请选择".to_string())
                        }
                    }
                }

                // Chevron arrow
                span {
                    class: "hi-select-arrow",
                    dangerous_inner_html: r#"<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>"#,
                }
            }
        }
    }
}

impl StyledComponent for SelectComponent {
    fn styles() -> &'static str {
        include_str!(concat!(env!("OUT_DIR"), "/styles/select.css"))
    }

    fn name() -> &'static str {
        "select"
    }
}
