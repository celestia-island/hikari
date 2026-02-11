# Refactor Plan: Replace `add_raw` with Type-Safe UtilityClass Enums

## Overview

This plan tracks the refactoring of all components in `hikari-components` to use type-safe `UtilityClass` enums instead of raw string literals with `add_raw()`.

## Status: ✅ COMPLETED

All phases have been successfully completed. The codebase now uses type-safe enums for CSS class management.

---

## Summary of Changes

### New Enums Added

| Phase | Enum | Component |
|-------|------|-----------|
| 1 | `SwitchClass` | Switch |
| 1 | `SliderClass` | Slider |
| 1 | `SelectClass` | Select |
| 1 | `DatePickerClass` | DatePicker |
| 1 | `FileUploadClass` | FileUpload |
| 1 | `FormFieldClass` | FormField |
| 1 | `DividerClass` | Divider |
| 2 | `AutoCompleteClass` | AutoComplete |
| 2 | `CascaderClass` | Cascader |
| 2 | `NumberInputClass` | NumberInput |
| 2 | `SearchClass` | Search |
| 2 | `TransferClass` | Transfer |
| 3 | `SpaceClass` | Space |
| 4 | `TagClass` | Tag |
| 4 | `DescriptionListClass` | DescriptionList |
| 4 | `EmptyClass` | Empty |
| 4 | `QRCodeClass` | QRCode |
| 5 | `AppLayoutClass` | Layout |
| 6 | `DrawerClass` | Drawer |
| 6 | `PopoverClass` | Popover |
| 6 | `ProgressClass` | Progress |
| 6 | `SkeletonClass` | Skeleton |
| 6 | `SpinClass` | Spin |
| 7 | `AnchorClass` | Anchor |
| 7 | `StepsClass` | Steps |

### Extended Existing Enums

| Enum | New Members Added |
|------|-------------------|
| `BadgeClass` | Primary, Success, Warning, Danger |
| `ContainerClass` | Md, Centered |
| `GlowClass` | GlowWrapperBlock |
| `MenuClass` | Vertical, Horizontal, Compact, MenuItem, SubmenuList |

---

## Completed Phases

### Phase 1: Basic Form Components ✅
- Switch, Slider, Select, DatePicker, FileUpload, FormField, Divider

### Phase 2: Entry Components ✅
- AutoComplete, Cascader, NumberInput, Search, Transfer

### Phase 3: Use Existing Enums ✅
- Badge, Button, Card, Input, Aside, Container, Footer, Grid, Header, Section, Space
- Cell, Filter, Node, Pagination, Sort, Table
- Alert, Dropdown, Glow, Toast, Tooltip
- Breadcrumb, Menu

### Phase 4: Display Components ✅
- Tag, DescriptionList, Empty, QRCode

### Phase 5: Layout Components ✅
- AppLayout (Layout)

### Phase 6: Feedback Components ✅
- Drawer, Popover, Progress, Skeleton, Spin

### Phase 7: Navigation Components ✅
- Anchor, Steps

---

## Benefits Achieved

1. **Type Safety**: All CSS class strings are now compile-time checked
2. **IDE Autocompletion**: Full autocomplete support for all class names
3. **No Typos**: Impossible to misspell class names
4. **Consistent Pattern**: All components follow the same `ClassesBuilder` + enum pattern
5. **Maintainability**: Easier to find and update class references

---

## Notes

- `.add_raw(&props.class)` is still used for user-provided custom classes (correct pattern)
- All hardcoded `"hi-xxx"` strings have been replaced with type-safe enums
- Each enum follows the naming convention: `{ComponentName}Class`
- All enums derive `Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize`
