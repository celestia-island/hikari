//! Basic components module
//!
//! Provides fundamental UI components with Arknights-style design
//! and FUI aesthetics.
//!
//! ## Components
//!
//! - [`Background`] - Full-screen gradient background
//! - [`Avatar`] - User profile image with fixed sizes
//! - [`Badge`] - Small status indicators and labels
//! - [`Button`] - Interactive button with multiple variants
//! - [`Card`] - Content container with optional header
//! - [`Image`] - Image with configurable fit modes
//! - [`Input`] - Text input with styling support
//! - [`Select`] - Dropdown selection
//! - [`Checkbox`] - Checkbox with animations
//! - [`RadioGroup`] - Radio button group
//! - [`Switch`] - Toggle switch
//! - [`Slider`] - Range slider
//! - [`Textarea`] - Multi-line text input
//! - [`FileUpload`] - File upload with drag-drop
//! - [`FormField`] - Form field wrapper with label and error
//! - [`DatePicker`] - Date picker component

pub mod avatar;
pub mod background;
pub mod badge;
pub mod button;
pub mod card;
pub mod checkbox;
pub mod date_picker;
pub mod file_upload;
pub mod form_field;
pub mod icon_button;
pub mod image;
pub mod input;
pub mod radio_group;
pub mod select;
pub mod slider;
pub mod switch;
pub mod textarea;

pub use avatar::*;
pub use background::*;
pub use badge::*;
pub use button::*;
pub use card::*;
pub use checkbox::*;
pub use date_picker::*;
pub use file_upload::*;
pub use form_field::*;
pub use icon_button::*;
pub use image::*;
pub use input::*;
pub use radio_group::*;
pub use select::*;
pub use slider::*;
pub use switch::*;
pub use textarea::*;
