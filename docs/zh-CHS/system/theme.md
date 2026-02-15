# Theme 主题系统

主题管理系统，提供主题上下文、CSS变量和主题切换功能。

## 目录

- [概述](#概述)
- [ThemeProvider 主题提供者](#themeprovider-主题提供者)
- [ThemeContext 主题上下文](#themecontext-主题上下文)
- [Generated 生成资源](#generated-生成资源)
- [CSS变量系统](#css变量系统)
- [主题切换](#主题切换)
- [样式定制](#样式定制)
- [API参考](#api-参考)

## 概述

`hikari-theme` 提供了完整的主题管理解决方案：

- **ThemeProvider** - 主题上下文提供者组件
- **ThemeContext** - 主题配置和颜色定义
- **Generated** - 自动生成的CSS变量和资源
- **CSS Variables** - 动态主题变量系统
- **主题切换** - 运行时主题切换支持

所有主题组件都具备：

- **类型安全** - 编译时检查主题标识
- **响应式** - 自动适配不同主题
- **可扩展** - 支持自定义主题

## ThemeProvider 主题提供者

为整个应用提供主题上下文。

### 基础用法

```rust
use dioxus::prelude::*;
use hikari_theme::ThemeProvider;

rsx! {
    ThemeProvider { palette: "hikari".to_string() }
        // 应用内容
        App {}
    }
}
```

### 主题切换

```rust
#[component]
fn App() -> Element {
    let mut theme = use_signal(|| "hikari".to_string());

    rsx! {
        ThemeProvider { palette: theme() }
            div {
                button {
                    onclick: move |_| {
                        theme.set(if theme() == "hikari" {
                            "tairitsu".to_string()
                        } else {
                            "hikari".to_string()
                        });
                    },
                    "切换主题"
                }
                // 应用内容
            }
        }
    }
}
```

### Props

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `palette` | `String` | `"hikari"` | 主题标识符 |
| `children` | `Element` | - | 子元素 |

### 支持的主题

- **hikari** - 浅色主题（光）
- **tairitsu** - 深色主题

## ThemeContext 主题上下文

包含主题配置和颜色定义的数据结构。

### 结构定义

```rust
pub struct ThemeContext {
    pub palette: String,
    pub colors: Palette,
}
```

### 字段说明

- **palette** - 主题标识符字符串
- **colors** - 主题色板配置（来自 `hikari-palette`）

### 默认值

```rust
impl Default for ThemeContext {
    fn default() -> Self {
        ThemeContext {
            palette: "hikari".to_string(),
            colors: themes::Hikari::palette(),
        }
    }
}
```

## Generated 生成资源

自动生成的静态资源和CSS变量。

### Tailwind CSS

```rust
use hikari_theme::generated::tailwind;

// 访问生成的Tailwind CSS类
let tailwind_classes = tailwind::TAILWIND_CLASSES;
```

### 生成内容

`generated/mod.rs` 模块包含：

- `tailwind` - Tailwind CSS生成的类名和变量
- `components` - 组件样式常量（由builder生成）

### 文件位置

```
packages/theme/src/generated/
├── mod.rs           # 模块入口
├── tailwind.rs      # Tailwind CSS生成内容
└── ...              # 其他生成内容
```

## CSS变量系统

主题系统使用CSS变量实现动态主题切换。

### 根级变量

定义在 `:root` 或 `[data-theme]` 下：

```css
[data-theme="hikari"] {
    --hi-color-primary: #00A0E9;
    --hi-color-secondary: #E94B35;
    --hi-color-accent: #F8B62D;
    --hi-color-background: #FFFFFF;
    --hi-color-surface: #F5F5F5;
    --hi-color-text-primary: #1A1A2E;
    --hi-color-text-secondary: #666666;
}

[data-theme="tairitsu"] {
    --hi-color-primary: #1a237e;
    --hi-color-secondary: #E94B35;
    --hi-color-accent: #FFF176;
    --hi-color-background: #0D1117;
    --hi-color-surface: #161B22;
    --hi-color-text-primary: #C9D1D9;
    --hi-color-text-secondary: #8B949E;
}
```

### 使用CSS变量

在组件样式中使用：

```rust
rsx! {
    div {
        style: "color: var(--hi-color-primary); background: var(--hi-color-surface);",
        "使用主题变量"
    }
}
```

或者在SCSS中：

```scss
.my-component {
    color: var(--hi-color-primary);
    background-color: var(--hi-color-surface);
    border: 1px solid var(--hi-color-border);
}
```

### 完整变量列表

#### 颜色变量

```css
--hi-color-primary          /* 主色 */
--hi-color-secondary        /* 次色 */
--hi-color-accent           /* 强调色 */
--hi-color-success          /* 成功色 */
--hi-color-warning          /* 警告色 */
--hi-color-danger           /* 危险色 */
--hi-color-background       /* 背景色 */
--hi-color-surface          /* 表面色 */
--hi-color-border           /* 边框色 */
--hi-color-text-primary     /* 主文本色 */
--hi-color-text-secondary   /* 次文本色 */
```

#### 排版变量

```css
--hi-font-family-sans       /* 无衬线字体 */
--hi-font-family-mono       /* 等宽字体 */
--hi-font-size-xs           /* 12px */
--hi-font-size-sm           /* 14px */
--hi-font-size-base         /* 16px */
--hi-font-size-lg           /* 18px */
--hi-font-size-xl           /* 20px */
--hi-font-size-2xl          /* 24px */
--hi-font-size-3xl          /* 30px */
```

#### 间距变量

```css
--hi-spacing-xs            /* 4px */
--hi-spacing-sm            /* 8px */
--hi-spacing-md            /* 16px */
--hi-spacing-lg            /* 24px */
--hi-spacing-xl            /* 32px */
--hi-spacing-2xl           /* 48px */
```

#### 圆角变量

```css
--hi-radius-sm             /* 4px */
--hi-radius-md             /* 8px */
--hi-radius-lg             /* 12px */
--hi-radius-xl             /* 16px */
--hi-radius-full           /* 9999px */
```

#### 阴影变量

```css
--hi-shadow-sm             /* 小阴影 */
--hi-shadow-md             /* 中阴影 */
--hi-shadow-lg             /* 大阴影 */
--hi-shadow-xl             /* 超大阴影 */
```

#### 过渡变量

```css
--hi-transition-fast       /* 150ms */
--hi-transition-base       /* 200ms */
--hi-transition-slow       /* 300ms */
```

## 主题切换

### 运行时切换

```rust
#[component]
fn ThemeSwitcher() -> Element {
    let mut theme = use_signal(|| "hikari".to_string());

    rsx! {
        ThemeProvider { palette: theme() }
            div {
                button {
                    onclick: move |_| theme.set("hikari".to_string()),
                    class: if theme() == "hikari" { "active" } else { "" },
                    "浅色"
                }
                button {
                    onclick: move |_| theme.set("tairitsu".to_string()),
                    class: if theme() == "tairitsu" { "active" } else { "" },
                    "深色"
                }
            }
        }
    }
}
```

### 持久化主题

```rust
use gloo::storage::LocalStorage;

#[component]
fn PersistentTheme() -> Element {
    // 从 LocalStorage 加载主题
    let mut theme = use_signal(|| {
        LocalStorage::get("theme")
            .unwrap_or_else(|_| Ok("hikari".to_string()))
            .unwrap_or("hikari".to_string())
    });

    // 主题改变时保存到 LocalStorage
    use_effect(move || {
        let theme = theme();
        async move {
            if let Err(e) = LocalStorage::set("theme", &theme) {
                eprintln!("Failed to save theme: {}", e);
            }
        }
    });

    rsx! {
        ThemeProvider { palette: theme() }
            // 应用内容
        }
    }
}
```

### 系统主题检测

```rust
use web_sys::window;

#[component]
fn SystemTheme() -> Element {
    let mut theme = use_signal(|| "hikari".to_string());

    // 检测系统主题偏好
    use_effect(|| {
        let win = window()?;
        let media_query = win.match_media("(prefers-color-scheme: dark)")?;

        let listener = Closure::wrap(Box::new(move |e: Event| {
            let matches = e
                .dyn_ref::<MediaQueryListEvent>()
                .unwrap()
                .matches();
            theme.set(if matches {
                "tairitsu".to_string()
            } else {
                "hikari".to_string()
            });
        }) as Box<dyn Fn(_)>);

        media_query
            .add_listener_with_opt_callback(Some(listener.as_ref().unchecked_ref()))
            .unwrap();
        listener.forget();

        async move {}
    });

    rsx! {
        ThemeProvider { palette: theme() }
            // 应用内容
        }
    }
}
```

## 样式定制

### 主题变量覆盖

```css
/* 在全局样式中覆盖主题变量 */
[data-theme="hikari"] {
    --hi-color-primary: #0066CC;
    --hi-color-secondary: #FF6600;
}
```

### 组件级主题

```rust
rsx! {
    // 为特定组件使用不同主题
    div {
        "data-theme": "tairitsu",
        style: "background: var(--hi-color-surface);",
        "这个组件使用深色主题"
    }
}
```

### 自定义主题变量

```css
[data-theme="custom"] {
    --hi-color-primary: #FF0066;
    --hi-color-secondary: #00FF99;
    --hi-color-accent: #FFFF00;
    /* ... 其他变量 */
}
```

## 最佳实践

### 1. 主题提供者位置

```rust
// 好的做法：在应用根部放置 ThemeProvider
#[component]
fn App() -> Element {
    rsx! {
        ThemeProvider { palette: "hikari".to_string() }
            Router {}
        }
    }
}

// 避免：嵌套多个 ThemeProvider
#[component]
fn BadExample() -> Element {
    rsx! {
        ThemeProvider { palette: "hikari".to_string() }
            ThemeProvider { palette: "tairitsu".to_string() }
                // 内部的 theme 会覆盖外部的
            }
        }
    }
}
```

### 2. 主题切换动画

```css
/* 添加平滑的主题切换过渡 */
* {
    transition: background-color 0.3s ease,
                color 0.3s ease,
                border-color 0.3s ease;
}
```

### 3. 条件样式

```rust
rsx! {
    div {
        class: if theme() == "hikari" {
            "light-theme"
        } else {
            "dark-theme"
        },
        "根据主题应用不同样式"
    }
}
```

### 4. CSS变量回退

```css
/* 为不支持CSS变量的浏览器提供回退 */
.my-component {
    background-color: #00A0E9; /* 回退值 */
    background-color: var(--hi-color-primary, #00A0E9);
}
```

## API参考

### ThemeProvider

```rust
#[component]
pub fn ThemeProvider(
    palette: String,
    children: Element
) -> Element
```

### ThemeContext

```rust
pub struct ThemeContext {
    pub palette: String,
    pub colors: Palette,
}

impl Default for ThemeContext {
    fn default() -> Self { ... }
}
```

## 与其他系统集成

### 与 Palette 集成

```rust
use hikari_palette::{ChineseColor, themes};

let hikari_palette = themes::Hikari::palette();
println!("主色: {}", hikari_palette.primary.hex);
```

### 与 Animation 集成

```rust
use hikari_animation::AnimationBuilder;
use hikari_theme::ThemeProvider;

// 主题变量可用于动画
AnimationBuilder::new(&elements)
    .add_style("button", "background-color", "var(--hi-color-primary)")
    .apply_with_transition("300ms", "ease-in-out");
```

### 与 Components 集成

所有组件都自动继承ThemeProvider提供的主题：

```rust
rsx! {
    ThemeProvider { palette: "hikari".to_string() }
        // 所有组件自动使用 hikari 主题
        Button { label: "按钮" }
        Card { "卡片" }
        Input { placeholder: "输入" }
    }
}
```

## 设计理念

### Arknights 风格

- **浅色主题 (hikari)**：
  - 主色：石青 (#00A0E9)
  - 背景：白色
  - 文本：深色

- **深色主题 (tairitsu)**：
  - 主色：靛蓝 (#1a237e)
  - 背景：深色
  - 文本：浅色

### FUI 元素

- 微妙的发光效果
- 动态指示（呼吸灯）
- 精细边框

### 响应式

- 移动端优先
- 自适应布局
- 断点系统

## 相关系统

- [Palette 调色板](./palette.md) - 颜色定义和主题色板
- [Animation 动画](./animation.md) - 动画与主题集成
- [Components 组件](../components/) - 使用主题的组件库
