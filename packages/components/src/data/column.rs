// hi-components/src/data/column.rs
// Column component for table configuration

use crate::prelude::*;

#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum ColumnAlign {
    #[default]
    Left,
    Center,
    Right,
}

#[derive(Clone, PartialEq, Debug, Default)]
pub struct ColumnDef {
    pub column_key: String,

    pub title: String,

    pub width: Option<String>,

    pub min_width: Option<String>,

    pub max_width: Option<String>,

    pub align: ColumnAlign,

    pub fixed: bool,

    pub sortable: bool,

    pub filterable: bool,

    pub resizable: bool,

    pub class: String,
}

#[define_props]
pub struct ColumnProps {
    #[default]
    pub column_key: String,

    #[default]
    pub title: String,

    #[default]
    pub width: Option<String>,

    #[default]
    pub min_width: Option<String>,

    #[default]
    pub max_width: Option<String>,

    #[default]
    pub align: ColumnAlign,

    #[default]
    pub fixed: bool,

    #[default]
    pub sortable: bool,

    #[default]
    pub filterable: bool,

    #[default]
    pub resizable: bool,

    #[default]
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

    pub fn width(mut self, width: impl Into<String>) -> Self {
        self.width = Some(width.into());
        self
    }

    pub fn min_width(mut self, min_width: impl Into<String>) -> Self {
        self.min_width = Some(min_width.into());
        self
    }

    pub fn max_width(mut self, max_width: impl Into<String>) -> Self {
        self.max_width = Some(max_width.into());
        self
    }

    #[must_use]
    pub fn align(mut self, align: ColumnAlign) -> Self {
        self.align = align;
        self
    }

    #[must_use]
    pub fn fixed(mut self, fixed: bool) -> Self {
        self.fixed = fixed;
        self
    }

    #[must_use]
    pub fn sortable(mut self, sortable: bool) -> Self {
        self.sortable = sortable;
        self
    }

    #[must_use]
    pub fn filterable(mut self, filterable: bool) -> Self {
        self.filterable = filterable;
        self
    }

    #[must_use]
    pub fn resizable(mut self, resizable: bool) -> Self {
        self.resizable = resizable;
        self
    }

    pub fn class(mut self, class: impl Into<String>) -> Self {
        self.class = class.into();
        self
    }

    #[must_use]
    pub fn align_class(&self) -> &'static str {
        match self.align {
            ColumnAlign::Left => "hi-align-left",
            ColumnAlign::Center => "hi-align-center",
            ColumnAlign::Right => "hi-align-right",
        }
    }

    #[must_use]
    pub fn fixed_class(&self) -> &'static str {
        if self.fixed { "hi-column-fixed" } else { "" }
    }

    #[must_use]
    pub fn sortable_class(&self) -> &'static str {
        if self.sortable {
            "hi-column-sortable"
        } else {
            ""
        }
    }

    #[must_use]
    pub fn resizable_class(&self) -> &'static str {
        if self.resizable {
            "hi-column-resizable"
        } else {
            ""
        }
    }

    #[must_use]
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

    #[must_use]
    pub fn has_width_constraints(&self) -> bool {
        self.width.is_some() || self.min_width.is_some() || self.max_width.is_some()
    }

    #[must_use]
    pub fn width_styles(&self) -> String {
        let mut styles = Vec::new();

        if let Some(width) = &self.width {
            styles.push(format!("width: {width}"));
        }

        if let Some(min_width) = &self.min_width {
            styles.push(format!("min-width: {min_width}"));
        }

        if let Some(max_width) = &self.max_width {
            styles.push(format!("max-width: {max_width}"));
        }

        if styles.is_empty() {
            String::new()
        } else {
            format!("{};", styles.join("; "))
        }
    }
}
