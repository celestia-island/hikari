# Changelog

All notable changes to hikari, the Celestia Island UI component library, are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Version lines

hikari currently carries two version lines, plus one stale tag:

- **Rust crates (`hikari-*`)** — the `0.3.x` line. The workspace is at
  `0.3.19` on master; versions up to `0.3.14` have been published to
  crates.io. Git tags `v0.1.0` … `v0.3.14` track these releases. Releases
  `v0.3.0`–`v0.3.2` and `v0.3.4` were published to crates.io without git
  tags, and `v0.3.15`–`v0.3.19` are unpublished master changes.
- **Vue port (`@celestia-island/hikari`)** — the `0.4.x` line. The npm
  package is at `0.4.7` on master but has **never been published** to npm;
  publication is pending (A3).
- **Tag `v0.4.0` is a stale tag.** It was created on an early Vue-port
  commit (2026-07-21) before the npm package version line was established,
  so it predates the npm `0.4.x` line. It marks neither a crates.io release
  nor an npm release and should be ignored.

## [Unreleased]

Current master, Rust workspace `0.3.19`.

### Added

- Add a `variant="sidebar"` mode to `HkMenu`: an inline vertical nav list
  (no popover, no history) where rows carry icon/flag/badge/active states
  with a consistent 4px rhythm, and root items with `children` render as
  collapsible groups (defaulting open when they contain the `activeKey`
  row; deeper levels indent). `HkMenuItem` gains `badge` for sidebar count
  pills. Built for admin sidebars and mobile nav drawers.
- Add a generic cascading menu component `HkMenu` (`items` tree with
  icons/flags/checked/danger/disabled rows) plus `HkLocalePickerPopup`
  rebuilt as a thin config over it: desktop anchors the root panel to the
  trigger and cascades submenu panels to the right of their anchor row
  (flipping left on viewport overflow), switching or collapsing on sibling
  hover like a classic menubar; mobile renders one fullscreen sheet per
  level — the root included — where every level pushes a history entry so
  the system/browser back gesture closes exactly one level.
- Add mobile native pass-through to both date pickers and localize the
  datetime picker: HkDateTimePicker now derives month/weekday names and the
  trigger label from `Intl.DateTimeFormat` on the active locale (week start
  from `Intl.Locale` weekInfo, Sunday fallback) instead of hardcoded English
  tables, its previously dead popup mode renders a real trigger anchored to
  HPopover (`placement`/`offset` finally wired), and both HkDateTimePicker
  and HkDatePicker gain `nativeOnMobile` (default true) which swaps the
  custom popup for the OS `<input type="datetime-local">`/`type="date"`
  control below the 768px breakpoint with Date-to-wire-format conversion,
  min/max clamping and model re-sync on rejected edits.
- Add safe centering and overflow sensing to HkScrollContainer (`align="center"`
  wraps the slot in an auto-margin aligner; `data-h-overflow` /
  `data-v-overflow` mirror sensed overflow; optional `fade` masks the edges
  with hidden content; `refresh()` / `getOverflow()` join the exposed API).
- Add `scrollable` mode to HkTabs — the tab list rides a centered horizontal
  HkScrollContainer, keeps center alignment while it fits, scrolls when it
  overflows, fades its hidden edges and scrolls the active tab into view.
- Port media, zoom and chart components to Vue. (#89)
- Add Phase 6 theme bridge — CSS variable bridge for hikari components. (#83)
- Migrate PopupSelect component from shittim-chest to hikari.
- Migrate ColorPicker from shittim-chest to hikari. (#76)
- Migrate components and export utilities.
- Add hikari component demo SPA and docs site.
- Provide fallback color aliases for hikari component tokens.
- Add per-locale mergeMessages for layer-2 i18n namespace registration.

### Changed

- Unify npm specs to caret-star and upgrade to latest series. (#86)
- Export PopupPlacement type from HPopover module for downstream consumption. (#84)
- Rename i18n prefix to `hikari::` namespace.
- Remove backward compat i18n aliases, use new names only.
- Unify locale codes to BCP 47 format.
- Route compute CI to local self-hosted runner. (#87)
- Fix noa release download in CI validate job. (#92)
- Rewrite README to reflect tairitsu-based architecture and current state. (#91)
- Restore full SySL license text and align npm metadata. (#90)
- Add paired `hikari:rust` + `hikari:tsx` blocks and live preview config.
- Add paired hikari rust and hikari tsx live blocks with cross-language ref support.
- Add Chinese README for hikari docs index.
- Add missing language README files for hikari docs.

### Fixed

- Theme every scrollable menu/select surface: `HkSelect` popouts, the
  `HkPopupSelect` viewport (whose hidden scrollbar now shows as a themed
  thin bar) and `HkMenu` panels/sheets use a 6px themed scrollbar instead
  of the browser-native chrome.
- Restyle `HkSelect` / `HkPopupSelect` / `HkInput` labels as small muted
  captions (xs, 600, 60% text) instead of full-size text, and give
  dropdown option rows a consistent 2px rhythm so rounded hover pills
  never touch.
- Add admin KPI widgets: HkStatCard (label/value/hint with a tone DOT —
  text hue never changes, per the interaction-state precedence), HkStatusPill
  (compact ok/warn/error/unknown pill with optional latency + version, gentle
  pulse on live state, reduced-motion aware), and HkShareBar (label + share
  bar + caption row for usage/quota breakdowns).
- Fix HkNavItem hover erasing the active state: the `:hover:not([data-disabled])`
  selector outranked `[data-active]` (0,3,0 vs 0,2,0), so hovering the selected
  sidebar item wiped its background tint and primary text color. Hover now
  excludes `[data-active]` everywhere and shows a primary 10% wash with neutral
  text — hue and font-weight never change on hover (active > hover precedence,
  applied to HkNavItem, HkPopover menu items, and the theme toggle as well).
- Stop HkButton's base min-height from applying to every size: sm buttons were
  2.5rem (40px) tall regardless of their compact padding — each size variant
  now carries its own min-height (sm 1.75rem, md 2.5rem, lg 2.75rem).
- Upgrade HkPageHeader from the inline-styled stub to the full page shell:
  big title with optional leading icon and subtitle on the left, right-aligned
  `actions` slot, optional dense variant, and a scoped stylesheet (consumed by
  the chest admin redesign).
- Fix i18n include_dir path and sync DemoApp with component APIs. (#85)
- Remove dead Language variants in i18n crate.
- Make layout component optional props genuinely optional (`#[props(default)]`
  instead of the no-op `#[props(optional)]`) so Header/Section/Aside/Layout
  render without panic when props are omitted.
- Fix CI gates: nightly fmt drift, apt non-interactive install, stale website
  build job, `just` install via GitHub API 404, and squash-message-clean git
  identity. (#99)

### Removed

- Remove dead HAuthCard and stale HkStatusBar references. (#88)

## [v0.3.14] - 2026-07-18

### Changed

- Bump version to 0.3.14.

### Fixed

- Drop `.scss` extension from theme `@use` imports for load-path resolution.

## [v0.3.13] - 2026-07-18

### Added

- Add the component demo block style family and missing surface tokens. (#19)
- Switch component CSS from build.rs grass to `scss!` macro.
- Purge Dioxus, adopt shittim-chest design tokens, migrate docs to lagrange, and decouple SCSS compilation.

### Changed

- Add SCSS styles directory as grass load path in build script.
- Bump publish timeout from 15 to 30 min for 6-package release.
- Restrict publish to master, skip if version already exists.
- Publish v0.3.13 — rebuild components against `scss!` no_hash-capable tairitsu. (#15)
- Final sync of dev into master before dev retirement. (#17)
- Bump actions/cache from 4 to 6. (#14)

### Fixed

- Ship packed MDI data so every build gets icon data. (#18)

## [v0.3.12] - 2026-07-13

### Added

- Add multi-palette code highlighting, i18n component strings, and icon system overhaul.

### Changed

- Purge Dioxus, adopt shittim-chest design tokens, migrate docs to lagrange, and decouple SCSS compilation.

## [v0.3.11] - 2026-07-10

### Changed

- Unify the crate workspace with a component system and compile-time palette.
- Release v0.3.11 — Dioxus purge + shittim-chest design tokens + lagrange docs migration + SCSS decoupling.

## [v0.3.10] - 2026-07-07

### Fixed

- Add missing description to hikari-components.
- Fix borrow checker error in CSS stub generation.
- Emit empty CSS stubs when SCSS compilation is skipped.
- Skip SCSS compilation in components when theme styles are unavailable.
- Provide complete type definitions in `mdi_selected` stub.
- Fix build.rs return type for icons stub generation.
- Emit stub `mdi_selected.rs` when icons build is skipped.

## [v0.3.9] - 2026-07-07

### Fixed

- Fix borrow checker error in CSS stub generation.

## [v0.3.8] - 2026-07-07

### Fixed

- Emit empty CSS stubs when SCSS compilation is skipped.

## [v0.3.7] - 2026-07-06

### Fixed

- Skip SCSS compilation in components when theme styles are unavailable.

## [v0.3.6] - 2026-07-06

### Fixed

- Provide complete type definitions in `mdi_selected` stub.

## [v0.3.5] - 2026-07-06

### Fixed

- Fix build.rs return type for icons stub generation.
- Emit stub `mdi_selected.rs` when icons build is skipped.

## [v0.3.3] - 2026-07-06

### Changed

- Migrate to the Tairitsu runtime with TOML-driven color collections.
- Switch from Apache-2.0 to SySL-1.0.

### Fixed

- Emit stub `mdi_selected.rs` when icons build is skipped.
- Add missing description fields for crates.io publish.
- Fix build scripts to gracefully handle non-workspace context.

## [v0.2.6] - 2026-05-23

### Changed

- Rewrite hikari-icons for runtime icon resolution and TypedClass enums.
- Migrate icons build to OUT_DIR and generate TypedClass enums.

## [v0.2.5] - 2026-05-21

### Fixed

- Fix hikari-icons crate packaging for crates.io publish.

## [v0.2.4] - 2026-05-21

### Changed

- Remove tairitsu runtime deps from hikari-theme.

## [v0.2.3] - 2026-05-20

### Changed

- Migrate hikari-icons to a pure abstraction layer.

## [v0.2.2] - 2026-05-19

### Fixed

- Restore root-level re-exports and abort publish on failure.

## [v0.2.1] - 2026-05-19

### Changed

- Eliminate shell scripts for cross-platform CI.
- Consolidate visual regression to tairitsu-packager CLI.

## [v0.2.0] - 2026-05-18

### Added

- Add topological publish script with crates.io index wait.

### Changed

- Migrate Dioxus to Tairitsu framework with import grouping.

## [v0.1.10] - 2026-05-13

### Changed

- Remove inline `load_toml_flat` and use upstream tairitsu-web.
- Complete health check audit and add visual regression CI.

## [v0.1.9] - 2026-05-13

Re-tag of the v0.1.8 commit (same commit, no code changes).

## [v0.1.8] - 2026-05-13

### Fixed

- Use `load_path` SCSS imports instead of relative paths.

## [v0.1.7] - 2026-05-13

### Fixed

- Remove hikari-theme build-dep to fix duplicate tairitsu-style.

## [v0.1.6] - 2026-05-13

### Fixed

- Resolve theme SCSS via cargo metadata for crates.io builds.

## [v0.1.5] - 2026-05-13

### Fixed

- Generate empty CSS stubs when theme is unavailable.

## [v0.1.4] - 2026-05-13

### Fixed

- Skip SCSS compilation when theme directory is missing.

## [v0.1.3] - 2026-05-13

### Fixed

- Handle missing workspace in build script for crates.io.

## [v0.1.2] - 2026-05-13

### Fixed

- Fix icon build output path for crates.io publish.

## [v0.1.1] - 2026-05-13

Re-tag of the v0.1.0 commit (same commit, no code changes).

## [v0.1.0] - 2026-05-13

### Added

- Initialize the project.
- Overhaul CI and add crates.io dependencies.

### Fixed

- Fix path deps missing version for crates.io publish.

[Unreleased]: https://github.com/celestia-island/hikari/compare/v0.3.14...master
[v0.3.14]: https://github.com/celestia-island/hikari/compare/v0.3.13...v0.3.14
[v0.3.13]: https://github.com/celestia-island/hikari/compare/v0.3.12...v0.3.13
[v0.3.12]: https://github.com/celestia-island/hikari/compare/v0.3.11...v0.3.12
[v0.3.11]: https://github.com/celestia-island/hikari/compare/v0.3.10...v0.3.11
[v0.3.10]: https://github.com/celestia-island/hikari/compare/v0.3.9...v0.3.10
[v0.3.9]: https://github.com/celestia-island/hikari/compare/v0.3.8...v0.3.9
[v0.3.8]: https://github.com/celestia-island/hikari/compare/v0.3.7...v0.3.8
[v0.3.7]: https://github.com/celestia-island/hikari/compare/v0.3.6...v0.3.7
[v0.3.6]: https://github.com/celestia-island/hikari/compare/v0.3.5...v0.3.6
[v0.3.5]: https://github.com/celestia-island/hikari/compare/v0.3.3...v0.3.5
[v0.3.3]: https://github.com/celestia-island/hikari/compare/v0.2.6...v0.3.3
[v0.2.6]: https://github.com/celestia-island/hikari/compare/v0.2.5...v0.2.6
[v0.2.5]: https://github.com/celestia-island/hikari/compare/v0.2.4...v0.2.5
[v0.2.4]: https://github.com/celestia-island/hikari/compare/v0.2.3...v0.2.4
[v0.2.3]: https://github.com/celestia-island/hikari/compare/v0.2.2...v0.2.3
[v0.2.2]: https://github.com/celestia-island/hikari/compare/v0.2.1...v0.2.2
[v0.2.1]: https://github.com/celestia-island/hikari/compare/v0.2.0...v0.2.1
[v0.2.0]: https://github.com/celestia-island/hikari/compare/v0.1.10...v0.2.0
[v0.1.10]: https://github.com/celestia-island/hikari/compare/v0.1.9...v0.1.10
[v0.1.9]: https://github.com/celestia-island/hikari/compare/v0.1.8...v0.1.9
[v0.1.8]: https://github.com/celestia-island/hikari/compare/v0.1.7...v0.1.8
[v0.1.7]: https://github.com/celestia-island/hikari/compare/v0.1.6...v0.1.7
[v0.1.6]: https://github.com/celestia-island/hikari/compare/v0.1.5...v0.1.6
[v0.1.5]: https://github.com/celestia-island/hikari/compare/v0.1.4...v0.1.5
[v0.1.4]: https://github.com/celestia-island/hikari/compare/v0.1.3...v0.1.4
[v0.1.3]: https://github.com/celestia-island/hikari/compare/v0.1.2...v0.1.3
[v0.1.2]: https://github.com/celestia-island/hikari/compare/v0.1.1...v0.1.2
[v0.1.1]: https://github.com/celestia-island/hikari/compare/v0.1.0...v0.1.1
[v0.1.0]: https://github.com/celestia-island/hikari/releases/tag/v0.1.0
