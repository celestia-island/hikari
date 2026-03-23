# Hikari 迁移到 Tairitsu 设施

## 概述

Hikari 正在进行从 wasm-bindgen 到 Tairitsu WIT component model 的迁移。
基础架构已完成，编译错误已全部修复。

## 完成状态

| Phase | 任务 | 状态 |
|-------|------|------|
| 0 | 删除 render-service 包 | ✅ 完成 |
| 1.1 | 更新 components Cargo.toml | ✅ 完成 |
| 1.2 | 更新 icons Cargo.toml | ✅ 完成 |
| 2 | 迁移条件编译 | ✅ 完成 |
| 3 | 验证与测试 | ✅ 完成 |
| 4 | 清理与优化 | ✅ 完成 |
| 5 | 修复编译错误 | ✅ 完成 |
| 6 | 移除剩余 web-sys/wasm-bindgen | 🔄 进行中 |

---

## Phase 6: 移除剩余 web-sys/wasm-bindgen

### 6.1 高优先级 - 组件核心功能

| 文件 | 当前使用 | 迁移方案 | 状态 |
|------|----------|----------|------|
| `scripts/scrollbar_container.rs` | web_sys::Element, Closure, wasm_bindgen | 保留（纯 WASM 脚本，不参与 VDOM） | ⏳ |
| `theme/provider.rs` | web_sys::window, Closure | 迁移到 Platform 抽象 | ⏳ |
| `theme/registry.rs` | web_sys::window | 迁移到 Platform 抽象 | ⏳ |
| `basic/background.rs` | web_sys::window, request_animation_frame | 迁移到 Platform 抽象 | ⏳ |
| `navigation/anchor.rs` | web_sys::window, Closure, scroll | 迁移到 Platform 抽象 | ✅ |
| `portal/animation/dropdown_animation.rs` | web_sys::Element, window | 迁移到 Platform 抽象 | ⏳ |

### 6.2 中优先级 - 数据组件

| 文件 | 当前使用 | 迁移方案 | 状态 |
|------|----------|----------|------|
| `data/drag.rs` | JsCast, web_sys DataTransfer | 使用 tairitsu_vdom::DragEvent | ✅ |
| `data/virtual_scroll.rs` | Event downcast | 使用 Platform scroll API | ✅ |

### 6.3 低优先级 - 可选功能

| 文件 | 当前使用 | 迁移方案 | 状态 |
|------|----------|----------|------|
| `icons/dynamic_fetch.rs` | web_sys::console | 使用 platform::log | ⏳ |
| `production/code_highlight.rs` | wasm_bindgen inline_js | 保留（外部 JS 集成） | ✅ |

### 6.4 Tairitsu 包清理

| 文件 | 当前使用 | 迁移方案 | 状态 |
|------|----------|----------|------|
| `hooks/src/css_var.rs` | wasm_bindgen::JsCast, web_sys | 迁移到 Platform 抽象 | ⏳ |

---

## Platform 抽象层待补充 API

| API | 功能 | 状态 |
|-----|------|------|
| `element_from_point` | 根据坐标获取元素 | ✅ |
| `element_closest` | 查找最近的匹配选择器的祖先元素 | ✅ |
| `get_bounding_client_rect` | 获取元素边界矩形 | ✅ |
| `request_animation_frame` | 请求动画帧 | ✅ |
| `query_selector_all` | 查询所有匹配元素 | ✅ |
| `get_scroll_top_by_selector` | 根据选择器获取滚动位置 | ✅ |
| `get_target_element_from_event` | 从事件坐标获取目标元素 | ✅ |
| `get_element_by_id` | 根据 ID 获取元素 | ⏳ |
| `create_element` | 创建 DOM 元素 | ⏳ |
| `append_child` | 添加子元素 | ⏳ |
| `remove_child` | 移除子元素 | ⏳ |
| `add_event_listener` | 添加事件监听器 | ⏳ |
| `remove_event_listener` | 移除事件监听器 | ⏳ |

---

## 编译验证命令

```bash
# 检查 WASM 目标编译
cargo check -p hikari-components --target wasm32-unknown-unknown

# 检查动画包
cargo check -p hikari-animation --target wasm32-unknown-unknown

# 完整构建测试
cargo build --target wasm32-unknown-unknown
```

---

## 迁移原则

1. **不保留 wasm-bindgen 用于"复杂 API"** - Tairitsu WIT 已有完整接口
2. **所有 DOM 操作通过 Platform 抽象层**
3. **事件使用 tairitsu_vdom 类型，不 downcast 到 web_sys**
4. **不使用 TODO、Mock 或假实现**
5. **使用 E2E 测试验证功能**

---

## 已完成内容

### Phase 0-5 完成项
- 删除 render-service 包
- Cargo.toml 依赖清理
- 创建 platform 抽象模块
- Canvas API 迁移
- Observer API 迁移
- Timer API 迁移
- E2E 测试路由修复
- 废弃代码清理
- TimerId 路径修复
- ChangeEvent.value 字段适配
- MouseEvent downcast 移除
- onmounted 替换为 use_effect + query_selector
- Signal 嵌套闭包问题修复
- use_reactive 替换为 use_effect
- DataTransfer 可变引用修复

### Platform API 已实现
- log/warn/error
- inner_width/height
- set_timeout
- get_scroll_y
- scroll_to_with_options
- on_resize
- get_bounding_rect_by_class_impl
- set_style_property
- get_canvas_context
- draw_qrcode_on_canvas
- create_resize_observer/observe_resize/disconnect_resize
- create_mutation_observer/observe_mutations/disconnect_mutation
- now_timestamp
- element_from_point
- get_target_element_from_event
- element_closest
- get_bounding_client_rect
- request_animation_frame
- query_selector_all
- get_scroll_top_by_selector
