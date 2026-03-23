# Hikari 迁移到 Tairitsu 设施计划

## 背景

Tairitsu 项目已经准备好了以下设施：
- **packager** - 新的构建打包工具，支持 wasm32-wasip2 component model
- **browser-glue** - TypeScript 胶水层，通过 WIT 接口替代 wasm-bindgen
- **browser-worlds** - WIT 定义（browser-full.wit，13,806 行，28 个域，454 接口）
- **web (WitPlatform)** - WIT bindings 的 Platform 实现，替代 web-sys
- **vdom/hooks/style/macros** - 核心框架组件

Hikari 目前仍部分依赖旧的 wasm-bindgen 体系，需要彻底迁移。

---

## 当前进度

| Phase | 任务 | 状态 |
|-------|------|------|
| 0 | 删除 render-service 包 | ✅ 完成 |
| 1.1 | 更新 components Cargo.toml | 🔶 部分（保留 wasm-bindgen 用于复杂 API） |
| 1.2 | 更新 icons Cargo.toml | ✅ 完成（移除未使用依赖） |
| 2 | 迁移条件编译 | 🔶 部分（已创建 platform 抽象模块，迁移多个组件） |
| 3 | 验证与测试 | 🔄 进行中（已修复 E2E 测试路由） |
| 4 | 清理与优化 | ⏳ 待开始 |

---

## 剩余工作

### Phase 1.1: components Cargo.toml（部分完成）

保留 wasm-bindgen 用于复杂 API，待后续完全迁移：
- Canvas 相关 API (glow, qrcode)
- 复杂 DOM 操作

### Phase 2: 迁移条件编译（部分完成）

已完成：
- 创建 `platform` 抽象模块
- 迁移多个组件到 WitPlatform

待完成：
1. **Portal 系统** (`packages/components/src/portal/`)
   - `render.rs` - 使用 Platform trait 替代直接 DOM 操作
   - `positioning.rs` - 使用 Platform 获取元素尺寸/位置
   - `animation/` - 使用 Platform 的动画 API

2. **Style Builder** (`packages/components/src/style_builder.rs`)
   - 移除 web-sys HtmlElement 直接操作
   - 使用 Platform::set_style()

3. **Theme Provider** (`packages/components/src/theme/`)
   - 移除 web-sys Window/media query 直接操作
   - 使用 Platform 的 prefers-color-scheme 检测

4. **特殊组件**
   - `glow.rs` - Canvas 操作 → Platform Canvas API
   - `qrcode.rs` - Canvas 操作 → Platform Canvas API
   - `code_highlight.rs` - 移除 web-sys 依赖

### Phase 3: 验证与测试（进行中）

```bash
# 确保 wasm32-wasip2 目标编译通过
cargo check --workspace --exclude hikari-e2e \
  --all-features --target wasm32-wasip2

# E2E 测试
cd examples/website && tairitsu build
just dev
```

### Phase 4: 清理与优化（待开始）

- 移除 `#[deprecated]` 的 `get_utility_classes()`
- 清理未使用的 `#[cfg(not(...))]` 分支
- 更新文档

---

## WitPlatform API 对照表

| web-sys API | WitPlatform 等价 |
|---|---|
| `web_sys::Window::window()` | `Platform::window()` |
| `window.document()` | `Platform::document()` |
| `document.create_element()` | `Platform::create_element()` |
| `element.set_attribute()` | `Platform::set_attribute()` |
| `element.style.set_property()` | `Platform::set_style()` |
| `element.append_child()` | `Platform::append_child()` |
| `element.get_bounding_client_rect()` | `Platform::get_bounding_rect()` |
| `window.request_animation_frame()` | `Platform::request_animation_frame()` |
| `CanvasRenderingContext2d` | WitPlatform Canvas APIs |

---

## 已确认的决定

- [x] **icons 包** - 保留，是 Hikari 附着于 Tairitsu 的 SVG 基础设施
- [x] **render-service** - 彻底删除，服务端渲染由 Tairitsu 的服务端中间件负责
- [x] **wasm-bindgen fallback** - 不保留，彻底迁移到 WIT component model
