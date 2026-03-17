# Hikari -> Tairitsu 构建链迁移计划

## 已完成

- **应用层迁移完成** (commit `e226e43`):
  - `examples/website/src` 全部改写为 Tairitsu vdom/rsx 模型。
  - 移除 `#[wasm_bindgen]` 启动入口，改用 `tairitsu_component_bootstrap`。
  - 去除 Dioxus/wasm-bindgen 依赖，编译目标 `wasm32-wasip2` 通过。
  - 添加 `public/styles/hikari-spa.css` SPA 路由样式。
  - 清理全部旧 Dioxus 源文件（51 文件，删减 7149 行）。

- **构建链迁移完成** (commit `bdcb3ca`, `2d2489b`):
  - 默认开发入口迁移到 `tairitsu-packager`: `just dev`, `just watch`, `just watch-dev`, `just dev-by-agent`
  - 删除 `scripts/build/ensure_wasm_bindgen.py` 和 `scripts/fix_index_html.py`
  - 简化 `build.rs`，移除 wasm-bindgen 相关逻辑

- **核心包依赖迁移完成** (commit `0be0d2d`):
  - `packages/animation`: Dioxus/wasm-bindgen 改为可选 feature
  - `packages/components`: 添加 dioxus feature，条件化 UI 组件模块
  - `packages/extra-components`: 移除 Dioxus 依赖，组件重构为数据模型
  - `packages/i18n`: 移除 Dioxus 依赖，保留核心 i18n 功能
  - `packages/icons`: 添加 dioxus feature，条件化 Icon 组件
  - `packages/theme`: 添加 dioxus feature，保持向后兼容

- **CI 迁移完成** (commit `4564b54`):
  - 为 lint 和 test jobs 添加 wasm32-wasip2 target 支持
  - 排除服务器端包 (hikari-render-service, hikari-e2e) 从 wasm 检查

- **Tairitsu 事件类型补充** (commit `f1c04f7`):
  - 添加 `FormData`, `FormEvent`, `DragEvent`, `DataTransfer`, `MouseData` 类型
  - 修复 `#[component]` 宏的模式匹配代码生成问题
  - 在 hikari prelude 中导出所有新事件类型

- **样式系统迁移** (commit `f1c04f7`):
  - 创建本地 `style_builder.rs` 模块替代 `hikari_animation::style`
  - 实现 `StyleStringBuilder` 和 `CssProperty` 枚举
  - 所有使用 `animation::style` 的组件改用本地模块

- **组件库迁移进展** (commit `d9b5d64`, `dae7461`):
  - 添加 WASM cfg guards 到 hooks.rs, render.rs, qrcode.rs
  - 修复 `String: From<u32>` 错误
  - 转换 `Memo<T>` 返回类型为 `Signal<T>`
  - 重构 calendar.rs 使用 Vec<VNode> 模式
  - 添加 `IntoAttrValue` trait 及多个类型的实现
  - 添加 `try_consume_context` 别名
  - 修复 `Signal.toggle()` → `Signal.set(!Signal.get())`
  - 添加 Debug/Default derives 到多个组件枚举

- **Tairitsu VNode/Signal 增强** (commit `998c243`, `6754b35`):
  - 添加 `Default` impl for `VNode` (返回 empty Fragment)
  - 添加 `PartialEq` impl for `Signal<T>` (identity comparison)
  - 添加 `From<Option<String>>` impl for `Style`
  - 修复多个 `Event<T>` → `Event` + downcast pattern
  - 修复 Signal move errors 使用 `.clone()`

## 🟡 进行中

### hikari-components 编译修复

**当前错误数**: ~139 (从初始 ~232 减少 40%)

**已修复错误类型**:
- ✅ Event<T> generic args → Event with downcast
- ✅ Style: From<Option<String>>
- ✅ Signal move errors (大部分)
- ✅ IntoAttrValue for component enum types (ArrowDirection, InputSize, StepStatus, etc.)
- ✅ rsx! 语法: let in for loops → Vec<VNode> pattern
- ✅ rsx! 语法: tuple keys → simple keys
- ✅ Context<T> access via .get() method
- ✅ RadioContext Copy → Clone

**剩余错误类型**:
- 47 mismatched types (VNode 转换问题)
- 7 type annotations needed (event handlers)
- 4 expected `,` (rsx! 语法)
- IntoAttrValue for Vec types (可能需要不同方法)

## 验收标准

- [x] 默认命令仅依赖 Tairitsu 链路，且 `just dev`、`just build` 在 clean 环境可运行
- [x] 删除 `scripts/build/ensure_wasm_bindgen.py` 和 `scripts/fix_index_html.py`
- [x] 核心包在 wasm32-wasip2 下编译通过
- [x] CI 支持 wasm32-wasip2 检查
- [ ] **激进清理**: hikari-components 编译通过

## 架构说明

当前采用渐进式迁移策略：

1. **已迁移到 Tairitsu**: `examples/website`
2. **核心基础设施** (无框架依赖): `packages/palette`, `packages/builder`, `packages/i18n`
3. **迁移中** (rsx! 语法修复): `packages/components`
4. **服务器端专用** (不支持 wasm): `packages/render-service`, `packages/e2e`
