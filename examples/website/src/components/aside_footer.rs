// website/src/components/aside_footer.rs
// Aside footer with theme toggle and language switcher - simplified version

use dioxus::prelude::*;

use crate::app::ThemeContext;
use _components::basic::{Button, ButtonVariant};
use _icons::MdiIcon;

/// Language type
#[derive(Clone, Copy, Debug, PartialEq, Default)]
pub enum Language {
    #[default]
    English,
    SimplifiedChinese,
    TraditionalChinese,
}

impl Language {
    /// Get current language label (localized)
    pub fn current_label(&self) -> &'static str {
        match self {
            Language::English => "English",
            Language::SimplifiedChinese => "简体中文",
            Language::TraditionalChinese => "繁體中文",
        }
    }
}

/// Aside footer component with theme toggle and language switcher
#[component]
pub fn AsideFooter() -> Element {
    let mut theme_context = use_context::<ThemeContext>();
    let mut selected_language = use_signal(|| Language::English);

    // Compute current theme icon
    let current_icon = use_memo(move || {
        let theme = theme_context.theme.read();
        if theme.as_str() == "hikari" {
            MdiIcon::WhiteBalanceSunny
        } else {
            MdiIcon::MoonWaningCrescent
        }
    });

    // Create a reactive key that changes when the theme/icon changes
    let icon_key = use_memo(move || format!("{:?}", current_icon.read()));

    rsx! {
        // Theme toggle and language switcher
        div {
            class: "hi-aside-footer-container",

            // Theme toggle button
            Button {
                key: "{icon_key}",
                variant: ButtonVariant::Ghost,
                class: "hi-aside-footer-button",
                icon: rsx! {
                    _icons::Icon {
                        icon: *current_icon.read(),
                        size: 20,
                    }
                },
                onclick: move |_| {
                    let current = theme_context.theme.read().clone();
                    let new_theme = if current.as_str() == "hikari" { "tairitsu" } else { "hikari" };
                    theme_context.theme.set(new_theme.to_string());
                }
            }

            // Language switcher button
            Button {
                variant: ButtonVariant::Ghost,
                class: "hi-aside-footer-button",
                icon: rsx! {
                    _icons::Icon {
                        icon: MdiIcon::Information,
                        size: 20,
                    }
                },
                onclick: move |_| {
                    let current_lang = *selected_language.read();
                    let new_lang = match current_lang {
                        Language::English => Language::SimplifiedChinese,
                        Language::SimplifiedChinese => Language::TraditionalChinese,
                        Language::TraditionalChinese => Language::English,
                    };
                    selected_language.set(new_lang);
                }
            }

            // Current language indicator
            div {
                class: "hi-aside-footer-language",
                "{selected_language().current_label()}"
            }
        }
    }
}
