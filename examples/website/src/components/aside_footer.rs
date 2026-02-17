// website/src/components/aside_footer.rs
// Aside footer with theme toggle and language switcher using Popover + Menu

use dioxus::prelude::*;

use _components::{
    basic::{IconButton, IconButtonSize},
    feedback::{GlowBlur, GlowColor, GlowIntensity, Popover, PopoverPlacement, PopoverPositioning},
    navigation::{Menu, MenuItem, MenuItemHeight},
    use_theme,
};
use _icons::MdiIcon;
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
    /// Get language name in the specified language
    pub fn name_in(&self, lang: Language) -> String {
        match (self, lang) {
            // English names
            (Language::English, Language::English) => "English",
            (Language::SimplifiedChinese, Language::English) => "Simplified Chinese",
            (Language::TraditionalChinese, Language::English) => "Traditional Chinese",
            // Simplified Chinese names
            (Language::English, Language::SimplifiedChinese) => "英语",
            (Language::SimplifiedChinese, Language::SimplifiedChinese) => "简体中文",
            (Language::TraditionalChinese, Language::SimplifiedChinese) => "繁体中文",
            // Traditional Chinese names
            (Language::English, Language::TraditionalChinese) => "英語",
            (Language::SimplifiedChinese, Language::TraditionalChinese) => "簡體中文",
            (Language::TraditionalChinese, Language::TraditionalChinese) => "繁體中文",
        }
        .to_string()
    }

    /// Get bilingual display: "Native Name - Current Language Name"
    pub fn bilingual_display(&self, current_lang: Language) -> String {
        let native = self.name_in(*self);
        if *self == current_lang {
            native
        } else {
            let in_current = self.name_in(current_lang);
            format!("{} - {}", in_current, native)
        }
    }
}

/// Aside footer component with theme toggle and language switcher
#[component]
pub fn AsideFooter() -> Element {
    let theme = use_theme();
    let mut selected_language = use_signal(|| Language::English);
    let mut is_popover_open = use_signal(|| false);

    // Compute current theme icon
    let current_icon = use_memo(move || {
        let theme_name = theme.palette.cloned();
        if theme_name == "hikari" {
            MdiIcon::WhiteBalanceSunny
        } else {
            MdiIcon::MoonWaningCrescent
        }
    });

    let icon_key = use_memo(move || format!("{:?}", current_icon.read()));

    // Container styles - centered layout
    let container_classes = ClassesBuilder::new()
        .add(Display::Flex)
        .add(FlexDirection::Row)
        .add(JustifyContent::Center)
        .add(Gap::Gap2)
        .add(Shadow::Md)
        .build();

    // Close callback for menu items
    let request_close = Callback::new(move |_| {
        is_popover_open.set(false);
    });

    let current_lang = *selected_language.read();

    rsx! {
        div {
            class: "hi-aside-footer {container_classes}",

            // Theme toggle button
            IconButton {
                key: "{icon_key}",
                icon: *current_icon.read(),
                size: IconButtonSize::Large,
                glow: true,
                glow_blur: GlowBlur::Medium,
                glow_color: GlowColor::Ghost,
                glow_intensity: GlowIntensity::Thirty,
                onclick: move |_| {
                    let icon = *current_icon.read();
                    let new_theme = if icon == MdiIcon::WhiteBalanceSunny {
                        "tairitsu".to_string()
                    } else {
                        "hikari".to_string()
                    };
                    theme.set_theme.call(new_theme);
                }
            }

            // Language switcher using Popover + Menu
            Popover {
                open: *is_popover_open.read(),
                positioning: PopoverPositioning::Relative {
                    preferred: vec![PopoverPlacement::Top, PopoverPlacement::Bottom],
                },
                close_on_click_outside: true,
                on_open_change: move |open| is_popover_open.set(open),
                trigger: rsx! {
                    IconButton {
                        icon: MdiIcon::Translate,
                        size: IconButtonSize::Large,
                        glow: true,
                        glow_blur: GlowBlur::Medium,
                        glow_color: GlowColor::Ghost,
                        glow_intensity: GlowIntensity::Thirty,
                        onclick: move |_| {},
                    }
                },
                Menu {
                    in_popover: true,
                    request_close: Some(request_close),
                    MenuItem {
                        item_key: "en".to_string(),
                        height: MenuItemHeight::Compact,
                        onclick: move |_| {
                            selected_language.set(Language::English);
                        },
                        "{Language::English.bilingual_display(current_lang)}"
                    }
                    MenuItem {
                        item_key: "zh".to_string(),
                        height: MenuItemHeight::Compact,
                        onclick: move |_| {
                            selected_language.set(Language::SimplifiedChinese);
                        },
                        "{Language::SimplifiedChinese.bilingual_display(current_lang)}"
                    }
                    MenuItem {
                        item_key: "tw".to_string(),
                        height: MenuItemHeight::Compact,
                        onclick: move |_| {
                            selected_language.set(Language::TraditionalChinese);
                        },
                        "{Language::TraditionalChinese.bilingual_display(current_lang)}"
                    }
                }
            }
        }
    }
}
