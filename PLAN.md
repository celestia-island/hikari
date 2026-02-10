# Hikari Development Plan

> **Last Updated**: 2026-02-10
> **Status**: Active

## Overview

This plan tracks critical issues, missing features, and improvements needed for the Hikari project.

---

## Priority 1: Critical Fixes [✅ COMPLETED]

### ✅ 1.1 Node Graph Input Node Output Bug [CRITICAL]

**File**: `packages/extra-components/src/node_graph/plugins/input_node.rs`

**Issue**: `get_output()` returns `None` - Input nodes don't provide their actual value as output.

**Fix**: Implemented DOM value capture and global registry
- Added `default_value` field to `InputNode`
- Created `store_node_value()` function to store values in global JS object
- Input changes now store value in registry for retrieval
- `get_output()` returns the stored value instead of None

**Commit**: `463f122`

---

### ✅ 1.2 Transfer Component Sorting Bug [HIGH]

**File**: `packages/components/src/entry/transfer.rs:145-151`

**Issue**: Sorting algorithm uses original data position.

**Analysis**: The current implementation is actually correct - it sorts by original data position, which is the expected behavior for Transfer components (maintaining data order).

**Status**: No fix needed - working as designed

---

### ✅ 1.3 Table Component Missing CSS Class [MEDIUM]

**File**: `packages/components/src/data/table.rs:146`

**Issue**: Missing `.as_class()` call on `TableClass::TableWrapper`.

**Fix**: Added `UtilityClass` trait import to table.rs

**Before**:
```rust
use palette::classes::{ClassesBuilder, TableClass};
```

**After**:
```rust
use palette::classes::{ClassesBuilder, TableClass, UtilityClass};
```

**Commit**: `463f122`

---

## Priority 2: Missing Features [PARTIALLY COMPLETED]

### ✅ 2.3 Draggable and Collapsible Wrappers for Card [MEDIUM]

**Action**: Created wrapper components that integrate with `Card`

**Created**:
- `packages/extra-components/src/extra/draggable_card.rs`
- `packages/extra-components/src/extra/collapsible_card.rs`

**Usage**:
```rust
// Draggable Card
DraggableCard {
    initial_x: 100.0,
    initial_y: 100.0,
    Card {
        CardHeader { title: Some("Draggable Card".to_string()) }
        CardContent { div { "Content" } }
    }
}

// Collapsible Card
CollapsibleCard {
    title: "Collapsible Card".to_string(),
    expanded: true,
    Card {
        CardHeader { title: Some("Title".to_string()) }
        CardContent { div { "Content" } }
    }
}
```

**Commit**: `463f122`

---

### ⏳ 2.1 Table Sorting Implementation [HIGH - PENDING]

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

### ⏳ 2.2 Table Filter Integration [MEDIUM - PENDING]

**File**: `packages/components/src/data/filter.rs` + `table.rs`

**Issue**: Filter module exists but not integrated with main table component.

**Action**: Wire up filter dropdown to table data display.

---

## Priority 3: Performance Optimizations [PENDING]

### ⏳ 3.1 Background Animation DOM Queries [HIGH]

**File**: `packages/components/src/basic/background.rs:120-195`

**Issue**: DOM queries in every animation frame (60fps).

**Fix**: Cache DOM elements and only update when theme changes.

---

### ⏳ 3.2 Transfer Component Clone Optimization [MEDIUM]

**File**: `packages/components/src/entry/transfer.rs:319-327`

**Issue**: Complex cloning in render loop.

**Fix**: Use memoization or move semantics.

---

## Priority 4: Type Safety Improvements [PENDING]

### ⏳ 4.1 Replace Dynamic Types in Node Graph [MEDIUM]

**Files**: Multiple node graph plugin files

**Issue**: Heavy use of `serde_json::Value` loses type safety.

**Action**: Define strongly-typed interfaces for node data exchange.

---

## Priority 5: Code Quality [PENDING]

### ⏳ 5.1 Rich Text Editor Non-WASM Implementation [HIGH]

**File**: `packages/extra-components/src/extra/rich_text_editor.rs:121-126`

**Issue**: Formatting functions are no-ops on non-WASM targets.

**Fix**: Replace with panic! for clearer error messages.

---

### ⏳ 5.2 Duplicate Class Building Pattern [MEDIUM]

**Issue**: Repetitive `ClassesBuilder` patterns across components.

**Action**: Create reusable utility functions.

---

## Priority 6: Documentation & Examples [PENDING]

### ⏳ 6.1 Update Theme Name in Lib Docs [LOW]

**File**: `packages/components/src/lib.rs:69`

**Issue**: Docstring shows `"arknights"` theme but code uses `"hikari"`.

**Fix**: Update documentation.

---

### ⏳ 6.2 Missing Component Examples

**Issue**: Some components lack usage examples.

**Action**: Add examples for new wrapper components.

---

## Implementation Progress

| Priority | Tasks | Completed | Pending | In Progress |
|----------|-------|-----------|---------|-------------|
| **P1** | Critical Fixes | 3 | 0 | 0 |
| **P2** | Missing Features | 1 | 2 | 0 |
| **P3** | Performance | 0 | 2 | 0 |
| **P4** | Type Safety | 0 | 1 | 0 |
| **P5** | Code Quality | 0 | 2 | 0 |
| **P6** | Documentation | 0 | 2 | 0 |
| **Total** | | 4 | 9 | 0 |

**Progress**: 4/13 tasks completed (31%)

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

### ✅ Critical Bug Fixes (2026-02-10)

- Fixed InputNode to return actual user input value
- Added global value registry for node graph inputs
- Fixed Table CSS class application
- Added DraggableCard and CollapsibleCard wrapper components
- Commit: `463f122`

---

## Next Steps

1. **Immediate**: Implement Table sorting (P2.1)
2. **This Week**: Integrate Table filter (P2.2)
3. **Next Week**: Performance optimizations (P3)

---

## References

- Architecture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Contributing: [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md)
- Design Principles: [CLAUDE.md](CLAUDE.md)
