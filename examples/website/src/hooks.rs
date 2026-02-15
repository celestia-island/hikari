// website/src/hooks.rs
// Custom hooks for the website

use _i18n::{
    context::{I18nContext, Language},
    I18nProvider,
};
use dioxus::prelude::*;

mod i18n_toml {
    pub const EN_US: &str = include_str!("../../../packages/i18n/locales/en-US/strings.toml");
    pub const ZH_CN: &str = include_str!("../../../packages/i18n/locales/zh-CN/strings.toml");
    pub const ZH_TW: &str = include_str!("../../../packages/i18n/locales/zh-TW/strings.toml");
}

pub fn get_toml_content(lang: Language) -> &'static str {
    match lang {
        Language::English => i18n_toml::EN_US,
        Language::ChineseSimplified => i18n_toml::ZH_CN,
        Language::ChineseTraditional => i18n_toml::ZH_TW,
    }
}

pub fn use_i18n() -> Option<I18nContext> {
    try_consume_context::<I18nContext>()
}

#[derive(Clone, Props, PartialEq)]
pub struct I18nProviderWrapperProps {
    pub language: Signal<Language>,
    pub children: Element,
}

#[component]
pub fn I18nProviderWrapper(props: I18nProviderWrapperProps) -> Element {
    let lang = (props.language)();
    let toml_content = get_toml_content(lang);

    rsx! {
        I18nProvider {
            language: lang,
            toml_content,
            {props.children}
        }
    }
}
