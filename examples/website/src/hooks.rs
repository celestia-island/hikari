// website/src/hooks.rs
// Custom hooks for the website

use _i18n::{context::Language, keys::I18nKeys, loader::load_toml};
use dioxus::prelude::*;
use std::cell::RefCell;

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

/// 响应式 I18n context
pub struct ReactiveI18nContext {
    pub language: Signal<Language>,
    keys: RefCell<I18nKeys>,
}

impl ReactiveI18nContext {
    pub fn keys(&self) -> std::cell::Ref<'_, I18nKeys> {
        self.keys.borrow()
    }

    fn update_keys(&self, lang: Language) {
        let mut keys = self.keys.borrow_mut();
        *keys = load_keys(lang);
    }
}

impl Clone for ReactiveI18nContext {
    fn clone(&self) -> Self {
        Self {
            language: self.language,
            keys: RefCell::new(self.keys.borrow().clone()),
        }
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

    // 提供响应式 context，初始值直接从 URL 读取
    let reactive_ctx = use_context_provider(|| {
        let url_lang = get_language_from_url();
        lang_ctx.language.set(url_lang);
        ReactiveI18nContext {
            language: lang_ctx.language,
            keys: RefCell::new(load_keys(url_lang)),
        }
    });

    // 监听语言变化
    use_effect(move || {
        let current_lang = *lang_ctx.language.read();
        reactive_ctx.update_keys(current_lang);
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
