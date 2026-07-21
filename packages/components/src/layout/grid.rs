// hikari-components/src/layout/grid.rs
//! Grid system components - Responsive grid layout system
//!
//! # Example
//!
//! ```rust
//! use hikari_components::layout::{Grid, Col};
//! use crate::prelude::*;
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

use hikari_palette::{ClassesBuilder, classes::components::*};

use crate::{prelude::*, theme::use_layout_direction};

///
///
#[component]
pub fn Grid(
    children: Element,

    #[props(default = 12)] columns: u8,

    #[props(default = "md".to_string())] gap: String,

    #[props(default)] class: String,
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
            class: classes,
            style: format!("grid-template-columns: repeat({columns}, minmax(0, 1fr));"),
            {children}
        }
    }
}

///
///
#[component]
pub fn Col(
    children: Element,

    #[props(default)] span: Option<u8>,

    #[props(default)] span_sm: Option<u8>,

    #[props(default)] span_md: Option<u8>,

    #[props(default)] span_lg: Option<u8>,

    #[props(default)] offset: Option<u8>,

    #[props(default)] class: String,
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
        div { class: classes, style, {children} }
    }
}

///
///
#[component]
pub fn Row(
    children: Element,

    #[props(default = "md".to_string())] gap: String,

    #[props(default = true)] wrap: bool,

    #[props(default = "start".to_string())] justify: String,

    #[props(default = "center".to_string())] align: String,

    #[props(default)] rtl: Option<bool>,

    #[props(default)] class: String,

    #[props(default)] style: String,
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
            class: classes,
            style: format!(
                "display: flex; {direction_style} {justify_style} {align_style} {wrap_style} {style}",
            ),
            {children}
        }
    }
}

pub struct GridComponent;

impl crate::styled::StyledComponent for GridComponent {
    fn styles() -> &'static str {
        r#"
.hk-grid {
  display: grid;
}

.hk-grid-gap-sm {
  gap: 0.5rem;
}

.hk-grid-gap-md {
  gap: 1rem;
}

.hk-grid-gap-lg {
  gap: 1.5rem;
}

.hk-col {
  min-width: 0;
}

.hk-row {
  display: flex;
}

.hk-row-gap-sm {
  gap: 0.5rem;
}

.hk-row-gap-md {
  gap: 1rem;
}

.hk-row-gap-lg {
  gap: 1.5rem;
}

.col-responsive {
  grid-column: span 12;
}

@media (min-width: 768px) {
  .md\:col-span-1 { grid-column: span 1 !important; }
  .md\:col-span-2 { grid-column: span 2 !important; }
  .md\:col-span-3 { grid-column: span 3 !important; }
  .md\:col-span-4 { grid-column: span 4 !important; }
  .md\:col-span-5 { grid-column: span 5 !important; }
  .md\:col-span-6 { grid-column: span 6 !important; }
  .md\:col-span-7 { grid-column: span 7 !important; }
  .md\:col-span-8 { grid-column: span 8 !important; }
  .md\:col-span-9 { grid-column: span 9 !important; }
  .md\:col-span-10 { grid-column: span 10 !important; }
  .md\:col-span-11 { grid-column: span 11 !important; }
  .md\:col-span-12 { grid-column: span 12 !important; }
}

@media (min-width: 1024px) {
  .lg\:col-span-1 { grid-column: span 1 !important; }
  .lg\:col-span-2 { grid-column: span 2 !important; }
  .lg\:col-span-3 { grid-column: span 3 !important; }
  .lg\:col-span-4 { grid-column: span 4 !important; }
  .lg\:col-span-5 { grid-column: span 5 !important; }
  .lg\:col-span-6 { grid-column: span 6 !important; }
  .lg\:col-span-7 { grid-column: span 7 !important; }
  .lg\:col-span-8 { grid-column: span 8 !important; }
  .lg\:col-span-9 { grid-column: span 9 !important; }
  .lg\:col-span-10 { grid-column: span 10 !important; }
  .lg\:col-span-11 { grid-column: span 11 !important; }
  .lg\:col-span-12 { grid-column: span 12 !important; }
}
"#
    }

    fn name() -> &'static str {
        "grid"
    }
}
