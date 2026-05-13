# Hikari Build Scripts

This directory contains modularized build scripts for the Hikari project.

## Structure

```
scripts/
├── theme.just          # Theme module build tasks
├── icons.just          # Icons module build tasks
├── palette.just        # Palette module build tasks
├── theme/             # Theme-related Python scripts
│   └── fetch_tailwindcss.py
├── icons/             # Icons-related Python scripts
│   ├── fetch_lucide_icons.py
│   ├── generate_lucide_icons.py
│   └── build_lucide_assets.py
└── palette/           # Palette-related Python scripts
    └── generate_palette.py
```

## Usage

### Root Level Commands

From the project root directory:

```bash
# Generate all static assets
just generate-all

# Generate specific module
just generate-palette
just generate-tailwind
just generate-lucide

# Build with generated assets
just build-generated

# Access module-specific commands
just theme <command>
just icons <command>
just palette <command>
```

### Module-Specific Commands

#### Theme Module

```bash
just theme fetch         # Fetch Tailwind CSS from CDN
just theme build         # Build theme package
just theme rebuild       # Rebuild theme from scratch
just theme test         # Run theme tests
just theme status       # Show theme build status
```

#### Icons Module

```bash
just icons fetch         # Fetch Lucide icons from GitHub
just icons build         # Build icons package
just icons rebuild       # Rebuild icons from scratch
just icons test         # Run icons tests
just icons status       # Show icons build status
just icons list        # List available icons
```

#### Palette Module

```bash
just palette generate    # Generate Chinese color palette
just palette fetch      # Alias for generate
just palette build      # Build palette package
just palette test      # Run palette tests
just palette status    # Show palette build status
just palette popular   # Show popular Chinese colors
just palette categories # Show color categories
```

### Direct Module Execution

You can also execute module-specific justfiles directly:

```bash
# Using just with specific justfile
just --justfile scripts/theme.just fetch
just --justfile scripts/icons.just fetch
just --justfile scripts/palette.just generate
```

## Module Documentation

### Theme Module

- **Purpose**: Fetch and integrate Tailwind CSS
- **Input**: Tailwind CSS CDN
- **Output**: `packages/theme/src/generated/tailwind.rs`
- **Script**: `scripts/theme/fetch_tailwindcss.py`

### Icons Module

- **Purpose**: Download and integrate Lucide Icons
- **Input**: Lucide Icons GitHub repository
- **Output**: `packages/icons/src/generated/lucide.rs`
- **Scripts**:
  - `scripts/icons/fetch_lucide_icons.py` (recommended)
  - `scripts/icons/generate_lucide_icons.py` (legacy)
  - `scripts/icons/build_lucide_assets.py` (legacy)

### Palette Module

- **Purpose**: Generate Chinese color palette from data source
- **Input**: Chinese colors data
- **Output**: `packages/palette/src/colors.rs`
- **Script**: `scripts/palette/generate_palette.py`

## Development

### Adding New Scripts

1. Choose the appropriate module folder (`theme/`, `icons/`, or `palette/`)
2. Add your Python script
3. Update the corresponding `*.just` file
4. Test with `just <module> <command>`

### Adding New Modules

1. Create a new folder: `scripts/<module>/`
2. Add Python scripts to the folder
3. Create `scripts/<module>.just` with build tasks
4. Update root `justfile` to include the new module

## Dependencies

- Python 3.11+
- `requests` library (install with `pip install requests`)
- Rust toolchain (for cargo build commands)
- Just (build runner)

## Troubleshooting

### Script Permissions

On Linux/macOS, ensure scripts are executable:
```bash
chmod +x scripts/*/*.py
```

### Missing Dependencies

Install Python dependencies:
```bash
pip install requests
```

### Just Version

Ensure you have just installed:
```bash
cargo install just
```

## See Also

- [Root justfile](../justfile) - Main project build tasks
- [CLAUDE.md](../CLAUDE.md) - Project documentation
