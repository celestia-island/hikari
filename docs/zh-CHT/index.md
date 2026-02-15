# Hikari UI 框架

> 基於 Dioxus + Grass + Axum 的現代化 Rust UI 框架
>
> **設計風格**: Arknights 平面設計 + FUI 科幻感 + 中國傳統色
>
> **名稱來源**: "Hikari" (光) 來自音樂遊戲 Arcaea

## 什麼是 Hikari？

Hikari 是一個為 Rust 生態系統設計的現代化 UI 框架，結合了傳統中國色彩美學與科幻介面設計。框架採用模組化設計，提供了完整的元件庫、主題系統和動畫系統。

## 核心特性

### 🎨 中國傳統色彩系統
- **500+ 傳統顏色**: 完整的中國傳統色彩調色板
- **主題系統**: 內建 Hikari (淺色) 和 Tairitsu (深色) 主題
- **型別安全**: 編譯時檢查的顏色值

### 🧩 豐富的元件庫
- **基礎元件**: Button、Input、Card、Badge
- **反饋元件**: Alert、Toast、Tooltip、Spotlight
- **導航元件**: Menu、Tabs、Breadcrumb
- **資料元件**: Table、Tree、Pagination
- **佈局元件**: Layout、Header、Aside、Content、Footer
- **進階元件**: Collapsible、DragLayer、ZoomControls

### ✨ 強大的動畫系統
- **宣告式動畫**: 類似 CSS 的流暢 API
- **動態值**: 執行時期計算的動畫值
- **緩動函數**: 30+ 種緩動函數
- **預設動畫**: 淡入淡出、滑動、縮放等

### 🎯 進階特性
- **伺服器端渲染**: 完整的 SSR 支援
- **型別安全**: 全面利用 Rust 型別系統
- **響應式設計**: 內建響應式佈局工具
- **建置系統**: 自動化的 SCSS 編譯和資源生成

## 快速開始

### 安裝相依性

在 `Cargo.toml` 中加入：

```toml
[dependencies]
hikari-components = "0.1"
hikari-palette = "0.1"
hikari-theme = "0.1"
dioxus = "0.5"
```

### 基礎使用

```rust
use dioxus::prelude::*;
use hikari_components::{ThemeProvider, Button};
use hikari_theme::ThemeProvider;

#[component]
fn App() -> Element {
    rsx! {
        ThemeProvider { palette: "hikari" } {
            div { class: "hi-flex hi-flex-col hi-gap-4" {
                Button { label: "點擊我" }
                Button { label: "主要按鈕", variant: "primary" }
                Button { label: "次要按鈕", variant: "secondary" }
            }
        }
    }
}
```

### 建置和執行

```bash
# 開發模式
cargo run

# 建置
cargo build --release

# 建置 WASM
trunk build --release
```

## 設計理念

### Arknights 平面設計
- 清晰的線條和資訊層級
- 高對比度，確保可讀性
- 簡約而不失精致

### FUI 科幻感
- 微妙的發光效果
- 動態指示（呼吸燈、脈衝動畫）
- 精細的邊框和幾何圖案

### 中國傳統色
- 主色: 石青（藍）、朱砂（紅）、藤黃（黃）
- 中性色: 月白（淡白）、墨色（深黑）、縞色（淺灰）
- 功能色: 葱倩（成功）、鵝黃（警告）、朱砂（危險）

## 專案結構

```
hikari/
 ├── packages/
 │   ├── hikari-palette/          # 中國傳統色彩調色板
 │   ├── hikari-theme/            # 主題系統
 │   ├── hikari-animation/        # 動畫系統
 │   ├── hikari-icons/            # 圖示系統
 │   ├── hikari-components/       # 基礎元件庫
 │   ├── hikari-extra-components/ # 進階元件庫
 │   ├── hikari-builder/          # 建置系統
 │   └── hikari-render-service/   # SSR 服務
 │
 └── examples/
     ├── website/                 # 官方網站
     ├── table-demo/              # 表格元件演示
     ├── tree-demo/               # 樹形控件演示
     └── node-graph-demo/         # 節點圖演示
```

## 文件

- [元件文件](./components/) - UI 元件使用指南
- [系統文件](./system/) - 核心系統架構
- [API 參考](https://docs.rs/hikari-components) - Rust API 文件

## 範例

### 主題切換

```rust
use dioxus::prelude::*;
use hikari_theme::ThemeProvider;

fn App() -> Element {
    let mut theme = use_signal(|| "hikari".to_string());

    rsx! {
        ThemeProvider { palette: "{theme}" } {
            button {
                onclick: move |_| {
                    theme.set(if *theme() == "hikari" {
                        "tairitsu".to_string()
                    } else {
                        "hikari".to_string()
                    });
                },
                "切換主題"
            }
        }
    }
}
```

### 使用動畫

```rust
use hikari_animation::{AnimationBuilder, AnimationContext};
use hikari_animation::style::CssProperty;

// 靜態動畫
AnimationBuilder::new(&elements)
    .add_style("button", CssProperty::Opacity, "0.8")
    .apply_with_transition("300ms", "ease-in-out");

// 動態動畫（滑鼠跟隨）
AnimationBuilder::new(&elements)
    .add_style_dynamic("button", CssProperty::Transform, |ctx| {
        let x = ctx.mouse_x();
        let y = ctx.mouse_y();
        format!("translate({}px, {}px)", x, y)
    })
    .apply_with_transition("150ms", "ease-out");
```

## 貢獻

歡迎貢獻！請閱讀 [CONTRIBUTING.md](../../CONTRIBUTING.md) 了解詳情。

## 授權

[MIT License](../../LICENSE)

## 致謝

- [Dioxus](https://dioxuslabs.com/) - 強大的 Rust UI 框架
- [Grass](https://github.com/kaj/kaj) - 純 Rust SCSS 編譯器
- [Element Plus](https://element-plus.org/) - 優秀的元件庫設計參考
- [Material UI](https://mui.com/) - 現代化 UI 設計靈感

---

**Hikari** - 簡約、科技、文化自信
