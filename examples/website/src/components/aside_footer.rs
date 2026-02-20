// website/src/components/aside_footer.rs
// Aside footer with theme toggle and language switcher using Popover + Menu

use dioxus::prelude::*;
use dioxus_router::{use_navigator, use_route};

use crate::{app::Route, hooks::use_language};
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

fn language_name_in(lang: Language, _display_lang: Language) -> String {
    lang.native_name().to_string()
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

fn get_route_with_lang(route: &Route, new_lang: &str) -> Option<Route> {
    match route {
        Route::LangHome { .. } => Some(Route::LangHome {
            lang: new_lang.to_string(),
        }),
        Route::ComponentsOverview { .. } => Some(Route::ComponentsOverview {
            lang: new_lang.to_string(),
        }),
        Route::AnimationDemo { .. } => Some(Route::AnimationDemo {
            lang: new_lang.to_string(),
        }),
        Route::DemosOverview { .. } => Some(Route::DemosOverview {
            lang: new_lang.to_string(),
        }),
        Route::FormDemo { .. } => Some(Route::FormDemo {
            lang: new_lang.to_string(),
        }),
        Route::DashboardDemo { .. } => Some(Route::DashboardDemo {
            lang: new_lang.to_string(),
        }),
        Route::VideoDemo { .. } => Some(Route::VideoDemo {
            lang: new_lang.to_string(),
        }),
        Route::Button { .. } => Some(Route::Button {
            lang: new_lang.to_string(),
        }),
        Route::Layer1Form { .. } => Some(Route::Layer1Form {
            lang: new_lang.to_string(),
        }),
        Route::Layer1Switch { .. } => Some(Route::Layer1Switch {
            lang: new_lang.to_string(),
        }),
        Route::Layer1Feedback { .. } => Some(Route::Layer1Feedback {
            lang: new_lang.to_string(),
        }),
        Route::Layer1Display { .. } => Some(Route::Layer1Display {
            lang: new_lang.to_string(),
        }),
        Route::NumberInput { .. } => Some(Route::NumberInput {
            lang: new_lang.to_string(),
        }),
        Route::Search { .. } => Some(Route::Search {
            lang: new_lang.to_string(),
        }),
        Route::Avatar { .. } => Some(Route::Avatar {
            lang: new_lang.to_string(),
        }),
        Route::Image { .. } => Some(Route::Image {
            lang: new_lang.to_string(),
        }),
        Route::Tag { .. } => Some(Route::Tag {
            lang: new_lang.to_string(),
        }),
        Route::Empty { .. } => Some(Route::Empty {
            lang: new_lang.to_string(),
        }),
        Route::Comment { .. } => Some(Route::Comment {
            lang: new_lang.to_string(),
        }),
        Route::Layer2Overview { .. } => Some(Route::Layer2Overview {
            lang: new_lang.to_string(),
        }),
        Route::Layer2Navigation { .. } => Some(Route::Layer2Navigation {
            lang: new_lang.to_string(),
        }),
        Route::Layer2Data { .. } => Some(Route::Layer2Data {
            lang: new_lang.to_string(),
        }),
        Route::Layer2Form { .. } => Some(Route::Layer2Form {
            lang: new_lang.to_string(),
        }),
        Route::Layer2Feedback { .. } => Some(Route::Layer2Feedback {
            lang: new_lang.to_string(),
        }),
        Route::Cascader { .. } => Some(Route::Cascader {
            lang: new_lang.to_string(),
        }),
        Route::Transfer { .. } => Some(Route::Transfer {
            lang: new_lang.to_string(),
        }),
        Route::Collapsible { .. } => Some(Route::Collapsible {
            lang: new_lang.to_string(),
        }),
        Route::Timeline { .. } => Some(Route::Timeline {
            lang: new_lang.to_string(),
        }),
        Route::Table { .. } => Some(Route::Table {
            lang: new_lang.to_string(),
        }),
        Route::Tree { .. } => Some(Route::Tree {
            lang: new_lang.to_string(),
        }),
        Route::Pagination { .. } => Some(Route::Pagination {
            lang: new_lang.to_string(),
        }),
        Route::QRCode { .. } => Some(Route::QRCode {
            lang: new_lang.to_string(),
        }),
        Route::Layer3Overview { .. } => Some(Route::Layer3Overview {
            lang: new_lang.to_string(),
        }),
        Route::Layer3Media { .. } => Some(Route::Layer3Media {
            lang: new_lang.to_string(),
        }),
        Route::Layer3Editor { .. } => Some(Route::Layer3Editor {
            lang: new_lang.to_string(),
        }),
        Route::Layer3Visualization { .. } => Some(Route::Layer3Visualization {
            lang: new_lang.to_string(),
        }),
        Route::UserGuide { .. } => Some(Route::UserGuide {
            lang: new_lang.to_string(),
        }),
        Route::ZoomControls { .. } => Some(Route::ZoomControls {
            lang: new_lang.to_string(),
        }),
        Route::SystemOverview { .. } => Some(Route::SystemOverview {
            lang: new_lang.to_string(),
        }),
        Route::SystemCSS { .. } => Some(Route::SystemCSS {
            lang: new_lang.to_string(),
        }),
        Route::SystemIcons { .. } => Some(Route::SystemIcons {
            lang: new_lang.to_string(),
        }),
        Route::SystemPalette { .. } => Some(Route::SystemPalette {
            lang: new_lang.to_string(),
        }),
        Route::SystemAnimations { .. } => Some(Route::SystemAnimations {
            lang: new_lang.to_string(),
        }),
        Route::SystemI18n { .. } => Some(Route::SystemI18n {
            lang: new_lang.to_string(),
        }),
        Route::NotFound { .. } => Some(Route::LangHome {
            lang: new_lang.to_string(),
        }),
        Route::RootRedirect { .. } => Some(Route::LangHome {
            lang: new_lang.to_string(),
        }),
        Route::LegacyRedirect { .. } => Some(Route::LangHome {
            lang: new_lang.to_string(),
        }),
    }
}

/// Aside footer component with theme toggle and language switcher
#[component]
pub fn AsideFooter() -> Element {
    let theme = use_theme();
    let lang_ctx = use_language();
    let mut language = lang_ctx.language;
    let mut is_popover_open = use_signal(|| false);
    let current_route = use_route::<Route>();
    let navigator = use_navigator();

    let current_icon = use_memo(move || {
        let theme_name = theme.palette.cloned();
        if theme_name == "hikari" {
            MdiIcon::WhiteBalanceSunny
        } else {
            MdiIcon::MoonWaningCrescent
        }
    });

    let icon_key = use_memo(move || format!("{:?}", current_icon.read()));

    let container_classes = ClassesBuilder::new()
        .add(Display::Flex)
        .add(FlexDirection::Row)
        .add(JustifyContent::Center)
        .add(Gap::Gap2)
        .add(Shadow::Md)
        .build();

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
                            onclick: {
                                let current_route = current_route.clone();
                                let navigator = navigator.clone();
                                move |_| {
                                    language.set(Language::English);
                                    is_popover_open.set(false);
                                    if let Some(new_route) = get_route_with_lang(&current_route, "en") {
                                        navigator.push(new_route);
                                    }
                                }
                            },
                            "{language_bilingual_display(Language::English, current_lang)}"
                        }
                        MenuItem {
                            item_key: "zh".to_string(),
                            height: MenuItemHeight::Compact,
                            onclick: {
                                let current_route = current_route.clone();
                                let navigator = navigator.clone();
                                move |_| {
                                    language.set(Language::ChineseSimplified);
                                    is_popover_open.set(false);
                                    if let Some(new_route) = get_route_with_lang(&current_route, "zh-chs") {
                                        navigator.push(new_route);
                                    }
                                }
                            },
                            "{language_bilingual_display(Language::ChineseSimplified, current_lang)}"
                        }
                        MenuItem {
                            item_key: "tw".to_string(),
                            height: MenuItemHeight::Compact,
                            onclick: {
                                let current_route = current_route.clone();
                                let navigator = navigator.clone();
                                move |_| {
                                    language.set(Language::ChineseTraditional);
                                    is_popover_open.set(false);
                                    if let Some(new_route) = get_route_with_lang(&current_route, "zh-cht") {
                                        navigator.push(new_route);
                                    }
                                }
                            },
                            "{language_bilingual_display(Language::ChineseTraditional, current_lang)}"
                        }
                        MenuItem {
                            item_key: "fr".to_string(),
                            height: MenuItemHeight::Compact,
                            onclick: {
                                let current_route = current_route.clone();
                                let navigator = navigator.clone();
                                move |_| {
                                    language.set(Language::French);
                                    is_popover_open.set(false);
                                    if let Some(new_route) = get_route_with_lang(&current_route, "fr") {
                                        navigator.push(new_route);
                                    }
                                }
                            },
                            "{language_bilingual_display(Language::French, current_lang)}"
                        }
                        MenuItem {
                            item_key: "ru".to_string(),
                            height: MenuItemHeight::Compact,
                            onclick: {
                                let current_route = current_route.clone();
                                let navigator = navigator.clone();
                                move |_| {
                                    language.set(Language::Russian);
                                    is_popover_open.set(false);
                                    if let Some(new_route) = get_route_with_lang(&current_route, "ru") {
                                        navigator.push(new_route);
                                    }
                                }
                            },
                            "{language_bilingual_display(Language::Russian, current_lang)}"
                        }
                        MenuItem {
                            item_key: "es".to_string(),
                            height: MenuItemHeight::Compact,
                            onclick: {
                                let current_route = current_route.clone();
                                let navigator = navigator.clone();
                                move |_| {
                                    language.set(Language::Spanish);
                                    is_popover_open.set(false);
                                    if let Some(new_route) = get_route_with_lang(&current_route, "es") {
                                        navigator.push(new_route);
                                    }
                                }
                            },
                            "{language_bilingual_display(Language::Spanish, current_lang)}"
                        }
                        MenuItem {
                            item_key: "ar".to_string(),
                            height: MenuItemHeight::Compact,
                            onclick: {
                                let current_route = current_route.clone();
                                let navigator = navigator.clone();
                                move |_| {
                                    language.set(Language::Arabic);
                                    is_popover_open.set(false);
                                    if let Some(new_route) = get_route_with_lang(&current_route, "ar") {
                                        navigator.push(new_route);
                                    }
                                }
                            },
                            "{language_bilingual_display(Language::Arabic, current_lang)}"
                        }
                        MenuItem {
                            item_key: "ja".to_string(),
                            height: MenuItemHeight::Compact,
                            onclick: {
                                let current_route = current_route.clone();
                                let navigator = navigator.clone();
                                move |_| {
                                    language.set(Language::Japanese);
                                    is_popover_open.set(false);
                                    if let Some(new_route) = get_route_with_lang(&current_route, "ja") {
                                        navigator.push(new_route);
                                    }
                                }
                            },
                            "{language_bilingual_display(Language::Japanese, current_lang)}"
                        }
                        MenuItem {
                            item_key: "ko".to_string(),
                            height: MenuItemHeight::Compact,
                            onclick: {
                                let current_route = current_route.clone();
                                let navigator = navigator.clone();
                                move |_| {
                                    language.set(Language::Korean);
                                    is_popover_open.set(false);
                                    if let Some(new_route) = get_route_with_lang(&current_route, "ko") {
                                        navigator.push(new_route);
                                    }
                                }
                            },
                            "{language_bilingual_display(Language::Korean, current_lang)}"
                        }
                    }
                }
            }
        }
    }
}
