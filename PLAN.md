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

## 当前状态分析

### 1. 仍然依赖 wasm-bindgen 的包

| 包 | 依赖 | 条件编译 |
|---|---|---|
| `hikari-components` | wasm-bindgen, wasm-bindgen-futures, js-sys, web-sys | `cfg(all(target_arch = "wasm32", target_os = "unknown"))` |
| `hikari-icons` | wasm-bindgen, wasm-bindgen-futures, web-sys | `cfg(target_arch = "wasm32")` |

### 2. 需要迁移的代码量

- `packages/components/`: **162 处** `target_os = "unknown"` 条件编译
- 涉及的主要模块：
  - `portal/` - Portal 渲染、定位、动画
  - `feedback/` - Glow、Modal、Popover
  - `production/` - CodeHighlight
  - `display/` - QRCode, Calendar
  - `entry/` - Search
  - `data/` - Drag
  - `basic/` - Select, FileUpload, Background
  - `navigation/` - Anchor
  - `theme/` - Provider, Registry
  - `style_builder.rs`

### 3. 已经正确使用 Tairitsu 的部分

- `examples/website/` - 已使用 `tairitsu-web` 的 `wit-bindings` feature
- `packages/animation/` - 已依赖 tairitsu-vdom/hooks/style
- `packages/builder/` - 已依赖 tairitsu-packager

---

## 迁移计划

### Phase 1: 消除 wasm-bindgen 依赖 (高优先级)

**目标**: 从 Cargo.toml 中移除 wasm-bindgen/web-sys/js-sys

#### 1.1 更新 `hikari-components/Cargo.toml`

```diff
- [target.'cfg(all(target_arch = "wasm32", target_os = "unknown"))'.dependencies]
- wasm-bindgen = "0.2"
- wasm-bindgen-futures = "0.4"
- js-sys = "0.3"
- web-sys = { version = "0.3", features = [...] }
- gloo = { version = "0.11", features = ["futures", "timers"] }
+ tairitsu-web = { path = "../../../tairitsu/packages/web", features = ["wit-bindings"] }
```

#### 1.2 更新 `hikari-icons/Cargo.toml`

```diff
- [target.'cfg(target_arch = "wasm32")'.dependencies]
- web-sys = { version = "0.3", features = ["Window", "Element"] }
- wasm-bindgen = "0.2"
- wasm-bindgen-futures = "0.4"
- reqwest = { version = "^0.12", features = ["json"] }
+ # 使用 tairitsu-web 的 WitPlatform (如需 WASM 特定功能)
+ tairitsu-web = { path = "../../../tairitsu/packages/web", features = ["wit-bindings"], optional = true }
```

### Phase 2: 迁移条件编译 (中优先级)

**目标**: 将 `target_os = "unknown"` 替换为 WitPlatform 统一接口

#### 2.1 条件编译策略

| 旧模式 | 新模式 |
|---|---|
| `cfg(all(target_arch = "wasm32", target_os = "unknown"))` | 使用 `tairitsu_vdom::Platform` trait |
| `web_sys::Window` | `Platform::window()` |
| `web_sys::Document` | `Platform::document()` |
| `web_sys::Element` | `ElementHandle` (WitElement) |
| `web_sys::HtmlElement` | `ElementHandle` + 样式方法 |

#### 2.2 主要迁移点

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

### Phase 3: 验证与测试 (中优先级)

#### 3.1 构建验证

```bash
# 确保 wasm32-wasip2 目标编译通过
cargo check --workspace --exclude hikari-e2e \
  --all-features --target wasm32-wasip2

# Clippy 检查
cargo clippy --workspace --exclude hikari-e2e \
  --all-features --target wasm32-wasip2
```

#### 3.2 E2E 测试

```bash
# 构建并运行 website
cd examples/website && tairitsu build
just dev
# 运行 E2E 测试验证功能
```

### Phase 4: 清理与优化 (低优先级)

#### 4.1 移除废弃代码

- 移除 `#[deprecated]` 的 `get_utility_classes()`
- 清理未使用的 `#[cfg(not(...))]` 分支

#### 4.2 文档更新

- 更新 ARCHITECTURE.md
- 更新依赖指南
- 更新迁移指南

---

## 技术细节

### WitPlatform API 对照表

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

### 构建目标

- **旧**: `wasm32-unknown-unknown` + wasm-bindgen
- **新**: `wasm32-wasip2` + WIT component model + browser-glue

---

## 依赖关系图

```
┌─────────────────────────────────────────────────────────────┐
│                    Hikari Component Library                  │
│                                                             │
│  hikari-components ──► tairitsu-web (WitPlatform)          │
│  hikari-icons ──────► tairitsu-vdom                        │
│  hikari-animation ──► tairitsu-hooks                       │
│  hikari-theme ──────► tairitsu-style                       │
│                      tairitsu-macros                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Tairitsu Infrastructure                   │
│                                                             │
│  tairitsu-packager (build) ──► browser-glue (runtime)       │
│  tairitsu-web ─────────────► WIT bindings                   │
│  browser-worlds ───────────► browser-full.wit               │
└─────────────────────────────────────────────────────────────┘
```

---

## 执行顺序

0. **Phase 0** - 删除 render-service 包
1. **Phase 1.1** - 更新 components Cargo.toml (移除 wasm-bindgen)
2. **Phase 1.2** - 更新 icons Cargo.toml (保留包，移除 wasm-bindgen)
3. **Phase 2.1** - 迁移 portal 系统
4. **Phase 2.2** - 迁移 style_builder
5. **Phase 2.3** - 迁移 theme provider
6. **Phase 2.4** - 迁移特殊组件 (glow, qrcode, code_highlight)
7. **Phase 3** - 验证构建和测试
8. **Phase 4** - 清理和文档

---

## 已确认的决定

- [x] **icons 包** - 保留，是 Hikari 附着于 Tairitsu 的 SVG 基础设施，数据源使用外部动态构建
- [x] **render-service** - 彻底删除，服务端渲染由 Tairitsu 的服务端中间件负责
- [x] **wasm-bindgen fallback** - 不保留，彻底迁移到 WIT component model

---

## Phase 0: 删除 render-service (最高优先级)

在开始迁移前，先删除不再需要的 render-service 包。

```bash
# 删除目录
rm -rf packages/render-service

# 更新 Cargo.toml workspace members
# 移除 "packages/render-service"
```

---

## 相关文件

- `/mnt/sdb1/tairitsu/PLAN.md` - Browser Glue 实现状态
- `/mnt/sdb1/tairitsu/CONTEXT.md` - Browser Glue 上下文
- `/mnt/sdb1/tairitsu/packages/packager/src/wasm/mod.rs` - Packager WASM 构建
- `/mnt/sdb1/tairitsu/packages/web/src/wit_platform.rs` - WitPlatform 实现
