# hikari-builder

Build-time code generation and SCSS compilation for Hikari UI applications.

## Installation

Add to your `Cargo.toml` as a build dependency:

```toml
[build-dependencies]
hikari-builder = "0.1.0"
```

## Quick Start

Add this to your `build.rs` file:

```rust
fn main() {
    hikari_builder::build().expect("Build failed");
}
```

That's it! The build system will:
- Scan `packages/components/src/styles/components/` for SCSS files
- Generate `packages/builder/src/generated/components.rs`
- Compile SCSS bundle to `public/styles/bundle.css`

## Documentation

For complete documentation, custom configuration, and build process details, see [docs.rs](https://docs.rs/hikari-builder)

## Features

- **SCSS Compilation** - Uses [Grass](https://github.com/kaj/kaj) (pure Rust Sass compiler)
- **Component Discovery** - Automatically discovers components from SCSS files
- **Code Generation** - Generates Rust constants for discovered components
- **Asset Bundling** - Creates optimized CSS bundles for production
- **Zero External Dependencies** - No Ruby, Node.js, or build tools required

## Custom Configuration

For advanced use cases, use the Builder API:

```rust
use hikari_builder::{Builder, BuildConfig};

fn main() {
    let config = BuildConfig {
        components: vec![
            "button".to_string(),
            "input".to_string(),
            "card".to_string(),
        ],
        output_dir: "dist".into(),
        minify_css: true,
        ..BuildConfig::default()
    };

    Builder::new(config)
        .build()
        .expect("Build failed");
}
```

## License

MIT OR Apache-2.0
