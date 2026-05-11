# Hikari 0.1.0 Post-Release Plan

> 下方 "体系健康检查" 部分来自 2026-05-11 对 tairitsu + hikari 整体栈的全面审计。
> 原 Post-Release Plan 事项保留在底部。

---

## 体系健康检查 (2026-05-11)

> 审查范围: tairitsu (v0.4.5) + hikari (v0.1.8) 作为完整技术栈
> 详见 tairitsu/PLAN.md 中的完整报告，此处仅列出 hikari 相关条目

### 🔴 严重 (P0)

- [x] **重写全部文档** — 87 处 Dioxus + 122 处 Lucide 引用已全部替换为 Tairitsu/MDI (`docs/**/*.md`, `packages/*.md`, `examples/*.md`)
- [x] **补齐键盘无障碍** — Switch/Tabs/Menu 已添加 onkeydown 处理器 (Space/Enter/Escape/Arrow keys)

### 🟡 中等 (P1-P2)

- [x] 消除 CSS 变量覆盖重复代码 — 提取 `build_css_vars_style()` + `CssVarEntry` 到 `utils/css_vars.rs`
- [x] 封装 `ConditionalGlow` 组件 — 替换 button/input/icon_button 中的 if-glow 模式
- [x] 删除冗余 easing 包装函数 — 44 个零值包装函数移除，保留 8 个有实质逻辑的
- [x] 统一 Avatar props — 从 `#[props(default)]` 迁移到 `#[define_props]`
- [x] NodeState/Node 语义区分 — 重命名为 `NodePlacement`（持久化）和 `NodeView`（渲染时）
- [x] 统一 CSS 变量命名 — 18 个非 `--hi-` 前缀变量已全部迁移到 `--hi-`
- [x] `just fmt` 与 CI 统一 — 使用 `cargo +nightly fmt --unstable-features`
- [x] CI 添加 `cargo audit` + `cargo deny` — 新增 `.github/workflows/security.yml`
- [x] MDI 图标获取加入 CI 缓存 — fmt/clippy/test 均添加 `actions/cache` 步骤

### 🟢 轻微 (P3)

- [x] 确认 SVG `fill="currentColor"` 为有意设计，非 bug
- [x] 删除空目录 `components/src/hooks/`
- ~~`NodePlugin::handle_input` 空操作~~ — 误报，是必需的 trait 方法
- [x] 清理悬空依赖 `gloo`/`gloo-net`
- [x] `tokio` features `"full"` → `"rt", "rt-multi-thread", "macros", "time"`
- [x] Docker 重构 — 多阶段构建、非 root 用户、`debian:bookworm-slim`
- [x] 组件测试从"仅验证不 panic"升级为"验证输出结构和属性"
- [x] `README.md` 版本号 → `0.1.8`

---

## Priority 1: Dioxus Legacy Cleanup

- [x] `packages/animation/README.md` — 已移除 Dioxus 引用
- [x] `packages/components/README.md` — 已移除 `dioxus` 依赖
- [x] `packages/theme/README.md` — 已移除 Dioxus 用法
- [x] `packages/icons/README.md` — 已移除 Dioxus 引用
- [x] `packages/icons/Cargo.toml` — description "Lucide" → "MDI"
- [x] `tabs.rs` doc comments — 移除 `dioxus::prelude`

## Priority 2: Documentation Rewrite (9 languages)

- [x] `docs/*/system/overview.md` — Lucide → MDI (9 locales)
- [x] `docs/*/system/palette.md` + `theme.md` + `icons.md` — 移除 `dioxus::prelude` (27 files)
- [x] `docs/*/guides/index.md` — Dioxus → Tairitsu (9 locales)
- [x] All en-only guide docs (ARCHITECTURE, CONTRIBUTING, i18n, dependency_style, static_assets_guide, layer-component-plan, etc.)
- [x] `docs/en/design/custom.md` — dioxus::prelude → tairitsu_vdom::prelude
- [ ] `examples/website/public/docs/` — stale pre-built copies, regenerate

## Priority 3: TOML Loader Upstream

- [ ] Extract `load_toml_flat` into tairitsu-packager as `fmt` subcommand
- [ ] After upstream: remove inlined loader from website

## Priority 4: Example Cleanup

- [x] Remove `examples/node-graph-demo/` (Dioxus dependency, removed)
- [x] Remove `examples/menu_dynamic_level.rs`
- [x] Rewrite `examples/README.md` and `examples/website/README.md`

## Done

- [x] Merge hikari-builder into hikari-icons
- [x] Delete hikari-i18n, inline TOML loader into website
- [x] Split CI into clippy/fmt/test/publish
- [x] Remove dead `dioxus = []` feature from icons
- [x] Clean justfile builder references
- [x] Update README.md package table
- [x] Delete stale builder/render-service docs (18 files)
- [x] Delete stale SSR guide docs (3 files)
- [x] Replace hikari_i18n references in docs with tairitsu_web::i18n
- [x] Publish v0.1.0 to crates.io
- [x] 补齐键盘无障碍 (Switch/Tabs/Menu onkeydown)
- [x] 删除冗余 easing 包装函数 (44 → 8)
- [x] 移除悬空依赖 gloo/gloo-net
- [x] 重写全部文档 Dioxus/Lucide → Tairitsu/MDI (209 处)
- [x] 修复 package READMEs + icons description
- [x] 删除孤立示例 + 重写 examples READMEs
- [x] 消除 CSS 变量覆盖重复代码
- [x] 封装 ConditionalGlow 组件
- [x] tokio features "full" → minimal
- [x] Avatar props #[define_props] 迁移
- [x] NodeState → NodePlacement, Node → NodeView 重命名
- [x] CSS 变量命名统一 (--hikari/--glow/--bg/--spotlight/--fade → --hi-)
- [x] just fmt 统一使用 nightly + --unstable-features
- [x] CI security workflow (audit + deny)
- [x] CI MDI icons cache
- [x] Docker 多阶段构建 + 非 root 用户
- [x] 删除 node-graph-demo (Dioxus dependency)
- [x] 组件测试升级: background panic-only → structural; 新增 Button/Input/Switch/Tabs/Menu/CssVars 测试
