# hikari-components

Core UI component library with flat design and glow effect aesthetics, providing 40+ ready-to-use rendered components.

## Relationship to `hikari-extra-components`

`hikari-components` provides **rendered components** (using the `rsx!` macro, reactive hooks, and `StyledComponent` CSS embedding). Its sibling package `hikari-extra-components` provides complementary **framework-agnostic data models** for the same component domains (Timeline, DragLayer, UserGuide, ZoomControls, etc.).

- Use `hikari-components` when you need ready-to-render UI in a Tairitsu application
- Use `hikari-extra-components` when you need pure state models for SSR, testing, or non-Tairitsu frameworks
- Use both together: state models from `extra` can feed into rendered components from this package

> **Note:** Some types share names across both packages (e.g., `TimelinePosition`). The `components` versions accept `Element` children and event handlers; the `extra` versions use `String` fields with `serde`. Import with explicit module paths to disambiguate.

## Animation Utilities

The `utils::anim_helpers` module provides shared animation primitives used internally by components:

- `run_ease_out(duration, power, signal)` — One-shot ease-out animation (used by DragLayer, UserGuide, Drawer)
- `run_phase_loop(period, signal, compute)` — Infinite looping phase animation (used by Progress)
- `run_dual_phase_loop(period, sig_a, sig_b, compute_a, compute_b)` — Dual-signal phase loop (used by Skeleton)

## Installation

```toml
[dependencies]
hikari-components = "0.1"
hikari-theme = "0.1"
hikari-palette = "0.1"
```

## Quick Start

```rust
use hikari_components::*;
use hikari_theme::ThemeProvider;

fn app() -> Element {
    rsx! {
        ThemeProvider { initial_initial_palette: "hikari".to_string(),
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

## Documentation

For complete API documentation and component examples, see [docs.rs](https://docs.rs/hikari-components)

## Features

### Component Categories

| Category | Feature | Components |
|----------|----------|-----------|
| Basic | `basic` | Button, Input, Card, Badge |
| Feedback | `feedback` | Alert, Toast, Tooltip |
| Navigation | `navigation` | Menu, Tabs, Breadcrumb |
| Data | `data` | Table, Tree, Pagination |
| Layout | (always) | Layout, Header, Aside, Content |

### Feature Flags

Enable all basic components:
```toml
[dependencies]
hikari-components = { features = ["basic"] }
```

Enable specific components:
```toml
[dependencies]
hikari-components = { features = ["button", "input", "card"] }
```

## License

MIT OR Apache-2.0
