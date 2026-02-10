# Hikari Development Plan

> **Last Updated**: 2026-02-10
> **Status**: Active

## Overview

This plan tracks critical issues, missing features, and improvements needed for the Hikari project.

---

## Priority 1: Critical Fixes

### 1.1 Node Graph Input Node Output Bug [CRITICAL]

**File**: `packages/extra-components/src/node_graph/plugins/input_node.rs:84-88`

**Issue**: `get_output()` returns `None` - Input nodes don't provide their actual value as output.

**Problem**: This breaks the entire node graph data flow. Input nodes should capture and return their current DOM value.

**Fix**:
```rust
// Current (broken):
fn get_output(&self) -> Option<serde_json::Value> {
    None  // ❌ Always returns None
}

// Should be:
fn get_output(&self) -> Option<serde_json::Value> {
    self.get_current_value()  // ✅ Return actual input value
}
```

**Action**: Implement DOM value capture and return as `serde_json::Value`.

---

### 1.2 Transfer Component Sorting Bug [HIGH]

**File**: `packages/components/src/entry/transfer.rs:145-151`

**Issue**: Sorting algorithm uses original data position instead of sorted order.

**Problem**: When items are sorted (e.g., alphabetically), the transfer operation doesn't preserve the visual order.

**Fix**: Track original positions separately or use stable sort.

---

### 1.3 Table Component Missing CSS Class [MEDIUM]

**File**: `packages/components/src/data/table.rs:146`

**Issue**: Missing `.as_class()` call on `TableClass::TableWrapper`.

**Current**:
```rust
div { class: "table-wrapper", ... }  // ❌ String literal
```

**Should be**:
```rust
div { class: "{TableClass::TableWrapper.as_class()}", ... }  // ✅ Proper class
```

---

## Priority 2: Missing Features

### 2.1 Table Sorting Implementation [HIGH]

**File**: `packages/components/src/data/table.rs`

**Issue**: Table has sortable column classes but no actual sorting logic.

**Requirements**:
- Sort by column on header click
- Show sort indicator icon
- Toggle between ascending/descending
- Preserve sort state

**Implementation**:
```rust
pub struct TableProps {
    // ... existing props

    /// Current sort column
    #[props(default)]
    pub sort_column: Option<String>,

    /// Current sort direction
    #[props(default)]
    pub sort_direction: SortDirection,
}

pub enum SortDirection {
    Ascending,
    Descending,
}
```

---

### 2.2 Table Filter Integration [MEDIUM]

**File**: `packages/components/src/data/filter.rs` + `table.rs`

**Issue**: Filter module exists but not integrated with main table component.

**Action**: Wire up filter dropdown to table data display.

---

### 2.3 Draggable and Collapsible Wrappers for Card [MEDIUM]

**Context**: `DragLayer` and `Collapsible` components exist in `extra-components`.

**Action**: Create wrapper components that integrate with `Card`:

```rust
// Example usage:
DraggableCard {
    Card {
        CardHeader { title: Some("Draggable Card".to_string()) }
        CardContent { ... }
    }
}

CollapsibleCard {
    Card {
        CardHeader { title: Some("Collapsible Card".to_string()) }
        CardContent { ... }
    }
}
```

**Files to create**:
- `packages/extra-components/src/extra/draggable_card.rs`
- `packages/extra-components/src/extra/collapsible_card.rs`

---

## Priority 3: Performance Optimizations

### 3.1 Background Animation DOM Queries [HIGH]

**File**: `packages/components/src/basic/background.rs:120-195`

**Issue**: DOM queries in every animation frame (60fps).

**Problem**: `document().get_element_by_id()` called repeatedly causes performance bottleneck.

**Fix**: Cache DOM elements and only update when theme changes:

```rust
// Cache element reference
let element_ref = use_signal(|| None);
let cached_element = use_coroutine(|_, rx| async move {
    // Query once and cache
});

// Only re-query on theme change
use_effect(move |theme| {
    // Update cache when theme changes
});
```

---

### 3.2 Transfer Component Clone Optimization [MEDIUM]

**File**: `packages/components/src/entry/transfer.rs:319-327`

**Issue**: Complex cloning in render loop.

**Fix**: Use memoization or move semantics instead of clones.

---

## Priority 4: Type Safety Improvements

### 4.1 Replace Dynamic Types in Node Graph [MEDIUM]

**Files**: Multiple node graph plugin files

**Issue**: Heavy use of `serde_json::Value` loses type safety.

**Problem**: Runtime type errors possible, no compile-time checking.

**Action**: Define strongly-typed interfaces for node data exchange:

```rust
// Instead of:
fn process(&self, input: serde_json::Value) -> serde_json::Value

// Use:
fn process(&self, input: &NodeData) -> NodeData

trait NodeData: Clone + PartialEq + Debug {
    fn as_value(&self) -> serde_json::Value;
    fn from_value(value: serde_json::Value) -> Result<Self, Error>;
}
```

---

## Priority 5: Code Quality

### 5.1 Rich Text Editor Non-WASM Implementation [HIGH]

**File**: `packages/extra-components/src/extra/rich_text_editor.rs:121-126`

**Issue**: Formatting functions are no-ops on non-WASM targets.

**Current**:
```rust
#[cfg(not(target_arch = "wasm32"))]
fn format_command(&self, _command: &str, _value: Option<&str>) {
    // Does nothing silently  // ❌
}
```

**Should be**:
```rust
#[cfg(not(target_arch = "wasm32"))]
fn format_command(&self, _command: &str, _value: Option<&str>) {
    panic!("Rich text editor only works on WASM target. Enable target_arch = \"wasm32\" in build configuration.");
}
```

---

### 5.2 Duplicate Class Building Pattern [MEDIUM]

**Issue**: Repetitive `ClassesBuilder` patterns across components.

**Action**: Create reusable utility functions:

```rust
// packages/components/src/utils/class_helpers.rs
pub fn flex_row() -> String {
    ClassesBuilder::new()
        .add(Display::Flex)
        .add(FlexDirection::Row)
        .build()
}
```

---

## Priority 6: Documentation & Examples

### 6.1 Update Theme Name in Lib Docs [LOW]

**File**: `packages/components/src/lib.rs:69`

**Issue**: Docstring shows `"arknights"` theme but code uses `"hikari"`.

**Fix**: Update documentation to use correct theme names.

---

### 6.2 Missing Component Examples

**Issue**: Some components lack usage examples in demo site.

**Action**: Add examples for:
- `DragLayer` + `Card` integration
- `Collapsible` + `Card` integration
- `Table` with sorting
- `Table` with filtering

---

## Implementation Order

1. **Week 1**: Critical fixes (1.1, 1.2, 1.3)
2. **Week 2**: Missing features (2.1, 2.2, 2.3)
3. **Week 3**: Performance (3.1, 3.2)
4. **Week 4**: Type safety (4.1)
5. **Week 5**: Code quality (5.1, 5.2)
6. **Week 6**: Documentation (6.1, 6.2)

---

## Success Criteria

Each task must meet:
- ✅ No compilation errors
- ✅ No TODO/unimplemented! markers
- ✅ No mock/fake implementations
- ✅ Type-safe (no serde_json::Value where avoidable)
- ✅ Tested with example/demo code
- ✅ Documented with doc comments

---

## Completed Tasks

### ✅ Card Component Modular Redesign (2026-02-10)

- Added `CardHeader`, `CardContent`, `CardActions`, `CardMedia` sub-components
- Fixed transparent background on header/footer
- Updated examples to show composition pattern
- Commit: `8d160a1`

---

## References

- Architecture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Contributing: [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md)
- Design Principles: [CLAUDE.md](CLAUDE.md)
