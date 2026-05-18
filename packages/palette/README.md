# hikari-palette

Color palette system with 660+ named colors as type-safe Rust constants.

## Installation

```toml
[dependencies]
hikari-palette = "0.1.0"
```

## Quick Start

```rust
use hikari_palette::{石青, 朱砂, 藤黄};

fn main() {
    let primary = 石青;
    let secondary = 朱砂;

    println!("Primary color: {}", primary.name);
    println!("Hex: {}", primary.hex);
    println!("RGB: {:?}", primary.rgb);
}
```

## Documentation

For complete API documentation and examples, see [docs.rs](https://docs.rs/hikari-palette)

## Features

- **660+ Named Colors** — Comprehensive color library
- **Type-Safe Constants** — Named identifiers in Rust code
- **Pre-defined Palettes** — Hikari (light) and Tairitsu (dark) theme palettes
- **Utility Classes** — Type-safe Tailwind-like class system
- **Color Math** — HSL conversion, gradient, blending utilities

## License

MIT OR Apache-2.0
