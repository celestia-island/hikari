# Hikari Examples

Welcome to the Hikari UI examples! This directory contains comprehensive, runnable demonstrations of the Hikari component library.

## Examples Overview

### 1. [website](./website/) - Comprehensive Component Demo

A complete showcase of all Hikari components with sidebar navigation.

**Features:**

- Basic Components (Button, Input, Card, Badge)
- Feedback Components (Alert, Toast, Tooltip)
- Navigation Components (Menu, Tabs, Breadcrumb)
- Data Components (Table, Tree)

**Run:**

```bash
cargo run --bin website
```

### 2. [table-demo](./table-demo/) - Advanced Table Component

Focused demonstration of table features including sorting, filtering, pagination, selection, and editing.

**Features:**

- Sortable columns
- Real-time filtering
- Pagination for large datasets
- Row selection
- Inline editing
- Custom styling

**Run:**

```bash
cargo run --bin table-demo
```

### 3. [tree-demo](./tree-demo/) - Tree Component Demo

Comprehensive tree component examples with large datasets and advanced features.

**Features:**

- Basic tree with expandable nodes
- Large tree (1000+ nodes) for performance testing
- Virtual scrolling for optimal performance
- Drag & drop demonstration
- Custom node rendering with icons and badges

**Run:**

```bash
cargo run --bin tree-demo
```

### 4. [node-graph-demo](./node-graph-demo/) - Interactive Node Graph

Interactive node graph editor with connections, zoom, pan, and minimap.

**Features:**

- Draggable nodes
- Bezier curve connections
- Zoom and pan controls
- Minimap navigation
- Multiple node types (Input, Process, Output, Conditional)
- Real-time updates

**Run:**

```bash
cargo run --bin node-graph-demo
```

### 5. [ssr-demo](./ssr-demo/) - Server-Side Rendering

Production-ready SSR example with Axum integration.

**Features:**

- Full SSR with Tairitsu
- Static asset serving with caching
- Health check endpoints
- API routes
- CORS support
- Compression
- Request tracing

**Run:**

```bash
cargo run --bin ssr-demo
```

Server starts on `http://localhost:3000`

## Quick Start

### Prerequisites

- Rust 1.75 or later
- Cargo (comes with Rust)

### Running Examples

From the project root:

```bash
# Run any example
cargo run --bin <example-name>

# For example:
cargo run --bin website
cargo run --bin table-demo
cargo run --bin tree-demo
cargo run --bin node-graph-demo
cargo run --bin ssr-demo
```

Or navigate to a specific example directory:

```bash
cd examples/<example-name>
cargo run
```

## Project Structure

```
examples/
├── website/            # Comprehensive component showcase
│   ├── Cargo.toml
│   ├── README.md
│   └── src/main.rs
│
├── table-demo/         # Advanced table features
│   ├── Cargo.toml
│   ├── README.md
│   └── src/main.rs
│
├── tree-demo/          # Tree component with large datasets
│   ├── Cargo.toml
│   ├── README.md
│   └── src/main.rs
│
├── node-graph-demo/    # Interactive node graph
│   ├── Cargo.toml
│   ├── README.md
│   └── src/main.rs
│
└── ssr-demo/           # Server-Side Rendering
    ├── Cargo.toml
    ├── README.md
    ├── src/
    │   ├── main.rs
    │   └── index.html
    └── static/         # Static assets (optional)
```

## Design System

All examples use the Hikari design system:

- **Arknights-inspired** clean, flat design
- **FUI elements** with subtle glows and futuristic touches
- **Chinese traditional colors** from the Hikari palette
- **Responsive layouts** that work on all screen sizes

## Development Tips

### Hot Reloading

For development with hot reloading:

```bash
cargo install tairitsu
dx watch --bin website
```

### Building Examples

Build all examples in release mode:

```bash
cargo build --release --bins
```

### Running Tests

Run tests for all examples:

```bash
cargo test --workspace
```

## Learn More

- **Hikari Components**: [../../packages/components/](../../packages/components/)
- **Hikari Palette**: [../../packages/palette/](../../packages/palette/)
- **Hikari Theme**: [../../packages/theme/](../../packages/theme/)

## Contributing

When adding new examples:

1. Create a new directory in `examples/`
2. Add a `Cargo.toml` with workspace dependencies
3. Implement the example in `src/main.rs`
4. Add a comprehensive `README.md`
5. Update this `README.md` with the new example

## License

All examples are licensed under the same terms as the Hikari project — the [Synthetic Source License (SySL), Version 1.0](../LICENSE).

## Acknowledgments

- Built with [Tairitsu](https://github.com/celestia-island/tairitsu)
- Design inspired by [Arknights](https://www.arknights.global/)
- Colors from [ChineseColors](https://github.com/zhaoolee/ChineseColors)
