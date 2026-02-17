// website/src/components/aside_footer.rs
// Aside footer with theme toggle and language switcher using Popover + Menu

use dioxus::prelude::*;

use crate::hooks::use_language;
use _components::{
    basic::{IconButton, IconButtonSize},
    feedback::{GlowBlur, GlowColor, GlowIntensity, Popover, PopoverPlacement, PopoverPositioning},
    layout::{Direction, FlexBox, FlexGap},
    navigation::{Menu, MenuItem, MenuItemHeight},
    use_theme,
};
use _i18n::context::Language;
use _icons::MdiIcon;
use _palette::classes::{ClassesBuilder, Display, FlexDirection, Gap, JustifyContent, Shadow};

fn language_name_in(lang: Language, display_lang: Language) -> String {
    match (lang, display_lang) {
        (Language::English, Language::English) => "English",
        (Language::ChineseSimplified, Language::English) => "Simplified Chinese",
        (Language::ChineseTraditional, Language::English) => "Traditional Chinese",
        (Language::English, Language::ChineseSimplified) => "英语",
        (Language::ChineseSimplified, Language::ChineseSimplified) => "简体中文",
        (Language::ChineseTraditional, Language::ChineseSimplified) => "繁体中文",
        (Language::English, Language::ChineseTraditional) => "英語",
        (Language::ChineseSimplified, Language::ChineseTraditional) => "簡體中文",
        (Language::ChineseTraditional, Language::ChineseTraditional) => "繁體中文",
    }
    .to_string()
}

fn language_bilingual_display(lang: Language, current_lang: Language) -> String {
    let native = language_name_in(lang, lang);
    if lang == current_lang {
        native
    } else {
        let in_current = language_name_in(lang, current_lang);
        format!("{} - {}", in_current, native)
    }
}

/// Aside footer component with theme toggle and language switcher
#[component]
pub fn AsideFooter() -> Element {
    let theme = use_theme();
    let lang_ctx = use_language();
    let mut language = lang_ctx.language;
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

    let current_lang = *language.read();

    rsx! {
        div {
            class: "hi-aside-footer {container_classes}",

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
                FlexBox {
                    min_width: Some("140px".to_string()),
                    direction: Direction::Column,
                    gap: FlexGap::Gap1,
                    Menu {
                        in_popover: true,
                        request_close: Some(request_close),
                        MenuItem {
                            item_key: "en".to_string(),
                            height: MenuItemHeight::Compact,
                            onclick: move |_| {
                                language.set(Language::English);
                            },
                            "{language_bilingual_display(Language::English, current_lang)}"
                        }
                        MenuItem {
                            item_key: "zh".to_string(),
                            height: MenuItemHeight::Compact,
                            onclick: move |_| {
                                language.set(Language::ChineseSimplified);
                            },
                            "{language_bilingual_display(Language::ChineseSimplified, current_lang)}"
                        }
                        MenuItem {
                            item_key: "tw".to_string(),
                            height: MenuItemHeight::Compact,
                            onclick: move |_| {
                                language.set(Language::ChineseTraditional);
                            },
                            "{language_bilingual_display(Language::ChineseTraditional, current_lang)}"
                        }
                    }
                }
            }
        }
    }
}
