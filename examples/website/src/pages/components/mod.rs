// website/src/pages/components/mod.rs
// Components pages (Layer 1/2/3)

pub mod layer1;
pub mod layer2;
pub mod layer3;
pub mod overview;

// Re-exports
pub use overview::ComponentsOverview;

// Layer 1
pub use layer1::ButtonPage;
pub use layer1::Layer1Display;
pub use layer1::Layer1Feedback;
pub use layer1::Layer1Form;
pub use layer1::Layer1Switch;

// Layer 1 - New components
pub use layer1::Avatar;
pub use layer1::Comment;
pub use layer1::DescriptionList;
pub use layer1::Empty;
pub use layer1::Image;
pub use layer1::NumberInput;
pub use layer1::Search;
pub use layer1::Tag;

// Layer 2
pub use layer2::Layer2Data;
pub use layer2::Layer2Feedback;
pub use layer2::Layer2Form;
pub use layer2::Layer2Navigation;
pub use layer2::Layer2Overview;

// Layer 2 - New components
pub use layer2::Cascader;
pub use layer2::Collapsible;
pub use layer2::Pagination;
pub use layer2::QRCode;
pub use layer2::Table;
pub use layer2::Timeline;
pub use layer2::Transfer;
pub use layer2::Tree;

// Layer 3
pub use layer3::Layer3Editor;
pub use layer3::Layer3Media;
pub use layer3::Layer3Visualization;

// Layer 3 - New components
pub use layer3::UserGuide;
pub use layer3::ZoomControls;
