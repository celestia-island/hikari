# hikari-palette

500+ traditional Chinese colors with type-safe Rust constants and rich historical context.

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

- **500+ Traditional Chinese Colors** - Authentic historical colors
- **Rich Metadata** - Hex, RGB, CMYK values, and historical notes
- **Type-Safe Constants** - Chinese identifiers in Rust code
- **Pre-defined Palettes** - Ready-to-use theme color schemes
- **Utility Classes** - Type-safe Tailwind-like class system

## License

MIT OR Apache-2.0
