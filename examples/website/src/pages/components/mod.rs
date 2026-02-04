// website/src/pages/components/mod.rs
// Components pages (Layer 1/2/3)

pub mod display;
pub mod entry;
pub mod extra;
pub mod layer1;
pub mod layer2;
pub mod layer3;
pub mod overview;

// Re-exports
pub use overview::ComponentsOverview;

pub use layer1::Layer1Basic;
pub use layer1::Layer1Display;
pub use layer1::Layer1Feedback;
pub use layer1::Layer1Form;
pub use layer1::Layer1Switch;

pub use layer2::Layer2Data;
pub use layer2::Layer2Feedback;
pub use layer2::Layer2Form;
pub use layer2::Layer2Navigation;
pub use layer2::Layer2Overview;

pub use layer3::Layer3Editor;
pub use layer3::Layer3Media;
pub use layer3::Layer3Visualization;

pub use entry::CascaderDoc;
pub use entry::NumberInputDoc;
pub use entry::SearchDoc;
pub use entry::TransferDoc;

pub use extra::CollapsibleDoc;
pub use extra::TimelineDoc;
pub use extra::UserGuideDoc;
pub use extra::ZoomControlsDoc;
