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
  - 从工作区成员中移除 examples/node-graph-demo

## 验收标准

- [x] 默认命令仅依赖 Tairitsu 链路，且 `just dev`、`just build` 在 clean 环境可运行
- [x] 删除 `scripts/build/ensure_wasm_bindgen.py` 和 `scripts/fix_index_html.py`
- [x] 核心包在 wasm32-wasip2 下编译通过
- [x] CI 支持 wasm32-wasip2 检查

## 架构说明

当前采用渐进式迁移策略：

1. **已迁移到 Tairitsu**: `examples/website`
2. **核心基础设施** (无框架依赖): `packages/palette`, `packages/builder`, `packages/i18n`
3. **可选 Dioxus 支持**: `packages/theme`, `packages/animation`, `packages/components`, `packages/icons`, `packages/extra-components`
4. **服务器端专用** (不支持 wasm): `packages/render-service`, `packages/e2e`

各包的 Dioxus 依赖通过 `dioxus` feature flag 控制，默认启用以保持向后兼容性。新项目可以使用 `--no-default-features` 避免启用 Dioxus。
