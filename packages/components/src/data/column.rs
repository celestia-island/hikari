// hikari-components/src/data/column.rs
// Column component for table configuration

use dioxus::prelude::*;

/// Column alignment options
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum ColumnAlign {
    #[default]
    Left,
    Center,
    Right,
}

/// Column definition for table configuration
#[derive(Clone, PartialEq, Debug, Default)]
pub struct ColumnDef {
    /// Column identifier (column_key to avoid conflict with Dioxus's key attribute)
    pub column_key: String,

    /// Column header text
    pub title: String,

    /// CSS width value
    pub width: Option<String>,

    /// Min width
    pub min_width: Option<String>,

    /// Max width
    pub max_width: Option<String>,

    /// Text alignment
    pub align: ColumnAlign,

    /// Fixed column (not scrollable)
    pub fixed: bool,

    /// Enable sorting
    pub sortable: bool,

    /// Enable filtering
    pub filterable: bool,

    /// Allow resize
    pub resizable: bool,

    /// Custom CSS classes
    pub class: String,
}

/// Column component props
#[derive(Clone, PartialEq, Props, Default)]
pub struct ColumnProps {
    /// Column identifier
    #[props(default)]
    pub column_key: String,

    /// Column header text
    #[props(default)]
    pub title: String,

    /// CSS width value
    #[props(default)]
    pub width: Option<String>,

    /// Min width
    #[props(default)]
    pub min_width: Option<String>,

    /// Max width
    #[props(default)]
    pub max_width: Option<String>,

    /// Text alignment
    #[props(default)]
    pub align: ColumnAlign,

    /// Fixed column (not scrollable)
    #[props(default)]
    pub fixed: bool,

    /// Enable sorting
    #[props(default)]
    pub sortable: bool,

    /// Enable filtering
    #[props(default)]
    pub filterable: bool,

    /// Allow resize
    #[props(default)]
    pub resizable: bool,

    /// Custom CSS classes
    #[props(default)]
    pub class: String,
}

impl From<ColumnProps> for ColumnDef {
    fn from(props: ColumnProps) -> Self {
        Self {
            column_key: props.column_key,
            title: props.title,
            width: props.width,
            min_width: props.min_width,
            max_width: props.max_width,
            align: props.align,
            fixed: props.fixed,
            sortable: props.sortable,
            filterable: props.filterable,
            resizable: props.resizable,
            class: props.class,
        }
    }
}

impl ColumnDef {
    /// Create a new column definition with minimal parameters
    pub fn new(column_key: impl Into<String>, title: impl Into<String>) -> Self {
        Self {
            column_key: column_key.into(),
            title: title.into(),
            width: None,
            min_width: None,
            max_width: None,
            align: Default::default(),
            fixed: false,
            sortable: false,
            filterable: false,
            resizable: false,
            class: String::default(),
        }
    }

    /// Set column width
    pub fn width(mut self, width: impl Into<String>) -> Self {
        self.width = Some(width.into());
        self
    }

    /// Set min width
    pub fn min_width(mut self, min_width: impl Into<String>) -> Self {
        self.min_width = Some(min_width.into());
        self
    }

    /// Set max width
    pub fn max_width(mut self, max_width: impl Into<String>) -> Self {
        self.max_width = Some(max_width.into());
        self
    }

    /// Set column alignment
    pub fn align(mut self, align: ColumnAlign) -> Self {
        self.align = align;
        self
    }

    /// Set fixed column
    pub fn fixed(mut self, fixed: bool) -> Self {
        self.fixed = fixed;
        self
    }

    /// Enable sorting
    pub fn sortable(mut self, sortable: bool) -> Self {
        self.sortable = sortable;
        self
    }

    /// Enable filtering
    pub fn filterable(mut self, filterable: bool) -> Self {
        self.filterable = filterable;
        self
    }

    /// Enable resize
    pub fn resizable(mut self, resizable: bool) -> Self {
        self.resizable = resizable;
        self
    }

    /// Set custom CSS class
    pub fn class(mut self, class: impl Into<String>) -> Self {
        self.class = class.into();
        self
    }

    /// Get alignment CSS class
    pub fn align_class(&self) -> &'static str {
        match self.align {
            ColumnAlign::Left => "hikari-align-left",
            ColumnAlign::Center => "hikari-align-center",
            ColumnAlign::Right => "hikari-align-right",
        }
    }

    /// Get fixed column class
    pub fn fixed_class(&self) -> &'static str {
        if self.fixed {
            "hikari-column-fixed"
        } else {
            ""
        }
    }

    /// Get sortable class
    pub fn sortable_class(&self) -> &'static str {
        if self.sortable {
            "hikari-column-sortable"
        } else {
            ""
        }
    }

    /// Get resizable class
    pub fn resizable_class(&self) -> &'static str {
        if self.resizable {
            "hikari-column-resizable"
        } else {
            ""
        }
    }

    /// Build CSS classes string
    pub fn build_classes(&self) -> String {
        format!(
            "{} {} {} {}",
            self.align_class(),
            self.fixed_class(),
            self.sortable_class(),
            self.resizable_class()
        )
        .split_whitespace()
        .collect::<Vec<&str>>()
        .join(" ")
    }

    /// Check if column has width constraints
    pub fn has_width_constraints(&self) -> bool {
        self.width.is_some() || self.min_width.is_some() || self.max_width.is_some()
    }

    /// Get inline styles for width constraints
    pub fn width_styles(&self) -> String {
        let mut styles = Vec::new();

        if let Some(width) = &self.width {
            styles.push(format!("width: {}", width));
        }

        if let Some(min_width) = &self.min_width {
            styles.push(format!("min-width: {}", min_width));
        }

        if let Some(max_width) = &self.max_width {
            styles.push(format!("max-width: {}", max_width));
        }

        if styles.is_empty() {
            String::new()
        } else {
            format!("{};", styles.join("; "))
        }
    }
}
