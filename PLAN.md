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

## 🟡 进行中 (2024-03-17)

### rsx! 宏语法迁移

**已完成**:
- [x] 添加 Tairitsu 缺失的事件类型 (FormData, DragEvent, MouseData, FormEvent)
- [x] 创建本地 style_builder 模块
- [x] 添加 WASM 条件编译 guards
- [x] 修复 `#[component]` 宏的 props 默认值处理
- [x] 修复 `if let` 模式匹配 (改用 `is_some()` + `unwrap()`)
- [x] 修复条件渲染语法 (提取到 rsx! 外部变量)
- [x] 添加 WASM 依赖 (wasm-bindgen, web-sys, gloo, js-sys)

**剩余工作** (~21 个文件):

- [ ] 修复 rsx! 中的格式字符串语法:

  - `"{variable}"` → `{variable}`
  - 复杂表达式提取到 rsx! 外部

- [ ] 修复 `for` 循环中的 key 属性语法

**错误位置**:
```
packages/components/src/display/calendar.rs:247
packages/components/src/display/skeleton.rs:112
packages/components/src/display/user_guide.rs:169
packages/components/src/feedback/progress.rs:74
packages/components/src/navigation/sidebar.rs:271
packages/components/src/navigation/stepper.rs:101
packages/components/src/navigation/steps.rs:125
packages/components/src/navigation/tabs.rs:206
packages/components/src/data/drag.rs:251
packages/components/src/data/node.rs:117
packages/components/src/data/pagination.rs:309
packages/components/src/data/selection.rs:121, 221
packages/components/src/data/sort.rs:152
packages/components/src/data/tree.rs:101
packages/components/src/entry/cascader.rs:262
packages/components/src/entry/transfer.rs:263
packages/components/src/production/code_highlight.rs:193
packages/components/src/portal/render.rs:323, 785, 939
```

## 验收标准

- [x] 默认命令仅依赖 Tairitsu 链路，且 `just dev`、`just build` 在 clean 环境可运行
- [x] 删除 `scripts/build/ensure_wasm_bindgen.py` 和 `scripts/fix_index_html.py`
- [x] 核心包在 wasm32-wasip2 下编译通过
- [x] CI 支持 wasm32-wasip2 检查
- [ ] **激进清理**: hikari-components 编译通过（剩余 ~21 文件的 rsx! 语法修复）

## 架构说明

当前采用渐进式迁移策略：

1. **已迁移到 Tairitsu**: `examples/website`
2. **核心基础设施** (无框架依赖): `packages/palette`, `packages/builder`, `packages/i18n`
3. **迁移中** (rsx! 语法修复): `packages/components`
4. **服务器端专用** (不支持 wasm): `packages/render-service`, `packages/e2e`
