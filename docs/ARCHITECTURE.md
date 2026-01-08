# Hikari Architecture

This document provides an overview of the Hikari project architecture, including package relationships, design patterns, technology choices, and future roadmap.

## Table of Contents

- [Overview](#overview)
- [Architecture Principles](#architecture-principles)
- [Package Architecture](#package-architecture)
- [Technology Stack](#technology-stack)
- [Design Patterns](#design-patterns)
- [Data Flow](#data-flow)
- [Component Architecture](#component-architecture)
- [Theme System Architecture](#theme-system-architecture)
- [Build and Bundle System](#build-and-bundle-system)
- [Testing Strategy](#testing-strategy)
- [Future Roadmap](#future-roadmap)

## Overview

Hikari is a modular Rust UI framework built around Dioxus, following a workspace-based architecture. The project is organized into several focused packages, each with a specific responsibility:

```
hikari/
├── packages/
│   ├── hikari-palette/          # Foundation: Color system
│   ├── hikari-theme/            # Foundation: Theme management
│   ├── hikari-components/       # UI: Basic components
│   ├── hikari-extra-components/ # UI: Advanced components
│   └── hikari-ssr/              # Server: SSR integration
│
└── examples/                    # Demonstrations
```

### Design Philosophy

Hikari follows three core design principles:

1. **Modularity** - Each package has a single, well-defined responsibility
2. **Composability** - Packages can be used independently or combined
3. **Type Safety** - Leverage Rust's type system for compile-time guarantees

## Architecture Principles

### 1. Separation of Concerns

Each package handles a specific aspect of the framework:

- **hikari-palette**: Color data and palette generation (no UI dependencies)
- **hikari-theme**: Theme management and CSS variables (depends on palette)
- **hikari-components**: UI components (depends on palette and theme)
- **hikari-extra-components**: Advanced components (depends on components)
- **hikari-ssr**: Server-side rendering (no dependencies on other packages)

### 2. Dependency Inversion

Packages depend on abstractions, not concrete implementations:

```
hikari-components
    ↓ depends on
hikari-theme
    ↓ depends on
hikari-palette
```

This creates a clear dependency hierarchy and prevents circular dependencies.

### 3. Library over Framework

Hikari is designed as a library, not a framework:

- No mandatory build steps
- No code generation required
- Use only what you need
- Easy to integrate incrementally

## Package Architecture

### Dependency Graph

```
hikari-ssr (independent)
    │
    │
hikari-palette (foundation)
    │
    ├─────────────┐
    │             │
hikari-theme   hikari-components
    │             │
    └──────┬──────┘
           │
    hikari-extra-components
```

### Package Responsibilities

#### hikari-palette
**Purpose**: Color system foundation

**Responsibilities**:
- Define color data structures
- Provide 500+ traditional Chinese colors
- Generate pre-defined palettes
- Serialize/deserialize colors

**Dependencies**: None (foundation package)

**Exports**:
```rust
pub use colors::*;
pub use palettes::*;
```

#### hikari-theme
**Purpose**: Theme management and CSS generation

**Responsibilities**:
- Theme context provider
- CSS variable definitions
- SCSS mixins and utilities
- Theme switching logic

**Dependencies**:
- `hikari-palette` (for color data)

**Exports**:
```rust
pub use context::*;
pub use provider::*;
```

#### hikari-components
**Purpose**: Basic UI components

**Responsibilities**:
- Basic components (Button, Input, Card, Badge)
- Feedback components (Alert, Toast, Tooltip)
- Navigation components (Menu, Tabs, Breadcrumb)
- Data components (Table, Tree with sub-modules)

**Dependencies**:
- `hikari-palette` (for color types)
- `hikari-theme` (for theming)

**Exports**:
```rust
pub use basic::*;
pub use feedback::*;
pub use navigation::*;
pub use data::*;
```

#### hikari-extra-components
**Purpose**: Advanced UI components

**Responsibilities**:
- Node graph system
- Advanced utilities (DragLayer, Collapsible, ZoomControls)

**Dependencies**:
- `hikari-components` (uses basic components)
- `hikari-theme` (for theming)

**Exports**:
```rust
pub use extra::*;
pub use node_graph::*;
```

#### hikari-ssr
**Purpose**: Server-side rendering integration

**Responsibilities**:
- SSR plugin builder
- Router construction
- Static asset serving
- State management

**Dependencies**: None (independent package)

**Exports**:
```rust
pub use plugin::HikariSsrPlugin;
pub use router::build_router;
pub use static_files::*;
```

## Technology Stack

### Frontend

- **Dioxus 0.7**: React-like UI framework for Rust
  - Virtual DOM
  - Component-based architecture
  - Hooks for state management
  - WebAssembly compilation

- **wasm-bindgen**: JavaScript interoperability
  - Bridge between Rust and JavaScript
  - Browser API access

### Styling

- **Grass**: SCSS compiler for Rust
  - Compile SCSS to CSS at build time
  - Full SCSS feature support
  - Fast compilation

- **SCSS**: Stylesheet language
  - Variables and mixins
  - Nesting and inheritance
  - Functions and operations

### Server

- **Axum 0.8**: Web framework
  - Tower-based middleware
  - Async handlers
  - Type-safe routing

- **Tokio**: Async runtime
  - Futures executor
  - Networking and I/O

### Build System

- **Cargo**: Rust package manager
  - Workspace support
  - Dependency management
  - Build profiles

- **Just**: Command runner
  - Task automation
  - Build scripts
  - Development workflows

### Tooling

- **Python 3.11+**: Development tooling
  - Code formatting
  - Linting
  - Pre-commit hooks

## Design Patterns

### 1. Builder Pattern

Used extensively for configuration:

```rust
let app = HikariSsrPlugin::new()
    .static_assets("./dist")
    .add_route("/api/health", get(health))
    .state("app_name", "Hikari App")
    .build()?;
```

**Benefits**:
- Fluent API
- Optional parameters
- Clear configuration flow
- Type-safe

### 2. Component Pattern

Dioxus components follow React-like patterns:

```rust
#[component]
fn Button(props: ButtonProps) -> Element {
    rsx! {
        button { class: "{props.class}", {props.children} }
    }
}
```

**Benefits**:
- Reusable UI elements
- Composable
- Props-based configuration
- Clear lifecycle

### 3. Context Pattern

Theme and state management:

```rust
rsx! {
    ThemeProvider { palette: "arknights".to_string(),
        // All children have access to theme
        Button { "Themed Button" }
    }
}
```

**Benefits**:
- Global state sharing
- Avoid prop drilling
- Dynamic updates
- Type-safe access

### 4. Module Pattern

Component organization:

```
data/
├── mod.rs          # Public exports
├── table.rs        # Core table
├── column.rs       # Column module
├── cell.rs         # Cell module
├── header.rs       # Header module
├── pagination.rs   # Pagination module
├── sort.rs         # Sorting module
├── filter.rs       # Filtering module
└── selection.rs    # Selection module
```

**Benefits**:
- Clear separation
- Easy to navigate
- Encapsulated functionality
- Testable modules

### 5. Provider Pattern

Theme provision to component tree:

```rust
#[component]
pub fn ThemeProvider(props: ThemeProviderProps) -> Element {
    rsx! {
        div {
            "data-theme": "{props.palette}",
            {props.children}
        }
    }
}
```

**Benefits**:
- Centralized configuration
- Automatic propagation
- Easy theme switching
- No manual prop passing

## Data Flow

### Component Data Flow

```
User Interaction
       ↓
   Event Handler
       ↓
  State Update
       ↓
  Re-render
       ↓
   DOM Update
```

### Theme Data Flow

```
ThemeProvider
       ↓
  CSS Variables
       ↓
  Component Styles
       ↓
  Visual Output
```

### SSR Data Flow

```
HTTP Request
       ↓
   Axum Router
       ↓
   Handler
       ↓
  State Access
       ↓
HTTP Response
```

## Component Architecture

### Component Hierarchy

```
ThemeProvider (root)
    │
    ├─ App
    │   ├─ Layout
    │   │   ├─ Header
    │   │   ├─ Sidebar
    │   │   └─ Content
    │   │       ├─ Table
    │   │       ├─ Tree
    │   │       └─ NodeGraph
    │   └─ Footer
    │
    └─ ToastContainer
```

### Component Lifecycle

1. **Mount**: Component is created and added to DOM
2. **Update**: Props or state change triggers re-render
3. **UnMount**: Component is removed from DOM

### State Management

- **Local State**: `use_signal` for component-local state
- **Shared State**: Context providers for global state
- **Server State**: Axum state for SSR applications

## Theme System Architecture

### Theme Structure

```
Theme (ThemeProvider)
    │
    ├─ Palette (hikari-palette)
    │   ├─ Primary Color
    │   ├─ Secondary Color
    │   ├─ Accent Color
    │   └─ Functional Colors
    │
    ├─ CSS Variables
    │   ├─ Color Variables
    │   ├─ Typography Variables
    │   ├─ Spacing Variables
    │   └─ Effect Variables
    │
    └─ SCSS Mixins
        ├─ Layout Mixins
        ├─ Typography Mixins
        └─ Component Mixins
```

### Theme Application

1. **Rust Side**: ThemeProvider sets `data-theme` attribute
2. **CSS Side**: CSS variables scoped to `[data-theme="..."]`
3. **Component Side**: Components use CSS variables

## Build and Bundle System

### Cargo Workspace

```toml
[workspace]
members = [
    "packages/hikari-palette",
    "packages/hikari-theme",
    "packages/hikari-components",
    "packages/hikari-extra-components",
    "packages/hikari-ssr",
]
```

**Benefits**:
- Shared dependencies
- Unified compilation
- Easy inter-package development
- Consistent versioning

### Build Profiles

```toml
[profile.release]
opt-level = 3
lto = true
codegen-units = 1
strip = true
```

**Benefits**:
- Optimized WASM output
- Small bundle sizes
- Fast runtime performance

### Just Commands

```makefile
build:        # Build all packages
test:         # Run tests
fmt:          # Format code
lint:         # Run linter
dev:          # Start dev server
```

**Benefits**:
- Consistent commands
- Easy to remember
- Cross-platform
- Documented workflows

## Testing Strategy

### Unit Tests

Package-level unit tests:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_color_rgb() {
        assert_eq!(石青.rgb, (23, 89, 168));
    }
}
```

### Integration Tests

Cross-package integration:

```rust
#[tokio::test]
async fn test_theme_provider() {
    // Test theme provider with components
}
```

### Example Tests

Example applications serve as integration tests:

```
examples/
├── website/         # Full integration test
├── table-demo/      # Table component test
├── tree-demo/       # Tree component test
├── node-graph-demo/ # Node graph test
└── ssr-demo/        # SSR integration test
```

## Future Roadmap

### Phase 4: hikari-components (Current)

- [x] Basic components (Button, Input, Card, Badge)
- [x] Feedback components (Alert, Toast, Tooltip)
- [x] Navigation components (Menu, Tabs, Breadcrumb)
- [x] Data components (Table, Tree)
- [ ] Comprehensive component testing
- [ ] Component documentation

### Phase 5: hikari-extra-components

- [ ] Node graph system
- [ ] Advanced utilities
- [ ] Performance optimization
- [ ] Use case examples

### Phase 6: Examples

- [ ] Complete demo-app
- [ ] Individual component demos
- [ ] SSR full example
- [ ] Performance benchmarks

### Phase 7: Documentation

- [ ] API documentation
- [ ] Migration guides
- [ ] Best practices
- [ ] Video tutorials

### Phase 8: Ecosystem

- [ ] CLI tooling
- [] Starter templates
- [ ] VS Code extension
- [ ] Community components

### Long-term Vision

- **Design System**: Complete design system specification
- **Component Library**: 50+ production-ready components
- **Tooling**: Developer tools and debugging
- **Community**: Plugin ecosystem and contribution guidelines
- **Performance**: Best-in-class WASM performance

## Architectural Decisions

### Why Dioxus?

- **Rust Native**: No JavaScript required for logic
- **Type Safety**: Compile-time guarantees
- **Performance**: Efficient virtual DOM
- **WASM**: Native browser support
- **React-like**: Familiar patterns

### Why Axum?

- **Tower**: Ecosystem compatibility
- **Type Safety**: Route and state safety
- **Async**: Modern async/await
- **Performance**: Fast and efficient
- **Ergonomic**: Clean API design

### Why SCSS?

- **Features**: Variables, mixins, nesting
- **Ecosystem**: Large community and tools
- **Compilation**: Fast with Grass
- **Adoption**: Industry standard
- **Maintainability**: Organized styles

### Why Workspace?

- **Monorepo**: Unified development
- **Sharing**: Code reuse between packages
- **Versioning**: Consistent versions
- **CI/CD**: Simplified pipelines
- **Documentation**: Co-located docs

## Performance Considerations

### WASM Optimization

- **LTO**: Link-time optimization enabled
- **Codegen Units**: Single unit for better optimization
- **Strip**: Remove debug symbols
- **Opt-level**: Maximum optimization

### Runtime Performance

- **Virtual DOM**: Efficient updates
- **Signals**: Fine-grained reactivity
- **Lazy Loading**: Component code splitting
- **Caching**: Static asset caching

### Bundle Size

- **Tree Shaking**: Unused code elimination
- **Compression**: Gzip enabled
- **WASM Opt**: Size optimization
- **Minimal Dependencies**: Few external deps

## Security Considerations

### Static Files

- **Path Sanitization**: Prevent directory traversal
- **MIME Types**: Proper content types
- **Cache Headers**: Controlled caching
- **File Limits**: Size restrictions

### SSR

- **State Isolation**: Request-scoped state
- **Error Handling**: Graceful failures
- **Validation**: Input validation
- **Logging**: Audit trails

## Conclusion

Hikari's architecture is designed to be:

- **Modular**: Clear package boundaries
- **Composable**: Use what you need
- **Performant**: Optimized WASM output
- **Type-Safe**: Leverage Rust's type system
- **Maintainable**: Clean code organization
- **Extensible**: Easy to add features

The architecture supports the project's goals of providing a modern, type-safe UI framework that blends traditional Chinese aesthetics with futuristic design elements.
