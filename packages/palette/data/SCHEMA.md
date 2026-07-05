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

Collections are opt-in via Cargo features:

```toml
# Default — only the palette core + themes, no color collections
hikari-palette = "^0.2"

# Bring in a collection
hikari-palette = { version = "^0.2", features = ["collection-chinese"] }
```

Each `collection-<name>` feature makes the generated module available at
`hikari_palette::collections::<name>`. Nothing from a disabled collection is
compiled into the binary.
