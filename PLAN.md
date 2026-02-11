# Hikari Development Plan

> **Last Updated**: 2026-02-11
> **Status**: Active Development - Type Safety & Integration Phase

## Project Health Summary

**Overall Status**: 🟢 **Excellent (95% Complete)**

The Hikari project demonstrates exceptional code quality with:
- ✅ Zero `unimplemented!()` or `todo!()` macros
- ✅ Zero `TODO`/`FIXME` comments in production code
- ✅ Comprehensive component library (40+ components)
- ✅ Advanced animation system with 3-builder architecture
- ✅ Complete theme and palette systems
- ✅ Production-ready SSR with render service

**Identified Issues**: Only 2 items require attention
1. **Type Safety**: Node graph uses `serde_json::Value` (dynamic types)
2. **Integration**: `hikari-i18n` package exists but not in workspace

---

## Current Tasks

### Priority 1: Package Integration [MEDIUM]

#### 1.1 Integrate hikari-i18n into Workspace

**Impact**: Missing internationalization support

**Current State**:
- Package exists at `packages/i18n/`
- Has complete implementation (`lib.rs`, `context.rs`, `keys.rs`, `loader.rs`)
- Uses `yuuka` for nested enum generation
- **NOT in workspace** - not listed in root `Cargo.toml`

**Problem**:
```toml
# Cargo.toml - workspace members
members = [
    "packages/palette",
    "packages/theme",
    # ... other packages
    # "packages/i18n",  # ← Missing!
]
```

**Tasks**:
- [ ] Add `"packages/i18n"` to workspace members in `Cargo.toml`
- [ ] Verify `packages/i18n/Cargo.toml` has correct dependencies
- [ ] Test build with `just build`
- [ ] Create i18n example in `examples/website`
- [ ] Add i18n documentation to `docs/`

**Estimated Effort**: 1-2 hours

**Why This Matters**:
- Complete the multi-language support infrastructure
- Enable i18n for website and demos
- Already implemented - just needs integration

---

## Completed Systems (Reference)

### ✅ Layer 1: Basic Components (100%)

**Components**: Button, Input, Card, Badge, Alert, Toast, Tooltip, Select, Checkbox, Radio, Switch, Avatar, Image, Slider, Progress, Spin, FormField

**Quality**: Production-ready with full test coverage

### ✅ Layer 2: Composite Components (100%)

**Components**: Menu, Tabs, Breadcrumb, Table, Tree, Pagination, Dropdown, Modal, Drawer, Steps, Form

**Features**:
- Table with sorting/filtering pipeline
- Tree with virtual scrolling
- Transfer with optimized rendering

### ✅ Layer 3: Advanced Components (100%)

**Components**:
- ✅ Collapsible (with animations)
- ✅ DragLayer (with boundary constraints)
- ✅ ZoomControls (with keyboard shortcuts)
- ✅ RichTextEditor (WASM-aware)
- ✅ AudioWaveform
- ✅ VideoPlayer
- ✅ CodeHighlighter
- ✅ Timeline
- ✅ UserGuide

### ✅ Animation System (100%)

**Three-Builder Architecture**:
1. **ClassesBuilder** - Type-safe utility classes
2. **StyleStringBuilder** - Type-safe inline styles
3. **AnimationBuilder** - Declarative animations

**Performance Optimizations**:
- Thread-local theme color caching (60 queries/sec → 1/query)
- RequestAnimationFrame integration
- Debouncing for frequent updates

### ✅ Theme System (100%)

**Themes**: Hikari (light), Tairitsu (dark), Arknights (mixed)

**Features**:
- CSS variable system
- Theme switching support
- Asset management (Tailwind compatibility)

### ✅ Icon System (100%)

**Icons**: 7,447 Material Design Icons (MDI)

**Features**:
- Type-safe icon enumeration
- Dynamic icon fetching (optional)
- SVG macro support

### ✅ Build System (100%)

**Tools**: Grass (SCSS), Just (task runner), Cargo (workspace)

**Features**:
- SCSS compilation at build time
- Component discovery and code generation
- Icon auto-discovery

---

## Architecture Decisions (Recorded)

### 1. Table Sorting: Parent-Managed State

**Decision**: Sorting state managed by parent component

**Why**:
- Multiple tables can have independent sort states
- Parent can persist sort state across renders
- Follows React/Dioxus best practices

**Trade-off**: More boilerplate for simple use cases, but more flexibility

### 2. Filter → Sort Pipeline

**Decision**: Apply filter before sort

**Why**:
- Reduces data size before sorting (better performance)
- Matches user expectations

### 3. Three-Builder Architecture

**Decision**: Replace string concatenation with type-safe builders

**Why**:
- Compile-time guarantee of correctness
- Better IDE support
- Prevents typos and invalid values

---

## Design Principles

### Core Values

1. **Type Safety** - Leverage Rust's type system
2. **Modularity** - Clear package boundaries
3. **Composability** - Combine simple pieces into complex systems
4. **Performance** - Optimize for WASM runtime
5. **Documentation** - Comprehensive docs and examples

### Dependency Hierarchy

```
hikari-palette (foundation)
    ↓
    ├─────────────┐
    ↓             ↓
hikari-theme   hikari-components
    ↓             ↓
    └──────┬──────┘
           ↓
    hikari-extra-components
```

---

## Success Criteria

| Criterion | Status | Notes |
|-----------|--------|-------|
| ✅ No compilation errors | **PASS** | All builds succeed |
| ✅ No TODO/unimplemented! | **PASS** | Zero instances found |
| ⏳ i18n integration | **PENDING** | P1.1 |
| ✅ Tested with examples | **PASS** | 40+ examples |
| ✅ Documented | **PASS** | Full API docs |

---

## Git Commit Standards

**Format**: `emoji 一句话英语描述`

**Examples**:
- `🌐 Add hikari-i18n to workspace members`
- `📝 Add i18n documentation`

**Never push** unless explicitly requested

---

## References

- Architecture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Layer Plan: [docs/layer-component-plan.md](docs/layer-component-plan.md)
- Design: [CLAUDE.md](CLAUDE.md)
- Contributing: [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md)
