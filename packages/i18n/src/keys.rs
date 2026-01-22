//! # I18n Keys
//!
//! Language key structures for internationalization.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct I18nKeys {
    pub common: CommonKeys,
    pub theme: ThemeKeys,
    pub page: PageKeys,
    pub language: LanguageKeys,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommonKeys {
    pub button: ButtonKeys,
    pub navigation: NavigationKeys,
    pub status: StatusKeys,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ButtonKeys {
    pub submit: String,
    pub cancel: String,
    pub confirm: String,
    pub delete: String,
    pub edit: String,
    pub save: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NavigationKeys {
    pub home: String,
    pub about: String,
    pub documentation: String,
    pub components: String,
    pub theme: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatusKeys {
    pub loading: String,
    pub success: String,
    pub error: String,
    pub warning: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThemeKeys {
    pub light: String,
    pub dark: String,
    pub auto: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PageKeys {
    pub home: HomeKeys,
    pub components: ComponentsKeys,
    pub documentation: DocumentationKeys,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HomeKeys {
    pub hero: HeroKeys,
    pub features: FeaturesKeys,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HeroKeys {
    pub title: String,
    pub subtitle: String,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FeaturesKeys {
    pub title: String,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComponentsKeys {
    pub title: String,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentationKeys {
    pub title: String,
    pub description: String,
    pub getting_started: String,
    pub quick_start: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LanguageKeys {
    pub english: String,
    pub chinese_simplified: String,
    pub chinese_traditional: String,
}
