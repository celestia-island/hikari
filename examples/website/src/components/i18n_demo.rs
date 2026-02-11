// website/src/components/i18n_demo.rs
// i18n demonstration component

use dioxus::prelude::*;
use _i18n::{context::Language, I18nProvider, LanguageSwitcher, use_i18n};

/// Sample TOML content for English
const EN_US_TOML: &str = r#"
[common.button]
submit = "Submit"
cancel = "Cancel"
confirm = "Confirm"
delete = "Delete"
edit = "Edit"
save = "Save"

[common.navigation]
home = "Home"
about = "About"
documentation = "Documentation"
components = "Components"
theme = "Theme"

[common.status]
loading = "Loading..."
success = "Success"
error = "Error"
warning = "Warning"

[theme]
light = "Light"
dark = "Dark"
auto = "Auto"

[page.home.hero]
title = "Hikari UI Framework"
subtitle = "光 - Modern Rust UI Components"
description = "A beautiful UI component library built with Dioxus, featuring traditional Chinese colors and futuristic design."

[page.home.features]
title = "Features"
description = "Explore our comprehensive component library"

[page.components]
title = "Components"
description = "Production-ready UI components for your next project"

[page.documentation]
title = "Documentation"
description = "Learn how to use Hikari in your projects"
getting_started = "Getting Started"
quick_start = "Quick Start"

[language]
english = "English"
chinese_simplified = "简体中文"
chinese_traditional = "繁體中文"
"#;

/// Sample TOML content for Simplified Chinese
const ZH_CN_TOML: &str = r#"
[common.button]
submit = "提交"
cancel = "取消"
confirm = "确认"
delete = "删除"
edit = "编辑"
save = "保存"

[common.navigation]
home = "首页"
about = "关于"
documentation = "文档"
components = "组件"
theme = "主题"

[common.status]
loading = "加载中..."
success = "成功"
error = "错误"
warning = "警告"

[theme]
light = "浅色"
dark = "深色"
auto = "自动"

[page.home.hero]
title = "Hikari UI 框架"
subtitle = "光 - 现代化 Rust UI 组件"
description = "基于 Dioxus 构建的精美 UI 组件库，融合中国传统色彩与未来主义设计。"

[page.home.features]
title = "特性"
description = "探索我们全面的组件库"

[page.components]
title = "组件"
description = "为您的下一个项目提供生产就绪的 UI 组件"

[page.documentation]
title = "文档"
description = "学习如何在您的项目中使用 Hikari"
getting_started = "快速开始"
quick_start = "快速入门"

[language]
english = "English"
chinese_simplified = "简体中文"
chinese_traditional = "繁體中文"
"#;

/// Sample TOML content for Traditional Chinese
const ZH_TW_TOML: &str = r#"
[common.button]
submit = "提交"
cancel = "取消"
confirm = "確認"
delete = "刪除"
edit = "編輯"
save = "儲存"

[common.navigation]
home = "首頁"
about = "關於"
documentation = "文件"
components = "組件"
theme = "主題"

[common.status]
loading = "載入中..."
success = "成功"
error = "錯誤"
warning = "警告"

[theme]
light = "淺色"
dark = "深色"
auto = "自動"

[page.home.hero]
title = "Hikari UI 框架"
subtitle = "光 - 現代化 Rust UI 組件"
description = "基於 Dioxus 構建的精美 UI 組件庫，融合中國傳統色彩與未來主義設計。"

[page.home.features]
title = "特性"
description = "探索我們全面的組件庫"

[page.components]
title = "組件"
description = "為您的下一個專案提供生產就緒的 UI 組件"

[page.documentation]
title = "文件"
description = "學習如何在您的專案中使用 Hikari"
getting_started = "快速開始"
quick_start = "快速入門"

[language]
english = "English"
chinese_simplified = "简体中文"
chinese_traditional = "繁體中文"
"#;

/// i18n Demo component
#[component]
pub fn I18nDemo() -> Element {
    let mut language = use_signal(|| Language::English);

    let toml_content = match language() {
        Language::English => EN_US_TOML,
        Language::ChineseSimplified => ZH_CN_TOML,
        Language::ChineseTraditional => ZH_TW_TOML,
    };

    rsx! {
        I18nProvider {
            language: language(),
            toml_content: toml_content,
            div {
                class: "hi-i18n-demo",
                style: "padding: 2rem; max-width: 1200px; margin: 0 auto;",

                // Language switcher
                div {
                    class: "hi-i18n-demo-header",
                    style: "display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;",
                    h2 { "I18n Demo / 国际化演示" }
                    LanguageSwitcher {
                        current_language: language(),
                        on_language_change: move |lang| language.set(lang),
                    }
                }

                // Demo content using i18n keys
                I18nDemoContent {}
            }
        }
    }
}

/// Inner component that uses i18n context
#[component]
fn I18nDemoContent() -> Element {
    let i18n = use_i18n();

    rsx! {
        div {
            class: "hi-i18n-demo-content",

            // Hero section
            div {
                class: "hi-i18n-demo-hero",
                style: "text-align: center; padding: 3rem 0; margin-bottom: 2rem; background: linear-gradient(135deg, var(--hi-color-primary) 0%, var(--hi-color-secondary) 100%); border-radius: 8px; color: white;",
                h1 { style: "font-size: 2.5rem; margin-bottom: 0.5rem;", "{i18n.keys.page.home.hero.title}" }
                h3 { style: "font-size: 1.5rem; margin-bottom: 1rem; opacity: 0.9;", "{i18n.keys.page.home.hero.subtitle}" }
                p { style: "font-size: 1rem; max-width: 600px; margin: 0 auto; opacity: 0.85;", "{i18n.keys.page.home.hero.description}" }
            }

            // Features section
            div {
                class: "hi-i18n-demo-features",
                style: "margin-bottom: 2rem;",
                h2 { "{i18n.keys.page.home.features.title}" }
                p { "{i18n.keys.page.home.features.description}" }
            }

            // Button examples
            div {
                class: "hi-i18n-demo-buttons",
                style: "display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 2rem;",
                button { class: "hi-button hi-button-primary", "{i18n.keys.common.button.submit}" }
                button { class: "hi-button hi-button-default", "{i18n.keys.common.button.cancel}" }
                button { class: "hi-button hi-button-danger", "{i18n.keys.common.button.delete}" }
                button { class: "hi-button hi-button-success", "{i18n.keys.common.button.save}" }
            }

            // Status examples
            div {
                class: "hi-i18n-demo-status",
                style: "display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 2rem;",
                span { class: "hi-tag hi-tag-info", "{i18n.keys.common.status.loading}" }
                span { class: "hi-tag hi-tag-success", "{i18n.keys.common.status.success}" }
                span { class: "hi-tag hi-tag-error", "{i18n.keys.common.status.error}" }
                span { class: "hi-tag hi-tag-warning", "{i18n.keys.common.status.warning}" }
            }

            // Navigation examples
            div {
                class: "hi-i18n-demo-navigation",
                style: "display: flex; gap: 1rem; flex-wrap: wrap;",
                span { class: "hi-tag hi-tag-default", "{i18n.keys.common.navigation.home}" }
                span { class: "hi-tag hi-tag-default", "{i18n.keys.common.navigation.documentation}" }
                span { class: "hi-tag hi-tag-default", "{i18n.keys.common.navigation.components}" }
            }

            // Theme examples
            div {
                class: "hi-i18n-demo-theme",
                style: "margin-top: 2rem;",
                h3 { "{i18n.keys.page.components.title}" }
                p { "{i18n.keys.page.components.description}" }
            }
        }
    }
}
