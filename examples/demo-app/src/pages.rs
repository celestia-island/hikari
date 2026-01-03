// demo-app/src/pages/mod.rs
// Page components

pub mod home;
pub mod basic_components;
pub mod feedback_components;
pub mod navigation_components;
pub mod data_components;

pub use home::Home;
pub use basic_components::BasicComponents;
pub use feedback_components::FeedbackComponents;
pub use navigation_components::NavigationComponents;
pub use data_components::DataComponents;

