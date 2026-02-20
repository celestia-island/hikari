//! # I18n Context
//!
//! React-like context for internationalization in Dioxus.

use crate::{keys::I18nKeys, loader::load_toml};

/// Text direction for layout
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Default)]
pub enum TextDirection {
    #[default]
    Ltr,
    Rtl,
}

/// Supported languages
///
/// Includes all UN official languages (Arabic, Chinese, English, French, Russian, Spanish)
/// plus Japanese and Korean.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Language {
    English,
    ChineseSimplified,
    ChineseTraditional,
    French,
    Russian,
    Spanish,
    Arabic,
    Japanese,
    Korean,
}

impl Language {
    pub fn code(&self) -> &'static str {
        match self {
            Language::English => "en-US",
            Language::ChineseSimplified => "zh-CHS",
            Language::ChineseTraditional => "zh-CHT",
            Language::French => "fr-FR",
            Language::Russian => "ru-RU",
            Language::Spanish => "es-ES",
            Language::Arabic => "ar-SA",
            Language::Japanese => "ja-JP",
            Language::Korean => "ko-KR",
        }
    }

    pub fn url_prefix(&self) -> &'static str {
        match self {
            Language::English => "en",
            Language::ChineseSimplified => "zh-chs",
            Language::ChineseTraditional => "zh-cht",
            Language::French => "fr",
            Language::Russian => "ru",
            Language::Spanish => "es",
            Language::Arabic => "ar",
            Language::Japanese => "ja",
            Language::Korean => "ko",
        }
    }

    pub fn native_name(&self) -> &'static str {
        match self {
            Language::English => "English",
            Language::ChineseSimplified => "简体中文",
            Language::ChineseTraditional => "繁體中文",
            Language::French => "Français",
            Language::Russian => "Русский",
            Language::Spanish => "Español",
            Language::Arabic => "العربية",
            Language::Japanese => "日本語",
            Language::Korean => "한국어",
        }
    }

    pub fn short_name(&self) -> &'static str {
        match self {
            Language::English => "EN",
            Language::ChineseSimplified => "简",
            Language::ChineseTraditional => "繁",
            Language::French => "FR",
            Language::Russian => "РУ",
            Language::Spanish => "ES",
            Language::Arabic => "ع",
            Language::Japanese => "日",
            Language::Korean => "한",
        }
    }

    pub fn is_rtl(&self) -> bool {
        matches!(self, Language::Arabic)
    }

    pub fn direction(&self) -> TextDirection {
        if self.is_rtl() {
            TextDirection::Rtl
        } else {
            TextDirection::Ltr
        }
    }

    pub fn from_code(code: &str) -> Option<Self> {
        match code {
            "en-US" | "en" => Some(Language::English),
            "zh-CHS" | "zh-chs" | "zh-Hans" => Some(Language::ChineseSimplified),
            "zh-CHT" | "zh-cht" | "zh-Hant" => Some(Language::ChineseTraditional),
            "fr-FR" | "fr" => Some(Language::French),
            "ru-RU" | "ru" => Some(Language::Russian),
            "es-ES" | "es" => Some(Language::Spanish),
            "ar-SA" | "ar" => Some(Language::Arabic),
            "ja-JP" | "ja" => Some(Language::Japanese),
            "ko-KR" | "ko" => Some(Language::Korean),
            _ => None,
        }
    }

    pub fn from_url_prefix(prefix: &str) -> Option<Self> {
        Self::from_code(prefix)
    }

    pub fn all() -> &'static [Language] {
        &[
            Language::English,
            Language::ChineseSimplified,
            Language::ChineseTraditional,
            Language::French,
            Language::Russian,
            Language::Spanish,
            Language::Arabic,
            Language::Japanese,
            Language::Korean,
        ]
    }

    pub fn un_official_languages() -> &'static [Language] {
        &[
            Language::Arabic,
            Language::ChineseSimplified,
            Language::English,
            Language::French,
            Language::Russian,
            Language::Spanish,
        ]
    }

    pub fn east_asian_languages() -> &'static [Language] {
        &[
            Language::ChineseSimplified,
            Language::ChineseTraditional,
            Language::Japanese,
            Language::Korean,
        ]
    }

    pub fn rtl_languages() -> &'static [Language] {
        &[Language::Arabic]
    }

    pub fn default_lang() -> Self {
        Language::ChineseSimplified
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
    let dir = if props.language.is_rtl() {
        "rtl"
    } else {
        "ltr"
    };

    rsx! {
        div {
            "data-language": "{props.language.code()}",
            dir: "{dir}",
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
    let languages = Language::all();

    rsx! {
        div {
            class: "hi-language-switcher",
            {languages.iter().map(|&lang| {
                let is_active = props.current_language == lang;
                let lang_name = lang.short_name();

                rsx! {
                button {
                    class: if is_active { "hi-language-switcher-button hi-active" } else { "hi-language-switcher-button" },
                    onclick: move |_| (props.on_language_change)(lang),
                    title: lang.native_name(),
                    "{lang_name}"
                }
                }
            })}
        }
    }
}
