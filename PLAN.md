# hikari — Maintenance Notes

> Created 2026-07-10 during a routine maintenance sweep.

<<<<<<< HEAD
=======
## Refresh log 2026-07-15

- **当前分支**：`dev` · 领先 `origin/dev` 0 commits · 工作区有未提交改动
- **最近提交**：`📝 Refresh PLAN.md (2026-07-14)` (`cb9b464`)
- **未提交改动**：
  - `M packages/e2e/Cargo.toml` — 修复 chromiumoxide `tokio-runtime` → 移除（v0.9 不再有此 feature）；reqwest `rustls-tls` → `rustls`（v0.13 重命名）
  - `M packages/components/tests/basic_components_tests.rs` — 修复 `test_image_renders`（`src` 为必填字段）
  - Clippy auto-fix: `animation/src/events.rs` + `timer.rs` (8 for_kv_map), `palette/build.rs` (3), `palette/src/colors/mod.rs` (1), `components/build.rs` (1), `icons/build.rs` (4), `components/src/layout/space.rs` (1), `components/src/utils/icon_helper.rs` (1), `components/src/production/code_highlight.rs` (1) — 共 18 fixes
- **验证结果**：
  - `cargo check --workspace`：通过（需隐藏 NASM 使 aws-lc-sys 回退到 prebuilt NASM，见下文）
  - `cargo test --workspace`：全部通过（image 测试已修复）
  - `cargo clippy`：13 warnings（↓ 从 32）：12 个 `unfulfilled_lint_expectations` + 1 个 `unused_variable`（生成代码）。机械性警告已全部由 `clippy --fix` 自动修复。
- **Windows `aws-lc-sys` 编译解决方案**：
  - 根因：`aws-lc-sys` v0.42.0 的 build script 在本机 MSVC v18 上 `stdalign_check.c` 测试失败（`<stdalign.h>` 在 MSVC 中不可用），且 NASM 找不到 `.inc` include 路径。
  - 解决方法：从 PATH 中隐藏 `nasm.exe`，让 `test_nasm_command()` 返回 false → `use_prebuilt_nasm()` 返回 true → 使用预编译的 NASM `.obj` 文件。
  - 命令：`$env:Path = ($env:Path -split ';' | ? { $_ -notmatch 'NASM' }) -join ';'`（在 cargo 调用前）
  - 备选：设置 `AWS_LC_SYS_PREBUILT_NASM=1` 环境变量强制 prebuilt 模式。
- **后续动作**：
  1. 提交上述改动
  2. 清理 12 个 stale `#[expect(clippy::needless_update)]`
  3. 在 CI 中确保 NASM 不可用（或用 `AWS_LC_SYS_PREBUILT_NASM=1`）

## Refresh log 2026-07-14

- **当前分支**：`dev` · 领先 `origin/dev` 0 commits · 工作区干净
- **最近提交**：`⬆️ Upgrade dependencies and GitHub Actions versions.` (`d4cd31b`)
- **未提交改动**：无
- **后续动作**：
  1. 复核本文件 §"Documented decision" — 决策：rustfmt 不稳定选项留在 nightly 工具链；CI 中显式 `cargo +nightly fmt`。
  2. 升级 GitHub Actions 后跑一遍 `cargo test --workspace` 确认无回归。
  3. 把 `[patch]` 收敛到 `~/.cargo/config.toml` 顶层方案（见 entelecheia/PLAN.md §6 跨仓依赖约定）。
- **跨仓依赖**：被 `entelecheia` 工作区以 crate 形式引用；是 dev/build CI 的共享 helper。

>>>>>>> 40cec58 (🐛 Switch logo URLs to raw.githubusercontent.com for GitHub camo proxy support.)
## Documented decision: rustfmt.toml unstable options on a stable toolchain

`rustfmt.toml` declares two unstable options:

```toml
imports_granularity = "Module"
group_imports = "StdExternalCrate"
```

Both are **unstable** rustfmt options, but `rust-toolchain.toml` pins the
**stable** channel, so they are **silently ignored** and every `cargo fmt`
prints two "unstable features are only available in nightly channel" warnings.

### Resolution (2026-07-10)

Verified empirically that the options have **zero effect** on the current tree
(`cargo fmt --all -- --check` reports 0 diffs both with and without the config),
so the tree is already fmt-clean on stable regardless. Rather than delete the
options (which would lose the documented intent) or force a nightly toolchain
(which would burden all contributors/CI), the options are **kept and annotated**
with a comment in `rustfmt.toml` explaining they are nightly-only and have no
effect today. The original "8 fmt drift" diffs had already resolved themselves
by the time of this check.

If the project later wants the import grouping to actually apply, switch
`rust-toolchain.toml` to `channel = "nightly"` (the options will then take
effect and a one-time `cargo fmt --all` will group imports).

## Open issue: clippy warnings (1)

`cargo clippy --workspace` after auto-fix + stale expect cleanup reports 1 warning:

- 1 "this match could be replaced by its body itself" — in generated `mdi_selected.rs` (icons build output). Auto-re-generated on each build; suppressible via `#[allow]` in the build script template.

All 12 stale `#[expect(clippy::needless_update)]` attributes have been removed. All 18 mechanical fixes are applied.

## Done during this sweep (2026-07-15)

- `packages/e2e/Cargo.toml`: fixed `chromiumoxide` feature (`tokio-runtime` removed, not present in v0.9) and `reqwest` feature (`rustls-tls` → `rustls`, renamed in v0.13).
- `packages/components/tests/basic_components_tests.rs`: fixed `test_image_renders` (provided `src` prop).
- `cargo clippy --fix`: applied 18 mechanical fixes across palette/build/anim/components/icons (collapsible_if, for_kv_map, derivable_impls, manual_rem_euclid, manual_range_contains, match_single_binding, needless_borrows).
- Discovered Windows `aws-lc-sys` workaround: hide NASM from PATH → prebuilt NASM fallback.
- Full workspace `cargo check` + `cargo test` pass.

## Done during this sweep (2026-07-10)

- README: corrected the license declaration (was MIT/Apache, actually SySL) and
  fixed dead package/doc links (en-US→en, render-service/builder removal).
- guides/index.md: fixed broken CONTRIBUTING links across all 11 languages.
- Removed dead see-also links to unwritten design/classes docs.
- i18n: verified strings.toml key parity (75 keys × 9 locales, 100%).
