# Hikari 0.1.0 Post-Release Plan

> 下方 "体系健康检查" 部分来自 2026-05-11 对 tairitsu + hikari 整体栈的全面审计。
> 原 Post-Release Plan 事项保留在底部。

---

## 体系健康检查 (2026-05-11)

> 审查范围: tairitsu (v0.4.5) + hikari (v0.1.8) 作为完整技术栈
> 详见 tairitsu/PLAN.md 中的完整报告，此处仅列出 hikari 相关条目

### 🔴 严重 (P0)

- [x] **重写全部文档** — 87 处 Dioxus + 122 处 Lucide 引用已全部替换为 Tairitsu/MDI (`docs/**/*.md`, `packages/*.md`, `examples/*.md`)
- [x] **补齐键盘无障碍** — Switch (`basic/switch.rs`)、Tabs (`navigation/tabs.rs`)、Menu (`navigation/menu.rs`) 已添加 onkeydown 处理器 (Space/Enter/Escape/Arrow keys)

### 🟡 中等 (P1-P2)

- [x] 消除 CSS 变量覆盖重复代码 — 提取 `build_css_vars_style()` + `CssVarEntry` 到 `utils/css_vars.rs`，button/input/icon_button 已迁移
- [x] 封装 `ConditionalGlow` 组件 — 替换 button/input/icon_button 中的 `if props.glow { Glow { ... } } else { ... }` 模式
- [x] 删除冗余 easing 包装函数 (`animation/src/easing.rs`) — 移除了 44 个零值包装函数，保留有实质逻辑的 `custom`/`bezier`/`steps`/`power`/`elastic`/`bounce`/`overshoot`/`anticipate`
- [ ] 统一 Avatar 的 props 定义 — 从 `#[props(default)]` 迁移到 `#[define_props]` (`avatar.rs:79`)
- [ ] 合并 `NodeState` 和 `Node` 或明确区分语义 (`extra-components/src/node_graph/node.rs`)
- [ ] 统一 CSS 变量命名 — 全量迁移到 `--hi-` 或 `--hi-color-`
- [ ] `just fmt` 与 CI 统一 — 都使用 nightly + `--unstable-features`
- [ ] CI 添加 `cargo audit` + `cargo deny`
- [ ] MDI 图标获取加入 CI 缓存

### 🟢 轻微 (P3)

- [ ] 回退 SVG 添加 `fill="currentColor"` (`icons/src/lib.rs:41`) — 注意: 此行为是有意设计，使图标继承父元素 CSS color，并非 bug
- [x] 删除空模块 `components/src/hooks/` 目录 — 已移除空目录
- ~~`NodePlugin::handle_input` 当前为空操作~~ — **误报**: `handle_input` 是必需的 trait 方法，所有实现者必须提供，非空操作
- [x] 清理悬空依赖: `gloo`、`gloo-net` 已从 workspace 移除；`once_cell`、`chrono` 确认仍在使用
- [x] `tokio` features 从 `"full"` 缩减到 `"rt", "rt-multi-thread", "macros", "time"`
- [ ] Docker 重构: 多阶段构建、相对路径、非 root 用户、添加 `.dockerignore`
- [ ] 组件测试从"仅验证不 panic"升级为"验证输出结构和属性"
- [x] `README.md:63` 版本号 `0.1.0` → `0.1.8`

---

## Priority 1: Dioxus Legacy Cleanup

### Package READMEs
- [x] `packages/animation/README.md` — 已移除 Dioxus 引用
- [x] `packages/components/README.md` — 已移除 `dioxus = "0.7"` 依赖
- [x] `packages/theme/README.md` — 已移除 Dioxus 用法
- [x] `packages/icons/README.md` — 已移除 Dioxus 引用

### Source Code
- [x] `packages/components/src/navigation/tabs.rs` — doc comments 已移除 `dioxus::prelude`
- [x] `packages/icons/Cargo.toml` — description 已改为 "Material Design Icons (MDI)"

### Examples
- [ ] `examples/node-graph-demo/` — 仍依赖 Dioxus，待迁移或移除
- [x] `examples/menu_dynamic_level.rs` — 已删除孤立 Dioxus 示例
- [x] `examples/README.md` — 已重写，移除虚构示例
- [x] `examples/website/README.md` — 已更新为 Tairitsu 构建流程

## Priority 2: Documentation Rewrite (9 languages each)

### System Docs
- [x] `docs/*/system/overview.md` — Lucide → MDI, LucideIcon → MdiIcon (9 locales)
- [x] `docs/*/system/palette.md` — 移除 `use dioxus::prelude::*` (9 locales)
- [x] `docs/*/system/theme.md` — 移除 `use dioxus::prelude::*` (9 locales)
- [x] `docs/*/system/icons.md` — Lucide → MDI, 移除 `use dioxus::prelude::*` (9 locales)

### Guide Docs
- [x] `docs/*/guides/index.md` — Dioxus → Tairitsu (9 locales)
- [x] `docs/en/guides/ARCHITECTURE.md` — Dioxus → Tairitsu
- [x] `docs/en/guides/CONTRIBUTING.md` — Dioxus component style → Tairitsu
- [x] `docs/en/guides/i18n.md` — 已更新
- [x] `docs/en/guides/dependency_style.md` — dioxus → tairitsu-vdom
- [x] `docs/en/guides/static_assets_guide.md` — Dioxus SSR → Tairitsu SSR
- [x] `docs/*/guides/layer-component-plan.md` — Dioxus → Tairitsu (en/zhs/zht)
- [x] `docs/en/guides/root-layer-component-plan.md` — Dioxus → Tairitsu
- [x] `docs/en/design/custom.md` — dioxus::prelude → tairitsu_vdom::prelude

### Website Public Docs
- [ ] `examples/website/public/docs/` — stale pre-built copies, regenerate after source docs are fixed

## Priority 3: TOML Loader Upstream

- [ ] Extract `examples/website/src/i18n_init.rs::load_toml_flat` into tairitsu-packager as `fmt` subcommand
- [ ] After upstream: remove inlined loader from website, depend on tairitsu-packager feature

## Priority 4: Example Cleanup

- [ ] Decide fate of `examples/node-graph-demo/` — migrate to Tairitsu or remove
- [x] Remove `examples/menu_dynamic_level.rs` (orphaned Dioxus example)
- [x] Rewrite `examples/README.md` to reflect current state
- [x] Rewrite `examples/website/README.md` to describe Tairitsu build process

## Done

- [x] Merge hikari-builder into hikari-icons
- [x] Delete hikari-i18n, inline TOML loader into website
- [x] Split CI into clippy/fmt/test/publish matching tairitsu pattern
- [x] Remove dead `dioxus = []` feature from icons
- [x] Clean justfile builder references
- [x] Update README.md package table
- [x] Delete stale builder/render-service docs (18 files)
- [x] Delete stale SSR guide docs (3 files)
- [x] Replace hikari_i18n references in docs with tairitsu_web::i18n
- [x] Publish v0.1.0 to crates.io
- [x] 补齐键盘无障碍 (Switch/Tabs/Menu onkeydown handlers)
- [x] 删除冗余 easing 包装函数 (44 functions → 8 有实质逻辑的保留)
- [x] 移除悬空依赖 gloo/gloo-net
- [x] 删除空目录 components/src/hooks/
- [x] 更新 README.md 版本号到 0.1.8
- [x] 重写全部文档 Dioxus/Lucide → Tairitsu/MDI (209 处引用，66 个文件)
- [x] 修复 package READMEs (animation/components/theme/icons)
- [x] 修复 icons/Cargo.toml description (Lucide → MDI)
- [x] 删除孤立示例 menu_dynamic_level.rs
- [x] 重写 examples/README.md 和 examples/website/README.md
- [x] 消除 CSS 变量覆盖重复代码 (build_css_vars_style helper)
- [x] 封装 ConditionalGlow 组件 (button/input/icon_button 已迁移)
- [x] tokio features 从 "full" 缩减到 "rt, rt-multi-thread, macros, time"
