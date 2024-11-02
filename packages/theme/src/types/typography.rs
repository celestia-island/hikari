// TODO: fonts, scales and default font size

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum FontSize {
    H1,
    H2,
    H3,
    H4,
    H5,
    H6,
    Px(f64),
    Em(f64),
    Rem(f64),
    Custom(&'static str),
}
