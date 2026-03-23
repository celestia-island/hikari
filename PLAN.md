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

**问题：** `record dom-rect` 在 WIT 文件顶层定义，导致 wit-bindgen 编译错误。

**修复：** 将 `record` 移动到 `interface types` 内部：

```wit
// 修复前（错误）
package tairitsu-browser:full@0.2.0;
record dom-rect { ... }  // 顶层 record 不允许

// 修复后（正确）
package tairitsu-browser:full@0.2.0;
interface types {
    record dom-rect { ... }  // 在 interface 内部
}
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
cargo build -p tairitsu-web --features wit-bindings
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
