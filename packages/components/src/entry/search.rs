// packages/components/src/entry/search.rs
// Search component
// Features: Embedded icons/buttons, unified input styling, Glow effects
// Uses InputWrapper for consistent layout and Portal system for dropdown suggestions

#![allow(clippy::needless_update)]

use hikari_icons::{Icon, MdiIcon};
use hikari_palette::classes::{ClassesBuilder, SearchClass};

use crate::basic::{InputWrapper, InputWrapperItem, InputWrapperSize};
use crate::feedback::{GlowBlur, GlowColor, GlowIntensity};
use crate::portal::{
    PortalEntry, PortalMaskMode, PortalPositionStrategy, TriggerPlacement, generate_portal_id,
    use_portal,
};
use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct SearchComponent;

#[define_props]
pub struct SearchProps {
    pub value: String,
    pub placeholder: String,
    #[default(false)]
    pub disabled: bool,
    #[default(false)]
    pub loading: bool,
    #[default(true)]
    pub allow_clear: bool,
    pub suggestions: Vec<String>,
    #[default(EventHandler::new(|_| {}))]
    pub on_search: EventHandler<String>,
    pub on_clear: Option<EventHandler<()>>,
    pub on_suggestion_click: Option<EventHandler<String>>,
    pub class: String,
    pub style: String,
    #[default(true)]
    pub glow: bool,
}

#[component]
pub fn Search(props: SearchProps) -> Element {
    let mut value_signal = use_signal(|| props.value.clone());
    let mut dropdown_id = use_signal(String::new);
    #[allow(unused_mut)]
    let mut container_rect = use_signal(|| None::<(f64, f64, f64, f64)>);
    let portal = use_portal();

    let wrapper_classes = ClassesBuilder::new()
        .add_typed(SearchClass::Wrapper)
        .add(&props.class)
        .build();

    let current_value = value_signal.get();

    let filtered_suggestions: Vec<String> = if current_value.is_empty() {
        props.suggestions.clone()
    } else {
        props
            .suggestions
            .iter()
            .filter(|s| s.to_lowercase().contains(&current_value.to_lowercase()))
            .cloned()
            .collect()
    };

    let has_clear_button = props.allow_clear && !current_value.is_empty() && !props.disabled;
    let has_suggestions = !filtered_suggestions.is_empty() && !current_value.is_empty();

    let left_items = vec![InputWrapperItem::icon(MdiIcon::Magnify)];

    let mut right_items: Vec<InputWrapperItem> = Vec::new();

    if props.loading {
        right_items.push(InputWrapperItem::icon(MdiIcon::Loading));
    } else if has_clear_button {
        // Clone for clear button
        let value_signal_for_clear = value_signal.clone();
        let dropdown_id_for_clear = dropdown_id.clone();
        let portal_for_clear = portal.clone();
        let on_clear_for_clear = props.on_clear.clone();

        right_items.push(InputWrapperItem::button(
            MdiIcon::Close,
            EventHandler::new(move |_| {
                value_signal_for_clear.set(String::new());
                let id = dropdown_id_for_clear.get();
                if !id.is_empty() {
                    portal_for_clear.remove_entry.call(id);
                }
                if let Some(ref on_clear) = on_clear_for_clear {
                    on_clear.call(());
                }
            }),
        ));
    } else {
        // Clone for search button
        let value_signal_for_search_btn = value_signal.clone();
        let dropdown_id_for_search_btn = dropdown_id.clone();
        let portal_for_search_btn = portal.clone();
        let on_search_for_btn = props.on_search.clone();

        right_items.push(InputWrapperItem::button(
            MdiIcon::ArrowRight,
            EventHandler::new(move |_| {
                let id = dropdown_id_for_search_btn.get();
                if !id.is_empty() {
                    portal_for_search_btn.remove_entry.call(id);
                }
                on_search_for_btn.call(value_signal_for_search_btn.get());
            }),
        ));
    }

    // Clone for input handlers - each handler needs its own clones
    // Clones for onfocus handler
    let value_signal_for_onfocus = value_signal.clone();
    let dropdown_id_for_onfocus = dropdown_id.clone();
    let container_rect_for_onfocus = container_rect.clone();
    let portal_for_onfocus = portal.clone();
    let on_search_for_onfocus = props.on_search.clone();
    let on_suggestion_click_for_onfocus = props.on_suggestion_click.clone();
    let has_suggestions_for_onfocus = has_suggestions;
    let filtered_suggestions_for_onfocus = filtered_suggestions.clone();

    // Clones for oninput handler
    let value_signal_for_oninput = value_signal.clone();
    let on_search_for_oninput = props.on_search.clone();

    // Clones for onkeydown handler
    let dropdown_id_for_onkeydown = dropdown_id.clone();
    let portal_for_onkeydown = portal.clone();

    let input_element = rsx! {
        div { class: "hi-search-input-container",
            input {
                r#type: "search",
                value: "{current_value}",
                placeholder: props.placeholder,
                disabled: props.disabled,
                onfocus: move |_| {
                    if has_suggestions_for_onfocus {
                        let trigger_rect_opt = container_rect_for_onfocus.read();

                        let id = dropdown_id_for_onfocus.get();
                        if !id.is_empty() {
                            portal_for_onfocus.remove_entry.call(id.clone());
                        }

                        let new_id = generate_portal_id();
                        dropdown_id_for_onfocus.set(new_id.clone());

                        let suggestions_for_dropdown = filtered_suggestions_for_onfocus.clone();
                        let on_search = on_search_for_onfocus.clone();
                        let on_suggestion_click = on_suggestion_click_for_onfocus.clone();
                        let portal_remove = portal_for_onfocus.remove_entry.clone();
                        let value_signal_for_dropdown = value_signal_for_onfocus.clone();

                        let dropdown_content = rsx! {
                            div { class: "hi-search-suggestions-dropdown",
                                for suggestion in suggestions_for_dropdown.iter() {
                                    {
                                        let suggestion_value = suggestion.clone();
                                        let suggestion_for_click = suggestion.clone();
                                        let suggestion_for_search = suggestion.clone();
                                        let suggestion_for_handler = suggestion.clone();
                                        let id_close = new_id.clone();
                                        // Clone for this iteration's onclick handler
                                        let value_signal_for_item = value_signal_for_dropdown.clone();
                                        let on_suggestion_click_for_item = on_suggestion_click.clone();
                                        let on_search_for_item = on_search.clone();
                                        let portal_remove_for_item = portal_remove.clone();
                                        rsx! {
                                            div {
                                                class: "hi-search-suggestion-item",
                                                onclick: move |e: MouseEvent| {
                                                    e.stop_propagation();
                                                    value_signal_for_item.set(suggestion_for_click.clone());
                                                    if let Some(ref handler) = on_suggestion_click_for_item {
                                                        handler.call(suggestion_for_handler.clone());
                                                    }
                                                    on_search_for_item.call(suggestion_for_search.clone());
                                                    portal_remove_for_item.call(id_close.clone());
                                                },
                                                Icon {
                                                    icon: MdiIcon::Magnify,
                                                    size: 14,
                                                    class: "hi-search-suggestion-icon".to_string(),
                                                    color: String::new(),
                                                }
                                                span { "{suggestion_value}" }
                                            }
                                        }
                                    }
                                }
                            }
                        };

                        portal_for_onfocus
                            .add_entry
                            .call(PortalEntry::Dropdown {
                                id: new_id,
                                strategy: PortalPositionStrategy::TriggerBased {
                                    placement: TriggerPlacement::BottomLeft,
                                },
                                mask_mode: PortalMaskMode::Transparent,
                                children: dropdown_content,
                                trigger_rect: trigger_rect_opt,
                                close_on_select: true,
                            });
                    }
                },
                oninput: move |e: InputEvent| {
                    let new_value = e.data.clone();
                    value_signal_for_oninput.set(new_value.clone());
                    on_search_for_oninput.call(new_value);
                },
                onkeydown: move |e: KeyboardEvent| {
                    if e.get_key() == Key::Escape {
                        let id = dropdown_id_for_onkeydown.get();
                        if !id.is_empty() {
                            portal_for_onkeydown.remove_entry.call(id);
                        }
                    }
                },
            }
        }
    };

    rsx! {
        div { class: wrapper_classes, style: props.style,

            div { class: "hi-search-input-wrapper",

                InputWrapper {
                    left: left_items,
                    right: right_items,
                    input: Some(input_element),
                    size: InputWrapperSize::Medium,
                    disabled: props.disabled,
                    glow: props.glow,
                    glow_blur: GlowBlur::None,
                    glow_intensity: GlowIntensity::Dim,
                    glow_color: GlowColor::Ghost,
                }
            }
        }
    }
}

impl StyledComponent for SearchComponent {
    fn styles() -> &'static str {
        include_str!(concat!(env!("OUT_DIR"), "/styles/search.css"))
    }

    fn name() -> &'static str {
        "search"
    }
}
