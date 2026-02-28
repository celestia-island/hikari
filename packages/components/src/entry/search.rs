// packages/components/src/entry/search.rs
// Search component with Arknights + FUI styling
// Features: Embedded icons/buttons, unified input styling, Glow effects, Voice input
// Uses InputWrapper for consistent layout and Portal system for dropdown suggestions and voice input

use dioxus::prelude::*;
use icons::{Icon, MdiIcon};
use palette::classes::{ClassesBuilder, SearchClass};

#[cfg(target_arch = "wasm32")]
use wasm_bindgen::JsCast;

use crate::{
    basic::{InputWrapper, InputWrapperItem, InputWrapperSize},
    feedback::{GlowBlur, GlowColor, GlowIntensity},
    hooks::use_audio_recorder::{
        AudioRecorderState, clear_transcript, is_audio_recording_supported, start_audio_recording,
        stop_audio_recording, use_audio_recorder,
    },
    portal::{
        PortalEntry, PortalMaskMode, PortalPositionStrategy, TriggerPlacement, generate_portal_id,
        use_portal,
    },
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
    let mut value_signal = use_signal(|| props.value.clone());
    let mut dropdown_id = use_signal(|| String::new());
    let mut container_rect = use_signal(|| None::<(f64, f64, f64, f64)>);
    let portal = use_portal();

    let is_speech_supported = is_audio_recording_supported();
    let audio_ctx = use_audio_recorder();

    let wrapper_classes = ClassesBuilder::new()
        .add(SearchClass::Wrapper)
        .add_raw(&props.class)
        .build();

    let current_value = value_signal();

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

    let audio_state = audio_ctx.state.read().clone();

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
        let is_active = matches!(
            audio_state,
            AudioRecorderState::Recording | AudioRecorderState::RequestingPermission
        );

        if is_active {
            // Recording - show microphone with dynamic color based on volume
            // Read audio levels directly to trigger re-renders when they change
            let audio_levels = audio_ctx.audio_levels.read().clone();

            let mic_color = if audio_levels.volume > 0.0 {
                let intensity = (audio_levels.volume * 2.0).min(1.0);

                // Add pulsing effect using audio level changes
                // The color will update as audio levels change
                format!(
                    "rgb({}, {}, {})",
                    (46.0 + 158.0 * intensity) as u8,
                    (204.0 * intensity) as u8,
                    (113.0 * intensity) as u8
                )
            } else {
                String::new()
            };

            right_items.push(InputWrapperItem::button_with_color(
                MdiIcon::Microphone,
                EventHandler::new(move |_| {
                    #[cfg(target_arch = "wasm32")]
                    {
                        web_sys::console::log_1(
                            &"[Search] Microphone button clicked (recording)".into(),
                        );
                    }
                    clear_transcript();
                    stop_audio_recording();
                }),
                mic_color,
            ));
        } else {
            // Not recording - show normal microphone button
            right_items.push(InputWrapperItem::button(
                MdiIcon::Microphone,
                EventHandler::new(move |_| {
                    #[cfg(target_arch = "wasm32")]
                    {
                        web_sys::console::log_1(&"[Search] Microphone button clicked".into());
                    }
                    start_audio_recording();
                }),
            ));
        }
    } else if props.voice_input {
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
                                let rect_value = (rect.x(), rect.y(), rect.width(), rect.height());
                                container_rect.set(Some(rect_value));
                                web_sys::console::log_1(
                                    &format!("[Search] container_rect set: {:?}", rect_value).into(),
                                );
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
