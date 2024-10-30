#[derive(Debug, PartialEq, Eq, Clone, Copy, Default)]
pub enum SizeType {
    Large,
    #[default]
    Medium,
    Small,
}
