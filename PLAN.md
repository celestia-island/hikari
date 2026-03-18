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

- **Tairitsu rsx! 宏增强** (commit `6350ae3`):
  - 修复 if/match 条件解析问题 (使用 `parse_without_eager_brace`)
  - 区分 HTML 元素和自定义组件的事件处理
  - HTML 元素的 `on_*` 属性作为 DOM 事件处理器
  - 自定义组件的 `on_*` 属性作为普通 props 传递

- **Tairitsu hooks 增强** (commit `69e6222`):
  - 添加 `From<Memo<String>>` 实现 for `Style` 和 `Classes`
  - 允许 `Memo<String>` 直接用作 style/class 属性

## 🟡 进行中

### hikari-components 编译修复

**当前错误数**: ~149 (从初始 ~232 减少 36%)

**已修复错误类型**:
- ✅ Event<T> generic args → Event with downcast
- ✅ Style: From<Option<String>>
- ✅ Signal move errors (大部分)
- ✅ IntoAttrValue for component enum types (ArrowDirection, InputSize, StepStatus, etc.)
- ✅ rsx! 语法: let in for loops → Vec<VNode> pattern
- ✅ rsx! 语法: tuple keys → simple keys
- ✅ Context<T> access via .get() method
- ✅ RadioContext Copy → Clone
- ✅ rsx! if/match 解析问题 (struct literal ambiguity)
- ✅ HTML 元素 vs 自定义组件的事件处理区分

**剩余错误类型**:
- 52 mismatched types (事件处理器类型、VNode 转换)
- IntoAttrValue for Vec/Option types
- Callback doesn't implement Display
- Memo<String> to Style conversion (部分已修复)

## 验收标准

- [x] 默认命令仅依赖 Tairitsu 链路，且 `just dev`、`just build` 在 clean 环境可运行
- [x] 删除 `scripts/build/ensure_wasm_bindgen.py` 和 `scripts/fix_index_html.py`
- [x] 核心包在 wasm32-wasip2 下编译通过
- [x] CI 支持 wasm32-wasip2 检查
- [ ] **激进清理**: hikari-components 编译通过

## 待完成

### 样式系统整合

当前问题：
- `scripts/build/compile_scss.py` 用 Python+sass CLI 编译 SCSS
- tairitsu-packager 有内置 SCSS 编译器，但只从 `src/styles/` 查找
- `index.html` 引用 `/styles/bundle.css` 和 `/styles/hikari-spa.css`，后者无 SCSS 源文件

任务：
- [ ] 创建 `examples/website/src/styles/spa.scss` 包含 SPA 路由样式：
  ```scss
  .hikari-page { display: none; }
  .hikari-page.is-active { display: block; }
  .sidebar-link.is-active { font-weight: 600; }
  ```
- [ ] 等待 tairitsu-packager 支持多 SCSS 入口配置
- [ ] 配置 `Cargo.toml` 的 `[package.metadata.tairitsu.scss]`
- [ ] 删除 `scripts/build/compile_scss.py`（由 tairitsu-packager 替代）

## 架构说明

当前采用渐进式迁移策略：

1. **已迁移到 Tairitsu**: `examples/website`
2. **核心基础设施** (无框架依赖): `packages/palette`, `packages/builder`, `packages/i18n`
3. **迁移中** (rsx! 语法修复): `packages/components`
4. **服务器端专用** (不支持 wasm): `packages/render-service`, `packages/e2e`
