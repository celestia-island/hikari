use std::collections::HashMap;

use tairitsu_web::i18n::{load_toml_flat, provide_i18n, Language};

use crate::hooks;

pub fn init() {
    let initial_lang = hooks::detect_language();
    let mut translations: HashMap<Language, HashMap<String, String>> = HashMap::new();

    translations.insert(
        Language::ENGLISH,
        load_toml_flat(include_str!("../locales/en/strings.toml"))
            .expect("Failed to load en translations"),
    );
    translations.insert(
        Language::CHINESE_SIMPLIFIED,
        load_toml_flat(include_str!("../locales/zhs/strings.toml"))
            .expect("Failed to load zhs translations"),
    );
    translations.insert(
        Language::CHINESE_TRADITIONAL,
        load_toml_flat(include_str!("../locales/zht/strings.toml"))
            .expect("Failed to load zht translations"),
    );
    translations.insert(
        Language::JAPANESE,
        load_toml_flat(include_str!("../locales/ja/strings.toml"))
            .expect("Failed to load ja translations"),
    );
    translations.insert(
        Language::KOREAN,
        load_toml_flat(include_str!("../locales/ko/strings.toml"))
            .expect("Failed to load ko translations"),
    );
    translations.insert(
        Language::FRENCH,
        load_toml_flat(include_str!("../locales/fr/strings.toml"))
            .expect("Failed to load fr translations"),
    );
    translations.insert(
        Language::SPANISH,
        load_toml_flat(include_str!("../locales/es/strings.toml"))
            .expect("Failed to load es translations"),
    );
    translations.insert(
        Language::RUSSIAN,
        load_toml_flat(include_str!("../locales/ru/strings.toml"))
            .expect("Failed to load ru translations"),
    );
    translations.insert(
        Language::ARABIC,
        load_toml_flat(include_str!("../locales/ar/strings.toml"))
            .expect("Failed to load ar translations"),
    );

    provide_i18n(initial_lang, translations);
}
