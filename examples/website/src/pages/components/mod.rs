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

// Layer 2 - Migrated to Markdown
// See: /docs/{lang}/components/layer2/*.md

// Layer 3
pub use layer3::Layer3Overview;

// Layer 3 - Migrated to Markdown
// See: /docs/{lang}/components/layer3/*.md
