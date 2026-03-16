# Hikari -> Tairitsu 构建链迁移计划

更新时间: 2026-03-17

## 已完成

- **应用层迁移完成** (commit `e226e43`):
  - `examples/website/src` 全部改写为 Tairitsu vdom/rsx 模型。
  - 移除 `#[wasm_bindgen]` 启动入口，改用 `tairitsu_component_bootstrap`。
  - 去除 Dioxus/wasm-bindgen 依赖，编译目标 `wasm32-wasip2` 通过。
  - 添加 `public/styles/hikari-spa.css` SPA 路由样式。
  - 清理全部旧 Dioxus 源文件（51 文件，删减 7149 行）。
- **构建链迁移完成** (commit `bdcb3ca`):
- 默认开发入口迁移到 `tairitsu-packager`:
  - `just dev`
  - `just watch`
  - `just watch-dev`
  - `just dev-by-agent`
- 旧 `dioxus + wasm-bindgen-cli` 流程已降级为 `just dev-legacy`。
- 增加 `check-tairitsu-packager`，显式校验 `../tairitsu/packages/packager/Cargo.toml`。
- `examples/website/Cargo.toml` 已补充 `[package.metadata.tairitsu]` 配置。
- `scripts/build/ensure_wasm_bindgen.py` 已标记为 DEPRECATED。

## 当前阻塞与评估结论

- **已解除**：`examples/website` 应用层已完全迁移，`wasm32-wasip2` 编译通过。

## 下一步（按优先级）

~~1. Website 应用层迁移~~ **已完成**

1. 依赖与工作区收敛

- 从根 `Cargo.toml`、`examples/website/Cargo.toml` 去除 Dioxus/wasm-bindgen 依赖。
- 评估 `packages/theme`、`packages/render-service` 中 Dioxus 耦合并拆分到兼容层。

1. 构建与产物路径统一

- 将网站运行路径统一到 `tairitsu-packager` 输出目录（避免 `public/` 与 `dist/` 双轨）。
- 清理旧脚本：`scripts/build/ensure_wasm_bindgen.py`、`scripts/fix_index_html.py`。

1. CI 迁移

- CI 从 `wasm32-unknown-unknown + wasm-bindgen-cli` 迁移到 `wasm32-wasip2 + tairitsu-packager`。
- 新增迁移过渡期 job：`legacy` 与 `component` 双流水线并行，直到应用层完成迁移。

## 验收标准

- 默认命令仅依赖 Tairitsu 链路，且 `just dev`、`just build` 在 clean 环境可运行。
- 仓库中无 `wasm-bindgen-cli` 安装/调用逻辑。
- 网站与核心包不再依赖 Dioxus。
