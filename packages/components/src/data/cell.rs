// hi-components/src/data/cell.rs
// Cell component for table cells

use std::rc::Rc;

use dioxus::prelude::*;
use palette::classes::{CellClass, ClassesBuilder};

use super::column::ColumnDef;

/// Cell component props
#[derive(Clone, Props, Default)]
pub struct CellProps {
    /// Cell content
    #[props(default)]
    pub value: String,

    /// Column configuration
    pub column: ColumnDef,

    /// Row index
    #[props(default)]
    pub row_index: usize,

    /// Column index
    #[props(default)]
    pub col_index: usize,

    /// Custom CSS classes
    #[props(default)]
    pub class: String,

    /// Custom rendering callback
    #[props(default)]
    pub render: Option<CellRenderer>,

    /// Editable flag
    #[props(default)]
    pub editable: bool,
}

impl PartialEq for CellProps {
    fn eq(&self, other: &Self) -> bool {
        self.value == other.value
            && self.column == other.column
            && self.row_index == other.row_index
            && self.col_index == other.col_index
            && self.class == other.class
            && self.editable == other.editable
    }
}

/// Cell component for table data display
///
/// Renders individual table cells with support for:
/// - Custom cell rendering callbacks
/// - Column alignment
/// - Hover effects
/// - Editable flag support
///
/// # Examples
///
/// ```rust
/// use dioxus::prelude::*;
/// use hikari_components::{Cell, ColumnDef, ColumnAlign};
///
/// fn app() -> Element {
///     let column = ColumnDef {
///         column_key: "name".to_string(),
///         title: "Name".to_string(),
///         align: ColumnAlign::Left,
///         ..Default::default()
///     };
///
///     rsx! {
///         Cell {
///             column: column.clone(),
///             value: "Arknights".to_string(),
///             row_index: 0,
///             col_index: 0,
///         }
///     }
/// }
/// ```
#[component]
pub fn Cell(props: CellProps) -> Element {
    let align_class = match props.column.align {
        super::column::ColumnAlign::Left => CellClass::AlignLeft,
        super::column::ColumnAlign::Center => CellClass::AlignCenter,
        super::column::ColumnAlign::Right => CellClass::AlignRight,
    };

    let classes = ClassesBuilder::new()
        .add(CellClass::Cell)
        .add(align_class)
        .add(CellClass::CellHover)
        .add_if(CellClass::CellEditable, || props.editable)
        .add_raw(&props.class)
        .build();

    // Use custom render callback if provided
    if let Some(render_fn) = &props.render {
        let element = render_fn(&props.value, props.row_index, props.col_index);
        return rsx! {
            td {
                class: "{classes}",
                "data-row-index": "{props.row_index}",
                "data-col-index": "{props.col_index}",
                "data-key": "{props.column.column_key}",
                {element}
            }
        };
    }

    // Default rendering
    let value = props.value.clone();
    rsx! {
        td {
            class: "{classes}",
            "data-row-index": "{props.row_index}",
            "data-col-index": "{props.col_index}",
            "data-key": "{props.column.column_key}",
            "data-editable": "{props.editable}",

            { value }
        }
    }
}

/// Custom cell renderer type
pub type CellRenderer = Rc<dyn Fn(&str, usize, usize) -> Element>;

/// Helper to create a cell renderer
///
/// # Examples
///
/// ```rust
/// use dioxus::prelude::*;
/// use hikari_components::cell::create_cell_renderer;
///
/// let renderer = create_cell_renderer(|value, row, col| {
///     rsx! {
///         strong { "{value}" }
///     }
/// });
/// ```
pub fn create_cell_renderer<F>(f: F) -> CellRenderer
where
    F: Fn(&str, usize, usize) -> Element + 'static,
{
    Rc::new(f)
}
