# Table Component Demo

Advanced table component demonstration with sorting, filtering, pagination, selection, and editing capabilities.

## Architecture

This demo uses the **Axum + WASM** architecture:
- **Frontend**: Dioxus 0.7 (compiled to WebAssembly)
- **Server**: Axum web framework (Rust)
- **Static Assets**: Served from `dist/assets/`
- **Port**: 3000 (to avoid VSCode conflicts)

## Features

This demo showcases:

- **Basic Table**: Simple table with bordered, striped, and hoverable styles
- **Sortable Table**: Click column headers to sort data
- **Filterable Table**: Real-time search across all columns
- **Pagination**: Navigate through large datasets efficiently
- **Selection**: Select single or multiple rows
- **Editable**: Double-click cells to edit content

## Running the Demo

### Recommended: One-Click Start

```bash
# From this directory
just serve
```

This will:
1. Build the WASM client
2. Start the Axum development server
3. Open at `http://localhost:3000`

### Manual Steps

```bash
# 1. Build WASM client
just build-client

# 2. Run server
cargo run --bin table-demo --features server
```

### Build Commands

- `just serve` - Build client and run server (recommended)
- `just build-client` - Build WASM only
- `just build-server` - Build Axum server binary
- `just clean` - Clean build artifacts
- `just clean-all` - Clean everything including dist/
- `just fmt` - Format code
- `just check` - Run formatting and clippy checks
- `just test` - Run tests

## Table Features

### Basic Table

- Bordered cells for clarity
- Striped rows for better readability
- Hover effect on rows
- Column alignment (left, center, right)
- Custom column widths

### Sortable Table

- Click any column header to sort
- Click again to reverse the sort order
- Visual indicator showing sorted column
- Works with text, numbers, and dates

### Filterable Table

- Real-time search across all columns
- Case-insensitive matching
- Shows matching row count
- Clear filter button

### Paginated Table

- Configurable page size
- Page number navigation
- Previous/Next buttons
- Total row counter
- Ideal for 100+ row datasets

### Selectable Table

- Click rows to select
- Multi-selection support
- Clear selection button
- Selection count display

### Editable Table

- Double-click cells to edit
- Inline input for editing
- Save on blur
- Live data state preview

## Usage Example

```rust
use hikari_components::{Table, ColumnDef, Align};

let columns = vec![
    ColumnDef::new("name", "Name")
        .sortable(true)
        .width("200px"),
    ColumnDef::new("age", "Age")
        .align(Align::Center)
        .width("100px"),
];

let data = vec![
    vec!["Alice".to_string(), "30".to_string()],
    vec!["Bob".to_string(), "25".to_string()],
];

rsx! {
    Table {
        columns: columns,
        data: data,
        bordered: true,
        striped: true,
        hoverable: true,
    }
}
```

## Architecture Details

### Project Structure

```
table-demo/
 ├── src/
 │   ├── lib.rs       # WASM entry point
 │   ├── app.rs       # Application logic (Dioxus components)
 │   └── main.rs      # Axum server (conditional compilation)
 ├── dist/
 │   ├── index.html   # HTML shell
 │   └── assets/      # WASM, JS, CSS files
 ├── Cargo.toml       # Dependencies with feature flags
 └── justfile         # Build recipes
```

### Conditional Compilation

- **Server dependencies** (tokio, axum, tower-http, etc.) are optional
- Enabled with `--features server`
- Binary target requires `server` feature
- WASM target compiles independently

### Server Endpoints

- `GET /` - SPA fallback (serves index.html)
- `GET /health` - Health check
- `GET /assets/*` - Static files (WASM, JS, CSS)

## Performance

The table component efficiently handles:

- Up to 1,000 rows without pagination
- 10,000+ rows with pagination
- Real-time filtering and sorting
- Smooth animations and transitions
