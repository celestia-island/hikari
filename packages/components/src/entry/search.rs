// packages/components/src/entry/search.rs
// Search component with Arknights + FUI styling
// Features: Embedded icons/buttons, unified input styling, Glow effects, Voice input
// Uses InputWrapper for consistent layout and Portal system for dropdown suggestions and voice input

use dioxus::prelude::*;
use icons::{Icon, MdiIcon};
use palette::classes::{ClassesBuilder, SearchClass};

#[cfg(target_arch = "wasm32")]
use wasm_bindgen::{JsCast, closure::Closure};

use crate::{
    basic::{
        IconButton, IconButtonSize, IconButtonVariant, InputWrapper, InputWrapperItem,
        InputWrapperSize,
    },
    feedback::{GlowBlur, GlowColor, GlowIntensity},
    hooks::use_audio_recorder::{
        AudioRecorderState, is_audio_recording_supported, use_audio_recorder,
    },
    portal::{
        PortalEntry, PortalMaskMode, PortalPositionStrategy, TriggerPlacement, generate_portal_id,
        use_portal,
    },
    styled::StyledComponent,
};

use animation::style::{CssProperty, StyleStringBuilder};

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
    let mut voice_portal_id = use_signal(|| String::new());
    let mut container_rect = use_signal(|| None::<(f64, f64, f64, f64)>);
    let portal = use_portal();

    // Voice input state
    let mut temp_transcript = use_signal(String::new);

    // Check if audio recording is supported
    let is_speech_supported = is_audio_recording_supported();

    // Audio recorder hook
    let (audio_state, _audio_levels, start_recording, stop_recording, voice_transcript, _) =
        use_audio_recorder();

    // Update temp transcript when voice transcript changes
    use_effect(move || {
        let transcript = voice_transcript();
        if !transcript.is_empty() {
            temp_transcript.set(transcript.clone());
        }
    });

    // Voice popover width
    let voice_popover_width = 240;

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
    let left_items = vec![InputWrapperItem::icon(MdiIcon::Magnify)];

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
            }),
        ));
    } else if props.voice_input && is_speech_supported {
        let is_recording = matches!(audio_state(), AudioRecorderState::Recording);

        if is_recording {
            // During recording: show close button to cancel
            right_items.push(InputWrapperItem::button(
                MdiIcon::Close,
                EventHandler::new(move |_| {
                    stop_recording.call(());
                    temp_transcript.set(String::new());
                    // Remove voice portal
                    let id = voice_portal_id();
                    if !id.is_empty() {
                        portal.remove_entry.call(id);
                        voice_portal_id.set(String::new());
                    }
                }),
            ));
        } else {
            // Not recording: show microphone button
            right_items.push(InputWrapperItem::button(
                MdiIcon::Microphone,
                EventHandler::new(move |_| {
                    // Clear temp_transcript for new recording session
                    temp_transcript.set(String::new());
                    // Start recording
                    start_recording.call(());
                }),
            ));
        }
    } else if props.voice_input {
        // Voice input requested but not supported
        right_items.push(InputWrapperItem::icon(MdiIcon::Alert));
    } else {
        // Default: show search button
        right_items.push(InputWrapperItem::button(
            MdiIcon::ArrowRight,
            EventHandler::new(move |_| {
                let id = dropdown_id();
                if !id.is_empty() {
                    portal.remove_entry.call(id);
                }
                props.on_search.call(value_signal());
            }),
        ));
    }

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

    // Manage voice portal based on recording state
    {
        let mut voice_portal_id = voice_portal_id.clone();
        let portal = portal.clone();
        let container_rect = container_rect.clone();
        let mut temp_transcript = temp_transcript.clone();
        let mut value_signal = value_signal.clone();
        let stop_recording = stop_recording.clone();
        let on_search = props.on_search.clone();

        use_effect(move || {
            let is_recording = matches!(audio_state(), AudioRecorderState::Recording);
            let current_id = voice_portal_id();
            let trigger_rect = container_rect();

            if is_recording && current_id.is_empty() {
                // Start recording - create portal
                let new_id = generate_portal_id();
                voice_portal_id.set(new_id.clone());

                let temp_transcript_for_content = temp_transcript.clone();
                let mut temp_transcript_for_confirm = temp_transcript.clone();
                let mut value_signal_for_confirm = value_signal.clone();
                let stop_recording_for_confirm = stop_recording.clone();
                let on_search_for_confirm = on_search.clone();
                let portal_for_confirm = portal.clone();
                let voice_portal_id_for_confirm = voice_portal_id.clone();

                let voice_content = rsx! {
                    VoicePopoverContent {
                        transcript_signal: temp_transcript_for_content,
                        width: voice_popover_width,
                        on_confirm: Callback::new(move |_| {
                            let transcript = temp_transcript_for_confirm();
                            if !transcript.is_empty() {
                                value_signal_for_confirm.set(transcript.clone());
                                on_search_for_confirm.call(transcript.clone());
                            }
                            stop_recording_for_confirm.call(());
                            temp_transcript_for_confirm.set(String::new());
                            // Remove portal
                            let id = voice_portal_id_for_confirm();
                            if !id.is_empty() {
                                portal_for_confirm.remove_entry.call(id);
                            }
                        }),
                    }
                };

                portal.add_entry.call(PortalEntry::Dropdown {
                    id: new_id,
                    strategy: PortalPositionStrategy::TriggerBased {
                        placement: TriggerPlacement::BottomLeft,
                    },
                    mask_mode: PortalMaskMode::Transparent,
                    children: voice_content,
                    trigger_rect,
                    close_on_select: false,
                });
            } else if !is_recording && !current_id.is_empty() {
                // Recording stopped - remove portal
                portal.remove_entry.call(current_id);
                voice_portal_id.set(String::new());
            }
        });
    }

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

/// Voice popover content component
#[component]
fn VoicePopoverContent(
    transcript_signal: Signal<String>,
    width: u32,
    on_confirm: Callback<()>,
) -> Element {
    let transcript = transcript_signal();

    rsx! {
        div {
            class: "hi-search-voice-popover",
            style: StyleStringBuilder::new()
                .add_px(CssProperty::Width, width)
                .build_clean(),
            // Waveform container - CSS animated bars
            div { class: "hi-search-voice-popover-waveform",
                for i in 0..12 {
                    div {
                        class: "hi-search-voice-popover-bar",
                        style: format!("animation-delay: {}ms;", i * 100),
                    }
                }
            }
            // Transcript display with scroll and gradient
            div { class: "hi-search-voice-popover-transcript-wrapper",
                div { class: "hi-search-voice-popover-transcript-container",
                    div { class: "hi-search-voice-popover-transcript-scroll",
                        div { class: "hi-search-voice-popover-transcript",
                            if transcript.is_empty() {
                                "请说话..."
                            } else {
                                "{transcript}"
                            }
                        }
                    }
                }
                // Confirm button
                IconButton {
                    icon: MdiIcon::Check,
                    size: IconButtonSize::Medium,
                    variant: IconButtonVariant::Ghost,
                    glow: false,
                    onclick: move |_| {
                        on_confirm.call(());
                    },
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
