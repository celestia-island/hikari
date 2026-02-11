// packages/components/src/entry/search.rs
// Search component with Arknights + FUI styling

use dioxus::prelude::*;
use palette::classes::{ClassesBuilder, SearchClass, UtilityClass};

use crate::styled::StyledComponent;

/// Search component type wrapper (for StyledComponent)
pub struct SearchComponent;

/// Search component with Arknights + FUI styling
///
/// A dedicated search input component with optional clear button and loading state.
/// Simpler than AutoComplete, focused on search functionality.
///
/// # Examples
///
/// ```rust
/// use dioxus::prelude::*;
/// use hikari_components::Search;
///
/// fn app() -> Element {
///     let mut value = use_signal(|| String::new());
///     let mut loading = use_signal(|| false);
///
///     rsx! {
///         Search {
///             value: value(),
///             placeholder: "Search...",
///             loading: loading(),
///             on_search: move |v| {
///                 println!("Searching for: {}", v);
///             },
///             on_clear: move |_| {
///                 value.set(String::new());
///             },
///         }
///     }
/// }
/// ```
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

    #[props(default = false)]
    pub allow_clear: bool,

    pub on_search: EventHandler<String>,

    pub on_clear: EventHandler,

    #[props(default)]
    pub class: String,

    #[props(default)]
    pub style: String,
}

#[component]
pub fn Search(props: SearchProps) -> Element {
    let input_classes = ClassesBuilder::new()
        .add(SearchClass::Input)
        .build();

    let wrapper_classes = ClassesBuilder::new()
        .add(SearchClass::Wrapper)
        .build();

    rsx! {
        div {
            class: "{wrapper_classes}",
            style: "{props.style}",

            input {
                class: "{input_classes}",
                r#type: "search",
                value: "{props.value}",
                placeholder: "{props.placeholder}",
                disabled: props.disabled,
                oninput: move |e| {
                    props.on_search.call(e.value());
                },
            }

            if props.loading {
                div {
                    class: "{SearchClass::Loading.as_class()}",
                    "⌛"
                }
            }

            if props.allow_clear && !props.value.is_empty() && !props.disabled {
                button {
                    class: "{SearchClass::Clear.as_class()}",
                    onclick: move |_| {
                        props.on_clear.call(());
                    },
                    "×"
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
    display: flex;
    align-items: center;
}

.hi-search-input {
    flex: 1;
    padding: 0.5rem 0.75rem;
    padding-right: 2rem;
    border: 1px solid var(--hi-color-border);
    border-radius: 8px;
    background-color: var(--hi-color-surface);
    color: var(--hi-color-text-primary);
    font-size: 0.875rem;
    outline: none;
    transition: all 0.2s ease;
}

.hi-search-input:focus {
    border-color: var(--hi-color-primary);
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
}

.hi-search-input:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.hi-search-input::placeholder {
    color: var(--hi-color-text-secondary);
}

.hi-search-clear {
    position: absolute;
    right: 0.5rem;
    top: 50%;
    transform: translateY(-50%);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    padding: 0;
    background-color: transparent;
    border: none;
    border-radius: 50%;
    color: var(--hi-color-text-secondary);
    font-size: 1.25rem;
    line-height: 1;
    cursor: pointer;
    transition: all 0.2s ease;
}

.hi-search-clear:hover {
    background-color: var(--hi-color-background);
    color: var(--hi-color-text-primary);
}

.hi-search-loading {
    position: absolute;
    right: 0.5rem;
    top: 50%;
    transform: translateY(-50%);
    font-size: 0.875rem;
    color: var(--hi-color-text-secondary);
}
"#
    }

    fn name() -> &'static str {
        "search"
    }
}
