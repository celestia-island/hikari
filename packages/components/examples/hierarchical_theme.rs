// examples/hierarchical_theme.rs
// 展示层级化主题系统的示例

use dioxus::prelude::*;
use hikari_components::{ThemeProvider, use_theme};

/// 示例：基础主题使用
#[component]
fn BasicThemeExample() -> Element {
    rsx! {
        ThemeProvider {
            palette: "hikari",
            h1 { "全局亮色主题" }
            p { "这个区域使用 Hikari 亮色主题" }
        }
    }
}

/// 示例：嵌套主题（局部暗色区域）
#[component]
fn NestedThemeExample() -> Element {
    rsx! {
        ThemeProvider {
            palette: "hikari",

            div { class: "light-section",
                h1 { "亮色主题区域" }
                p { "主要内容区域使用亮色主题" }

                // 嵌套一个暗色主题的局部区域
                div { class: "dark-section-wrapper",
                    ThemeProvider {
                        palette: "tairitsu",

                        div { class: "dark-section",
                            h2 { "局部暗色主题区域" }
                            p { "这个区域使用 Tairitsu 暗色主题" }
                            CodeBlock { }
                        }
                    }
                }

                p { "回到亮色主题" }
            }
        }
    }
}

/// 示例：自定义颜色覆盖
#[component]
fn CustomColorExample() -> Element {
    rsx! {
        ThemeProvider {
            palette: "hikari",

            div { class: "default-theme",
                h1 { "默认 Hikari 主题" }
                p { "使用石青色作为主色调" }
            }

            // 覆盖主色调为红色
            ThemeProvider {
                palette: "hikari",
                primary: Some("#FF6B6B".to_string()),  // 红色

                div { class: "custom-theme",
                    h2 { "自定义主色调" }
                    p { "这个区域使用红色作为主色调，但其他颜色仍来自 Hikari 主题" }
                }
            }
        }
    }
}

/// 示例：在组件中访问主题
#[component]
fn ThemedCard() -> Element {
    let theme = use_theme()?;

    rsx! {
        div {
            class: "themed-card",
            style: "background-color: {theme.palette.surface}; border-color: {theme.palette.border};",
            h3 { style: "color: {theme.palette.text_primary};", "主题卡片" }
            p { style: "color: {theme.palette.text_secondary};", "使用当前主题的颜色" }
            button {
                style: "background-color: {theme.palette.primary};",
                "主题按钮"
            }
        }
    }
}

/// 示例：多层级嵌套
#[component]
fn MultiLevelNesting() -> Element {
    rsx! {
        // 第1层：全局亮色主题
        ThemeProvider {
            palette: "hikari",

            Header { title: "全局亮色主题" }

            div { class: "content",
                ThemedCard { }  // 使用 Hikari 主题

                // 第2层：侧边栏使用暗色主题
                ThemeProvider {
                    palette: "tairitsu",

                    Sidebar {
                        // 第3层：侧边栏内的特殊区域使用自定义颜色
                        ThemeProvider {
                            palette: "tairitsu",
                            accent: Some("#FFD700".to_string()),  // 金色强调色

                            SpecialWidget { }  // 使用暗色主题 + 金色强调
                        }

                        MenuItem { }  // 使用 Tairitsu 主题
                    }
                }

                ThemedCard { }  // 仍然使用 Hikari 主题
            }
        }
    }
}

// ============================================
// 辅助组件
// ============================================

#[component]
fn Header(title: String) -> Element {
    rsx! {
        header {
            h1 { "{title}" }
        }
    }
}

#[component]
fn Sidebar(children: Element) -> Element {
    rsx! {
        aside { class: "sidebar", {children} }
    }
}

#[component]
fn MenuItem() -> Element {
    rsx! {
        div { class: "menu-item", "菜单项" }
    }
}

#[component]
fn SpecialWidget() -> Element {
    rsx! {
        div { class: "special-widget", "特殊小部件" }
    }
}

#[component]
fn CodeBlock() -> Element {
    rsx! {
        pre { class: "code-block",
            code { "fn hello() { println!(\"Hello\"); }" }
        }
    }
}
