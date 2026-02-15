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
    pub sidebar: SidebarKeys,
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SidebarKeys {
    pub overview: SidebarCategoryKeys,
    pub components: SidebarCategoryKeys,
    pub system: SidebarCategoryKeys,
    pub demos: SidebarCategoryKeys,
    pub items: SidebarItemKeys,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SidebarCategoryKeys {
    pub title: String,
    pub home: Option<String>,
    pub layer1: Option<String>,
    pub layer2: Option<String>,
    pub layer3: Option<String>,
    pub overview: Option<String>,
    pub css_utilities: Option<String>,
    pub icons: Option<String>,
    pub palette: Option<String>,
    pub animations: Option<String>,
    pub animation_demo: Option<String>,
    pub all_demos: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SidebarItemKeys {
    pub button: String,
    pub form: String,
    pub number_input: String,
    pub search: String,
    pub switch: String,
    pub feedback: String,
    pub display: String,
    pub avatar: String,
    pub image: String,
    pub tag: String,
    pub empty: String,
    pub comment: String,
    pub description_list: String,
    pub navigation: String,
    pub collapsible: String,
    pub data: String,
    pub table: String,
    pub tree: String,
    pub pagination: String,
    pub qrcode: String,
    pub timeline: String,
    pub cascader: String,
    pub transfer: String,
    pub media: String,
    pub editor: String,
    pub visualization: String,
    pub user_guide: String,
    pub zoom_controls: String,
    pub form_demo: String,
    pub dashboard_demo: String,
    pub video_demo: String,
}
