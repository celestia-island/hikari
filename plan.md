# Hikari Development & Maintenance Plan

## Overview

This plan tracks ongoing development, maintenance, and technical debt for the Hikari component library.

---

## Current Status

### Completed
- Type-safe CSS class refactoring (all components now use `UtilityClass` enums)
- Layer 1 & Layer 2 components implementation
- Chinese traditional color palette system
- Animation infrastructure (`AnimationBuilder`)
- **CodeHighlight clipboard fix** (2026-02-12) - Fixed button flickering and implemented real clipboard functionality

### Architecture
```
+------------------------------------------------------------------+
|                      Layer 3: Production Components               |
|  (Video Player, Rich Text Editor, Code Highlighting, Timeline)   |
|                            | depends on                           |
+------------------------------------------------------------------+
|                      Layer 2: Composite Components                |
|       (Menu, Tabs, Table, Tree, Form, Dropdown, Modal)           |
|                            | depends on                           |
+------------------------------------------------------------------+
|                       Layer 1: Basic Components                   |
|        (Button, Input, Card, Badge, Alert, Toast, etc.)          |
+------------------------------------------------------------------+
```

---

## Phase 1: Technical Debt & Maintenance

### 1.1 Empty/Stub Files

| File | Status | Action |
|------|--------|--------|
| `packages/components/src/data/header.rs` | Empty (1 byte) | ✅ Removed (commit a7cc059) |

### 1.2 Hardcoded Configuration Values ✅

Evaluated - All values are properly encapsulated:

| Location | Value | Status |
|----------|-------|--------|
| Responsive breakpoints | `Breakpoint` enum in `hooks.rs` with proper methods | ✅ Well-designed |
| Animation timings | User-configurable via props | ✅ Acceptable |
| Drawer sizes | Internal component constants | ✅ Acceptable |

### 1.3 Dynamic Typing Patterns (Acceptable)

The following `Box<dyn FnMut>` patterns are **intentional and correct** for WASM/JavaScript interop:

| File | Usage | Status |
|------|-------|--------|
| `scrollbar_container.rs` | JS event closures | Acceptable |
| `animation/builder.rs` | Animation callbacks | Acceptable |
| `hooks.rs` | Event listeners | Acceptable |

These are necessary for WASM bindings and don't represent technical debt.

---

## Phase 2: Layer 2 Component Completion ✅

### Missing Components (per layer-component-plan.md)

| Component | Priority | Dependencies | Status |
|-----------|----------|--------------|--------|
| Calendar | Medium | Button, Input, Card | ✅ Completed (2026-02-12) |
| Carousel | Low | Button, Card | Exists in `display/` |
| Collapse | Medium | Button, Card | Exists in `data/` |
| Stepper | Low | Button, Badge | Exists in `navigation/` |
| Timeline | Low | Card, Badge | ✅ Completed (2026-02-12) |
| Upload | Medium | Button, Progress | Exists as FileUpload in `basic/` |

---

## Phase 3: Layer 3 Production Components ✅

### High Priority

| Component | Description | Complexity | Dependencies | Status |
|-----------|-------------|------------|--------------|--------|
| **Code Highlighting** | Syntax highlighting, line numbers, themes | Medium | Card, Tabs, Form | ✅ Completed (2026-02-12), Fixed clipboard (2026-02-12) |
| **Video Player** | Playback controls, subtitles, playlist | High | Card, Button, Form, Menu | ✅ Completed (2026-02-12) |
| **Rich Text Editor** | WYSIWYG/Markdown, plugins | High | Form, Dropdown, Modal, Toolbar | ✅ Completed (2026-02-12) |

### Medium Priority

| Component | Description | Complexity | Dependencies | Status |
|-----------|-------------|------------|--------------|--------|
| **Timeline** | Event timeline, milestones | Medium | Card, Badge, Collapse | ✅ Completed (2026-02-12) |
| **User Guide** | Onboarding tours, feature hints | Medium | Modal, Button, Badge | Not started |

### Low Priority

| Component | Description | Complexity | Dependencies |
|-----------|-------------|------------|--------------|
| **Data Visualization** | Charts, dashboards | High | Card, Tabs, Form |
| **Code Editor** | Full IDE-like editing | High | Card, Tabs, Form, Menu |
| **Instant Messaging** | Chat UI, messages | High | Card, Form, Menu, Badge |

---

## Implementation Sequence

```mermaid
flowchart TD
    subgraph Phase1["Phase 1: Technical Debt"]
        A1[Remove empty header.rs]
        A2[Extract config constants]
    end

    subgraph Phase2["Phase 2: Layer 2 Completion"]
        B1[Calendar component]
        B2[Timeline component]
    end

    subgraph Phase3["Phase 3: Layer 3 Production"]
        C1[Code Highlighting]
        C2[Video Player]
        C3[Rich Text Editor]
    end

    A1 --> A2
    A2 --> B1
    B1 --> B2
    B2 --> C1
    C1 --> C2
    C2 --> C3

    classDef done fill:#90EE90,stroke:#006400,stroke-width:2px
    class A1,A2 done
```

---

## Notes

### Design Principles
1. **Progressive Enhancement** - Build from simple to complex
2. **Composition over Inheritance** - Compose Layer 3 from Layer 2, Layer 2 from Layer 1
3. **Single Responsibility** - Each component does one thing well
4. **Type Safety** - All CSS classes use `UtilityClass` enums

### Conventions
- Component class enums: `{ComponentName}Class` derives `Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize`
- Use `ClassesBuilder` pattern for composing classes
- Keep `.add_raw()` only for user-provided custom classes

---

## Historical: Type-Safe Refactoring (Completed)

The following enums were added during the refactoring to replace raw string literals:

| Phase | Enums Added |
|-------|-------------|
| 1 | `SwitchClass`, `SliderClass`, `SelectClass`, `DatePickerClass`, `FileUploadClass`, `FormFieldClass`, `DividerClass` |
| 2 | `AutoCompleteClass`, `CascaderClass`, `NumberInputClass`, `SearchClass`, `TransferClass` |
| 3 | `SpaceClass` (extended: `BadgeClass`, `ContainerClass`, `GlowClass`, `MenuClass`) |
| 4 | `TagClass`, `DescriptionListClass`, `EmptyClass`, `QRCodeClass` |
| 5 | `AppLayoutClass` |
| 6 | `DrawerClass`, `PopoverClass`, `ProgressClass`, `SkeletonClass`, `SpinClass` |
| 7 | `AnchorClass`, `StepsClass` |
