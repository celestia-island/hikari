// packages/components/src/entry/search.rs
// Search component with Arknights + FUI styling
// Features: Embedded icons/buttons, unified input styling, Glow effects, Voice input
// Uses InputWrapper for consistent layout and Portal system for dropdown suggestions

use dioxus::prelude::*;
use icons::{Icon, MdiIcon};
use palette::classes::{ClassesBuilder, SearchClass};

#[cfg(target_arch = "wasm32")]
use wasm_bindgen::JsCast;

use crate::{
    basic::{InputWrapper, InputWrapperItem, InputWrapperSize},
    feedback::{GlowBlur, GlowColor, GlowIntensity},
    hooks::use_voice_input::{use_voice_input, VoiceInputResult, is_speech_recognition_supported},
    portal::{generate_portal_id, use_portal, PortalEntry, PortalMaskMode, PortalPositionStrategy, TriggerPlacement},
    styled::StyledComponent,
};

pub struct SearchComponent;

#[derive(Clone, PartialEq, Props)]
pub struct SearchProps {
    #[props(default)]
    pub value: String,

    #[props(default)]
    pub placeholder: String,

    #[props(default = false)]
    pub disabled: bool,

    #[props(default = false)]
    pub loading: bool,

    #[props(default = true)]
    pub allow_clear: bool,

    #[props(default)]
    pub suggestions: Vec<String>,

    pub on_search: EventHandler<String>,

    #[props(default)]
    pub on_clear: Option<EventHandler>,

    #[props(default)]
    pub on_suggestion_click: Option<EventHandler<String>>,

    #[props(default)]
    pub class: String,

    #[props(default)]
    pub style: String,

    #[props(default = true)]
    pub glow: bool,

    #[props(default = false)]
    pub voice_input: bool,
}

#[component]
pub fn Search(props: SearchProps) -> Element {
    let mut is_voice_recording = use_signal(|| false);
    let mut voice_text = use_signal(String::new);
    let mut value_signal = use_signal(|| props.value.clone());
    let mut dropdown_id = use_signal(|| String::new());
    let mut container_rect = use_signal(|| None::<(f64, f64, f64, f64)>);
    let portal = use_portal();
    
    // Check if speech recognition is supported
    let is_speech_supported = is_speech_recognition_supported();

    // Voice input hook
    let (_voice_state, start_voice, stop_voice, _) = use_voice_input(
        Callback::new(move |result: VoiceInputResult| {
            voice_text.set(result.text.clone());
            if result.is_final {
                value_signal.set(result.text.clone());
                props.on_search.call(result.text);
                is_voice_recording.set(false);
            }
        }),
        Callback::new(move |_error: String| {
            is_voice_recording.set(false);
        }),
    );

    let wrapper_classes = ClassesBuilder::new()
        .add(SearchClass::Wrapper)
        .add_raw(&props.class)
        .build();

    let current_value = value_signal();

    // Filter suggestions based on current value
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

    // Left icon - pure icon display (decorative, always disabled)
    let left_items = vec![
        InputWrapperItem::icon(MdiIcon::Magnify)
    ];

    // Build right side items
    let mut right_items: Vec<InputWrapperItem> = Vec::new();

    if props.loading {
        // Loading spinner - pure icon display
        right_items.push(InputWrapperItem::icon(MdiIcon::Loading));
    } else if has_clear_button {
        // Clear button - interactive
        right_items.push(InputWrapperItem::button(
            MdiIcon::Close,
            EventHandler::new(move |_| {
                value_signal.set(String::new());
                let id = dropdown_id();
                if !id.is_empty() {
                    portal.remove_entry.call(id);
                }
                if let Some(ref on_clear) = props.on_clear {
                    on_clear.call(());
                }
            })
        ));
    } else if props.voice_input {
        // Voice input button - interactive
        let is_recording_value = *is_voice_recording.read();
        
        if !is_speech_supported {
            // Show warning icon if speech recognition not supported
            right_items.push(InputWrapperItem::icon(MdiIcon::Alert));
        } else {
            right_items.push(InputWrapperItem::button(
                if is_recording_value { MdiIcon::Stop } else { MdiIcon::Microphone },
                EventHandler::new(move |_| {
                    let current = *is_voice_recording.read();
                    if current {
                        stop_voice.call(());
                        is_voice_recording.set(false);
                    } else {
                        voice_text.set(String::new());
                        start_voice.call(());
                        is_voice_recording.set(true);
                    }
                })
            ));
        }
    } else {
        // Search submit button - interactive
        right_items.push(InputWrapperItem::button(
            MdiIcon::ArrowRight,
            EventHandler::new(move |_| {
                let id = dropdown_id();
                if !id.is_empty() {
                    portal.remove_entry.call(id);
                }
                props.on_search.call(value_signal());
            })
        ));
    }

    // Input element with embedded voice background
    let is_recording = *is_voice_recording.read();
    let voice_bg = if is_recording {
        let text_len = current_value.len();
        let position_class = if text_len > 20 {
            "hi-search-voice-bg-right"
        } else {
            "hi-search-voice-bg-center"
        };
        
        rsx! {
            div {
                class: "hi-search-voice-bg {position_class}",
                onclick: move |_| {
                    stop_voice.call(());
                    is_voice_recording.set(false);
                },
                
                // Waveform animation
                div { class: "hi-search-voice-waveform",
                    for delay in [0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100].iter() {
                        div {
                            class: "hi-search-voice-bar",
                            style: "animation-delay: {delay}ms",
                        }
                    }
                }
                
                // Voice text display
                if !voice_text().is_empty() {
                    div { class: "hi-search-voice-text",
                        "{voice_text()}"
                    }
                }
            }
        }
    } else {
        rsx! {}
    };

    let input_element = rsx! {
        div {
            class: "hi-search-input-container",
            { voice_bg }
            input {
                r#type: "search",
                value: "{current_value}",
                placeholder: "{props.placeholder}",
                disabled: props.disabled,
                onfocus: move |_| {
                    if has_suggestions {
                        let trigger_rect_opt = *container_rect.read();
                        
                        // Close existing dropdown if any
                        let id = dropdown_id();
                        if !id.is_empty() {
                            portal.remove_entry.call(id.clone());
                        }

                        let new_id = generate_portal_id();
                        dropdown_id.set(new_id.clone());

                        let suggestions_for_dropdown = filtered_suggestions.clone();
                        let on_search = props.on_search;
                        let on_suggestion_click = props.on_suggestion_click.clone();
                        let portal_remove = portal.remove_entry.clone();
                        let mut value_signal_for_dropdown = value_signal;

                        let dropdown_content = rsx! {
                            div {
                                class: "hi-search-suggestions-dropdown",
                                for suggestion in suggestions_for_dropdown.iter() {
                                    {
                                        let suggestion_value = suggestion.clone();
                                        let suggestion_for_click = suggestion.clone();
                                        let suggestion_for_search = suggestion.clone();
                                        let suggestion_for_handler = suggestion.clone();
                                        let id_close = new_id.clone();
                                        rsx! {
                                            div {
                                                class: "hi-search-suggestion-item",
                                                onclick: move |e: MouseEvent| {
                                                    e.stop_propagation();
                                                    value_signal_for_dropdown.set(suggestion_for_click.clone());
                                                    if let Some(ref handler) = on_suggestion_click {
                                                        handler.call(suggestion_for_handler.clone());
                                                    }
                                                    on_search.call(suggestion_for_search.clone());
                                                    portal_remove.call(id_close.clone());
                                                },
                                                Icon {
                                                    icon: MdiIcon::Magnify,
                                                    size: 14,
                                                    class: "hi-search-suggestion-icon",
                                                    color: String::new(),
                                                }
                                                span { "{suggestion_value}" }
                                            }
                                        }
                                    }
                                }
                            }
                        };

                        portal.add_entry.call(PortalEntry::Dropdown {
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
                oninput: move |e| {
                    let new_value = e.value();
                    value_signal.set(new_value.clone());
                    props.on_search.call(new_value);
                },
                onkeydown: move |e| {
                    if e.key() == Key::Enter {
                        let id = dropdown_id();
                        if !id.is_empty() {
                            portal.remove_entry.call(id);
                        }
                        props.on_search.call(value_signal());
                    }
                    if e.key() == Key::Escape {
                        let id = dropdown_id();
                        if !id.is_empty() {
                            portal.remove_entry.call(id);
                        }
                    }
                },
            }
        }
    };

    rsx! {
        div {
            class: "{wrapper_classes}",
            style: "{props.style}",

            div {
                class: "hi-search-input-wrapper",
                onmounted: move |evt| {
                    #[cfg(target_arch = "wasm32")]
                    {
                        if let Some(element) = evt.data().downcast::<web_sys::Element>() {
                            if let Some(html_el) = element.dyn_ref::<web_sys::HtmlElement>() {
                                let rect = html_el.get_bounding_client_rect();
                                container_rect.set(Some((rect.x(), rect.y(), rect.width(), rect.height())));
                            }
                        }
                    }
                },

                InputWrapper {
                    left: left_items,
                    right: right_items,
                    input: input_element,
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
