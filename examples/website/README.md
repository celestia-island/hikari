# Hikari Demo App

A comprehensive demonstration of all Hikari UI components.

## Features

This demo showcases:

- **Basic Components**: Button, Input, Card, Badge
- **Feedback Components**: Alert, Toast, Tooltip
- **Navigation Components**: Menu, Tabs, Breadcrumb
- **Data Components**: Table, Tree

## Running the Demo

This demo uses **Axum + WASM** architecture (similar to quotation-sheet-generator).

### Quick Start

```bash
# Build client (WASM) and start Axum server
just serve
```

This will:
1. Build workspace dependencies
2. Build WASM client
3. Start Axum development server at http://localhost:3000

### Manual Build

```bash
# Build WASM client only
just build-client

# Build Axum server only
just build-server

# Build both
just build

# Start server (after build)
just run-server
```

### Architecture

- **Client**: Dioxus WASM compiled to `dist/assets/`
- **Server**: Axum serves static files and handles SPA routing
- **Routes**:
  - `/assets/*` - Static files (WASM, JS, CSS)
  - `/health` - Health check
  - `/*` - SPA fallback (returns `index.html`)

Available commands (see `justfile`):

- `just serve` - Build and run (recommended)
- `just build-client` - Build WASM client
- `just build-server` - Build Axum server
- `just clean` - Clean build artifacts
- `just check` - Run formatting and clippy checks

## Demo Structure

The demo is organized into sections, each demonstrating a different category of components:

### Basic Components

- Buttons in different variants (Primary, Secondary, Ghost, Danger, Success)
- Button sizes (Small, Medium, Large)
- Input fields with various states
- Card components with headers and content
- Badge components in different colors

### Feedback Components

- Alert messages (Info, Success, Warning, Error)
- Toast notifications
- Tooltip components

### Navigation Components

- Menu component with nested items
- Tabs for content organization
- Breadcrumb navigation

### Data Components

- Table with sorting, filtering, and pagination
- Tree component for hierarchical data

## Component Styling

All components use the Hikari design system:

- **Arknights-inspired** clean, flat design
- **FUI elements** with subtle glows and futuristic touches
- **Chinese traditional colors** from the Hikari palette
- **Responsive layouts** that work on all screen sizes

## Sidebar Navigation

Use the sidebar to navigate between different component demos. Each section provides:

- Live component examples
- Usage information
- Feature lists
- Code structure hints
