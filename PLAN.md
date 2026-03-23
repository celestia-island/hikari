# Hikari 迁移到 Tairitsu 设施

## 概述

Hikari 已完成从 wasm-bindgen 到 Tairitsu WIT component model 的迁移。
**编译状态: ✅ 通过**

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
| 6 | 移除剩余 web-sys/wasm-bindgen | ✅ 完成 |

---

## 迁移总结

### 核心修复项

1. **TimerId 路径修复** - `scrollbar_container.rs`
   - 从 `crate::animation::TimerId` 改为 `hikari_animation::TimerId`

2. **ChangeEvent.data 字段适配** - `file_upload.rs`
   - tairitsu_vdom::ChangeEvent 只有 `value` 字段，移除 `e.data.as_any().downcast_ref::<FormData>()`

3. **MouseEvent downcast 移除** - `select.rs`
   - 使用 `platform::get_target_element_from_event(e.client_x, e.client_y)` 替代 `e.downcast::<web_sys::MouseEvent>()`

4. **onmounted 替换** - `qrcode.rs`, `search.rs`
   - tairitsu_vdom 没有 onmounted 事件
   - 使用 `use_effect` + `query_selector_all` 获取 DOM 元素

5. **Signal 嵌套闭包问题** - `hooks.rs`, `anchor.rs`
   - 在嵌套闭包中需要再次 clone Signal

6. **use_reactive 替换** - `portal/render.rs`
   - tairitsu 没有 use_reactive，直接使用 use_effect

7. **DataTransfer 可变引用修复** - `drag.rs`
   - 将闭包参数改为 `mut e: DragEvent` 以支持修改 data_transfer

8. **platform/web.rs 类型修复**
   - element_from_point 参数类型: f32
   - CanvasContext 闭包返回 Option
   - query_selector_all Node 到 Element 转换

### 保留 web-sys 的文件 (合理使用)

以下文件保留 web-sys/wasm-bindgen 因为它们是 Platform 抽象层的实现：

| 文件 | 原因 |
|------|------|
| `platform/web.rs` | Platform 抽象层实现，必须使用 web-sys |
| `scripts/scrollbar_container.rs` | 纯 WASM 脚本，不参与 VDOM |
| `portal/render.rs` | 通过 Closure 实现动画，调用 Platform API |
| `portal/animation/*.rs` | 动画实现层 |

---

## Platform 抽象层已实现 API

| API | 功能 |
|-----|------|
| `log/warn/error` | 控制台日志 |
| `inner_width/height` | 窗口尺寸 |
| `set_timeout` | 延时执行 |
| `get_scroll_y` | 获取滚动位置 |
| `scroll_to_with_options` | 滚动到指定位置 |
| `on_resize` | 窗口大小变化监听 |
| `get_bounding_rect_by_class_impl` | 根据类名获取边界矩形 |
| `set_style_property` | 设置 CSS 属性 |
| `get_canvas_context` | 获取 Canvas 2D 上下文 |
| `draw_qrcode_on_canvas` | 在 Canvas 上绘制 QR 码 |
| `create_resize_observer` | 创建 ResizeObserver |
| `observe_resize` | 观察元素大小变化 |
| `disconnect_resize` | 断开 ResizeObserver |
| `create_mutation_observer` | 创建 MutationObserver |
| `observe_mutations` | 观察 DOM 变化 |
| `disconnect_mutation` | 断开 MutationObserver |
| `now_timestamp` | 获取当前时间戳 |
| `element_from_point` | 根据坐标获取元素 |
| `get_target_element_from_event` | 从事件坐标获取目标元素 |
| `element_closest` | 查找最近的匹配祖先元素 |
| `get_bounding_client_rect` | 获取元素边界矩形 |
| `request_animation_frame` | 请求动画帧 |
| `query_selector_all` | 查询所有匹配元素 |
| `get_scroll_top_by_selector` | 根据选择器获取滚动位置 |

---

## 迁移原则

1. **组件层不直接使用 web-sys** - 通过 Platform 抽象层访问 DOM
2. **事件使用 tairitsu_vdom 类型** - 不 downcast 到 web_sys
3. **不使用 TODO、Mock 或假实现**
4. **保留实现层的 web-sys** - Platform/web.rs 和纯 WASM 脚本

---

## 验证命令

```bash
cargo build -p hikari-components --target wasm32-unknown-unknown
```
