# テーマシステム

テーマコンテキスト、CSS変数、テーマ切り替え機能を提供するテーマ管理システム。

## 目次

- [概要](#概要)
- [ThemeProvider](#themeprovider-テーマプロバイダー)
- [ThemeContext](#themecontext-テーマコンテキスト)
- [生成リソース](#生成リソース)
- [CSS変数システム](#css変数システム)
- [テーマ切り替え](#テーマ切り替え)
- [スタイルカスタマイズ](#スタイルカスタマイズ)
- [API リファレンス](#api-リファレンス)

## 概要

`hikari-theme`は完全なテーマ管理ソリューションを提供します:

- **ThemeProvider** - テーマコンテキストプロバイダーコンポーネント
- **ThemeContext** - テーマ設定と色定義
- **Generated** - 自動生成されるCSS変数とリソース
- **CSS Variables** - ダイナミックテーマ変数システム
- **Theme Switching** - 実行時テーマ切り替えサポート

すべてのテーマコンポーネントの特徴:

- **型安全** - コンパイル時のテーマ識別子チェック
- **レスポンシブ** - 異なるテーマに自動適応
- **拡張可能** - カスタムテーマをサポート

## ThemeProvider

アプリケーション全体のテーマコンテキストを提供します。

### 基本的な使用方法

```rust
use dioxus::prelude::*;
use hikari_theme::ThemeProvider;

rsx! {
    ThemeProvider { palette: "hikari".to_string() }
        // アプリケーションコンテンツ
        App {}
    }
}
```

### テーマ切り替え

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
                    "テーマ切り替え"
                }
                // アプリケーションコンテンツ
            }
        }
    }
}
```

### Props

| プロパティ | 型 | デフォルト | 説明 |
|------------|-----|------------|------|
| `palette` | `String` | `"hikari"` | テーマ識別子 |
| `children` | `Element` | - | 子要素 |

### サポートテーマ

- **hikari** - ライトテーマ
- **tairitsu** - ダークテーマ

## ThemeContext

テーマ設定と色定義を含むデータ構造。

### 構造定義

```rust
pub struct ThemeContext {
    pub palette: String,
    pub colors: Palette,
}
```

### フィールド説明

- **palette** - テーマ識別子文字列
- **colors** - テーマパレット設定（`hikari-palette`から）

### デフォルト値

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

## 生成リソース

自動生成される静的リソースとCSS変数。

### Tailwind CSS

```rust
use hikari_theme::generated::tailwind;

// 生成されたTailwind CSSクラスにアクセス
let tailwind_classes = tailwind::TAILWIND_CLASSES;
```

### 生成コンテンツ

`generated/mod.rs`モジュールには以下が含まれます:

- `tailwind` - Tailwind CSS生成クラス名と変数
- `components` - コンポーネントスタイル定数（builderによって生成）

### ファイルの場所

```
packages/theme/src/generated/
├── mod.rs           # モジュールエントリ
├── tailwind.rs      # Tailwind CSS 生成コンテンツ
└── ...              # その他の生成コンテンツ
```

## CSS変数システム

テーマシステムはダイナミックテーマ切り替えにCSS変数を使用します。

### ルート変数

`:root`または`[data-theme]`の下で定義:

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

### CSS変数の使用

コンポーネントスタイルで使用:

```rust
rsx! {
    div {
        style: "color: var(--hi-color-primary); background: var(--hi-color-surface);",
        "テーマ変数を使用"
    }
}
```

またはSCSSで:

```scss
.my-component {
    color: var(--hi-color-primary);
    background-color: var(--hi-color-surface);
    border: 1px solid var(--hi-color-border);
}
```

### 完全な変数リスト

#### 色変数

```css
--hi-color-primary          /* プライマリカラー */
--hi-color-secondary        /* セカンダリカラー */
--hi-color-accent           /* アクセントカラー */
--hi-color-success          /* 成功カラー */
--hi-color-warning          /* 警告カラー */
--hi-color-danger           /* 危険カラー */
--hi-color-background       /* 背景色 */
--hi-color-surface          /* サーフェス色 */
--hi-color-border           /* ボーダー色 */
--hi-color-text-primary     /* プライマリテキスト色 */
--hi-color-text-secondary   /* セカンダリテキスト色 */
```

#### タイポグラフィ変数

```css
--hi-font-family-sans       /* サンセリフフォント */
--hi-font-family-mono       /* モノスペースフォント */
--hi-font-size-xs           /* 12px */
--hi-font-size-sm           /* 14px */
--hi-font-size-base         /* 16px */
--hi-font-size-lg           /* 18px */
--hi-font-size-xl           /* 20px */
--hi-font-size-2xl          /* 24px */
--hi-font-size-3xl          /* 30px */
```

#### スペーシング変数

```css
--hi-spacing-xs            /* 4px */
--hi-spacing-sm            /* 8px */
--hi-spacing-md            /* 16px */
--hi-spacing-lg            /* 24px */
--hi-spacing-xl            /* 32px */
--hi-spacing-2xl           /* 48px */
```

#### 角丸変数

```css
--hi-radius-sm             /* 4px */
--hi-radius-md             /* 8px */
--hi-radius-lg             /* 12px */
--hi-radius-xl             /* 16px */
--hi-radius-full           /* 9999px */
```

#### シャドウ変数

```css
--hi-shadow-sm             /* 小さいシャドウ */
--hi-shadow-md             /* 中程度のシャドウ */
--hi-shadow-lg             /* 大きいシャドウ */
--hi-shadow-xl             /* 特大シャドウ */
```

#### トランジション変数

```css
--hi-transition-fast       /* 150ms */
--hi-transition-base       /* 200ms */
--hi-transition-slow       /* 300ms */
```

## テーマ切り替え

### 実行時切り替え

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
                    "ライト"
                }
                button {
                    onclick: move |_| theme.set("tairitsu".to_string()),
                    class: if theme() == "tairitsu" { "active" } else { "" },
                    "ダーク"
                }
            }
        }
    }
}
```

### テーマの永続化

```rust
use gloo::storage::LocalStorage;

#[component]
fn PersistentTheme() -> Element {
    // LocalStorageからテーマを読み込む
    let mut theme = use_signal(|| {
        LocalStorage::get("theme")
            .unwrap_or_else(|_| Ok("hikari".to_string()))
            .unwrap_or("hikari".to_string())
    });

    // テーマが変更されたらLocalStorageに保存
    use_effect(move || {
        let theme = theme();
        async move {
            if let Err(e) = LocalStorage::set("theme", &theme) {
                eprintln!("テーマの保存に失敗: {}", e);
            }
        }
    });

    rsx! {
        ThemeProvider { palette: theme() }
            // アプリケーションコンテンツ
        }
    }
}
```

### システムテーマ検出

```rust
use web_sys::window;

#[component]
fn SystemTheme() -> Element {
    let mut theme = use_signal(|| "hikari".to_string());

    // システムのテーマ設定を検出
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
            // アプリケーションコンテンツ
        }
    }
}
```

## スタイルカスタマイズ

### テーマ変数のオーバーライド

```css
/* グローバルスタイルでテーマ変数をオーバーライド */
[data-theme="hikari"] {
    --hi-color-primary: #0066CC;
    --hi-color-secondary: #FF6600;
}
```

### コンポーネントレベルのテーマ

```rust
rsx! {
    // 特定のコンポーネントに異なるテーマを使用
    div {
        "data-theme": "tairitsu",
        style: "background: var(--hi-color-surface);",
        "このコンポーネントはダークテーマを使用"
    }
}
```

### カスタムテーマ変数

```css
[data-theme="custom"] {
    --hi-color-primary: #FF0066;
    --hi-color-secondary: #00FF99;
    --hi-color-accent: #FFFF00;
    /* ... その他の変数 */
}
```

## ベストプラクティス

### 1. テーマプロバイダーの配置

```rust
// 良い: アプリケーションルートにThemeProviderを配置
#[component]
fn App() -> Element {
    rsx! {
        ThemeProvider { palette: "hikari".to_string() }
            Router {}
        }
    }
}

// 避ける: 複数のThemeProviderのネスト
#[component]
fn BadExample() -> Element {
    rsx! {
        ThemeProvider { palette: "hikari".to_string() }
            ThemeProvider { palette: "tairitsu".to_string() }
                // 内側のテーマが外側をオーバーライド
            }
        }
    }
}
```

### 2. テーマ切り替えアニメーション

```css
/* スムーズなテーマ切り替えトランジションを追加 */
* {
    transition: background-color 0.3s ease,
                color 0.3s ease,
                border-color 0.3s ease;
}
```

### 3. 条件付きスタイリング

```rust
rsx! {
    div {
        class: if theme() == "hikari" {
            "light-theme"
        } else {
            "dark-theme"
        },
        "テーマに基づいて異なるスタイルを適用"
    }
}
```

### 4. CSS変数のフォールバック

```css
/* CSS変数をサポートしないブラウザ用のフォールバックを提供 */
.my-component {
    background-color: #00A0E9; /* フォールバック値 */
    background-color: var(--hi-color-primary, #00A0E9);
}
```

## API リファレンス

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

## 他システムとの統合

### Paletteとの統合

```rust
use hikari_palette::{ChineseColor, themes};

let hikari_palette = themes::Hikari::palette();
println!("プライマリ: {}", hikari_palette.primary.hex);
```

### Animationとの統合

```rust
use hikari_animation::AnimationBuilder;
use hikari_theme::ThemeProvider;

// テーマ変数はアニメーションで使用可能
AnimationBuilder::new(&elements)
    .add_style("button", "background-color", "var(--hi-color-primary)")
    .apply_with_transition("300ms", "ease-in-out");
```

### Componentsとの統合

すべてのコンポーネントはThemeProviderが提供するテーマを自動的に継承します:

```rust
rsx! {
    ThemeProvider { palette: "hikari".to_string() }
        // すべてのコンポーネントが自動的にhikariテーマを使用
        Button { label: "ボタン" }
        Card { "カード" }
        Input { placeholder: "入力" }
    }
}
```

## デザイン哲学

### アークナイツスタイル

- **ライトテーマ (hikari)**:
  - プライマリ: 藍銅 (#00A0E9)
  - 背景: 白
  - テキスト: 暗色

- **ダークテーマ (tairitsu)**:
  - プライマリ: インディゴ (#1a237e)
  - 背景: 暗色
  - テキスト: 明色

### FUIエレメント

- 微細なグロー効果
- ダイナミックインジケーター（ブリージングライト）
- 繊細なボーダー

### レスポンシブ

- モバイルファースト
- アダプティブレイアウト
- ブレークポイントシステム

## 関連システム

- [Palette System](./palette.md) - 色定義とテーマパレット
- [Animation System](./animation.md) - アニメーションとテーマの統合
- [Components](../components/) - テーマを使用するコンポーネントライブラリ
