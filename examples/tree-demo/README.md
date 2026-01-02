# Tree Component Demo

Comprehensive tree component demonstration with large datasets, virtual scrolling, drag-and-drop, and custom rendering.

## Architecture

This demo uses the **Axum + WASM architecture**:
- **Frontend**: Dioxus compiled to WebAssembly
- **Backend**: Axum web server (Rust)
- **Build**: Unified build system via Justfile

## Features

This demo showcases:

- **Basic Tree**: Simple hierarchical data display
- **Large Tree**: 1,000+ node tree for performance testing
- **Virtual Scroll**: Optimized rendering for large datasets
- **Drag & Drop**: Visual demonstration of tree node reordering
- **Custom Render**: Custom icons, badges, and styling

## Running the Demo

### Quick Start (Recommended)

```bash
# From this directory
just serve
```

This will:
1. Build workspace dependencies
2. Build WASM client in release mode
3. Start Axum development server at **http://localhost:3000**

### Build Commands

```bash
# Build client (WASM) only
just build-client

# Build server (Axum) only
just build-server

# Build everything
just build
```

### Available Commands

See `justfile` for all available commands:

- `just serve` - Build client and start server (recommended)
- `just build-client` - Build WASM client only
- `just build-server` - Build Axum server only
- `just run-server` - Start Axum server (assumes client is built)
- `just build` - Build both client and server
- `just clean` - Clean build artifacts
- `just fmt` - Format code
- `just clippy` - Run Clippy checks
- `just check` - Run full checks (format + clippy)

## Server Features

The Axum server provides:
- **Health check**: `GET /health` - Returns "OK"
- **Static assets**: `/assets/*` - Serves WASM, JS, and CSS files
- **SPA fallback**: All other routes return `index.html` for client-side routing
- **CORS**: Enabled for development
- **Port**: 3000 (to avoid conflicts with VSCode Live Server)

## Tree Features

### Basic Tree

- Hierarchical data structure
- Expandable and collapsible nodes
- Visual connecting lines
- Keyboard navigation
- Selected state tracking
- Disabled nodes support

### Large Tree (1,000+ nodes)

- Performance test dataset
- Efficient rendering
- Smooth expand/collapse
- Memory-optimized structure
- Ideal for file systems, org charts, etc.

### Virtual Scrolling

- Constant memory usage
- Smooth scrolling performance
- Only renders visible nodes
- 50 categories × 20 items demo
- Best for 1000+ node trees

### Drag & Drop

- Drag nodes within same parent
- Drag nodes between parents
- Visual feedback during drag
- Drop zone highlighting
- Kanban-style task board demo

### Custom Rendering

- Custom icons for node types
- Badges with counts/metadata
- Disabled state styling
- Custom colors and themes
- Action buttons on hover
- Context menu support

## Usage Example

```rust
use hikari_components::{Tree, TreeNodeData};

let tree_data = vec![
    TreeNodeData {
        key: "1".to_string(),
        label: "Project Root".to_string(),
        disabled: false,
        children: Some(vec![
            TreeNodeData {
                key: "1-1".to_string(),
                label: "src".to_string(),
                disabled: false,
                children: Some(vec![
                    TreeNodeData {
                        key: "1-1-1".to_string(),
                        label: "main.rs".to_string(),
                        disabled: false,
                        children: None,
                    },
                ]),
            },
        ]),
    },
];

rsx! {
    Tree {
        data: tree_data,
        default_expanded_keys: vec!["1".to_string()],
        show_line: true,
    }
}
```

## Performance Considerations

### Small Trees (< 100 nodes)

- Use standard tree rendering
- All nodes loaded at once
- Fast expand/collapse

### Medium Trees (100-1,000 nodes)

- Consider virtual scrolling
- Lazy load children
- Good performance with proper optimization

### Large Trees (1,000+ nodes)

- Always use virtual scrolling
- Implement lazy loading
- Consider pagination for children
- Monitor memory usage

## Common Use Cases

- **File Explorer**: Display directory structures
- **Organization Charts**: Company hierarchies
- **Category Navigation**: E-commerce categories
- **Task Trees**: Project management
- **Settings Menus**: Configuration hierarchies

## Technical Details

### Build Process

1. Build Rust library as WASM target (release mode)
2. Use `wasm-bindgen` to generate JavaScript bindings
3. Output to `dist/assets/` directory
4. Serve with Axum web server

### Module Architecture

- `lib.rs`: WASM entry point with panic hook setup
- `main.rs`: Axum server entry point (conditional compilation)
- `app.rs`: Shared application components and logic

This structure allows the same code to run both:
- **In browser**: Compiled to WASM with `dioxus-web`
- **In server**: Axum handles static files and SPA routing

### Conditional Compilation

Server dependencies (tokio, axum, tower-http, etc.) are optional and only compiled when the `server` feature is enabled. This keeps the WASM binary small and focused.

## Development Tips

### Hot Reload

Currently, hot reload is not supported. After making changes:
1. Stop the server (Ctrl+C)
2. Run `just serve` again to rebuild and restart

### Debugging

- Browser DevTools: Use standard browser debugging tools for WASM
- Server logs: Axum uses `tracing` for structured logging
- Health check: `curl http://localhost:3000/health`

### Port Conflicts

If port 3000 is already in use:
1. Edit `src/main.rs`
2. Change the port number: `SocketAddr::from(([127, 0, 0, 1], 3001))`
3. Rebuild with `just build-server`
