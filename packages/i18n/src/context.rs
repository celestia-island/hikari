//! # I18n Context
//!
//! React-like context for internationalization in Dioxus.

use crate::{keys::I18nKeys, loader::load_toml};

/// Supported languages
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Language {
    English,
    ChineseSimplified,
    ChineseTraditional,
}

impl Language {
    pub fn code(&self) -> &'static str {
        match self {
            Language::English => "en-US",
            Language::ChineseSimplified => "zh-CHS",
            Language::ChineseTraditional => "zh-CHT",
        }
    }

    pub fn from_code(code: &str) -> Option<Self> {
        match code {
            "en-US" => Some(Language::English),
            "zh-CHS" => Some(Language::ChineseSimplified),
            "zh-CHT" => Some(Language::ChineseTraditional),
            _ => None,
        }
    }
}

/// I18n context containing language data
#[derive(Clone)]
pub struct I18nContext {
    pub language: Language,
    pub keys: I18nKeys,
}

impl I18nContext {
    pub fn new(language: Language, keys: I18nKeys) -> Self {
        Self { language, keys }
    }
}

use dioxus::prelude::*;

/// I18n Provider component
#[derive(Clone, Props, PartialEq)]
pub struct I18nProviderProps {
    pub language: Language,
    pub toml_content: &'static str,
    children: Element,
}

#[component]
pub fn I18nProvider(props: I18nProviderProps) -> Element {
    let keys = load_toml(props.toml_content).expect("Failed to load TOML");
    let _i18n_context = use_context_provider(|| I18nContext::new(props.language, keys));

    rsx! {
        div {
            "data-language": "{props.language.code()}",
            {props.children}
        }
    }
}

/// Hook to access i18n context
pub fn use_i18n() -> I18nContext {
    use_context::<I18nContext>()
}

/// Language switcher component
#[derive(Clone, Props, PartialEq)]
pub struct LanguageSwitcherProps {
    pub current_language: Language,
    pub on_language_change: EventHandler<Language>,
}

#[component]
pub fn LanguageSwitcher(props: LanguageSwitcherProps) -> Element {
    let languages = [
        Language::English,
        Language::ChineseSimplified,
        Language::ChineseTraditional,
    ];

    rsx! {
        div {
            class: "hi-language-switcher",
            {languages.iter().map(|&lang| {
                let is_active = props.current_language == lang;
                let lang_name = match lang {
                    Language::English => "EN",
                    Language::ChineseSimplified => "简",
                    Language::ChineseTraditional => "繁",
                };

                rsx! {
                button {
                    class: if is_active { "hi-language-switcher-button hi-active" } else { "hi-language-switcher-button" },
                    onclick: move |_| (props.on_language_change)(lang),
                    "{lang_name}"
                }
                }
            })}
        }
    }
}
