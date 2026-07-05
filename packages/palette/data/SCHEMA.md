# hikari-palette data schema (v1)

All color data lives in TOML. Two file kinds:

## 1. Color collection — `data/<name>.toml`

A catalog of named colors from a single source (a culture, a design system, a
brand). Each enabled collection becomes a `pub mod` of `pub const` values behind
a feature gate. Unused collections cost nothing.

```toml
[collection]
name = "chinese"                       # MUST match the file stem
description = "Traditional Chinese colors"
source = "https://github.com/lanqy/chinese-colors"  # optional attribution

[colors]
# Each key is an identifier (any valid Rust ident — ASCII, CJK, etc.).
# Value is a hex color "#rrggbb".
粉红 = "#ffb3a7"
朱红 = "#ff4c00"
```

The build script (`build.rs`) parses every enabled collection and emits, into
`OUT_DIR`, a module of `pub const <NAME>: Color = Color::from_rgb_hex(0xff, 0xb3, 0xa7);`
per color. Category inference (`ColorCategory`) is computed at build time from
the hex value — no per-color category column needed.

## 2. Themed palettes — `data/themes.toml`

Self-contained role-based palettes. Independent of any collection; values are
hex strings. Each palette becomes a `pub struct` + `::palette()` constructor
behind a feature gate.

```toml
[collection]
name = "themes"

[palettes.hikari]
mode = "light"          # or "dark"
primary = "#ffb3a7"
secondary = "#519a73"
accent = "#ffc773"
success = "#0eb840"
warning = "#ffa631"
danger = "#ff4c00"
background = "#ffffff"
surface = "#ffffff"
border = "#c4d8da"
text_primary = "#262626"
text_secondary = "#666666"
```

## Enabling data

Collections are **not** Cargo features. They are selected by the consuming
workspace via `[workspace.metadata.hikari]` in its root `Cargo.toml`:

```toml
# Root Cargo.toml of the business project
[workspace.metadata.hikari]
collections = ["chinese"]
```

Each listed collection is read by `hikari-palette`'s build script, which:

1. Emits `cargo:rustc-cfg=hikari_collection_<name>` so the source module compiles in.
2. Generates a `pub const` block from `data/<name>.toml` into `OUT_DIR`.

The collection is then available at `hikari_palette::collections::<name>`.
Collections not listed are never read, never generated, never compiled — they
cost zero bytes.

### Why metadata, not features?

Selection is a property of the *consuming project* (which color catalogs does
this app need?), not of the crate graph. Centralizing it in the workspace root
keeps every downstream crate's `Cargo.toml` free of `features = [...]` noise and
makes the active set visible in one place.
