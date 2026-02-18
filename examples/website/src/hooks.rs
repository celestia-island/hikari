// website/src/hooks.rs
// Custom hooks for the website

use _i18n::{
    context::{I18nContext, Language},
    I18nProvider,
};
use dioxus::prelude::*;

mod i18n_toml {
    pub const EN_US: &str = include_str!("../../../packages/i18n/locales/en-US/strings.toml");
    pub const ZH_CHS: &str = include_str!("../../../packages/i18n/locales/zh-CHS/strings.toml");
    pub const ZH_CHT: &str = include_str!("../../../packages/i18n/locales/zh-CHT/strings.toml");
}

pub fn get_toml_content(lang: Language) -> &'static str {
    match lang {
        Language::English => i18n_toml::EN_US,
        Language::ChineseSimplified => i18n_toml::ZH_CHS,
        Language::ChineseTraditional => i18n_toml::ZH_CHT,
    }
}

#[derive(Clone)]
pub struct LanguageContext {
    pub language: Signal<Language>,
}

pub fn use_language() -> LanguageContext {
    use_context::<LanguageContext>()
}

pub fn use_i18n() -> Option<I18nContext> {
    try_consume_context::<I18nContext>()
}

#[derive(Clone, Props, PartialEq)]
pub struct I18nProviderWrapperProps {
    pub children: Element,
}

#[component]
pub fn I18nProviderWrapper(props: I18nProviderWrapperProps) -> Element {
    let lang_ctx = use_language();

    // 使用 memo 建立对 language signal 的响应式依赖
    let lang = use_memo(move || *lang_ctx.language.read());
    let toml_content = get_toml_content(*lang.read());

    rsx! {
        I18nProvider {
            key: "{lang:?}",
            language: *lang.read(),
            toml_content,
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
