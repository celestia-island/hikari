use std::collections::HashMap;

use hikari_i18n::{loader::load_toml_flat, provide_i18n, Language};

pub fn init() {
    let mut translations: HashMap<Language, HashMap<String, String>> = HashMap::new();

    translations.insert(
        Language::English,
        load_toml_flat(include_str!(
            "../../../packages/i18n/locales/en-US/strings.toml"
        ))
        .expect("Failed to load en-US translations"),
    );
    translations.insert(
        Language::ChineseSimplified,
        load_toml_flat(include_str!(
            "../../../packages/i18n/locales/zh-CHS/strings.toml"
        ))
        .expect("Failed to load zh-CHS translations"),
    );
    translations.insert(
        Language::ChineseTraditional,
        load_toml_flat(include_str!(
            "../../../packages/i18n/locales/zh-CHT/strings.toml"
        ))
        .expect("Failed to load zh-CHT translations"),
    );
    translations.insert(
        Language::Japanese,
        load_toml_flat(include_str!(
            "../../../packages/i18n/locales/ja-JP/strings.toml"
        ))
        .expect("Failed to load ja-JP translations"),
    );
    translations.insert(
        Language::Korean,
        load_toml_flat(include_str!(
            "../../../packages/i18n/locales/ko-KR/strings.toml"
        ))
        .expect("Failed to load ko-KR translations"),
    );
    translations.insert(
        Language::French,
        load_toml_flat(include_str!(
            "../../../packages/i18n/locales/fr-FR/strings.toml"
        ))
        .expect("Failed to load fr-FR translations"),
    );
    translations.insert(
        Language::Spanish,
        load_toml_flat(include_str!(
            "../../../packages/i18n/locales/es-ES/strings.toml"
        ))
        .expect("Failed to load es-ES translations"),
    );
    translations.insert(
        Language::Russian,
        load_toml_flat(include_str!(
            "../../../packages/i18n/locales/ru-RU/strings.toml"
        ))
        .expect("Failed to load ru-RU translations"),
    );
    translations.insert(
        Language::Arabic,
        load_toml_flat(include_str!(
            "../../../packages/i18n/locales/ar-SA/strings.toml"
        ))
        .expect("Failed to load ar-SA translations"),
    );

    provide_i18n(Language::default_lang(), translations);
}
