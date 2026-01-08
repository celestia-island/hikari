# Hikari UI 框架

> 一个基于 Dioxus + Grass + Axum 的现代化 Rust UI 框架
>
> **设计风格**: Arknights 平面设计 + FUI 科幻感 + 中国传统色
>
> **名称来源**: "Hikari" (光) 来自音乐游戏 Arcaea

## 什么是 Hikari？

Hikari 是一个为 Rust 生态系统设计的现代化 UI 框架，结合了传统中国色彩美学与科幻界面设计。框架采用模块化设计，提供了完整的组件库、主题系统和动画系统。

## 核心特性

### 🎨 中国传统色彩系统
- **500+ 传统颜色**: 完整的中国传统色彩调色板
- **主题系统**: 内置 Hikari (浅色) 和 Tairitsu (深色) 主题
- **类型安全**: 编译时检查的颜色值

### 🧩 丰富的组件库
- **基础组件**: Button、Input、Card、Badge
- **反馈组件**: Alert、Toast、Tooltip、Spotlight
- **导航组件**: Menu、Tabs、Breadcrumb
- **数据组件**: Table、Tree、Pagination
- **布局组件**: Layout、Header、Aside、Content、Footer
- **高级组件**: Collapsible、DragLayer、ZoomControls

### ✨ 强大的动画系统
- **声明式动画**: 类似 CSS 的流畅 API
- **动态值**: 运行时计算的动画值
- **缓动函数**: 30+ 种缓动函数
- **预设动画**: 淡入淡出、滑动、缩放等

### 🎯 高级特性
- **服务端渲染**: 完整的 SSR 支持
- **类型安全**: 全面利用 Rust 类型系统
- **响应式设计**: 内置响应式布局工具
- **构建系统**: 自动化的 SCSS 编译和资源生成

## 快速开始

### 安装依赖

在 `Cargo.toml` 中添加依赖：

```toml
[dependencies]
hikari-components = "0.1"
hikari-palette = "0.1"
hikari-theme = "0.1"
dioxus = "0.5"
```

### 基础使用

```rust
use dioxus::prelude::*;
use hikari_components::{ThemeProvider, Button};
use hikari_theme::ThemeProvider;

#[component]
fn App() -> Element {
    rsx! {
        ThemeProvider { palette: "hikari" } {
            div { class: "hi-flex hi-flex-col hi-gap-4" {
                Button { label: "点击我" }
                Button { label: "主要按钮", variant: "primary" }
                Button { label: "次要按钮", variant: "secondary" }
            }
        }
    }
}
```

### 构建和运行

```bash
# 开发模式
cargo run

# 构建
cargo build --release

# 构建 WASM
trunk build --release
```

## 设计理念

### Arknights 平面设计
- 清晰的线条和信息层级
- 高对比度，确保可读性
- 简约而不失精致

### FUI 科幻感
- 微妙的发光效果
- 动态指示（呼吸灯、脉冲动画）
- 精细的边框和几何图案

### 中国传统色
- 主色: 石青（蓝）、朱砂（红）、藤黄（黄）
- 中性色: 月白（淡白）、墨色（深黑）、缟色（浅灰）
- 功能色: 葱倩（成功）、鹅黄（警告）、朱砂（危险）

## 项目结构

```
hikari/
 ├── packages/
 │   ├── hikari-palette/          # 中国传统色调色板
 │   ├── hikari-theme/            # 主题系统
 │   ├── hikari-animation/        # 动画系统
 │   ├── hikari-icons/            # 图标系统
 │   ├── hikari-components/       # 基础组件库
 │   ├── hikari-extra-components/ # 高级组件库
 │   ├── hikari-builder/          # 构建系统
 │   └── hikari-render-service/   # SSR 服务
 │
 └── examples/
     ├── website/                 # 官方网站
     ├── table-demo/              # 表格组件演示
     ├── tree-demo/               # 树形控件演示
     └── node-graph-demo/         # 节点图演示
```

## 文档

- [组件文档](./components/) - UI 组件使用指南
- [系统文档](./system/) - 核心系统架构说明
- [API 文档](https://docs.rs/hikari-components) - Rust API 参考

## 示例

### 主题切换

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
                "切换主题"
            }
        }
    }
}
```

### 使用动画

```rust
use hikari_animation::{AnimationBuilder, AnimationContext};
use hikari_animation::style::CssProperty;

// 静态动画
AnimationBuilder::new(&elements)
    .add_style("button", CssProperty::Opacity, "0.8")
    .apply_with_transition("300ms", "ease-in-out");

// 动态动画（鼠标跟随）
AnimationBuilder::new(&elements)
    .add_style_dynamic("button", CssProperty::Transform, |ctx| {
        let x = ctx.mouse_x();
        let y = ctx.mouse_y();
        format!("translate({}px, {}px)", x, y)
    })
    .apply_with_transition("150ms", "ease-out");
```

## 贡献

欢迎贡献！请阅读 [CONTRIBUTING.md](../../CONTRIBUTING.md) 了解详情。

## 许可证

[MIT License](../../LICENSE)

## 致谢

- [Dioxus](https://dioxuslabs.com/) - 强大的 Rust UI 框架
- [Grass](https://github.com/kaj/kaj) - 纯 Rust SCSS 编译器
- [Element Plus](https://element-plus.org/) - 优秀的组件库设计参考
- [Material UI](https://mui.com/) - 现代化 UI 设计灵感

---

**Hikari** - 简约、科技、文化自信
