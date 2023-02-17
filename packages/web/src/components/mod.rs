pub mod container;
pub mod data;
pub mod form;
pub mod navigation;

#[derive(Debug, PartialEq)]
pub enum Size {
    Small,
    Medium,
    Large,
}

#[derive(Debug, PartialEq)]
pub enum Color {
    Primary,
    Secondary,
    Success,
    Error,
    Info,
    Warning,
}
