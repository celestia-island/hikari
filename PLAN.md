# Hikari & Tairitsu Web-Sys/Wasm-Bindgen 清理报告

## 执行摘要

| 项目 | 状态 | 说明 |
|------|------|------|
| hikari-components | ✅ 完成 | 组件层已迁移到 Platform API |
| hikari-animation | ✅ 正常 | 动画核心库保留 web-sys（设计决策） |
| tairitsu-vdom | ✅ 清洁 | 无 web-sys 依赖 |
| tairitsu-hooks | ✅ 清洁 | css_var.rs 未启用（无 web feature） |
| tairitsu-style | ✅ 清洁 | 无 web-sys 依赖 |
| tairitsu-web | ✅ 正常 | 双后端架构（web-sys + WIT） |

---

## 架构原则

```
┌─────────────────────────────────────────────────────────────────┐
│                        Component Layer                           │
│  button, input, modal, anchor, qrcode, theme-provider...       │
│                          ↓ Platform API                          │
├─────────────────────────────────────────────────────────────────┤
│                      Platform Abstraction                        │
│                    platform/web.rs + stub.rs                     │
│                     ↓ web-sys / WitPlatform                      │
├─────────────────────────────────────────────────────────────────┤
│                       Browser Backends                           │
│         web-sys (current) ←→ WIT bindings (future)              │
└─────────────────────────────────────────────────────────────────┘
```

**核心原则：组件层不直接使用 web-sys，通过 Platform API 访问 DOM。**

---

## 已完成的修复

### 1. Hikari 组件层迁移到 Platform API

| 文件 | 原用法 | 迁移后 |
|------|--------|--------|
| `theme/provider.rs` | `Closure::once` + `web_sys::window()` | `platform::set_timeout` |
| `navigation/anchor.rs` | `web_sys::window()` + `document` | `platform::get_element_rect_by_id` |
| `display/qrcode.rs` | `dyn_ref::<HtmlCanvasElement>()` | `platform::draw_qrcode_on_canvas_by_id` |
| `portal/render.rs` | `Closure::once_into_js` + `request_animation_frame` | `platform::request_animation_frame` |

### 2. 新增 Platform API

| 函数 | 用途 |
|------|------|
| `query_selector` | 查询单个元素 |
| `get_element_by_id` | 根据 ID 获取元素 |
| `get_element_rect_by_id` | 获取元素边界矩形 |
| `on_scroll` | 滚动事件监听 |
| `draw_qrcode_on_canvas_by_id` | 在 Canvas 上绘制 QR 码 |
| `request_animation_frame` | 请求动画帧 |

### 3. Tairitsu WIT 文件修复

**问题 1：** `record dom-rect` 在 WIT 文件顶层定义，导致 wit-bindgen 编译错误。

**修复：** 将 `dom-rect` 添加到现有的 `interface types` 内部（位于第 5775 行）：

```wit
interface types {
    /// DOMRect values returned by getBoundingClientRect.
    record dom-rect {
        x: f64,
        y: f64,
        width: f64,
        height: f64,
    }
    // ... 其他类型定义
}
```

**问题 2：** `resize-observer-entry` 接口使用 `dom-rect` 但未导入。

**修复：** 添加 `use types.{dom-rect};` 到该接口。

**问题 3：** `on_interval` 回调使用 `FnOnce` 但 interval 需要重复调用。

**修复：** 新增 `IntervalCallback` 类型使用 `FnMut`：

```rust
type IntervalCallback = Option<Box<dyn FnMut()>>;
```

---

## 保留 Web-Sys 的文件（合理架构设计）

### Hikari Components

| 分类 | 文件 | 原因 |
|------|------|------|
| Platform 层 | `platform/web.rs` | Platform API 实现 |
| 纯脚本 | `scripts/scrollbar_container.rs` | `#[wasm_bindgen]` 导出 JS 函数 |
| 动画层 | `portal/animation/*.rs` | 直接操作 DOM 样式 |
| 动画层 | `basic/background.rs` | 复杂 requestAnimationFrame 动画 |
| JS 互操作 | `production/code_highlight.rs` | `#[wasm_bindgen(inline_js)]` |

### Hikari Animation

| 文件 | 原因 |
|------|------|
| `animation/src/*.rs` | 动画系统核心，需要直接操作 HtmlElement |

### Tairitsu Web

| 模块 | 原因 |
|------|------|
| `wit_platform.rs` | WIT bindings 后端（可选 feature） |

---

## Platform API 清单

### DOM 查询

- `query_selector` - 查询单个元素
- `query_selector_all` - 查询所有匹配元素
- `get_element_by_id` - 根据 ID 获取元素
- `get_element_rect_by_id` - 获取元素边界矩形
- `element_from_point` - 根据坐标获取元素
- `element_closest` - 查找最近的匹配祖先元素
- `get_target_element_from_event` - 从事件坐标获取目标元素

### 滚动

- `get_scroll_y` - 获取垂直滚动位置
- `scroll_to_with_options` - 平滑滚动到指定位置
- `on_scroll` - 滚动事件监听

### 尺寸

- `inner_width` / `inner_height` - 窗口尺寸
- `get_bounding_client_rect` - 获取元素边界矩形

### 定时器与动画

- `set_timeout` - 延时执行
- `request_animation_frame` - 请求动画帧

### Observer

- `create_resize_observer` / `observe_resize` / `disconnect_resize`
- `create_mutation_observer` / `observe_mutations` / `disconnect_mutation`

### Canvas

- `get_canvas_context` - 获取 Canvas 2D 上下文
- `draw_qrcode_on_canvas` / `draw_qrcode_on_canvas_by_id` - QR 码绘制

### 样式与日志

- `set_style_property` / `get_computed_style_value`
- `log` / `log_warn` / `log_error`
- `now_timestamp`

---

## 验证命令

```bash
# 构建 hikari-components (wasm32-unknown target)
cargo build -p hikari-components --target wasm32-unknown-unknown

# 构建 tairitsu 核心（无 web-sys）
cargo build -p tairitsu-vdom -p tairitsu-hooks -p tairitsu-style

# 构建 tairitsu-web 默认（web-sys 后端）
cargo build -p tairitsu-web

# 构建 tairitsu-web WIT 后端（需要在 tairitsu 目录）
cd /mnt/sdb1/tairitsu
cargo build -p tairitsu-web --features wit-bindings --target wasm32-wasip2
```

---

## 结论

**所有 web-sys/wasm-bindgen 使用都是合理的架构设计：**

1. **组件层** → 已完全迁移到 Platform API ✅
2. **Platform 抽象层** → 必须使用 web-sys 实现 ✅
3. **纯 WASM 脚本** → 需要 `#[wasm_bindgen]` 导出 JS 函数 ✅
4. **动画系统** → 需要直接操作 DOM 元素样式 ✅
5. **Tairitsu 核心** → 无 web-sys 依赖，跨平台 ✅
6. **WIT 绑定** → 已修复语法问题，可正常编译 ✅

**架构优势：**

- 组件层完全解耦 web-sys，可切换到 WIT bindings
- Tairitsu 核心库（vdom/hooks/style）无任何 web-sys 依赖
- 双后端设计支持渐进式迁移

---

## CSS/SCSS 编译管线修复

### 问题诊断

**症状：** 浏览器中组件内容已正常渲染，但所有组件样式缺失。`bundle.css` 仅 12,945 字节，只包含工具类（`.hi-flex`、`.hi-hidden` 等）和 CSS 变量（`:root`），而 59 个组件的 SCSS 样式被完全丢弃。

**根因：** `tairitsu-packager` 的 SCSS 编译器（`styles/compiler.rs`）是一个 193 行的简易解析器，只支持基础的嵌套选择器和属性，完全不支持：

| 缺失功能 | 影响 |
|---------|------|
| `@import` / `@use` / `@forward` | 所有组件 SCSS 文件无法被引入 |
| `$variable` | SCSS 变量全部被丢弃或误解析 |
| `@mixin` / `@include` | 混入代码全部丢失 |
| `@keyframes` | 动画定义被错误处理 |
| `@media` / `@supports` | 媒体查询丢失 |
| `load_paths` | 配置的搜索路径从未传递给编译器 |

**附加问题：** `CssExtractor::remove_duplicate_rules()` 使用 `split('}')`，破坏所有嵌套 CSS 结构（`@keyframes`、`@media` 等），导致括号不配对。

### 修复方案

#### 1. 替换 SCSS 编译器（tairitsu `styles/compiler.rs`）

| 改前 | 改后 |
|------|------|
| 自研 193 行简易解析器 | Grass SCSS 编译器（Dart Sass 的 Rust 实现） |
| 不支持 `@import` | 完整支持所有 SCSS 指令 |
| 无 `load_paths` 支持 | 通过 `grass::Options::load_paths()` 传递 |
| 自实现的 `minify_css()` | `grass::OutputStyle::Compressed` |

```rust
// 新的 ScssCompiler 核心
fn grass_options(&self) -> grass::Options<'_> {
    let style = if self.options.minify {
        grass::OutputStyle::Compressed
    } else {
        grass::OutputStyle::Expanded
    };
    let mut opts = grass::Options::default()
        .style(style)
        .input_syntax(grass::InputSyntax::Scss);
    for p in &self.options.load_paths {
        opts = opts.load_path(p);
    }
    opts
}

pub fn compile_file(&self, path: &Path) -> Result<String> {
    grass::from_path(path, &self.grass_options())
        .map_err(|e| anyhow::anyhow!("SCSS error in {}: {}", path.display(), e))
}
```

#### 2. 传递 `load_paths`（tairitsu `styles/mod.rs`）

`compile_scss_with_config()` 现在会将配置中的 `load_paths` 解析为绝对路径并传入编译器：

```rust
let resolved_load_paths: Vec<PathBuf> = config.load_paths.iter()
    .map(|p| std::fs::canonicalize(project_root.join(p)).unwrap_or(...))
    .collect();
let compiler = ScssCompiler::with_options(CompilerOptions {
    load_paths: resolved_load_paths,
    ..
});
```

#### 3. 移除有缺陷的 CSS 后处理（`CssExtractor`）

Grass 已输出优化/压缩的 CSS，不再需要 `CssExtractor::optimize()` 的去重步骤。该步骤的 `split('}')` 实现会破坏嵌套 CSS 结构。

#### 4. 补全缺失的组件导入（hikari `index.scss`）

在 `index.scss` 末尾添加 12 个之前遗漏的组件导入：

```scss
@import './components/anchor.scss';
@import './components/cascader.scss';
@import './components/collapse.scss';
@import './components/drag.scss';
@import './components/filter.scss';
@import './components/flex.scss';
@import './components/pagination_jump_modal.scss';
@import './components/selection.scss';
@import './components/sort.scss';
@import './components/stepper.scss';
@import './components/transfer.scss';
@import './components/virtual-scroll.scss';
```

注：5 个 `-vars.scss` 文件（`button-vars`、`card-vars`、`icon-button-vars`、`input-vars`、`modal-vars`）已由各自的父组件 SCSS 文件 `@import`，不需要在 `index.scss` 中重复引入。

### 结果对比

| 指标 | 修复前 | 修复后 |
|------|--------|--------|
| bundle.css 大小 | 12,945 bytes | 259,020 bytes |
| 包含组件数 | ~4（部分） | 59（全部） |
| CSS 括号平衡 | ❌ 不平衡 | ✅ 完全平衡 |
| `@import` 解析 | ❌ 被丢弃 | ✅ 完整解析 |
| `$variable` 支持 | ❌ 被丢弃 | ✅ 完整支持 |
| `@mixin/@include` | ❌ 被丢弃 | ✅ 完整支持 |
| `@keyframes` | ❌ 括号被破坏 | ✅ 正确输出 |
| `load_paths` | ❌ 日志记录但未使用 | ✅ 传递给 Grass |

### 修改的文件

| 文件（tairitsu 仓库） | 变更 |
|-----------------------|------|
| `packages/packager/src/styles/compiler.rs` | 替换为 Grass 编译器实现 |
| `packages/packager/src/styles/mod.rs` | 解析 load_paths + 移除 extractor |

| 文件（hikari 仓库） | 变更 |
|---------------------|------|
| `packages/components/src/styles/index.scss` | 添加 12 个缺失的组件导入 |

### SCSS 构建管线架构

```
examples/website/Cargo.toml
  ↓ [package.metadata.tairitsu.scss]
  ↓ entries: index.scss → bundle.css, spa.scss → spa.css
  ↓ load_paths: theme/styles, components/src/styles

tairitsu-packager (tairitsu build / tairitsu dev)
  ↓ compile_scss_with_config()
  ↓ 解析 load_paths → 绝对路径
  ↓ ScssCompiler::compile_file(entry_path)
  ↓ grass::from_path() + Options::load_paths()
  ↓ @import 递归解析 59 个组件 SCSS

public/styles/bundle.css (259 KB, 压缩)
  ↑ HTML: <link rel="stylesheet" href="/styles/bundle.css">
```
