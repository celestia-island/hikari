// hikari-components/src/layout/grid.rs
//! Grid system components - Responsive grid layout system
//!
//! # Example
//!
//! ```rust
//! use hikari_components::layout::{Grid, Col};
//! use dioxus::prelude::*;
//!
//! rsx! {
//!     Grid {
//!         Col { span: 6, "Half width" }
//!         Col { span: 6, "Half width" }
//!         Col { span: 4, "Third width" }
//!         Col { span: 8, "Two thirds width" }
//!     }
//! }
//! ```

use dioxus::prelude::*;
use palette::{ClassesBuilder, classes::components::*};

/// Grid component - 12-column responsive grid container
///
/// Provides a flexible grid system based on CSS Grid.
///
/// # Features
/// - 12-column grid system
/// - Responsive gutters
/// - Automatic wrapping
/// - Gap control
#[component]
pub fn Grid(
    /// Grid columns content
    children: Element,

    /// Number of columns (default: 12)
    #[props(default = 12)]
    columns: u8,

    /// Gap between grid items (default: md)
    #[props(default = "md".to_string())]
    gap: String,

    /// Custom CSS classes
    #[props(default)]
    class: String,
) -> Element {
    let gap_class = match gap.as_str() {
        "sm" => GridClass::GapSm,
        "lg" => GridClass::GapLg,
        _ => GridClass::GapMd, // md (default)
    };

    let classes = ClassesBuilder::new()
        .add(GridClass::Grid)
        .add(gap_class)
        .add_raw(&class)
        .build();

    rsx! {
        div {
            class: "{classes}",
            style: format!("grid-template-columns: repeat({columns}, minmax(0, 1fr));"),
            { children }
        }
    }
}

/// Col component - Grid column component
///
/// Defines column span within a Grid.
///
/// # Features
/// - Responsive column spans
/// - Auto-width option
/// - Offset support
#[component]
pub fn Col(
    /// Column content
    children: Element,

    /// Column span (1-12, default: auto)
    #[props(default)]
    span: Option<u8>,

    /// Offset by N columns
    #[props(default)]
    offset: Option<u8>,

    /// Custom CSS classes
    #[props(default)]
    class: String,
) -> Element {
    let style = if let Some(s) = span {
        format!("grid-column: span {s};")
    } else {
        "grid-column: auto;".to_string()
    };

    let style = if let Some(o) = offset {
        format!("{}grid-column-start: {};", style, o + 1)
    } else {
        style
    };

    let classes = ClassesBuilder::new()
        .add(GridClass::Col)
        .add_raw(&class)
        .build();

    rsx! {
        div {
            class: "{classes}",
            style: style,
            { children }
        }
    }
}

/// Row component - Flexbox row for horizontal layouts
///
/// Simple flex row container for horizontal layouts.
///
/// # Features
/// - Flexbox horizontal layout
/// - Responsive wrapping
/// - Gap control
/// - Alignment options
#[component]
pub fn Row(
    /// Row content
    children: Element,

    /// Gap between items (default: md)
    #[props(default = "md".to_string())]
    gap: String,

    /// Wrap content (default: true)
    #[props(default = true)]
    wrap: bool,

    /// Horizontal alignment (default: start)
    #[props(default = "start".to_string())]
    justify: String,

    /// Vertical alignment (default: center)
    #[props(default = "center".to_string())]
    align: String,

    /// Custom CSS classes
    #[props(default)]
    class: String,

    /// Custom inline styles
    #[props(default)]
    style: String,
) -> Element {
    let gap_class = match gap.as_str() {
        "sm" => RowClass::GapSm,
        "lg" => RowClass::GapLg,
        _ => RowClass::GapMd, // md (default)
    };

    let justify_style = match justify.as_str() {
        "center" => "justify-content: center;",
        "end" => "justify-content: flex-end;",
        "between" => "justify-content: space-between;",
        "around" => "justify-content: space-around;",
        _ => "justify-content: flex-start;", // start (default)
    };

    let align_style = match align.as_str() {
        "start" => "align-items: flex-start;",
        "end" => "align-items: flex-end;",
        "stretch" => "align-items: stretch;",
        _ => "align-items: center;", // center (default)
    };

    let wrap_style = if wrap {
        "flex-wrap: wrap;"
    } else {
        "flex-wrap: nowrap;"
    };

    let classes = ClassesBuilder::new()
        .add(RowClass::Row)
        .add(gap_class)
        .add_raw(&class)
        .build();

    rsx! {
        div {
            class: "{classes}",
            style: format!("display: flex; {justify_style} {align_style} {wrap_style} {style}"),
            { children }
        }
    }
}
