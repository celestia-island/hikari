# Theme 主題系統

主題管理系統，提供主題上下文、CSS變量和主題切換功能。

## 目錄

- [概述](#概述)
- [ThemeProvider 主題提供者](#themeprovider-主題提供者)
- [ThemeContext 主題上下文](#themecontext-主題上下文)
- [Generated 生成資源](#generated-生成資源)
- [CSS 變量系統](#css-變量系統)
- [主題切換](#主題切換)
- [樣式定制](#樣式定制)
- [API 參考](#api-參考)

## 概述

`hikari-theme` 提供了完整的主題管理解決方案：

- **ThemeProvider** - 主題上下文提供者元件
- **ThemeContext** - 主題配置和顏色定義
- **Generated** - 自動生成的CSS變量和資源
- **CSS Variables** - 動態主題變量系統
- **主題切換** - 執行時期主題切換支援

所有主題元件都具備：

- **型別安全** - 編譯時檢查主題標識
- **響應式** - 自動適配不同主題
- **可擴展** - 支援自訂主題

## ThemeProvider 主題提供者

為整個應用程式提供主題上下文。

### 基礎用法

```rust
use dioxus::prelude::*;
use hikari_theme::ThemeProvider;

rsx! {
    ThemeProvider { palette: "hikari".to_string() }
        // 應用程式內容
        App {}
    }
}
```

### 主題切換

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
                    "切換主題"
                }
                // 應用程式內容
            }
        }
    }
}
```

### Props

| 屬性 | 型別 | 預設值 | 說明 |
|------|------|--------|------|
| `palette` | `String` | `"hikari"` | 主題標識符 |
| `children` | `Element` | - | 子元素 |

### 支援的主題

- **hikari** - 淺色主題（光）
- **tairitsu** - 深色主題

## ThemeContext 主題上下文

包含主題配置和顏色定義的資料結構。

### 結構定義

```rust
pub struct ThemeContext {
    pub palette: String,
    pub colors: Palette,
}
```

### 欄位說明

- **palette** - 主題標識符字串
- **colors** - 主題調色板配置（來自 `hikari-palette`）

### 預設值

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

## Generated 生成資源

自動生成的靜態資源和CSS變量。

### Tailwind CSS

```rust
use hikari_theme::generated::tailwind;

// 存取生成的 Tailwind CSS 類
let tailwind_classes = tailwind::TAILWIND_CLASSES;
```

### 生成內容

`generated/mod.rs` 模組包含：

- `tailwind` - Tailwind CSS 生成的類別名稱和變數
- `components` - 元件樣式常數（由 builder 生成）

### 檔案位置

```
packages/theme/src/generated/
├── mod.rs           # 模組入口
├── tailwind.rs      # Tailwind CSS 生成內容
└── ...              # 其他生成內容
```

## CSS 變量系統

主題系統使用 CSS 變數實現動態主題切換。

### 根級變數

定義在 `:root` 或 `[data-theme]` 下：

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

### 使用 CSS 變量

在元件樣式中使用：

```rust
rsx! {
    div {
        style: "color: var(--hi-color-primary); background: var(--hi-color-surface);",
        "使用主題變數"
    }
}
```

或在 SCSS 中：

```scss
.my-component {
    color: var(--hi-color-primary);
    background-color: var(--hi-color-surface);
    border: 1px solid var(--hi-color-border);
}
```

### 完整變數列表

#### 顏色變數

```css
--hi-color-primary          /* 主色 */
--hi-color-secondary        /* 次色 */
--hi-color-accent           /* 強調色 */
--hi-color-success          /* 成功色 */
--hi-color-warning          /* 警告色 */
--hi-color-danger           /* 危險色 */
--hi-color-background       /* 背景色 */
--hi-color-surface          /* 表面色 */
--hi-color-border           /* 邊框色 */
--hi-color-text-primary     /* 主文本色 */
--hi-color-text-secondary   /* 次文本色 */
```

#### 排版變數

```css
--hi-font-family-sans       /* 無襯線字體 */
--hi-font-family-mono       /* 等寬字體 */
--hi-font-size-xs           /* 12px */
--hi-font-size-sm           /* 14px */
--hi-font-size-base         /* 16px */
--hi-font-size-lg           /* 18px */
--hi-font-size-xl           /* 20px */
--hi-font-size-2xl          /* 24px */
--hi-font-size-3xl          /* 30px */
```

#### 間距變數

```css
--hi-spacing-xs            /* 4px */
--hi-spacing-sm            /* 8px */
--hi-spacing-md            /* 16px */
--hi-spacing-lg            /* 24px */
--hi-spacing-xl            /* 32px */
--hi-spacing-2xl           /* 48px */
```

#### 圓角變數

```css
--hi-radius-sm             /* 4px */
--hi-radius-md             /* 8px */
--hi-radius-lg             /* 12px */
--hi-radius-xl             /* 16px */
--hi-radius-full           /* 9999px */
```

#### 陰影變數

```css
--hi-shadow-sm             /* 小陰影 */
--hi-shadow-md             /* 中陰影 */
--hi-shadow-lg             /* 大陰影 */
--hi-shadow-xl             /* 超大陰影 */
```

#### 過渡變數

```css
--hi-transition-fast       /* 150ms */
--hi-transition-base       /* 200ms */
--hi-transition-slow       /* 300ms */
```

## 主題切換

### 執行時期切換

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
                    "淺色"
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

### 持久化主題

```rust
use gloo::storage::LocalStorage;

#[component]
fn PersistentTheme() -> Element {
    // 從 LocalStorage 載入主題
    let mut theme = use_signal(|| {
        LocalStorage::get("theme")
            .unwrap_or_else(|_| Ok("hikari".to_string()))
            .unwrap_or("hikari".to_string())
    });

    // 主題改變時儲存到 LocalStorage
    use_effect(move || {
        let theme = theme();
        async move {
            if let Err(e) = LocalStorage::set("theme", &theme) {
                eprintln!("無法儲存主題: {}", e);
            }
        }
    });

    rsx! {
        ThemeProvider { palette: theme() }
            // 應用程式內容
        }
    }
}
```

### 系統主題檢測

```rust
use web_sys::window;

#[component]
fn SystemTheme() -> Element {
    let mut theme = use_signal(|| "hikari".to_string());

    // 檢測系統主題偏好
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
            // 應用程式內容
        }
    }
}
```

## 樣式定制

### 主題變數覆蓋

```css
/* 在全域樣式中覆蓋主題變數 */
[data-theme="hikari"] {
    --hi-color-primary: #0066CC;
    --hi-color-secondary: #FF6600;
}
```

### 元件級主題

```rust
rsx! {
    // 為特定元件使用不同主題
    div {
        "data-theme": "tairitsu",
        style: "background: var(--hi-color-surface);",
        "這個元件使用深色主題"
    }
}
```

### 自訂主題變數

```css
[data-theme="custom"] {
    --hi-color-primary: #FF0066;
    --hi-color-secondary: #00FF99;
    --hi-color-accent: #FFFF00;
    /* ... 其他變數 */
}
```

## 最佳實踐

### 1. ThemeProvider 放置位置

```rust
// 好的做法：在應用根部放置 ThemeProvider
#[component]
fn App() -> Element {
    rsx! {
        ThemeProvider { palette: "hikari".to_string() }
            Router {}
        }
    }
}

// 避免：嵌套多個 ThemeProvider
#[component]
fn BadExample() -> Element {
    rsx! {
        ThemeProvider { palette: "hikari".to_string() }
            ThemeProvider { palette: "tairitsu".to_string() }
                // 內部的 theme 會覆蓋外部的
            }
        }
    }
}
```

### 2. 主題切換動畫

```css
/* 添加平滑的主題切換過渡 */
* {
    transition: background-color 0.3s ease,
                color 0.3s ease,
                border-color 0.3s ease;
}
```

### 3. 條件式樣式

```rust
rsx! {
    div {
        class: if theme() == "hikari" {
            "light-theme"
        } else {
            "dark-theme"
        },
        "根據主題應用不同樣式"
    }
}
```

### 4. CSS 變數回退

```css
/* 為不支援 CSS 變數的瀏覽器提供回退 */
.my-component {
    background-color: #00A0E9; /* 回退值 */
    background-color: var(--hi-color-primary, #00A0E9);
}
```

## API 參考

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

## 與其他系統整合

### 與 Palette 整合

```rust
use hikari_palette::{ChineseColor, themes};

let hikari_palette = themes::Hikari::palette();
println!("主色: {}", hikari_palette.primary.hex);
```

### 與 Animation 整合

```rust
use hikari_animation::AnimationBuilder;
use hikari_theme::ThemeProvider;

// 主題變數可用於動畫
AnimationBuilder::new(&elements)
    .add_style("button", "background-color", "var(--hi-color-primary)")
    .apply_with_transition("300ms", "ease-in-out");
```

### 與 Components 整合

所有元件都自動繼承 ThemeProvider 提供的主題：

```rust
rsx! {
    ThemeProvider { palette: "hikari".to_string() }
        // 所有元件自動使用 hikari 主題
        Button { label: "按鈕" }
        Card { "卡片" }
        Input { placeholder: "輸入" }
    }
}
```

## 設計理念

### Arknights 風格

- **淺色主題 (hikari)**：
  - 主色: 石青 (#00A0E9)
  - 背景: 白色
  - 文字: 深色

- **深色主題 (tairitsu)**：
  - 主色: 靛藍 (#1a237e)
  - 背景: 深色
  - 文字: 淺色

### FUI 元素

- 微妙的發光效果
- 動態指示（呼吸燈）
- 精細的邊框

### 響應式

- 行動優先
- 自適應佈局
- 斷點系統

## 相關系統

- [Palette 調色板](./palette.md) - 顏色定義和主題調色板
- [Animation 動畫](./animation.md) - 動畫與主題整合
- [Components 元件](../components/) - 使用主題的元件庫
