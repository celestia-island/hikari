# Hikari 0.1.0 Post-Release Plan

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
