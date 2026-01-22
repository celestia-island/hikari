# Hikari UI 框架

Hikari (光) 是一个现代化的 Rust UI 框架，基于以下技术构建：

- **Dioxus 0.7** - 响应式 UI 框架
- **Grass** - SCSS 编译器
- **Axum** - 服务端渲染支持

## 设计理念

Hikari 融合了：

- **明日方舟美学** - 干净的线条、高对比度
- **FUI (未来用户界面)** - 发光效果、动态指示器
- **中国传统色** - 500+ 真实的颜色名称

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
        ThemeProvider { palette: "hikari" } {
            Button { label: "你好，Hikari！" }
        }
    }
}
```

## 特性

- 🎨 500+ 中国传统颜色
- 🌙 浅色和深色主题
- 🔧 类型安全的工具类
- ✨ 流畅的动画效果
- 📱 响应式组件
- 🌐 内置国际化支持

## 文档

访问 [docs.hikari.dev](https://docs.hikari.dev) 获取完整文档。
