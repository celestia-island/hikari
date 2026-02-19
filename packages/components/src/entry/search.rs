// packages/components/src/entry/search.rs
// Search component with Arknights + FUI styling

use dioxus::prelude::*;
use palette::classes::{ClassesBuilder, SearchClass};

use crate::{
    basic::{IconButton, IconButtonSize, IconButtonVariant},
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
    let mut show_suggestions = use_signal(|| false);

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

                span {
                    class: "hi-search-icon",
                    svg {
                        width: "16",
                        height: "16",
                        view_box: "0 0 24 24",
                        fill: "none",
                        stroke: "currentColor",
                        stroke_width: "2",
                        stroke_linecap: "round",
                        stroke_linejoin: "round",
                        circle { cx: "11", cy: "11", r: "8" }
                        line { x1: "21", y1: "21", x2: "16.65", y2: "16.65" }
                    }
                }

                input {
                    class: "hi-search-input",
                    r#type: "search",
                    value: "{props.value}",
                    placeholder: "{props.placeholder}",
                    disabled: props.disabled,
                    onfocus: move |_| {
                        show_suggestions.set(true);
                    },
                    onblur: move |_| {
                        show_suggestions.set(false);
                    },
                    oninput: move |e| {
                        show_suggestions.set(true);
                        props.on_search.call(e.value());
                    },
                }

                if props.loading {
                    span {
                        class: "hi-search-loading",
                        svg {
                            class: "hi-search-spinner",
                            width: "16",
                            height: "16",
                            view_box: "0 0 24 24",
                            fill: "none",
                            stroke: "currentColor",
                            stroke_width: "2",
                            circle {
                                cx: "12",
                                cy: "12",
                                r: "10",
                                stroke_opacity: "0.25",
                            }
                            path {
                                d: "M12 2a10 10 0 0 1 10 10",
                                stroke_opacity: "1",
                            }
                        }
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

impl StyledComponent for SearchComponent {
    fn styles() -> &'static str {
        r#"
.hi-search-wrapper {
    position: relative;
    width: 100%;
    display: inline-block;
}

.hi-search-input-wrapper {
    display: inline-flex;
    align-items: center;
    width: 100%;
    padding: 0 12px;
    border: 1px solid var(--hi-color-border, #d9d9d9);
    border-radius: 8px;
    background-color: var(--hi-color-surface, #fff);
    transition: all 0.2s ease;
    gap: 8px;
}

.hi-search-input-wrapper:focus-within {
    border-color: var(--hi-color-primary, #1890ff);
    box-shadow: 0 0 0 2px var(--hi-color-primary-glow, rgba(24, 144, 255, 0.2));
}

.hi-search-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--hi-color-text-secondary, #999);
    flex-shrink: 0;
}

.hi-search-icon svg {
    display: block;
}

.hi-search-input {
    flex: 1;
    min-width: 0;
    height: 32px;
    border: none;
    background-color: transparent;
    color: var(--hi-color-text-primary, #333);
    font-size: 14px;
    outline: none;
}

.hi-search-input::-webkit-search-cancel-button,
.hi-search-input::-webkit-search-decoration {
    -webkit-appearance: none;
    appearance: none;
}

.hi-search-input::placeholder {
    color: var(--hi-color-text-secondary, #999);
}

.hi-search-input:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.hi-search-loading {
    display: inline-flex;
    align-items: center;
    color: var(--hi-color-text-secondary, #999);
    flex-shrink: 0;
}

.hi-search-spinner {
    animation: hi-search-spin 0.8s linear infinite;
}

@keyframes hi-search-spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}

.hi-search-clear-btn {
    flex-shrink: 0;
    margin: 0 -4px;
}

.hi-search-suggestions {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    max-height: 240px;
    overflow-y: auto;
    background-color: var(--hi-color-surface, #fff);
    border: 1px solid var(--hi-color-border, #d9d9d9);
    border-radius: 8px;
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
    z-index: 1000;
    animation: hi-search-suggestions-enter 0.15s ease-out;
    padding: 4px;
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
    gap: 8px;
    padding: 8px 12px;
    cursor: pointer;
    transition: background-color 0.15s ease;
    border-radius: 6px;
    color: var(--hi-color-text-primary, #333);
}

.hi-search-suggestion-item:hover {
    background-color: var(--hi-color-background, #f5f5f5);
}

.hi-search-suggestion-icon {
    flex-shrink: 0;
    color: var(--hi-color-text-secondary, #999);
}

.hi-search-suggestion-item span {
    font-size: 14px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

[data-theme="dark"] .hi-search-input-wrapper {
    background-color: var(--hi-surface, #1a1a1a);
    border-color: var(--hi-border, #333);
}

[data-theme="dark"] .hi-search-input {
    color: var(--hi-text-primary, #e0e0e0);
}

[data-theme="dark"] .hi-search-icon {
    color: var(--hi-text-secondary, #888);
}

[data-theme="dark"] .hi-search-suggestions {
    background-color: var(--hi-surface, #1a1a1a);
    border-color: var(--hi-border, #333);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
}

[data-theme="dark"] .hi-search-suggestion-item:hover {
    background-color: var(--hi-surface-hover, #252525);
}

[data-theme="dark"] .hi-search-suggestion-item {
    color: var(--hi-text-primary, #e0e0e0);
}
"#
    }

    fn name() -> &'static str {
        "search"
    }
}
