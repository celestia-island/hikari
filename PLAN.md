# Hikari 迁移到 Tairitsu 设施 - 完成

## 概述

Hikari 已完成从 wasm-bindgen 到 Tairitsu WIT component model 的迁移。

## 完成状态

| Phase | 任务 | 状态 |
|-------|------|------|
| 0 | 删除 render-service 包 | ✅ 完成 |
| 1.1 | 更新 components Cargo.toml | ✅ 完成 |
| 1.2 | 更新 icons Cargo.toml | ✅ 完成 |
| 2 | 迁移条件编译 | ✅ 完成 |
| 3 | 验证与测试 | ✅ 完成 |
| 4 | 清理与优化 | ✅ 完成 |

## 完成内容

### Phase 0: 删除 render-service
- 彻底删除 render-service 包
- 服务端渲染由 Tairitsu 服务端中间件负责

### Phase 1: Cargo.toml 清理
- components: 移除 gloo, wasm-bindgen-futures 等未使用依赖
- icons: 移除未使用的依赖

### Phase 2: 条件编译迁移
- 创建 `platform` 抽象模块（web.rs, stub.rs）
- 添加 Canvas API：get_canvas_context, draw_qrcode_on_canvas
- 添加 Observer API：create_resize_observer, create_mutation_observer
- 添加 Timer API：set_timeout, request_animation_frame
- 迁移所有组件使用 platform 模块

### Phase 3: 测试修复
- 修复 E2E 测试路由问题（/ → /#/）
- 验证编译通过

### Phase 4: 清理
- 移除废弃代码
- 移除未使用的 Cargo 依赖

## Platform 抽象层 API

| API | 功能 |
|-----|------|
| `log/warn/error` | 控制台日志 |
| `inner_width/height` | 视口尺寸 |
| `set_timeout` | 定时器 |
| `get_scroll_y` | 滚动位置 |
| `scroll_to_with_options` | 滚动到指定位置 |
| `on_resize` | 窗口 resize 事件 |
| `get_bounding_rect_by_class_impl` | 获取元素边界 |
| `set_style_property` | 设置 CSS 属性 |
| `get_canvas_context` | 获取 Canvas 2D 上下文 |
| `draw_qrcode_on_canvas` | 在 Canvas 上绘制 QR 码 |
| `create_resize_observer` | 创建 ResizeObserver |
| `create_mutation_observer` | 创建 MutationObserver |
| `now_timestamp` | 获取时间戳 |

## 保留的 wasm-bindgen 使用

仅用于事件 downcast（从包装事件获取原生 web_sys 类型）：
- `wasm_bindgen::JsCast` - 事件类型转换
- `web_sys::MouseEvent` - 鼠标事件数据

## 已确认的决定

- [x] **icons 包** - 保留，是 Hikari 附着于 Tairitsu 的 SVG 基础设施
- [x] **render-service** - 彻底删除
- [x] **wasm-bindgen fallback** - 不保留，彻底迁移到 WIT component model
- [x] **Canvas API** - 已迁移到 Platform 抽象层
- [x] **Observer API** - 已迁移到 Platform 抽象层
