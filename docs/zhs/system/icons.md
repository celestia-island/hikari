# Icons 图标系统

图标管理和渲染系统，集成 Material Design Icons (MDI)。

## 概述

`hikari-icons` 提供：

- **1000+ 图标** - Material Design Icons (MDI) 完整集合
- **类型安全** - 枚举类型的图标名称
- **SVG 渲染** - 客户端和服务器端渲染
- **运行时加载** - 按需加载图标 SVG

## Icon 组件

### 基础用法

```rust
use hikari_icons::{Icon, MdiIcon};

rsx! {
    Icon {
        icon: MdiIcon::Magnify,
        size: 24,
        color: "var(--hi-color-primary)"
    }
}
```

### 可用图标

```rust
pub enum MdiIcon {
    // 导航
    Home,
    Menu,
    Magnify,
    Cog,
    ChevronDown,
    ChevronLeft,
    ChevronRight,

    // 操作
    Pencil,
    Delete,
    Check,
    Close,
    Plus,
    Minus,

    // 状态
    AlertCircleOutline,
    CheckCircleOutline,
    InformationOutline,
    AlertOutline,

    // ... 1000+ 图标
}
```

### Props

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `icon` | `MdiIcon` | - | 图标类型 |
| `size` | `u32` | `24` | 图标尺寸 |
| `color` | `&str` | - | 颜色 |

## 运行时加载

### 客户端渲染

```rust
use hikari_icons::runtime;

// 异步加载图标 SVG
async fn load_icon(name: &str) -> Result<String, Error> {
    runtime::load_icon(name).await
}
```

### 服务器端渲染

```rust
use hikari_icons::server;

// 服务器端渲染图标
fn render_icon(name: &str) -> String {
    server::render_icon(name)
}
```

## API 参考

### Icon

```rust
#[component]
pub fn Icon(
    icon: MdiIcon,
    size: Option<u32>,
    color: Option<&str>,
    class: Option<String>,
    style: Option<String>
) -> Element
```

### MdiIcon

```rust
pub enum MdiIcon {
    // 1000+ 图标变体
}
```

### runtime

```rust
pub mod runtime {
    pub async fn load_icon(name: &str) -> Result<String, Error>;
}
```

### server

```rust
pub mod server {
    pub fn render_icon(name: &str) -> String;
}
```

## 与其他系统集成

- **Components** - Button、Input 等组件中使用图标
- **Render-service** - 静态图标文件服务
- **Theme** - 图标颜色继承主题

## 相关系统

- [Components 组件](../components/) - 使用图标的组件
- [Palette 调色板](./palette.md) - 图标颜色
