//! Basic components module
//!
//! Provides fundamental UI components with Arknights-style design
//! and FUI aesthetics.
//!
//! ## Components
//!
//! - [`Background`] - Full-screen gradient background
//! - [`Avatar`] - User profile image with fixed sizes
//! - [`Arrow`] - Arrow indicator with rotation support
//! - [`Badge`] - Small status indicators and labels
//! - [`Button`] - Interactive button with multiple variants
//! - [`Canvas`] - 2D canvas with requestAnimationFrame integration
//! - [`Card`] - Content container with optional header
//! - [`Image`] - Image with configurable fit modes
//! - [`Input`] - Text input with styling support
//! - [`InputWrapper`] - Generic wrapper for input with left/right icons
//! - [`Select`] - Dropdown selection
//! - [`Checkbox`] - Checkbox with animations
//! - [`RadioGroup`] - Radio button group
//! - [`RadioButton`] - Radio button for use with RadioGroup
//! - [`Switch`] - Toggle switch
//! - [`Slider`] - Range slider
//! - [`Textarea`] - Multi-line text input
//! - [`FileUpload`] - File upload with drag-drop
//! - [`FormField`] - Form field wrapper with label and error
//! - [`DatePicker`] - Date picker component
//! - [`Divider`] - Horizontal/vertical divider line

pub mod arrow;
pub mod avatar;
pub mod background;
pub mod badge;
pub mod button;
pub mod canvas;
pub mod card;
pub mod checkbox;
pub mod date_picker;
pub mod divider;
pub mod file_upload;
pub mod form_field;
pub mod icon_button;
pub mod image;
pub mod input;
pub mod input_wrapper;
pub mod radio_group;
pub mod select;
pub mod slider;
pub mod switch;
pub mod textarea;

pub use arrow::{Arrow, ArrowComponent, ArrowDirection};
pub use avatar::*;
pub use background::*;
pub use badge::*;
pub use button::*;
pub use canvas::*;
pub use card::*;
pub use checkbox::*;
pub use date_picker::*;
pub use divider::*;
pub use file_upload::*;
pub use form_field::*;
pub use icon_button::*;
pub use image::*;
pub use input::*;
pub use input_wrapper::*;
pub use radio_group::*;
pub use select::*;
pub use slider::*;
pub use switch::*;
pub use textarea::*;
