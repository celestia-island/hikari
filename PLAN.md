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

- **样式系统整合完成** (commit `ba69e39`):
  - 创建 `examples/website/src/styles/spa.scss` 包含 SPA 路由样式
  - tairitsu-packager 支持多 SCSS 入口配置
  - 配置 `Cargo.toml` 的 `[[package.metadata.tairitsu.scss.entries]]`
  - 移除对 Python SCSS 编译脚本的依赖（bundle.css 和 spa.css 由 tairitsu-packager 生成）

- **wasm32-wasip2 条件编译修复** (commit `7eb8f32`):
  - 修复 `#[cfg(target_arch = "wasm32")]` 为 `#[cfg(all(target_arch = "wasm32", target_os = "unknown"))]`
  - 浏览器 WASM (wasm32-unknown-unknown) vs WASI (wasm32-wasip2) 正确区分
  - 修复文件: animation/*.rs, components/*.rs, theme/provider.rs, style_builder.rs
  - 添加 `StyleStringBuilder::add_custom()` 方法

- **测试兼容性修复** (commit `87e45e8`):
  - 修复 animation preset tests 的条件编译
  - 为 CarouselProps 添加 Default 实现
  - 修复 style_builder test 的参数类型
  - 为 TimelineState/UserGuideState 添加 with_class 方法
  - 修复 zoom_controls 和 minimap 测试的可变性
  - 组件集成测试标记为非 WASI 环境（需要 DOM 支持）

## 验收标准

- [x] 默认命令仅依赖 Tairitsu 链路，且 `just dev`、`just build` 在 clean 环境可运行
- [x] 删除 `scripts/build/ensure_wasm_bindgen.py` 和 `scripts/fix_index_html.py`
- [x] 核心包在 wasm32-wasip2 下编译通过
- [x] CI 支持 wasm32-wasip2 检查
- [x] **激进清理**: hikari-components 编译通过 (wasm32-wasip2)

## 架构说明

迁移完成后的架构：

1. **Tairitsu 应用层**: `examples/website` - 完全使用 Tairitsu 框架
2. **核心基础设施** (无框架依赖): `packages/palette`, `packages/builder`, `packages/i18n`
3. **UI 组件层** (条件编译): `packages/components` - 支持 Tairitsu 和独立使用
4. **服务器端专用** (不支持 wasm): `packages/render-service`, `packages/e2e`
