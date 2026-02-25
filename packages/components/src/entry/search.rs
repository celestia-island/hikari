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
    hooks::use_audio_recorder::{use_audio_recorder, AudioRecorderState, is_audio_recording_supported},
    portal::{generate_portal_id, use_portal, PortalEntry, PortalMaskMode, PortalPositionStrategy, TriggerPlacement},
    styled::StyledComponent,
};

#[cfg(target_arch = "wasm32")]
use animation::{AnimationBuilder, CssProperty};

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
    let mut value_signal = use_signal(|| props.value.clone());
    let mut dropdown_id = use_signal(|| String::new());
    let mut container_rect = use_signal(|| None::<(f64, f64, f64, f64)>);
    let portal = use_portal();
    
    // Voice input state
    let mut is_voice_recording = use_signal(|| false);
    let mut temp_transcript = use_signal(String::new);
    
    // Check if audio recording is supported
    let is_speech_supported = is_audio_recording_supported();

    // Audio recorder hook
    let (audio_state, audio_levels, start_recording, stop_recording, voice_transcript, _) = use_audio_recorder();
    
    // Store waveform bar DOM references
    #[cfg(target_arch = "wasm32")]
    let mut waveform_bars: Signal<std::collections::HashMap<String, wasm_bindgen::JsValue>> = use_signal(std::collections::HashMap::new);

    // Sync recording state from audio_state
    use_effect(move || {
        let is_recording = matches!(audio_state(), AudioRecorderState::Recording);
        is_voice_recording.set(is_recording);
    });

    // Update temp transcript when voice transcript changes
    use_effect(move || {
        let transcript = voice_transcript();
        if !transcript.is_empty() {
            temp_transcript.set(transcript.clone());
        }
    });

    // Animate waveform bars
    #[cfg(target_arch = "wasm32")]
    {
        use_effect(move || {
            let levels = audio_levels().levels;
            let bars = waveform_bars();
            
            if !bars.is_empty() {
                let elements: std::collections::HashMap<String, wasm_bindgen::JsValue> = bars.clone();
                
                for (bar_name, _) in &elements {
                    let bar_index: usize = bar_name.strip_prefix("bar_")
                        .and_then(|s| s.parse().ok())
                        .unwrap_or(0);
                    
                    if bar_index < levels.len() {
                        let level = levels[bar_index];
                        let height = std::cmp::max(4, (level * 40.0) as i32);
                        
                        AnimationBuilder::new(&elements)
                            .add_style(bar_name, CssProperty::Height, format!("{}px", height))
                            .add_style(bar_name, CssProperty::Transition, "height 0.08s ease-out")
                            .apply();
                    }
                }
            }
        });
    }

    let wrapper_classes = ClassesBuilder::new()
        .add(SearchClass::Wrapper)
        .add_raw(&props.class)
        .build();

    let current_value = value_signal();

    // Filter suggestions
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

    // Left icon
    let left_items = vec![
        InputWrapperItem::icon(MdiIcon::Magnify)
    ];

    // Build right side items
    let mut right_items: Vec<InputWrapperItem> = Vec::new();

    if props.loading {
        right_items.push(InputWrapperItem::icon(MdiIcon::Loading));
    } else if has_clear_button {
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
    } else if props.voice_input && is_speech_supported {
        // Voice input - single button that changes based on state
        let is_recording = is_voice_recording();
        
        if is_recording {
            // Cancel button (X) to stop recording
            right_items.push(InputWrapperItem::button(
                MdiIcon::Close,
                EventHandler::new(move |_| {
                    stop_recording.call(());
                    temp_transcript.set(String::new());
                })
            ));
        } else {
            // Microphone button to start recording
            right_items.push(InputWrapperItem::button(
                MdiIcon::Microphone,
                EventHandler::new(move |_| {
                    temp_transcript.set(String::new());
                    start_recording.call(());
                })
            ));
        }
    } else if props.voice_input {
        // Not supported
        right_items.push(InputWrapperItem::icon(MdiIcon::Alert));
    } else {
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

    // Voice input popover content (shown when recording)
    #[cfg(target_arch = "wasm32")]
    let voice_popover_content = if is_voice_recording() {
        let levels = audio_levels().levels;
        let transcript_text = temp_transcript();
        
        rsx! {
            div { class: "hi-search-voice-popover",
                // Waveform
                div { class: "hi-search-voice-popover-waveform",
                    for (i, level) in levels.iter().enumerate() {
                        div {
                            key: "{i}",
                            class: "hi-search-voice-popover-bar",
                            style: "height: {std::cmp::max(3, (*level * 32.0) as i32)}px",
                            onmounted: move |evt| {
                                if let Some(element) = evt.data().downcast::<web_sys::Element>() {
                                    let mut bars = waveform_bars.write();
                                    bars.insert(format!("bar_{}", i), element.into());
                                }
                            }
                        }
                    }
                }
                // Transcript
                div { class: "hi-search-voice-popover-transcript",
                    if transcript_text.is_empty() {
                        "请说话..."
                    } else {
                        "{transcript_text}"
                    }
                }
                // Confirm button in popover
                button {
                    class: "hi-search-voice-confirm-btn",
                    onclick: move |_| {
                        let transcript = temp_transcript();
                        if !transcript.is_empty() {
                            value_signal.set(transcript.clone());
                            props.on_search.call(transcript.clone());
                        }
                        stop_recording.call(());
                        temp_transcript.set(String::new());
                    },
                    Icon { icon: MdiIcon::Check, size: 20 }
                    " 确认"
                }
            }
        }
    } else {
        rsx! {}
    };
    
    #[cfg(not(target_arch = "wasm32"))]
    let voice_popover_content = rsx! {};

    let input_element = rsx! {
        div {
            class: "hi-search-input-container",
            input {
                r#type: "search",
                value: "{current_value}",
                placeholder: "{props.placeholder}",
                disabled: props.disabled,
                onfocus: move |_| {
                    if has_suggestions {
                        let trigger_rect_opt = *container_rect.read();
                        
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
            
            // Voice popover (shown below search box when recording)
            {voice_popover_content}
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
