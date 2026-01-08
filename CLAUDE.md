# Hikari 项目文档 (Claude 指南)

> Hikari - 基于 Dioxus + Grass + Axum 的 Rust UI 框架
>
> **设计风格**: Arknights 平面设计 + FUI 科幻感 + 中国传统色
>
> **名称来源**: "Hikari" (光) 来自音乐游戏 Arcaea

---

## 项目概述

Hikari 是一个现代化的 Rust UI 框架，采用模块化设计，结合了中国传统色彩美学和科幻界面设计。项目名称"Hikari"（光）取自音乐游戏 Arcaea。

### 技术栈

```
Frontend (WASM):  Dioxus 0.7
Styling:         Grass (SCSS 编译器)
Build System:    Justfile
Palette:         中国传统色 (500+ 色)
Server (SSR):    Axum (可选)
Tooling:         Python 3.11+ 用于预构建脚本
```

---

## 框架系统架构

### 1. 色彩系统 (hikari-palette)

**职责**: 中国传统色彩管理和工具类系统

**核心功能**:
- 500+ 中国传统颜色定义（colors.rs）
- 主题色板系统（themes.rs: Hikari, Tairitsu）
- 类型安全的工具类系统（classes/）
- 透明度和颜色混合工具

**关键类型**:
```rust
// 颜色使用
use hikari_palette::{朱砂, 石青, opacity};

// 主题使用
use hikari_palette::themes::{Hikari, Tairitsu};

// 工具类使用
use hikari_palette::classes::{Display, FlexDirection, Gap};
use hikari_palette::ClassesBuilder;
```

**注意事项**:
- ❌ **不要创建新的颜色常量** - 使用现有的 500+ 颜色
- ✅ **优先使用主题色板** - Hikari::palette() 或 Tairitsu::palette()
- ✅ **使用工具类进行样式** - 避免内联样式字符串

---

### 2. 主题系统 (hikari-theme)

**职责**: 主题上下文和样式注入

**核心功能**:
- ThemeProvider 组件（provider.rs）
- ThemeContext 和 hooks（context.rs）
- 自动生成的主题资源（generated/）

**关键 API**:
```rust
use hikari_theme::ThemeProvider;

// 基础使用
ThemeProvider { palette: "hikari" } {
    // 应用内容
}

// 嵌套主题（局部覆盖）
ThemeProvider { palette: "hikari" } {
    div {
        ThemeProvider { palette: "tairitsu" } {
            // 深色主题区域
        }
    }
}

// 访问主题
let theme = use_theme()?;
let color = theme.palette.primary;
```

**支持的主题**:
- `"hikari"` - 浅色主题（光）
- `"tairitsu"` - 深色主题（tairitsu）

**注意事项**:
- ✅ **ThemeProvider 应该在应用根部**
- ✅ **支持嵌套主题进行局部覆盖**
- ❌ **不要修改现有主题，创建新的主题结构体**

---

### 3. 动画系统 (hikari-animation)

**职责**: 声明式动画和动态值

**核心模块**:
- **builder.rs** - AnimationBuilder（主要 API）
- **context.rs** - AnimationContext（运行时状态）
- **style.rs** - StyleBuilder（类型安全的 CSS）
- **easing.rs** - 30+ 缓动函数
- **tween.rs** - 插值系统
- **timeline.rs** - 时间线控制
- **presets/** - 预设动画（fade, slide, scale）
- **spotlight.rs** - 聚光灯效果

**关键 API**:
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

// 防抖动画（性能优化）
let mut debounced = AnimationBuilderDebounced::new(&elements, 500);
debounced.add_style("button", CssProperty::Opacity, "0.5");
debounced.flush(); // 立即应用
```

**性能优化**:
- ✅ **使用防抖动画** - 处理频繁更新（如滚动）
- ✅ **优先使用 CSS 过渡** - 简单状态改变
- ✅ **使用 requestAnimationFrame** - 帧级动画

**注意事项**:
- ⚠️ **仅支持 WASM 目标** (`#[cfg(target_arch = "wasm32")]`)
- ❌ **不要创建新的缓动函数** - 使用现有的 30+ 函数
- ✅ **AnimationContext 提供丰富的运行时信息**

---

### 4. 图标系统 (hikari-icons)

**职责**: 图标枚举和 SVG 内容

**核心功能**:
- Lucide Icons 枚举（generated/lucide.rs）
- SVG 内容生成
- Icon 组件

**关键 API**:
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

**注意事项**:
- ✅ **使用 LucideIcon 枚举** - 类型安全
- ❌ **不要手动创建 SVG 字符串** - 使用 Icon 组件
- ✅ **图标会自动继承颜色**

---

### 5. 组件库 (hikari-components)

**职责**: UI 组件和样式系统

**组件分类**:

1. **基础组件** (basic/)
   - Button, Input, Card, Badge

2. **反馈组件** (feedback/)
   - Alert, Toast, Tooltip, Spotlight

3. **导航组件** (navigation/)
   - Menu, Tabs, Breadcrumb

4. **布局组件** (layout/)
   - Layout, Header, Aside, Content, Footer

5. **数据组件** (data/)
   - Table, Tree, Pagination（模块化设计）

**模块化设计示例**:

表格组件（8 个模块）:
```
data/table/
 ├── table.rs         # 核心逻辑
 ├── column.rs        # 列定义
 ├── cell.rs          # 单元格渲染
 ├── header.rs        # 表头
 ├── pagination.rs    # 分页
 ├── sort.rs          # 排序
 ├── filter.rs        # 筛选
 └── selection.rs     # 选择
```

树形控件（5 个模块）:
```
data/tree/
 ├── tree.rs          # 核心逻辑
 ├── node.rs          # 节点定义
 ├── virtual.rs       # 虚拟滚动
 ├── collapse.rs      # 折叠/展开
 └── drag.rs          # 拖拽
```

**关键 API**:
```rust
use hikari_components::{
    ThemeProvider, Button, Input, Card,
    Alert, Toast, Tooltip,
    Menu, Tabs, Breadcrumb,
    Layout, Header, Aside, Content,
    Table, Tree,
};

// 使用组件
rsx! {
    Button { label: "点击我", variant: "primary" }
    Input { placeholder: "请输入..." }
    Alert { variant: "success", title: "成功" }
}

// 样式注册
let mut registry = StyleRegistry::default();
registry.register_all();
```

**注意事项**:
- ✅ **使用 feature flags** - 按需启用组件组
- ✅ **遵循模块化设计** - 复杂组件拆分为多个模块
- ❌ **不要在组件中使用全局样式** - 使用 StyledComponent trait
- ✅ **所有组件自动继承主题** - 从 ThemeProvider

---

### 6. 构建系统 (hikari-builder)

**职责**: 编译时代码生成和 SCSS 编译

**核心功能**:
- SCSS 编译（使用 Grass）
- 组件发现和代码生成
- 资源打包

**构建流程**:
```
1. 查找工作空间根目录
   ↓
2. 扫描 packages/components/src/styles/components/*.scss
   ↓
3. 生成 packages/builder/src/generated/components.rs
   ↓
4. 编译 packages/components/src/styles/index.scss
   ↓
5. 输出 public/styles/bundle.css
```

**使用方式**:
```rust
// build.rs
fn main() {
    hikari_builder::build().expect("Build failed");
}
```

**关键配置**:
```rust
BuildConfig {
    components: vec!["button".to_string(), "card".to_string()],
    output_dir: "public".into(),
    minify_css: false,
    scss_entry: "packages/components/src/styles/index.scss".into(),
    ..BuildConfig::default()
}
```

**注意事项**:
- ✅ **自动运行** - 在 `cargo build` 时自动执行
- ❌ **不要编辑 generated/*.rs** - 自动生成的文件
- ✅ **使用 Grass** - 纯 Rust，无需 Ruby Sass
- ✅ **增量编译** - SCSS 未改变时不重新编译

---

### 7. 渲染服务 (hikari-render-service)

**职责**: SSR 和静态资源服务

**核心模块**:
- **plugin.rs** - HikariRenderServicePlugin（主要 API）
- **html.rs** - HtmlService（HTML 模板）
- **registry.rs** - StyleRegistry（样式管理）
- **router.rs** - 路由构建器
- **static_files.rs** - 静态文件服务
- **styles_service.rs** - 样式注入

**关键 API**:
```rust
use hikari_render_service::HikariRenderServicePlugin;

let app = HikariRenderServicePlugin::new()
    // 样式管理
    .component_style_registry(registry)
    .register_style("custom", ".custom { color: red; }")

    // 路由
    .add_route("/api/health", get(health_check))

    // 静态资源
    .static_assets("./dist", "/static")
    .icon_assets("./icons", "/static/icons")

    // 状态
    .state("api_key", "secret")

    // 构建
    .build()?;
```

**注意事项**:
- ✅ **集成 Axum** - 与 Dioxus SSR 无缝集成
- ✅ **静态资源缓存** - 可配置 Cache-Control
- ❌ **不要直接使用 HtmlService** - 通过 Plugin 使用

---

## 开发指南

### 添加新组件

1. **创建组件文件**
   ```
   packages/components/src/basic/my_component.rs
   ```

2. **实现 StyledComponent trait**
   ```rust
   use hikari_components::StyledComponent;

   pub struct MyComponent;

   impl StyledComponent for MyComponent {
       fn register_styles(registry: &mut StyleRegistry) {
           registry.register("my-component", include_str!("styles/my-component.scss"));
       }
   }
   ```

3. **创建 SCSS 文件**
   ```scss
   // packages/components/src/styles/components/my-component.scss
   .hi-my-component {
       @apply hi-flex hi-items-center;
   }
   ```

4. **在 mod.rs 中导出**
   ```rust
   pub mod my_component;
   pub use my_component::MyComponent;
   ```

5. **添加 feature flag**
   ```toml
   [features]
   my-component = []
   ```

6. **编写文档和测试**
   ```rust
   /// MyComponent - 我的组件
   ///
   /// # Example
   /// ```rust,no_run
   /// use hikari_components::MyComponent;
   /// ```
   ```

### 组件模块化策略

**表格组件（8 个模块）**:
```
table/
 ├── table.rs         # 核心逻辑
 ├── column.rs        # 列定义
 ├── cell.rs          # 单元格渲染
 ├── header.rs        # 表头
 ├── pagination.rs    # 分页
 ├── sort.rs          # 排序
 ├── filter.rs        # 筛选
 └── selection.rs     # 选择
```

**树形控件（5 个模块）**:
```
tree/
 ├── tree.rs          # 核心逻辑
 ├── node.rs          # 节点定义
 ├── virtual.rs       # 虚拟滚动
 ├── collapse.rs      # 折叠/展开
 └── drag.rs          # 拖拽
```

### 样式系统

**SCSS 编译**:
- 入口点: `packages/components/src/styles/index.scss`
- 组件样式: `packages/components/src/styles/components/*.scss`
- 工具类: `packages/palette/src/classes/`
- 输出: `public/styles/bundle.css`

**CSS 变量**:
```css
.hi-theme-provider[data-theme="hikari"] {
    --hi-primary: #00A0E9;
    --hi-secondary: #E94B35;
    --hi-accent: #F8B62D;
    /* ... */
}
```

**使用主题变量**:
```rust
rsx! {
    div {
        style: "color: var(--hi-primary); background: var(--hi-background);",
        "使用主题变量"
    }
}
```

### 调色板使用

```rust
use hikari_palette::{ChineseColor, opacity};

// 使用特定颜色
let red = ChineseColor::朱砂;
let blue = ChineseColor::石青;

// 透明度处理
let semi_red = opacity(red, 0.5);

// 使用主题
let theme = Hikari::palette();
let primary = theme.primary;
```

---

## Git 提交规范

**重要**：每次迭代完成后必须进行一次 git 提交，严格遵守以下规范：

- **格式**: `emoji 一句话英语描述`
- **示例**:
  - `🏗️ Initialize workspace structure`
  - `🎨 Add hikari-palette with Chinese colors`
  - `📦 Add justfile build system`
  - `🔧 Configure Python tooling scripts`
  - `📝 Add comprehensive documentation`
  - `✨ Implement animation system with easing functions`
  - `🐛 Fix theme provider context issue`
  - `♻️ Refactor SCSS variables for better organization`
  - `⚡ Performance optimization for virtual scrolling`
  - `🔖 Bump version to 0.2.0`

**注意**:
- 使用单个 emoji
- 只有一句话的英语描述（不使用中文）
- **不要 push 到云端**（除非明确要求）

---

## 设计风格

### Arknights 平面设计
- 干净的线条、清晰的信息层级
- 高对比度，避免模糊
- 简约而不失精致

### FUI 科幻感
- 微妙的发光效果（`box-shadow`, `text-shadow`）
- 动态指示（呼吸灯、脉冲动画）
- 精细的边框（1px 半透明）
- 几何图案（六边形、网格）

### 中国传统色应用
- **主色**: 石青（蓝）、朱砂（红）、藤黄（黄）、靛蓝（深蓝）
- **中性色**: 月白（淡白）、墨色（深黑）、缟色（浅灰）
- **功能色**: 葱倩（成功）、鹅黄（警告）、朱砂（危险）

---

## 命名规范

### 子包命名
- 所有子包使用 `hikari-*` 前缀
- 避免使用 `hikari`（已被占用）
- 内部包使用 `_hikari-*` 下划线前缀

### 代码风格
- **常量名**: 中文（如 `朱砂`、`石青`）用于调色板
- **其他**: 英文命名，遵循 Rust 约定
- **组件名**: PascalCase（如 `Button`, `DataTable`）
- **函数名**: snake_case（如 `get_color`, `render_cell`）

---

## 构建和测试

### 使用 Justfile

```bash
just build           # 构建所有包
just test            # 运行所有测试
just fmt             # 格式化代码
just clippy          # 运行 Clippy
just generate-all    # 生成所有静态资源（Tailwind CSS + Lucide Icons）
just build-generated # 生成静态资源后构建
```

### Python 预构建脚本

项目使用 Python 脚本在预构建阶段从 CDN 或 GitHub API 下载外部资源：

```bash
python scripts/generate_palette.py     # 生成中国传统色调色板
python scripts/fetch_tailwindcss.py     # 下载并生成 Tailwind CSS
python scripts/fetch_lucide_icons.py   # 下载并生成 Lucide Icons
```

生成的文件位于：
- `packages/theme/src/generated/` - Tailwind CSS 和主题资源
- `packages/icons/src/generated/` - Lucide Icons 枚举和 SVG 内容
- `packages/palette/src/colors.rs` - 中国传统色定义

---

## 当前状态

- ✅ Phase 1-3: hikari-palette, hikari-theme (已完成)
- 🚧 Phase 4: hikari-components (进行中)
  - 基础组件: Button, Input, Card, Badge
  - 反馈组件: Alert, Toast, Tooltip
  - 导航组件: Menu, Tabs, Breadcrumb
  - 表格组件（模块化）
  - 树形控件（模块化）

---

## 参考项目

- **tairitsu**: 架构模式、justfile、Python 工具脚本
- **akasha**: 节点图系统、贝塞尔曲线连接、小地图
- **hydro.sinap.ac.cn**: Dioxus + Grass + SCSS 编译
- **quotation-sheet-generator**: Dioxus + Axum 架构

---

## 核心理念

**简约、科技、文化自信**

- 简约: 清晰的代码结构，直观的 API
- 科技: 现代化的技术栈，优秀的性能
- 文化自信: 中国传统色彩与现代设计的完美融合

---

## Agent 指南

### Claude Agent 使用建议

1. **开始新任务前**
   - ✅ 先阅读此 CLAUDE.md
   - ✅ 检查现有的系统架构
   - ❌ 不要创建新的轮子

2. **使用现有系统**
   - ✅ **色彩**: 使用 `hikari-palette`，不要创建新颜色
   - ✅ **主题**: 使用 `ThemeProvider`，不要修改现有主题
   - ✅ **动画**: 使用 `AnimationBuilder`，不要直接操作 DOM
   - ✅ **图标**: 使用 `LucideIcon` 枚举，不要手动创建 SVG
   - ✅ **样式**: 使用 SCSS 和工具类，不要用内联样式

3. **添加新功能时**
   - ✅ 遵循模块化设计
   - ✅ 实现 StyledComponent trait
   - ✅ 添加完整的文档注释
   - ✅ 编写单元测试
   - ✅ 遵循 Git 提交规范

4. **性能优化**
   - ✅ 使用虚拟滚动（大数据列表）
   - ✅ 使用防抖动画（频繁更新）
   - ✅ 优先使用 CSS 过渡
   - ❌ 避免频繁的 DOM 操作

5. **文档规范**
   - ✅ 所有公共 API 必须有文档注释
   - ✅ 包含使用示例
   - ✅ 说明性能考虑
   - ✅ 标注平台支持（WASM/SSR）

### 避免的常见错误

1. ❌ **创建新的颜色常量** - 使用现有的 500+ 颜色
2. ❌ **修改现有主题** - 创建新的主题结构体
3. ❌ **手动拼接 CSS 字符串** - 使用 StyleBuilder 或 SCSS
4. ❌ **直接操作 DOM** - 使用 AnimationBuilder 或 Dioxus
5. ❌ **创建全局样式** - 使用 StyledComponent trait
6. ❌ **忽略模块化设计** - 复杂组件应该拆分
7. ❌ **使用中文提交信息** - 使用 emoji + 英语
8. ❌ **跳过文档** - 公共 API 必须有文档

---

## 相关资源

- **文档**: `docs/` 目录（多语言）
- **示例**: `examples/` 目录
- **API 文档**: https://docs.rs/hikari-components
- **设计规范**: `docs/zh-CN/design/`
- **贡献指南**: `CONTRIBUTING.md`
- **许可证**: `LICENSE`

---

**最后更新**: 2026-01-08
**维护者**: Hikari Contributors
**许可**: MIT OR Apache-2.0
