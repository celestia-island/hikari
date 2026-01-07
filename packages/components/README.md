# hikari-components

A comprehensive component library for Hikari applications, featuring basic UI components, feedback components, navigation components, and advanced data display components.

## Overview

`hikari-components` provides:

- **Basic Components** - Button, Input, Card, Badge
- **Feedback Components** - Alert, Toast, Tooltip
- **Navigation Components** - Menu, Tabs, Breadcrumb
- **Data Components** - Table (with modular sub-components), Tree (with modular sub-components)
- **Arknights + FUI Styling** - Consistent design language
- **Type-Safe Props** - Full TypeScript-like safety in Rust
- **Accessible** - WCAG compliant components

## Installation

Add to your `Cargo.toml`:

```toml
[dependencies]
hikari-components = "0.1.0"
hikari-theme = "0.1.0"
hikari-palette = "0.1.0"
dioxus = "0.7"
```

## Quick Start

```rust
use dioxus::prelude::*;
use hikari_components::*;
use hikari_theme::ThemeProvider;

fn app() -> Element {
    rsx! {
        ThemeProvider { palette: "arknights".to_string(),
            div { class: "container",
                Button { variant: ButtonVariant::Primary, "Click Me" }
                Card {
                    header: rsx! { h2 { "Card Title" } },
                    "Card content goes here"
                }
            }
        }
    }
}
```

## Basic Components

### Button

Multi-variant button component with loading and icon support.

```rust
rsx! {
    Button {
        variant: ButtonVariant::Primary,
        size: ButtonSize::Large,
        onclick: |_| println!("Clicked!"),
        "Click Me"
    }

    Button {
        variant: ButtonVariant::Ghost,
        icon: rsx! { Icon { name: "search" } },
        "Search"
    }

    Button {
        variant: ButtonVariant::Danger,
        loading: true,
        "Processing..."
    }

    Button {
        variant: ButtonVariant::Secondary,
        block: true,
        "Full Width Button"
    }
}
```

**Props:**
- `variant: ButtonVariant` - Primary, Secondary, Ghost, Danger, Success
- `size: ButtonSize` - Small, Medium, Large
- `disabled: bool` - Disable the button
- `loading: bool` - Show loading spinner
- `block: bool` - Full width button
- `icon: Option<Element>` - Icon element
- `onclick: Option<EventHandler<MouseEvent>>` - Click handler
- `class: String` - Additional CSS classes

### Input

Text input component with validation support.

```rust
rsx! {
    Input {
        placeholder: "Enter your name",
        value: name,
        oninput: move |e: Event<FormData>| name.set(e.value()),
        variant: InputVariant::Outlined
    }

    Input {
        placeholder: "Password",
        input_type: "password".to_string(),
        disabled: true
    }

    Input {
        placeholder: "Search",
        icon: rsx! { Icon { name: "search" } }
    }
}
```

**Props:**
- `value: String` - Input value
- `placeholder: String` - Placeholder text
- `input_type: String` - Input type (text, password, email, etc.)
- `variant: InputVariant` - Filled, Outlined, Standard
- `disabled: bool` - Disable input
- `icon: Option<Element>` - Input icon
- `oninput: EventHandler<Event<FormData>>` - Input change handler
- `class: String` - Additional CSS classes

### Card

Container component with optional header and footer.

```rust
rsx! {
    Card {
        header: rsx! { h2 { "Card Title" } },
        footer: rsx! { button { "Action" } },
        "Card content goes here. You can put any components inside."
    }

    Card {
        class: "hover-card",
        "Simple card without header/footer"
    }
}
```

**Props:**
- `header: Option<Element>` - Card header
- `footer: Option<Element>` - Card footer
- `class: String` - Additional CSS classes
- `children: Element` - Card content

### Badge

Small status or count indicator.

```rust
rsx! {
    Badge {
        variant: BadgeVariant::Success,
        "Active"
    }

    Badge {
        variant: BadgeVariant::Danger,
        count: Some(5),
        "Notifications"
    }

    Badge {
        variant: BadgeVariant::Warning,
        class: "pulse-badge",
        "Pending"
    }
}
```

**Props:**
- `variant: BadgeVariant` - Primary, Success, Warning, Danger, Info
- `count: Option<u32>` - Optional count number
- `dot: bool` - Show as dot indicator
- `class: String` - Additional CSS classes
- `children: Element` - Badge content

## Feedback Components

### Alert

Alert banners for important messages.

```rust
rsx! {
    Alert {
        variant: AlertVariant::Success,
        title: "Success!",
        "Your changes have been saved successfully."
    }

    Alert {
        variant: AlertVariant::Warning,
        title: "Warning",
        "Please review your input before proceeding."
    }

    Alert {
        variant: AlertVariant::Danger,
        closable: true,
        "An error occurred. Please try again."
    }
}
```

**Props:**
- `variant: AlertVariant` - Success, Warning, Danger, Info
- `title: Option<String>` - Alert title
- `closable: bool` - Show close button
- `onclose: Option<EventHandler<MouseEvent>>` - Close handler
- `class: String` - Additional CSS classes
- `children: Element` - Alert message

### Toast

Notification toasts that appear temporarily.

```rust
fn app() -> Element {
    let mut toasts = use_signal(Vec::new);

    let show_toast = move |message: String| {
        toasts.write().push((message, Utc::now()));
    };

    rsx! {
        button {
            onclick: move |_| show_toast("Operation successful!".to_string()),
            "Show Toast"
        }

        for (message, _) in toasts.read().iter() {
            Toast {
                message: message.clone(),
                variant: ToastVariant::Success,
                duration: 3000,
                onclose: move || {
                    toasts.write().retain(|(_, t)| t != &t);
                }
            }
        }
    }
}
```

**Props:**
- `message: String` - Toast message
- `variant: ToastVariant` - Success, Warning, Danger, Info
- `duration: u64` - Auto-dismiss duration (ms)
- `onclose: EventHandler` - Close callback
- `class: String` - Additional CSS classes

### Tooltip

Hover tooltip for additional context.

```rust
rsx! {
    Tooltip {
        content: "This is a helpful tooltip",
        position: TooltipPosition::Top,
        button {
            "Hover me"
        }
    }

    Tooltip {
        content: "More information",
        position: TooltipPosition::Right,
        Icon { name: "info" }
    }
}
```

**Props:**
- `content: String` - Tooltip text
- `position: TooltipPosition` - Top, Right, Bottom, Left
- `delay: u64` - Hover delay (ms)
- `class: String` - Additional CSS classes
- `children: Element` - Target element

## Navigation Components

### Menu

Vertical or horizontal navigation menu.

```rust
rsx! {
    Menu {
        orientation: MenuOrientation::Vertical,
        items: vec![
            MenuItem { id: "1", label: "Dashboard", icon: "dashboard" },
            MenuItem { id: "2", label: "Projects", icon: "folder" },
            MenuItem { id: "3", label: "Settings", icon: "settings" },
        ],
        selected: "1".to_string(),
        onselect: move |id| println!("Selected: {}", id)
    }
}
```

**Props:**
- `items: Vec<MenuItem>` - Menu items
- `selected: String` - Currently selected item ID
- `orientation: MenuOrientation` - Vertical, Horizontal
- `onselect: EventHandler<String>` - Selection handler
- `class: String` - Additional CSS classes

### Tabs

Tabbed content interface.

```rust
rsx! {
    Tabs {
        items: vec![
            TabItem { id: "tab1", label: "Overview" },
            TabItem { id: "tab2", label: "Details" },
            TabItem { id: "tab3", label: "Settings" },
        ],
        active: "tab1".to_string(),
        onchange: move |id| active_tab.set(id),
        div { class: "tab-content",
            {match active_tab() {
                "tab1" => rsx! { "Overview content" },
                "tab2" => rsx! { "Details content" },
                _ => rsx! { "Settings content" },
            }}
        }
    }
}
```

**Props:**
- `items: Vec<TabItem>` - Tab items
- `active: String` - Active tab ID
- `onchange: EventHandler<String>` - Tab change handler
- `variant: TabVariant` - Line, Card, Pill
- `class: String` - Additional CSS classes

### Breadcrumb

Navigation breadcrumb trail.

```rust
rsx! {
    Breadcrumb {
        items: vec![
            BreadcrumbItem { label: "Home".to_string(), href: "/" },
            BreadcrumbItem { label: "Projects".to_string(), href: "/projects" },
            BreadcrumbItem { label: "My Project".to_string(), href: None },
        ],
        separator: "/".to_string()
    }
}
```

**Props:**
- `items: Vec<BreadcrumbItem>` - Breadcrumb items
- `separator: String` - Separator between items
- `class: String` - Additional CSS classes

## Data Components

### Table

Feature-rich data table with modular architecture.

#### Basic Table

```rust
rsx! {
    Table {
        data: users,
        columns: vec![
            Column {
                header: "Name".to_string(),
                key: "name".to_string(),
                render: |row| rsx! { "{row.name}" }
            },
            Column {
                header: "Email".to_string(),
                key: "email".to_string(),
                render: |row| rsx! { "{row.email}" }
            },
        ],
    }
}
```

#### Table with Pagination

```rust
rsx! {
    Table {
        data: users,
        columns: columns,
        pagination: Some(TablePagination {
            page: 1,
            page_size: 10,
            total: users.len(),
            onpagechange: move |p| page.set(p)
        })
    }
}
```

#### Table with Sorting

```rust
rsx! {
    Table {
        data: users,
        columns: columns,
        sortable: true,
        sort_column: Some("name".to_string()),
        sort_direction: SortDirection::Asc,
        onsort: move |(col, dir)| {
            sort_column.set(Some(col));
            sort_direction.set(dir);
        }
    }
}
```

#### Table with Selection

```rust
rsx! {
    Table {
        data: users,
        columns: columns,
        selectable: true,
        selected_rows: selected.clone(),
        onselect: move |ids| selected.set(ids),
        selection_type: SelectionType::Multiple
    }
}
```

**Table Modules:**
- `table.rs` - Core table component
- `column.rs` - Column definitions
- `cell.rs` - Cell rendering
- `header.rs` - Table header with sort indicators
- `pagination.rs` - Pagination controls
- `sort.rs` - Sorting logic
- `filter.rs` - Filtering UI and logic
- `selection.rs` - Row selection

### Tree

Hierarchical tree component with drag-drop and virtual scrolling.

#### Basic Tree

```rust
rsx! {
    Tree {
        data: tree_data,
        node_render: |node| rsx! {
            div { class: "tree-node",
                Icon { name: node.icon }
                {node.label}
            }
        },
        onselect: move |node| println!("Selected: {}", node.id)
    }
}
```

#### Tree with Drag-Drop

```rust
rsx! {
    Tree {
        data: tree_data,
        draggable: true,
        ondrop: move |(source, target)| {
            println!("Moved {} to {}", source, target);
        }
    }
}
```

#### Tree with Virtual Scroll

```rust
rsx! {
    Tree {
        data: large_tree_data,
        virtual_scroll: true,
        item_height: 32,
        height: 400
    }
}
```

**Tree Modules:**
- `tree.rs` - Core tree component
- `node.rs` - Tree node implementation
- `virtual.rs` - Virtual scrolling for large datasets
- `collapse.rs` - Expand/collapse functionality
- `drag.rs` - Drag-drop support

## Styling Guide

### Custom Component Styles

All components use CSS variables and can be customized:

```css
/* Custom button styles */
.my-button {
    background-color: var(--hi-color-primary);
    border-radius: var(--hi-radius-lg);
    padding: var(--hi-spacing-sm) var(--hi-spacing-md);
}

/* Custom card styles */
.my-card {
    background-color: var(--hi-color-surface);
    border: 1px solid var(--hi-color-border);
    box-shadow: var(--hi-shadow-lg);
}
```

### Theme Variants

Components automatically adapt to the current theme:

```rust
rsx! {
    ThemeProvider { palette: "fui-dark".to_string(),
        // All components use FUI Dark theme
        Button { "FUI Button" }
        Card { "FUI Card" }
    }
}
```

## Props Reference

### Button

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| variant | ButtonVariant | Primary | Button style variant |
| size | ButtonSize | Medium | Button size |
| disabled | bool | false | Disabled state |
| loading | bool | false | Show loading spinner |
| block | bool | false | Full width |
| icon | Option\<Element\> | None | Icon element |
| onclick | EventHandler\<MouseEvent\> | None | Click handler |
| class | String | "" | Additional classes |
| children | Element | VNode::empty() | Button content |

### Input

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| value | String | "" | Input value |
| placeholder | String | "" | Placeholder text |
| input_type | String | "text" | Input type |
| variant | InputVariant | Filled | Input style |
| disabled | bool | false | Disabled state |
| icon | Option\<Element\> | None | Input icon |
| oninput | EventHandler\<Event\<FormData\>\> | None | Input handler |
| class | String | "" | Additional classes |

## Accessibility

All components follow WCAG 2.1 guidelines:

- Proper ARIA attributes
- Keyboard navigation support
- Screen reader compatibility
- Focus management
- Color contrast compliance

## Examples

See the [examples](../../examples/) directory:
- `demo-app/` - Component showcase
- `table-demo/` - Advanced table features
- `tree-demo/` - Tree component features

## License

MIT OR Apache-2.0
