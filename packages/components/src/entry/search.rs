// packages/components/src/entry/search.rs
// Search component with Arknights + FUI styling

use dioxus::prelude::*;
use palette::classes::{ClassesBuilder, SearchClass, UtilityClass};

use crate::{
    basic::{IconButton, IconButtonSize, IconButtonVariant},
    feedback::{Glow, GlowBlur, GlowColor, GlowIntensity},
    styled::StyledComponent,
};
use icons::MdiIcon;

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
}

#[component]
pub fn Search(props: SearchProps) -> Element {
    let mut is_focused = use_signal(|| false);
    let mut show_suggestions = use_signal(|| false);

    let input_classes = ClassesBuilder::new().add(SearchClass::Input).build();

    let wrapper_classes = ClassesBuilder::new().add(SearchClass::Wrapper).build();

    let filtered_suggestions: Vec<String> = if props.value.is_empty() {
        props.suggestions.clone()
    } else {
        props
            .suggestions
            .iter()
            .filter(|s| s.to_lowercase().contains(&props.value.to_lowercase()))
            .cloned()
            .collect()
    };

    let has_clear_button = props.allow_clear && !props.value.is_empty() && !props.disabled;

    rsx! {
        div {
            class: "{wrapper_classes}",
            style: "{props.style}",

            div {
                class: "hi-search-input-wrapper",

                Glow {
                    blur: GlowBlur::Light,
                    color: GlowColor::Ghost,
                    intensity: GlowIntensity::Seventy,
                    div { class: "hi-search-icon",
                        svg {
                            width: "18",
                            height: "18",
                            view_box: "0 0 24 24",
                            fill: "none",
                            stroke: "currentColor",
                            stroke_width: "2",
                            circle { cx: "11", cy: "11", r: "8" }
                            line { x1: "21", y1: "21", x2: "16.65", y2: "16.65" }
                        }
                    }
                }

                input {
                    class: "{input_classes}",
                    r#type: "search",
                    value: "{props.value}",
                    placeholder: "{props.placeholder}",
                    disabled: props.disabled,
                    onfocus: move |_| {
                        is_focused.set(true);
                        show_suggestions.set(true);
                    },
                    onblur: move |_| {
                        is_focused.set(false);
                    },
                    oninput: move |e| {
                        show_suggestions.set(true);
                        props.on_search.call(e.value());
                    },
                }

                if props.loading {
                    div {
                        class: "{SearchClass::Loading.as_class()}",
                        div { class: "hi-search-spinner" }
                    }
                }

                if has_clear_button {
                    IconButton {
                        icon: MdiIcon::Close,
                        size: IconButtonSize::Small,
                        variant: IconButtonVariant::Ghost,
                        class: "hi-search-clear-btn".to_string(),
                        onclick: move |_| {
                            if let Some(ref on_clear) = props.on_clear {
                                on_clear.call(());
                            }
                        },
                    }
                }
            }

            if *show_suggestions.read() && !filtered_suggestions.is_empty() && !props.value.is_empty() {
                div {
                    class: "hi-search-suggestions",
                    onmousedown: move |e| {
                        e.prevent_default();
                    },

                    for suggestion in filtered_suggestions.iter() {
                        {
                            let suggestion_clone = suggestion.clone();
                            let suggestion_clone2 = suggestion.clone();
                            rsx! {
                                Glow {
                                    blur: GlowBlur::Light,
                                    color: GlowColor::Ghost,
                                    intensity: GlowIntensity::Seventy,
                                    div {
                                        class: "hi-search-suggestion-item",
                                        onclick: move |_| {
                                            show_suggestions.set(false);
                                            if let Some(ref handler) = props.on_suggestion_click {
                                                handler.call(suggestion_clone.clone());
                                            }
                                            props.on_search.call(suggestion_clone2.clone());
                                        },

                                        svg {
                                            class: "hi-search-suggestion-icon",
                                            width: "14",
                                            height: "14",
                                            view_box: "0 0 24 24",
                                            fill: "none",
                                            stroke: "currentColor",
                                            stroke_width: "2",
                                            circle { cx: "11", cy: "11", r: "8" }
                                            line { x1: "21", y1: "21", x2: "16.65", y2: "16.65" }
                                        }

                                        span { "{suggestion}" }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

impl StyledComponent for SearchComponent {
    fn styles() -> &'static str {
        r#"
.hi-search-wrapper {
    position: relative;
    width: 100%;
}

.hi-search-input-wrapper {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--hi-color-border);
    border-radius: 8px;
    background-color: var(--hi-color-surface);
    transition: all 0.2s ease;
}

.hi-search-input-wrapper:focus-within {
    border-color: var(--hi-color-primary);
    box-shadow: 0 0 0 2px var(--hi-color-primary-glow);
}

.hi-search-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--hi-color-text-secondary);
    flex-shrink: 0;
}

.hi-search-input {
    flex: 1;
    min-width: 0;
    border: none;
    background-color: transparent;
    color: var(--hi-color-text-primary);
    font-size: 0.875rem;
    outline: none;
}

.hi-search-input::placeholder {
    color: var(--hi-color-text-secondary);
}

.hi-search-input:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.hi-search-clear-btn {
    flex-shrink: 0;
    margin-left: 0.25rem;
}

.hi-search-loading {
    display: flex;
    align-items: center;
    color: var(--hi-color-text-secondary);
    flex-shrink: 0;
}

.hi-search-spinner {
    width: 16px;
    height: 16px;
    border: 2px solid var(--hi-color-border);
    border-top-color: var(--hi-color-primary);
    border-radius: 50%;
    animation: hi-search-spin 0.8s linear infinite;
}

@keyframes hi-search-spin {
    to { transform: rotate(360deg); }
}

.hi-search-suggestions {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    max-height: 240px;
    overflow-y: auto;
    background-color: var(--hi-color-surface);
    border: 1px solid var(--hi-color-border);
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
    z-index: 1000;
    animation: hi-search-suggestions-enter 0.15s ease-out;
}

@keyframes hi-search-suggestions-enter {
    from {
        opacity: 0;
        transform: translateY(-4px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.hi-search-suggestion-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.625rem 0.875rem;
    cursor: pointer;
    transition: background-color 0.15s ease;
    border-radius: 4px;
    margin: 4px;
}

.hi-search-suggestion-item:hover {
    background-color: var(--hi-color-background);
}

.hi-search-suggestion-icon {
    flex-shrink: 0;
    color: var(--hi-color-text-secondary);
}

.hi-search-suggestion-item span {
    color: var(--hi-color-text-primary);
    font-size: 0.875rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

[data-theme="dark"] .hi-search-input-wrapper {
    background-color: var(--hi-surface);
    border-color: var(--hi-border);
}

[data-theme="dark"] .hi-search-suggestions {
    background-color: var(--hi-surface);
    border-color: var(--hi-border);
}
"#
    }

    fn name() -> &'static str {
        "search"
    }
}
