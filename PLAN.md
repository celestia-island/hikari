# Hikari 0.1.0 Post-Release Plan

> 下方 "体系健康检查" 部分来自 2026-05-11 对 tairitsu + hikari 整体栈的全面审计。
> 原 Post-Release Plan 事项保留在底部。

---

## 体系健康检查 (2026-05-11)

> 审查范围: tairitsu (v0.4.5) + hikari (v0.1.8) 作为完整技术栈
> 详见 tairitsu/PLAN.md 中的完整报告，此处仅列出 hikari 相关条目

### 🔴 严重 (P0)

- [ ] **重写全部文档** — 66 处引用 Dioxus/Lucide，全部替换为 Tairitsu vdom/hooks/macros 和 MDI (`docs/**/*.md`)
- [ ] **补齐键盘无障碍** — Switch (`switch.rs:188-214`)、Tabs (`tabs.rs:270`)、Menu (`menu.rs:224-227`) 有 ARIA 角色但无键盘事件处理器

### 🟡 中等 (P1-P2)

- [ ] 消除 CSS 变量覆盖重复代码 — `button.rs:142-171`、`input.rs:133-162` 等 5+ 组件中的相同模式
- [ ] 封装 `ConditionalGlow` 组件 — 替换 5 处 `if props.glow { Glow { ... } } else { ... }`
- [ ] 删除 55 个冗余 easing 包装函数 (`animation/src/easing.rs`)
- [ ] 统一 Avatar 的 props 定义 — 从 `#[props()]` 迁移到 `#[define_props]` (`avatar.rs:80`)
- [ ] 合并 `NodeState` 和 `Node` 或明确区分语义 (`extra-components/src/node.rs`)
- [ ] 统一 CSS 变量命名 — 全量迁移到 `--hi-` 或 `--hi-color-`
- [ ] `just fmt` 与 CI 统一 — 都使用 nightly + `--unstable-features`
- [ ] CI 添加 `cargo audit` + `cargo deny`
- [ ] MDI 图标获取加入 CI 缓存

### 🟢 轻微 (P3)

- [ ] 回退 SVG 添加 `fill="currentColor"` (`icons/src/lib.rs:41`)
- [ ] 删除空模块 `components/src/hooks/` 声明
- [ ] `NodePlugin::handle_input` 当前为空操作 (`extra-components/src/node.rs:137`)
- [ ] 清理悬空依赖: `once_cell`、`gloo`、`gloo-net`、`chrono`
- [ ] `tokio` features 从 `"full"` 缩减到实际需要的
- [ ] Docker 重构: 多阶段构建、相对路径、非 root 用户、添加 `.dockerignore`
- [ ] 组件测试从"仅验证不 panic"升级为"验证输出结构和属性"
- [ ] `README.md:63` 版本号 `0.1.0` → `0.1.8`

---

## Priority 1: Dioxus Legacy Cleanup

### Package READMEs
- [ ] `packages/animation/README.md` — references "for Dioxus"
- [ ] `packages/components/README.md` — `dioxus = "0.7"` examples
- [ ] `packages/theme/README.md` — Dioxus usage examples

### Source Code
- [ ] `packages/components/src/navigation/tabs.rs` — doc comments mention `dioxus::prelude`
- [ ] `packages/icons/Cargo.toml` — description says "Lucide" but it's MDI

### Examples
- [ ] `examples/node-graph-demo/` — still depends on Dioxus, needs migration or removal
- [ ] `examples/menu_dynamic_level.rs` — uses `dioxus::prelude`
- [ ] `examples/README.md` — documents non-existent examples (table-demo, tree-demo, ssr-demo)
- [ ] `examples/website/README.md` — describes Dioxus/Axum build process

## Priority 2: Documentation Rewrite (9 languages each)

### System Docs
- [ ] `docs/*/system/overview.md` — still references Dioxus, old build system, render-service
- [ ] `docs/*/system/palette.md` — `use dioxus::prelude::*` in examples
- [ ] `docs/*/system/theme.md` — `use dioxus::prelude::*` in examples
- [ ] `docs/*/system/icons.md` — `use dioxus::prelude::*` in examples

### Guide Docs
- [ ] `docs/*/guides/index.md` — stale directory tree (already partially cleaned)
- [ ] `docs/en/guides/ARCHITECTURE.md` — describes Dioxus architecture, lists non-existent packages
- [ ] `docs/en/guides/CONTRIBUTING.md` — Dioxus component style, ssr-demo references
- [ ] `docs/en/guides/i18n.md` — references deleted hikari_i18n
- [ ] `docs/en/guides/dependency_style.md` — Dioxus dependency example
- [ ] `docs/en/guides/static_assets_guide.md` — "Dioxus SSR" example

### Website Public Docs
- [ ] `examples/website/public/docs/` — stale pre-built copies, regenerate after source docs are fixed

## Priority 3: TOML Loader Upstream

- [ ] Extract `examples/website/src/i18n_init.rs::load_toml_flat` into tairitsu-packager as `fmt` subcommand
- [ ] After upstream: remove inlined loader from website, depend on tairitsu-packager feature

## Priority 4: Example Cleanup

- [ ] Decide fate of `examples/node-graph-demo/` — migrate to Tairitsu or remove
- [ ] Remove `examples/menu_dynamic_level.rs` (orphaned Dioxus example)
- [ ] Rewrite `examples/README.md` to reflect current state
- [ ] Rewrite `examples/website/README.md` to describe Tairitsu build process

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
