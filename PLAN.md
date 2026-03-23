# Hikari 迁移到 Tairitsu 设施

## 概述

Hikari 正在进行从 wasm-bindgen 到 Tairitsu WIT component model 的迁移。
基础架构已完成，但仍有部分组件需要修复。

## 完成状态

| Phase | 任务 | 状态 |
|-------|------|------|
| 0 | 删除 render-service 包 | ✅ 完成 |
| 1.1 | 更新 components Cargo.toml | ✅ 完成 |
| 1.2 | 更新 icons Cargo.toml | ✅ 完成 |
| 2 | 迁移条件编译 | ✅ 完成 |
| 3 | 验证与测试 | ✅ 完成 |
| 4 | 清理与优化 | ✅ 完成 |
| 5 | 修复编译错误 | 🔄 进行中 |
| 6 | 移除剩余 web-sys/wasm-bindgen | ⏳ 待处理 |

---

## Phase 5: 修复编译错误

### 5.1 动画包 (hikari-animation)

| 文件 | 问题 | 状态 |
|------|------|------|
| `builder/action.rs` | AnimationState → AnimationDataStore 类型修复 | ✅ |
| `builder/animation.rs` | AnimationState → AnimationDataStore 类型修复 | ✅ |
| `builder/value.rs` | AnimationState → AnimationDataStore 类型修复 | ✅ |
| `lifecycle.rs` | AnimationState → AnimationDataStore 类型修复 | ✅ |
| `global_manager.rs` | 类型签名修复 | ✅ |
| `lib.rs` | global_manager 模块启用条件修复 | ✅ |
| `Cargo.toml` | 添加 wasm 依赖 | ✅ |

### 5.2 组件包 (hikari-components) - Platform 模块

| 文件 | 问题 | 状态 |
|------|------|------|
| `platform/web.rs` | 添加 `element_from_point` 函数 | ✅ |
| `platform/web.rs` | 添加 `get_target_element_from_event` 函数 | ✅ |
| `platform/web.rs` | 添加 `element_closest` 函数 | ✅ |
| `platform/web.rs` | 添加 `get_bounding_client_rect` 函数 | ✅ |
| `platform/web.rs` | 添加 `request_animation_frame` 函数 | ✅ |
| `platform/web.rs` | 添加 `query_selector_all` 函数 | ✅ |
| `platform/web.rs` | 添加 `get_scroll_top_by_selector` 函数 | ✅ |
| `platform/stub.rs` | 同步添加对应的 stub 实现 | ✅ |

### 5.3 组件包 - 事件处理迁移

需要将 `evt.downcast::<web_sys::MouseEvent>()` 迁移到使用 Platform 抽象层：

| 文件 | 问题 | 状态 |
|------|------|------|
| `feedback/glow.rs` | 移除 web_sys 事件 downcast，使用 platform API | ✅ |
| `portal/render.rs` | Dropdown/Popover 点击检测迁移 | ✅ |
| `data/virtual_scroll.rs` | 滚动事件处理迁移 | ✅ |
| `basic/select.rs` | 事件 downcast 移除 | ⏳ |
| `entry/search.rs` | onmounted 事件处理 | ⏳ |
| `display/qrcode.rs` | onmounted 事件处理 | ⏳ |
| `basic/file_upload.rs` | ChangeEvent.data 字段不存在 | ⏳ |

### 5.4 组件包 - Signal/闭包问题

| 文件 | 问题 | 状态 |
|------|------|------|
| `hooks.rs` | use_screen_size Signal clone 问题 | ✅ |
| `hooks.rs` | use_media_query Signal clone 问题 | ✅ |
| `production/code_highlight.rs` | FnMut 闭包 move 问题 | ⏳ |
| `navigation/anchor.rs` | active_anchor move 问题 | ⏳ |
| `data/drag.rs` | data_transfer 可变借用问题 | ⏳ |

### 5.5 组件包 - onmounted 事件

tairitsu_vdom 似乎没有 `onmounted` 事件或 `evt.data()` 方法，需要确认替代方案：

| 文件 | 问题 | 状态 |
|------|------|------|
| `entry/search.rs` | onmounted + evt.data().downcast() | ⏳ |
| `display/qrcode.rs` | onmounted + evt.data().downcast() | ⏳ |

---

## Phase 6: 移除剩余 web-sys/wasm-bindgen

### 6.1 高优先级 - 组件核心功能

| 文件 | 当前使用 | 迁移方案 | 状态 |
|------|----------|----------|------|
| `scripts/scrollbar_container.rs` | web_sys::Element, Closure, wasm_bindgen | 迁移到 Platform 抽象 | ⏳ |
| `theme/provider.rs` | web_sys::window, Closure | 迁移到 Platform 抽象 | ⏳ |
| `theme/registry.rs` | web_sys::window | 迁移到 Platform 抽象 | ⏳ |
| `basic/background.rs` | web_sys::window, request_animation_frame | 迁移到 Platform 抽象 | ⏳ |
| `navigation/anchor.rs` | web_sys::window, Closure, scroll | 迁移到 Platform 抽象 | ⏳ |
| `portal/animation/dropdown_animation.rs` | web_sys::Element, window | 迁移到 Platform 抽象 | ⏳ |

### 6.2 中优先级 - 数据组件

| 文件 | 当前使用 | 迁移方案 | 状态 |
|------|----------|----------|------|
| `data/drag.rs` | JsCast, web_sys DataTransfer | 使用 tairitsu_vdom::DragEvent | ⏳ |
| `data/virtual_scroll.rs` | Event downcast | 使用 Platform scroll API | ✅ |

### 6.3 低优先级 - 可选功能

| 文件 | 当前使用 | 迁移方案 | 状态 |
|------|----------|----------|------|
| `icons/dynamic_fetch.rs` | web_sys::console | 使用 platform::log | ⏳ |
| `production/code_highlight.rs` | wasm_bindgen inline_js | 保留或迁移到 Platform | ⏳ |

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

## 已知技术问题

### 1. onmounted 事件
- **问题**: tairitsu_vdom 没有 `onmounted` 事件
- **影响**: qrcode.rs, search.rs 无法在元素挂载后获取 DOM 引用
- **方案**: 
  - 选项 A: 在 tairitsu_vdom 中添加 MountedEvent
  - 选项 B: 使用 ref 回调替代
  - 选项 C: 使用 use_effect + query_selector

### 2. ChangeEvent.data 字段
- **问题**: tairitsu_vdom::ChangeEvent 只有 `value` 字段，没有 `data`
- **影响**: file_upload.rs
- **方案**: 使用 `e.value` 替代 `e.data`

### 3. 事件 downcast
- **问题**: tairitsu_vdom 事件不再支持 `downcast::<web_sys::*>()`
- **影响**: 所有需要获取事件目标元素的组件
- **方案**: 使用 `element_from_point(client_x, client_y)` 替代

### 4. DataTransfer 可变性
- **问题**: DragEvent.data_transfer 是 & 引用，无法直接修改
- **影响**: drag.rs
- **方案**: 克隆 DataTransfer 或重新设计 API

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

### Phase 0-4 完成项
- 删除 render-service 包
- Cargo.toml 依赖清理
- 创建 platform 抽象模块
- Canvas API 迁移
- Observer API 迁移
- Timer API 迁移
- E2E 测试路由修复
- 废弃代码清理

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
