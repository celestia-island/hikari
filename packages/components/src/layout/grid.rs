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

use crate::theme::use_layout_direction;
use dioxus::prelude::*;
use palette::{classes::components::*, ClassesBuilder};

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
/// - Responsive column spans (span, span_sm, span_md, span_lg)
/// - Auto-width option
/// - Offset support
#[component]
pub fn Col(
    /// Column content
    children: Element,

    /// Column span (1-12, default: auto)
    #[props(default)]
    span: Option<u8>,

    /// Column span for mobile screens (< 768px)
    #[props(default)]
    span_sm: Option<u8>,

    /// Column span for tablet screens (>= 768px)
    #[props(default)]
    span_md: Option<u8>,

    /// Column span for desktop screens (>= 1024px)
    #[props(default)]
    span_lg: Option<u8>,

    /// Offset by N columns
    #[props(default)]
    offset: Option<u8>,

    /// Custom CSS classes
    #[props(default)]
    class: String,
) -> Element {
    // Build responsive grid-column style
    let mut style_parts = Vec::new();

    // Base span (mobile first)
    let base_span = span_sm.or(span).unwrap_or(12);
    style_parts.push(format!("grid-column: span {base_span};"));

    // Responsive spans using media query simulation via CSS custom properties
    // We'll use a CSS approach with inline styles
    let md_span = span_md.or(span).unwrap_or(base_span);
    let lg_span = span_lg.or(span_md).or(span).unwrap_or(md_span);

    // Build the style with responsive behavior using CSS grid-column
    let style = if let Some(o) = offset {
        format!("grid-column: {} / span {};", o + 1, base_span)
    } else {
        format!("grid-column: span {base_span};")
    };

    // Add responsive classes for different breakpoints
    let responsive_class = format!(
        "col-responsive col-span-{} md:col-span-{} lg:col-span-{}",
        base_span, md_span, lg_span
    );

    let classes = ClassesBuilder::new()
        .add(GridClass::Col)
        .add_raw(&responsive_class)
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
/// - RTL support
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

    /// Override RTL behavior (default: follow theme direction)
    #[props(default)]
    rtl: Option<bool>,

    /// Custom CSS classes
    #[props(default)]
    class: String,

    /// Custom inline styles
    #[props(default)]
    style: String,
) -> Element {
    let layout_direction = use_layout_direction();
    let is_rtl = rtl.unwrap_or_else(|| layout_direction.is_rtl());

    let gap_class = match gap.as_str() {
        "sm" => RowClass::GapSm,
        "lg" => RowClass::GapLg,
        _ => RowClass::GapMd,
    };

    let justify_style = match justify.as_str() {
        "center" => "justify-content: center;",
        "end" => "justify-content: flex-end;",
        "between" => "justify-content: space-between;",
        "around" => "justify-content: space-around;",
        _ => "justify-content: flex-start;",
    };

    let align_style = match align.as_str() {
        "start" => "align-items: flex-start;",
        "end" => "align-items: flex-end;",
        "stretch" => "align-items: stretch;",
        _ => "align-items: center;",
    };

    let wrap_style = if wrap {
        "flex-wrap: wrap;"
    } else {
        "flex-wrap: nowrap;"
    };

    let direction_style = if is_rtl {
        "flex-direction: row-reverse;"
    } else {
        "flex-direction: row;"
    };

    let classes = ClassesBuilder::new()
        .add(RowClass::Row)
        .add(gap_class)
        .add_raw(&class)
        .build();

    rsx! {
        div {
            class: "{classes}",
            style: format!("display: flex; {direction_style} {justify_style} {align_style} {wrap_style} {style}"),
            { children }
        }
    }
}
