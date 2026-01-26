// website/src/components/aside_footer.rs
// Aside footer with theme toggle and language switcher using Dropdown + Menu

use dioxus::prelude::*;

use crate::app::ThemeContext;
use _components::{
    basic::{Arrow, ArrowDirection, Button, ButtonVariant, ButtonWidth, IconButton},
    feedback::{
        Dropdown, DropdownPosition, DropdownPositioning, GlowBlur, GlowColor, GlowIntensity,
    },
    navigation::{Menu, MenuItem},
};
use _icons::{Icon, MdiIcon};
use _palette::classes::{ClassesBuilder, Display, FlexDirection, Gap, JustifyContent, Shadow};

/// Language type
#[derive(Clone, Copy, Debug, PartialEq, Default)]
pub enum Language {
    #[default]
    English,
    SimplifiedChinese,
    TraditionalChinese,
}

impl Language {
    /// Get full language name
    pub fn full_name(&self) -> &'static str {
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
    let mut is_dropdown_open = use_signal(|| false);

    // Compute current theme icon
    let current_icon = use_memo(move || {
        let theme = theme_context.theme.read();
        if theme.as_str() == "hikari" {
            MdiIcon::WhiteBalanceSunny
        } else {
            MdiIcon::MoonWaningCrescent
        }
    });

    let icon_key = use_memo(move || format!("{:?}", current_icon.read()));

    let lang = *selected_language.read();

    // Container styles - centered layout
    let container_classes = ClassesBuilder::new()
        .add(Display::Flex)
        .add(FlexDirection::Row)
        .add(JustifyContent::Center)
        .add(Gap::Gap2)
        .add(Shadow::Md)
        .build();

    rsx! {
        div {
            class: "hi-aside-footer {container_classes}",

            // Theme toggle button - IconButton (square)
            IconButton {
                key: "{icon_key}",
                icon: *current_icon.read(),
                size: 36,
                glow: true,
                glow_blur: GlowBlur::Medium,
                glow_color: GlowColor::Ghost,
                glow_intensity: GlowIntensity::Subtle,
                onclick: move |_| {
                    let current = theme_context.theme.read().clone();
                    let new_theme = if current.as_str() == "hikari" { "tairitsu" } else { "hikari" };
                    theme_context.theme.set(new_theme.to_string());
                }
            }

            // Language switcher using Dropdown + Menu - Square IconButton
            Dropdown {
                positioning: DropdownPositioning::TriggerBased,
                position: DropdownPosition::Top,
                close_on_click_outside: true,
                close_on_select: true,
                on_open_change: move |open| is_dropdown_open.set(open),
                trigger: rsx! {
                    IconButton {
                        icon: MdiIcon::Translate,
                        size: 36,
                        glow: true,
                        glow_blur: GlowBlur::Medium,
                        glow_color: GlowColor::Ghost,
                        glow_intensity: GlowIntensity::Subtle,
                        onclick: move |_| {},
                    }
                },
                Menu {
                    MenuItem {
                        item_key: "en".to_string(),
                        onclick: move |_| {
                            selected_language.set(Language::English);
                        },
                        "English"
                    }
                    MenuItem {
                        item_key: "zh".to_string(),
                        onclick: move |_| {
                            selected_language.set(Language::SimplifiedChinese);
                        },
                        "简体中文"
                    }
                    MenuItem {
                        item_key: "tw".to_string(),
                        onclick: move |_| {
                            selected_language.set(Language::TraditionalChinese);
                        },
                        "繁體中文"
                    }
                }
            }
        }
    }
}
