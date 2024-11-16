#[derive(Debug, Clone, PartialEq)]
pub struct ComponentSkin {
    pub style: stylist::StyleSource,
    pub extra_division: Vec<stylist::StyleSource>,
}
