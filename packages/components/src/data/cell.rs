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

impl std::fmt::Debug for CellProps {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("CellProps")
            .field("value", &self.value)
            .field("column", &self.column)
            .field("row_index", &self.row_index)
            .field("col_index", &self.col_index)
            .field("class", &self.class)
            .field("render", &self.render.is_some())
            .field("editable", &self.editable)
            .finish()
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cell_props_default() {
        let props = CellProps::default();
        assert_eq!(props.value, String::new());
        assert_eq!(props.row_index, 0);
        assert_eq!(props.col_index, 0);
        assert!(props.class.is_empty());
        assert!(props.render.is_none());
        assert!(!props.editable);
    }

    #[test]
    fn test_cell_props_value() {
        let props = CellProps {
            value: "test value".to_string(),
            ..Default::default()
        };
        assert_eq!(props.value, "test value");
    }

    #[test]
    fn test_cell_props_indices() {
        let props = CellProps {
            row_index: 5,
            col_index: 3,
            ..Default::default()
        };
        assert_eq!(props.row_index, 5);
        assert_eq!(props.col_index, 3);
    }

    #[test]
    fn test_cell_props_editable() {
        let props1 = CellProps {
            editable: false,
            ..Default::default()
        };

        let props2 = CellProps {
            editable: true,
            ..Default::default()
        };

        assert!(!props1.editable);
        assert!(props2.editable);
    }

    #[test]
    fn test_cell_props_class() {
        let props = CellProps {
            class: "custom-cell".to_string(),
            ..Default::default()
        };
        assert_eq!(props.class, "custom-cell");
    }

    #[test]
    fn test_cell_props_clone() {
        let render = create_cell_renderer(|_, _, _| {
            rsx! { span { "rendered" } }
        });
        let props = CellProps {
            value: "test".to_string(),
            render: Some(render),
            ..Default::default()
        };

        let cloned = props.clone();
        assert_eq!(cloned.value, "test");
        assert!(cloned.render.is_some());
    }

    #[test]
    fn test_cell_props_partial_eq() {
        let render = create_cell_renderer(|_, _, _| {
            rsx! { span { "rendered" } }
        });

        let props1 = CellProps {
            value: "test".to_string(),
            render: Some(render.clone()),
            ..Default::default()
        };

        let props2 = CellProps {
            value: "test".to_string(),
            render: Some(render),
            ..Default::default()
        };

        assert_eq!(props1, props2);
    }

    #[test]
    fn test_cell_props_not_equal() {
        let props1 = CellProps {
            value: "value1".to_string(),
            ..Default::default()
        };

        let props2 = CellProps {
            value: "value2".to_string(),
            ..Default::default()
        };

        assert_ne!(props1, props2);
    }

    #[test]
    fn test_cell_props_inequality_with_value() {
        let props1 = CellProps {
            value: "test".to_string(),
            ..Default::default()
        };

        let props2 = CellProps {
            value: "different".to_string(),
            ..Default::default()
        };

        assert_ne!(props1, props2);
    }

    #[test]
    fn test_cell_props_inequality_with_column() {
        let column1 = ColumnDef {
            column_key: "name1".to_string(),
            ..Default::default()
        };

        let column2 = ColumnDef {
            column_key: "name2".to_string(),
            ..Default::default()
        };

        let props1 = CellProps {
            column: column1.clone(),
            ..Default::default()
        };

        let props2 = CellProps {
            column: column2,
            ..Default::default()
        };

        assert_ne!(props1, props2);
    }

    #[test]
    fn test_cell_renderer_creation() {
        let renderer = create_cell_renderer(|_, _, _| {
            rsx! { span { "test" } }
        });
        assert!(Rc::strong_count(&renderer) > 0);
    }
}
