// hi-components/src/basic/select.rs
// Custom Select component with Portal-based dropdown and FUI styling

use hikari_palette::classes::{ClassesBuilder, Display, Position, SelectClass};

use crate::platform;
use crate::{
    feedback::{
        ConditionalGlow, ConditionalGlowProps, Glow, GlowBlur, GlowColor, GlowIntensity, GlowProps,
    },
    portal::{
        PortalEntry, PortalMaskMode, PortalPositionStrategy, TriggerPlacement, generate_portal_id,
        use_portal,
    },
    prelude::*,
    styled::StyledComponent,
};

pub struct SelectComponent;

#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum SelectSize {
    #[default]
    Md,
    Sm,
    Lg,
}

#[define_props]
pub struct SelectOption {
    #[default]
    pub label: String,

    #[default]
    pub value: String,
}

#[define_props]
pub struct SelectProps {
    #[default]
    pub options: Vec<SelectOption>,

    #[default]
    pub placeholder: Option<String>,

    #[default]
    pub size: SelectSize,

    #[default]
    pub disabled: bool,

    #[default]
    pub class: String,

    #[default]
    pub value: Option<String>,

    #[default]
    pub on_change: Option<EventHandler<String>>,

    #[default(false)]
    pub glow: bool,
}

///
///
///
///
///
#[component]
pub fn Select(props: SelectProps) -> Element {
    let portal = use_portal();
    let internal_value = use_signal(|| props.value.clone().unwrap_or_default());
    let dropdown_id = use_signal(String::new);
    let open = use_signal(|| false);

    // Sync controlled value
    let controlled_value = props.value.clone();
    let internal_value_for_effect = internal_value.clone();
    use_effect(move || {
        if let Some(ref v) = controlled_value {
            internal_value_for_effect.set(v.clone());
        }
    });

    // Track open state from portal entries
    let entries = portal.entries.clone();
    let dropdown_id_sync = dropdown_id.clone();
    let open_sync = open.clone();
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
            open_sync.set(is_in_entries);
        }
    });

    let current_value = internal_value.get();
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

    let open_for_classes = open.clone();
    let trigger_classes = ClassesBuilder::new()
        .add_typed(SelectClass::SelectTrigger)
        .add_typed(size_class)
        .add_typed_if(SelectClass::Disabled, props.disabled)
        .add_typed_if(SelectClass::Open, open_for_classes.get())
        .add(&props.class)
        .build();

    // Build the options menu for sharing in the click handler
    let options_for_menu = props.options.clone();
    let on_change = props.on_change.clone();

    let open_for_click = open.clone();
    let dropdown_id_for_click = dropdown_id.clone();
    let portal_remove = portal.remove_entry.clone();
    let portal_add = portal.add_entry.clone();
    let internal_value_for_click = internal_value.clone();
    let dropdown_id_for_click2 = dropdown_id.clone();

    let portal_remove_for_kb = portal.remove_entry.clone();
    let dropdown_id_for_kb = dropdown_id.clone();
    let handle_keydown = move |e: KeyboardEvent| {
        if props.disabled {
            return;
        }
        match e.get_key() {
            Key::Escape => {
                let id = dropdown_id_for_kb.get();
                if !id.is_empty() {
                    portal_remove_for_kb.call(id);
                }
            }
            Key::ArrowDown | Key::ArrowUp => {
                e.prevent_default();
            }
            _ => {}
        }
    };

    let handle_trigger_click = move |e: MouseEvent| {
        e.stop_propagation();

        if props.disabled {
            return;
        }

        let current_open = open_for_click.get();

        if current_open {
            // Close
            let id = dropdown_id_for_click.get();
            if !id.is_empty() {
                portal_remove.call(id);
            }
        } else {
            // Open dropdown via Portal
            let id = generate_portal_id();
            dropdown_id_for_click.set(id.clone());

            // Get trigger rect for positioning
            let trigger_rect_opt = if let Some(target_el) =
                platform::get_target_element_from_event(e.client_x, e.client_y)
            {
                platform::get_bounding_rect_by_class_impl("hi-select-trigger", &target_el)
                    .map(|rect| (rect.x, rect.y, rect.width, rect.height))
            } else {
                None
            };

            let opts = options_for_menu.clone();
            let portal_inner = portal_remove.clone();
            let id_inner = id.clone();
            let internal_value_clone2 = internal_value_for_click.clone();
            let glow_for_options = props.glow;

            let menu_content = rsx! {
                div {
                    class: "hi-select-dropdown",
                    role: "listbox",
                    // Match trigger width via inline style if we have the rect
                    style: if let Some((_, _, w, _)) = trigger_rect_opt { format!("width: {w}px;") } else { "min-width: 100%;".to_string() },

                    for opt in opts.iter() {
                        {
                            let value = opt.value.clone();
                            let label = opt.label.clone();
                            let is_selected = value == *internal_value_clone2.read();
                            let value_for_click = value.clone();
                            let on_change_item = on_change.clone();
                            let portal_close = portal_inner.clone();
                            let id_close = id_inner.clone();

                            // Create click handler for this option
                            let internal_value_clone3 = internal_value_for_click.clone();
                            let click_handler = EventHandler::new(move |e: MouseEvent| {
                                e.stop_propagation();
                                internal_value_clone3.set(value_for_click.clone());
                                if let Some(handler) = on_change_item.as_ref() {
                                    handler.call(value_for_click.clone());
                                }
                                portal_close.call(id_close.clone());
                            });

                            let option_classes = if is_selected { "hi-select-option hi-select-option-selected" } else { "hi-select-option" };

                            let aria_selected = is_selected.to_string();

                            rsx! {
                                if glow_for_options {
                                    Glow {
                                        block: true,
                                        blur: crate::GlowBlur::Light,
                                        intensity: crate::GlowIntensity::Soft,
                                        div {
                                            class: option_classes,
                                            onclick: click_handler,
                                            role: "option",
                                            "aria-selected": "{aria_selected}",
                                            "{label}"
                                        }
                                    }
                                } else {
                                    div {
                                        class: option_classes,
                                        onclick: click_handler,
                                        role: "option",
                                        "aria-selected": "{aria_selected}",
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

            portal_add.call(entry);
        }
    };

    let is_open = open.get();
    let aria_expanded = if is_open { "true" } else { "false" };

    let wrapper_classes = ClassesBuilder::new()
        .add_typed(Position::Relative)
        .add_typed(Display::InlineBlock)
        .build();

    rsx! {
        div { class: wrapper_classes,
            ConditionalGlow {
                glow: props.glow,
                block: true,
                blur: GlowBlur::Light,
                color: GlowColor::Primary,
                intensity: GlowIntensity::Soft,

                div { class: trigger_classes, onclick: handle_trigger_click,
                    role: "combobox",
                    tabindex: "0",
                    "aria-expanded": "{aria_expanded}",
                    "aria-haspopup": "listbox",
                    onkeydown: handle_keydown,

                    span { class: if selected_label.is_some() { "hi-select-value" } else { "hi-select-placeholder" },
                        "{if let Some(label) = &selected_label { label.clone() } else { props.placeholder.clone().unwrap_or_else(|| \"请选择\".to_string()) }}"
                    }

                    span {
                        class: "hi-select-arrow",
                        dangerous_inner_html: r#"<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>"#,
                    }
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
