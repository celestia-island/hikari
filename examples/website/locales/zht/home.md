# Hikari UI 框架

Hikari (光) 是一個現代化的 Rust UI 框架，基於以下技術構建：

- **Tairitsu** - 響應式 UI 框架
- **Grass** - SCSS 編譯器
- **Axum** - 服務端渲染支援

## 設計理念

Hikari 融合了：

- **扁平設計** - 乾淨的線條、高對比度
- **發光效果** - 微妙的光暈與動態指示器
- **命名色板** - 660+ 顏色作為型別安全常量

## 快速開始

```bash
cargo new my-app
cd my-app
cargo add hikari-components hikari-theme
```

```rust
use hikari_components::{ThemeProvider, Button};

fn App() -> Element {
    rsx! {
        ThemeProvider { initial_palette: "hikari" } {
            Button { label: "你好，Hikari！" }
        }
    }
}
```

## 特性

- 🎨 660+ 命名顏色
- 🌙 淺色和深色主題
- 🔧 型別安全的工具類
- ✨ 流暢的動畫效果
- 📱 響應式元件
- 🌐 內建國際化支援

## 文件

訪問 [docs.hikari.dev](https://docs.hikari.dev) 獲取完整文件。
