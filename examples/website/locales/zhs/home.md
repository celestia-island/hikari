# Hikari UI 框架

Hikari (光) 是一个现代化的 Rust UI 框架，基于以下技术构建：

- **Tairitsu** - 响应式 UI 框架
- **Grass** - SCSS 编译器
- **Axum** - 服务端渲染支持

## 设计理念

Hikari 融合了：

- **扁平设计** - 干净的线条、高对比度
- **发光效果** - 微妙的光晕与动态指示器
- **命名色板** - 660+ 颜色作为类型安全常量

## 快速开始

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

- 🎨 660+ 命名颜色
- 🌙 浅色和深色主题
- 🔧 类型安全的工具类
- ✨ 流畅的动画效果
- 📱 响应式组件
- 🌐 内置国际化支持

## 文档

访问 [docs.hikari.dev](https://docs.hikari.dev) 获取完整文档。
