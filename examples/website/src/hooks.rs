// website/src/hooks.rs
// Custom hooks for the website

mod i18n_toml {

    pub const EN_US: &str = include_str!("../../../packages/i18n/locales/en-US/strings.toml");
    pub const ZH_CHS: &str = include_str!("../../../packages/i18n/locales/zh-CHS/strings.toml");
    pub const ZH_CHT: &str = include_str!("../../../packages/i18n/locales/zh-CHT/strings.toml");
    pub const FR_FR: &str = include_str!("../../../packages/i18n/locales/fr-FR/strings.toml");
    pub const RU_RU: &str = include_str!("../../../packages/i18n/locales/ru-RU/strings.toml");
    pub const ES_ES: &str = include_str!("../../../packages/i18n/locales/es-ES/strings.toml");
    pub const AR_SA: &str = include_str!("../../../packages/i18n/locales/ar-SA/strings.toml");
    pub const JA_JP: &str = include_str!("../../../packages/i18n/locales/ja-JP/strings.toml");
    pub const KO_KR: &str = include_str!("../../../packages/i18n/locales/ko-KR/strings.toml");
}

use dioxus::prelude::*;

use _i18n::{loader::load_toml, I18nKeys, Language};

pub fn get_toml_content(lang: Language) -> &'static str {
    match lang {
        Language::English => i18n_toml::EN_US,
        Language::ChineseSimplified => i18n_toml::ZH_CHS,
        Language::ChineseTraditional => i18n_toml::ZH_CHT,
        Language::French => i18n_toml::FR_FR,
        Language::Russian => i18n_toml::RU_RU,
        Language::Spanish => i18n_toml::ES_ES,
        Language::Arabic => i18n_toml::AR_SA,
        Language::Japanese => i18n_toml::JA_JP,
        Language::Korean => i18n_toml::KO_KR,
    }
}

pub fn load_keys(lang: Language) -> I18nKeys {
    let toml_content = get_toml_content(lang);
    load_toml(toml_content).expect("Failed to load TOML")
}

#[derive(Clone)]
pub struct LanguageContext {
    pub language: Signal<Language>,
}

pub fn use_language() -> LanguageContext {
    use_context::<LanguageContext>()
}

/// 响应式 I18n context - 使用 Signal 实现响应式更新
#[derive(Clone, Copy)]
pub struct ReactiveI18nContext {
    pub language: Signal<Language>,
    pub keys: Signal<I18nKeys>,
}

impl ReactiveI18nContext {
    pub fn keys(&self) -> I18nKeys {
        self.keys.read().clone()
    }
}

pub fn use_i18n() -> ReactiveI18nContext {
    use_context::<ReactiveI18nContext>()
}

#[derive(Clone, Props, PartialEq)]
pub struct I18nProviderWrapperProps {
    pub children: Element,
}

/// 从 URL 读取当前语言
#[cfg(target_arch = "wasm32")]
fn get_language_from_url() -> Language {
    web_sys::window()
        .and_then(|w| w.location().pathname().ok())
        .and_then(|path| path.split('/').nth(1).map(|s| s.to_string()))
        .and_then(|s| Language::from_url_prefix(&s))
        .unwrap_or_else(Language::default_lang)
}

#[cfg(not(target_arch = "wasm32"))]
fn get_language_from_url() -> Language {
    Language::default_lang()
}

#[component]
pub fn I18nProviderWrapper(props: I18nProviderWrapperProps) -> Element {
    let mut lang_ctx = use_language();
    let url_lang = get_language_from_url();

    let mut current_keys = use_signal(|| load_keys(url_lang));
    lang_ctx.language.set(url_lang);

    let _reactive_ctx = use_context_provider(|| ReactiveI18nContext {
        language: lang_ctx.language,
        keys: current_keys,
    });

    use_effect(move || {
        let current_lang = *lang_ctx.language.read();
        let new_keys = load_keys(current_lang);
        current_keys.set(new_keys);
    });

    rsx! {
        div {
            "data-language": "{lang_ctx.language.read().code()}",
            {props.children}
        }
    }
}

pub fn use_current_language() -> Language {
    let lang_ctx = use_language();
    let lang = *lang_ctx.language.read();
    lang
}

/// Hook to update language from route. Call this in route components.
pub fn use_update_language_from_route(lang: &str) {
    let parsed = Language::from_url_prefix(lang).unwrap_or_else(Language::default_lang);
    let mut lang_ctx = use_language();
    let current = *lang_ctx.language.read();

    if current != parsed {
        lang_ctx.language.set(parsed);
    }
}
