//! Basic components module
//!
//! Provides fundamental UI components for the Hikari design system.
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
//! - [`RadioGroup`] - Radio option group (Vue HkRadio mirror)
//! - [`Switch`] - Toggle switch
//! - [`Slider`] - Range slider
//! - [`Textarea`] - Multi-line text input
//! - [`FileUpload`] - File upload with drag-drop
//! - [`FormField`] - Form field wrapper with label and error
//! - [`DatePicker`] - Date picker component

pub mod arrow;
pub mod avatar;
pub mod background;
pub mod badge;
pub mod button;
pub mod canvas;
pub mod card;
pub mod checkbox;
pub mod color_picker;
pub mod date_picker;
pub mod date_tag;
pub mod date_time_picker;
pub mod fab;
pub mod file_browser_dialog;
pub mod file_field;
pub mod file_picker_field;
pub mod file_upload;
pub mod form_field;
pub mod icon_button;
pub mod icon_button_group;
pub mod icon_chip;
pub mod image;
pub mod input;
pub mod input_wrapper;
pub mod kbd;
pub mod label;
pub mod link;
pub mod otp_input;
pub mod phone_input;
pub mod radio_group;
pub mod rolling_number;
pub mod search_input;
pub mod select;
pub mod slider;
pub mod slider_field;
pub mod switch;
pub mod tag_input;
pub mod template_text;
pub mod textarea;
pub mod time_zone_globe;
pub mod token_input;
pub mod typography;

pub use arrow::{Arrow, ArrowComponent, ArrowDirection, ArrowProps};
pub use avatar::*;
pub use background::*;
pub use badge::*;
pub use button::*;
pub use canvas::*;
pub use card::*;
pub use checkbox::*;
pub use color_picker::*;
pub use date_picker::*;
pub use date_tag::*;
pub use date_time_picker::*;
pub use fab::*;
pub use file_browser_dialog::*;
pub use file_field::*;
pub use file_picker_field::*;
pub use file_upload::*;
pub use form_field::*;
pub use icon_button::*;
pub use icon_button_group::*;
pub use icon_chip::*;
pub use image::*;
pub use input::*;
pub use input_wrapper::*;
pub use kbd::*;
pub use label::*;
pub use link::*;
pub use otp_input::*;
pub use phone_input::*;
pub use radio_group::*;
pub use rolling_number::*;
pub use search_input::*;
pub use select::*;
pub use slider::*;
pub use slider_field::*;
pub use switch::*;
pub use tag_input::*;
pub use template_text::*;
pub use textarea::*;
pub use time_zone_globe::*;
pub use token_input::*;
pub use typography::*;
