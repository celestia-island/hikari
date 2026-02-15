// website/src/pages/components/mod.rs
// Components pages (Layer 1/2/3)

pub mod layer1;
pub mod layer2;
pub mod layer3;
pub mod overview;

// Re-exports
pub use overview::ComponentsOverview;

// Layer 1 - All migrated to Markdown-driven architecture
// See: /docs/{lang}/components/layer1/*.md

// Layer 2
pub use layer2::Layer2Overview;

// Layer 2 - New components (still using .rs files)
pub use layer2::Cascader;
pub use layer2::Collapsible;
pub use layer2::Pagination;
pub use layer2::QRCode;
pub use layer2::Table;
pub use layer2::Timeline;
pub use layer2::Transfer;
pub use layer2::Tree;

// Layer 3
pub use layer3::Layer3Overview;

// Layer 3 - New components
pub use layer3::UserGuide;
pub use layer3::ZoomControls;
