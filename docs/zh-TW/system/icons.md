# Icons 圖示系統

圖示管理和渲染系統，整合 Lucide Icons。

## 概述

`hikari-icons` 提供：

- **1000+ 圖示** - Lucide Icons 完整集合
- **型別安全** - 枚舉型別的圖示名稱
- **SVG 渲染** - 客戶端和伺服器端渲染
- **執行時期載入** - 按需載入圖示 SVG

## Icon 元件

### 基礎用法

```rust
use dioxus::prelude::*;
use hikari_icons::{Icon, LucideIcon};

rsx! {
    Icon {
        icon: LucideIcon::Search,
        size: 24,
        color: "var(--hi-color-primary)"
    }
}
```

### 可用圖示

```rust
pub enum LucideIcon {
    // 導航
    Home,
    Menu,
    Search,
    Settings,
    ChevronDown,
    ChevronLeft,
    ChevronRight,

    // 操作
    Edit,
    Trash,
    Check,
    X,
    Plus,
    Minus,

    // 狀態
    AlertCircle,
    CheckCircle,
    Info,
    AlertTriangle,

    // ... 1000+ 圖示
}
```

### Props

| 屬性 | 型別 | 預設值 | 說明 |
|------|------|--------|------|
| `icon` | `LucideIcon` | - | 圖示型別 |
| `size` | `u32` | `24` | 圖示尺寸 |
| `color` | `&str` | - | 顏色 |

## 執行時期載入

### 客戶端渲染

```rust
use hikari_icons::runtime;

// 非同步載入圖示 SVG
async fn load_icon(name: &str) -> Result<String, Error> {
    runtime::load_icon(name).await
}
```

### 伺服器端渲染

```rust
use hikari_icons::server;

// 伺服器端渲染圖示
fn render_icon(name: &str) -> String {
    server::render_icon(name)
}
```

## API 參考

### Icon

```rust
#[component]
pub fn Icon(
    icon: LucideIcon,
    size: Option<u32>,
    color: Option<&str>,
    class: Option<String>,
    style: Option<String>
) -> Element
```

### LucideIcon

```rust
pub enum LucideIcon {
    // 1000+ 圖示變體
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

## 與其他系統整合

- **Components** - Button、Input 等元件中使用圖示
- **Render-service** - 靜態圖示檔案服務
- **Theme** - 圖示顏色繼承主題

## 相關系統

- [Components 元件](../components/) - 使用圖示的元件
- [Render-service](./render-service.md) - 圖示檔案服務
- [Palette 調色板](./palette.md) - 圖示顏色
