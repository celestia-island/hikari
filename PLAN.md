# Hikari & Tairitsu Web-Sys/Wasm-Bindgen 清理报告

## 执行摘要

| 项目 | 状态 | 说明 |
|------|------|------|
| hikari-components | ✅ 完成 | 组件层已迁移到 Platform API |
| hikari-animation | ✅ 正常 | 动画核心库保留 web-sys（设计决策） |
| tairitsu-vdom | ✅ 清洁 | 无 web-sys 依赖 |
| tairitsu-hooks | ✅ 清洁 | css_var.rs 未启用（无 web feature） |
| tairitsu-style | ✅ 清洁 | 无 web-sys 依赖 |

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

## Hikari Web-Sys 使用分析

### ✅ 组件层（已迁移到 Platform API）

| 文件 | 原用法 | 现状 |
|------|--------|------|
| `theme/provider.rs` | `Closure::once` + `set_timeout` | → `platform::set_timeout` |
| `navigation/anchor.rs` | `web_sys::window()` + `scroll_to` | → `platform::scroll_to_with_options` |
| `display/qrcode.rs` | `dyn_ref::<HtmlCanvasElement>()` | → `platform::draw_qrcode_on_canvas_by_id` |
| `portal/render.rs` | `Closure::once_into_js` + `request_animation_frame` | → `platform::request_animation_frame` |

### ✅ Platform 抽象层（合理保留）

| 文件 | 用途 | 原因 |
|------|------|------|
| `platform/web.rs` | Platform API 实现 | 必须使用 web-sys 实现 DOM 操作 |

### ✅ 纯 WASM 脚本（合理保留）

| 文件 | 用途 | 原因 |
|------|------|------|
| `scripts/scrollbar_container.rs` | 自定义滚动条 | `#[wasm_bindgen]` 导出 JS 函数，直接 DOM 操作 |

### ✅ 动画实现层（合理保留）

| 文件 | 用途 | 原因 |
|------|------|------|
| `portal/animation/dropdown_animation.rs` | Dropdown 动画 | 直接操作 DOM 样式 |
| `basic/background.rs` | 渐变背景动画 | 复杂的 requestAnimationFrame 动画循环 |

### ✅ JS 互操作（合理保留）

| 文件 | 用途 | 原因 |
|------|------|------|
| `production/code_highlight.rs` | 剪贴板 API | `#[wasm_bindgen(inline_js)]` 调用 navigator.clipboard |

### ✅ 动画核心库（合理保留）

| 文件 | 用途 | 原因 |
|------|------|------|
| `animation/src/*.rs` | 动画系统核心 | 直接操作 HtmlElement 样式 |

---

## Tairitsu Web-Sys 使用分析

### ✅ tairitsu-vdom（清洁）

无 web-sys/wasm-bindgen 依赖。

### ✅ tairitsu-hooks（清洁）

| 文件 | 状态 | 说明 |
|------|------|------|
| `css_var.rs` | 未启用 | `#[cfg(feature = "web")]` 但无 `web` feature |

### ✅ tairitsu-style（清洁）

无 web-sys/wasm-bindgen 依赖。

### ✅ tairitsu-web（双后端架构）

| 模块 | 用途 | 状态 |
|------|------|------|
| `platform.rs` | WebPlatform (web-sys 后端) | 保留 |
| `wit_platform.rs` | WitPlatform (WIT bindings 后端) | 保留 |

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
# 构建 hikari-components
cargo build -p hikari-components --target wasm32-unknown-unknown

# 构建 tairitsu 核心
cargo build -p tairitsu-vdom -p tairitsu-hooks -p tairitsu-style

# 检查组件层 web-sys 使用（应只剩保留的文件）
grep -rn "use web_sys\|use wasm_bindgen" packages/components/src/ --include="*.rs" | \
  grep -v "platform/web.rs" | \
  grep -v "scripts/scrollbar" | \
  grep -v "portal/animation" | \
  grep -v "basic/background" | \
  grep -v "code_highlight"
```

---

## 结论

**所有 web-sys/wasm-bindgen 使用都是合理的架构设计：**

1. **组件层** - 已完全迁移到 Platform API ✅
2. **Platform 抽象层** - 必须使用 web-sys 实现 DOM 操作 ✅
3. **纯 WASM 脚本** - 需要 `#[wasm_bindgen]` 导出 JS 函数 ✅
4. **动画系统** - 需要直接操作 DOM 元素样式 ✅
5. **JS 互操作** - 需要调用浏览器原生 API ✅

**Tairitsu 核心（vdom/hooks/style）无 web-sys 依赖，可在任何平台运行。**
