# 系統架構概覽

Hikari 框架採用模組化設計，由多個獨立的套件組成，每個套件負責特定的功能領域。

## 核心系統

### 1. 調色板系統 (hikari-palette)

中國傳統色彩系統的 Rust 實作。

**職責**:
- 提供 500+ 中國傳統顏色定義
- 主題調色板管理
- 工具類生成器
- 透明度和顏色混合

**核心功能**:
```rust
use hikari_palette::{ChineseColor, opacity};

// 使用傳統顏色
let red = ChineseColor::朱砂;
let blue = ChineseColor::石青;

// 透明度處理
let semi_red = opacity(red, 0.5);

// 主題系統
let theme = Hikari::default();
println!("主色: {}", theme.primary.hex());
```

**設計理念**:
- **文化自信**: 使用傳統顏色名稱
- **型別安全**: 編譯時檢查顏色值
- **高效能**: 零成本抽象

### 2. 主題系統 (hikari-theme)

主題上下文和樣式注入系統。

**職責**:
- 主題提供者元件
- 主題上下文管理
- CSS 變數生成
- 主題切換

**核心功能**:
```rust
use hikari_theme::ThemeProvider;

rsx! {
    ThemeProvider { palette: "hikari" } {
        // 應用程式內容
        App {}
    }
}
```

**支援的主題**:
- **Hikari (光)** - 淺色主題
  - 主色: 石青 (#00A0E9)
  - 次色: 朱砂 (#E94B35)
  - 強調色: 藤黃 (#F8B62D)

- **Tairitsu** - 深色主題
  - 主色: 靛藍 (#1a237e)
  - 次色: 朱砂 (#E94B35)
  - 強調色: 鵝黃 (#FFF176)

### 3. 動畫系統 (hikari-animation)

高效能的宣告式動畫系統。

**職責**:
- 動畫建構器
- 動畫上下文
- 緩動函數
- 預設動畫

**核心功能**:
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

**架構元件**:
- **builder** - 動畫建構器 API
- **context** - 執行時期動畫上下文
- **style** - 型別安全的 CSS 操作
- **easing** - 30+ 緩動函數
- **tween** - 插值系統
- **timeline** - 時間線控制
- **presets** - 預設動畫（淡入、滑動、縮放）
- **spotlight** - 聚光燈效果

**效能特性**:
- WASM 優化
- 防抖更新
- requestAnimationFrame 整合
- 最小化重排重繪

### 4. 圖示系統 (hikari-icons)

圖示管理和渲染系統。

**職責**:
- 圖示列舉定義
- SVG 內容生成
- 圖示尺寸變體
- Lucide Icons 整合

**核心功能**:
```rust
use hikari_icons::{Icon, LucideIcon};

rsx! {
    Icon {
        icon: LucideIcon::Search,
        size: 24,
        color: "var(--hi-primary)"
    }
}
```

**圖示來源**:
- Lucide Icons（1000+ 圖示）
- 可擴展的自訂圖示
- 多種尺寸支援

### 5. 元件庫 (hikari-components)

完整的 UI 元件庫。

**職責**:
- 基礎 UI 元件
- 版面配置元件
- 樣式註冊表
- 響應式 hooks

**元件分類**:

1. **基礎元件** (feature: "basic")
   - Button, Input, Card, Badge

2. **反饋元件** (feature: "feedback")
   - Alert, Toast, Tooltip, Spotlight

3. **導航元件** (feature: "navigation")
   - Menu, Tabs, Breadcrumb

4. **版面配置元件** (always available)
   - Layout, Header, Aside, Content, Footer

5. **資料元件** (feature: "data")
   - Table, Tree, Pagination

**模組化設計**:
```
hikari-components/
 ├── basic/          # 基礎元件
 ├── feedback/       # 反饋元件
 ├── navigation/     # 導航元件
 ├── layout/         # 版面配置元件
 ├── data/           # 資料元件
 ├── hooks.rs        # React hooks
 ├── styled.rs       # 樣式 traits
 └── theme_provider.rs  # 主題提供者
```

**樣式系統**:
- SCSS 原始碼
- 型別安全的工具類
- 元件級樣式隔離
- CSS 變數整合

### 6. 建置系統 (hikari-builder)

編譯時期程式碼生成和 SCSS 編譯。

**職責**:
- SCSS 編譯（使用 Grass）
- 元件發現
- 程式碼生成
- 資源打包

**建置流程**:
```
1. 尋找工作區根目錄
   ↓
2. 掃描 SCSS 檔案
   ↓
3. 生成 Rust 常數
   ↓
4. 編譯 SCSS Bundle
   ↓
5. 輸出到 public/
```

**使用方式**:
```rust
// build.rs
fn main() {
    hikari_builder::build().expect("Build failed");
}
```

**生成檔案**:
- `packages/builder/src/generated/components.rs` - 元件常數
- `public/styles/bundle.css` - 編譯後的 CSS

### 7. 渲染服務 (hikari-render-service)

伺服器端渲染和靜態資源服務。

**職責**:
- HTML 模板渲染
- 樣式註冊表
- 路由建構器
- 靜態資源服務
- Axum 整合

**核心功能**:
```rust
use hikari_render_service::HikariRenderServicePlugin;

let app = HikariRenderServicePlugin::new()
    .component_style_registry(registry)
    .static_assets("./dist", "/static")
    .add_route("/api/health", get(health_check))
    .build()?;
```

**架構模組**:
- **html** - HTML 服務
- **registry** - 樣式註冊表
- **router** - 路由建構器
- **static_files** - 靜態檔案服務
- **styles_service** - 樣式注入
- **plugin** - 插件系統

### 8. 進階元件庫 (hikari-extra-components)

進階 UI 元件，提供複雜互動場景的專用功能。

**職責**:
- 進階工具元件
- 拖曳和縮放互動
- 可折疊面板
- 動畫整合

**核心元件**:

1. **Collapsible** - 可折疊面板
   - 左右滑入/滑出動畫
   - 可配置寬度
   - 展開狀態回調

2. **DragLayer** - 拖曳層
   - 邊界約束
   - 拖曳事件回調
   - 自訂 z-index

3. **ZoomControls** - 縮放控制
   - 鍵盤快捷鍵支援
   - 可配置縮放範圍
   - 多種定位選項

**核心功能**:
```rust
use hikari_extra_components::{Collapsible, DragLayer, ZoomControls};

// 可折疊面板
Collapsible {
    title: "設定".to_string(),
    expanded: true,
    position: CollapsiblePosition::Right,
    div { "內容" }
}

// 拖曳層
DragLayer {
    initial_x: 100.0,
    initial_y: 100.0,
    constraints: DragConstraints {
        min_x: Some(0.0),
        max_x: Some(500.0),
        ..Default::default()
    },
    div { "拖曳我" }
}

// 縮放控制
ZoomControls {
    zoom: 1.0,
    on_zoom_change: move |z| println!("Zoom: {}", z)
}
```

## 架構原則

### 1. 模組化設計

每個套件都是獨立的，可以單獨使用：

```toml
# 只使用調色板
[dependencies]
hikari-palette = "0.1"

# 使用元件和主題
[dependencies]
hikari-components = "0.1"
hikari-theme = "0.1"

# 使用動畫系統
[dependencies]
hikari-animation = "0.1"
```

### 2. 分層架構

```
┌─────────────────────────────────────┐
│      應用層 (examples/)              │
├─────────────────────────────────────┤
│    元件層 (hikari-components)       │
├─────────────────────────────────────┤
│  系統層 (theme, animation, icons)   │
├─────────────────────────────────────┤
│   基礎層 (palette, builder)         │
└─────────────────────────────────────┘
```

### 3. 單向資料流

```
使用者操作 → 事件處理 → 狀態更新 → UI 重新渲染
```

### 4. 型別安全

所有 API 都是型別安全的：
- 編譯時檢查
- IDE 自動完成
- 重構安全

### 5. 效能優先

- WASM 優化
- 虛擬滾動
- 防抖/節流
- 最小化 DOM 操作

## 建置流程

### 開發模式
```bash
cargo run
```

### 生產建置
```bash
# 1. 建置 Rust 程式碼
cargo build --release

# 2. 建置系統自動編譯 SCSS
# 3. 生成 CSS bundle
# 4. 打包靜態資源
```

### WASM 建置
```bash
trunk build --release
```

## 相依性

```
hikari-components
  ├── hikari-palette
  ├── hikari-theme
  ├── hikari-animation
  └── hikari-icons

hikari-extra-components
  ├── hikari-palette
  ├── hikari-theme
  └── hikari-animation

hikari-render-service
  ├── hikari-components
  └── axum

hikari-builder
  └── grass (SCSS compiler)
```

## 擴展性

### 新增自訂元件

```rust
use hikari_components::{StyledComponent, StyleRegistry};

pub struct MyComponent;

impl StyledComponent for MyComponent {
    fn register_styles(registry: &mut StyleRegistry) {
        registry.register("my-component", include_str!("my-component.scss"));
    }
}
```

### 新增自訂主題

```rust
use hikari_palette::ThemePalette;

struct CustomTheme;

impl CustomTheme {
    pub fn palette() -> ThemePalette {
        ThemePalette {
            primary: "#FF0000",
            secondary: "#00FF00",
            // ...
        }
    }
}
```

### 新增自訂動畫預設

```rust
use hikari_animation::{AnimationBuilder, AnimationContext};

pub fn fade_in(
    builder: AnimationBuilder,
    element: &str,
    duration: u32,
) -> AnimationBuilder {
    builder
        .add_style(element, CssProperty::Opacity, "0")
        .add_style(element, CssProperty::Opacity, "1")
        .apply_with_transition(&format!("{}ms", duration), "ease-out")
}
```

## 效能優化

### 1. CSS 優化
- SCSS 編譯為優化的 CSS
- 移除未使用的樣式（tree-shaking）
- 壓縮生產環境 CSS

### 2. WASM 優化
- `wasm-opt` 優化
- 懶載入 WASM 模組
- 線性記憶體優化

### 3. 執行時期優化
- 虛擬滾動（大型資料列表）
- 防抖動畫更新
- requestAnimationFrame

### 4. 建置優化
- 平行編譯
- 增量編譯
- 二進制快取

## 測試策略

### 單元測試
每個模組都有完整的單元測試：

```rust
#[cfg(test)]
mod tests {
    #[test]
    fn test_color_conversion() {
        let color = ChineseColor::朱砂;
        assert_eq!(color.hex(), "#E94B35");
    }
}
```

### 整合測試
`examples/` 中的範例應用程式作為整合測試

### 視覺回歸測試
使用 Percy 或類似工具進行 UI 快照測試

## 下一步

- 閱讀 [元件文件](../components/) 了解具體元件
- 檢視 [API 文件](https://docs.rs/hikari-components) 了解 API 詳情
- 瀏覽 [範例程式碼](../../examples/) 學習最佳實踐
