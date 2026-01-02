# Node Graph Demo

Interactive node graph demonstration with connections, zoom, pan, and minimap navigation.

## Features

This demo showcases:

- **Interactive Nodes**: Draggable nodes with different types
- **Bezier Connections**: Smooth curved connections between nodes
- **Zoom & Pan**: Navigate large graphs with zoom and pan controls
- **Minimap**: Overview map for navigation
- **Node Types**: Input, Process, Output, Conditional nodes
- **Real-time Updates**: Dynamic graph manipulation

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

## Node Graph Features

### Interactive Canvas

- Click and drag nodes to reposition
- Scroll to zoom in/out
- Pan across the canvas
- Grid background for reference
- Smooth animations

### Node Types

- **Input Nodes** (Green): Data sources, inputs
- **Process Nodes** (Blue): Transformations, operations
- **Output Nodes** (Red): Outputs, results
- **Conditional Nodes** (Orange): Logic, branching

### Connections

- Bezier curve connections
- Directional arrows
- Automatic path calculation
- Visual port indicators
- Connection highlighting

### Controls

- **Zoom In**: Enlarge the view
- **Zoom Out**: Shrink the view
- **Reset View**: Return to default zoom and position
- **Add Node**: Create new process nodes
- **Select Nodes**: Click to select

### Minimap

- Overview of entire graph
- Viewport indicator
- Real-time position tracking
- Scaled representation

## Usage Example

The demo includes a pre-built data pipeline graph:

1. **Data Source** → Filter
2. **Data Source** → Transform
3. **Filter** → Merge
4. **Transform** → Merge
5. **Merge** → Output

This demonstrates:

- Multiple inputs to single nodes
- Branching connections
- Complex data flows
- Pipeline stages

## Keyboard Shortcuts

- **Drag**: Click and hold on nodes
- **Scroll**: Zoom in/out
- **Click**: Select nodes
- **Reset**: Use toolbar button

## Technical Details

### Rendering

- SVG-based rendering
- Hardware acceleration
- 60 FPS animations
- Responsive viewport

### Performance

- Handles 100+ nodes smoothly
- Optimized connection rendering
- Efficient state management
- Minimal memory footprint

## Use Cases

- **Data Pipeline Visualization**: ETL flows
- **Workflow Design**: Process automation
- **Neural Networks**: Node connections
- **Circuit Design**: Component diagrams
- **Org Charts**: Interactive structures
- **Decision Trees**: Logic flows
- **State Machines**: Transition diagrams

## Customization

You can customize:

- Node colors and styles
- Connection styles
- Grid appearance
- Zoom levels
- Port positions
- Node shapes
- Background patterns
