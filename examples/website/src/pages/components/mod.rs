// website/src/pages/components/mod.rs
// Component showcase pages

pub mod alert;
pub mod badge;
pub mod basic;
pub mod breadcrumb;
pub mod button;
pub mod card;
pub mod data;
pub mod display;
pub mod entry;
pub mod entry_cascader;
pub mod entry_transfer;
pub mod feedback;
pub mod input;
pub mod layout;
pub mod menu;
pub mod navigation;
pub mod overview;
pub mod tabs;
pub mod toast;
pub mod tooltip;

// Data components
pub mod data_table;
pub mod data_tree;
pub mod data_pagination;

// Display components
pub mod display_avatar;
pub mod display_comment;
pub mod display_description_list;
pub mod display_empty;
pub mod display_image;
pub mod display_qrcode;
pub mod display_tag;

// Alias for backward compatibility
pub use data_table as table;
pub use data_tree as tree;
pub use data_pagination as pagination;
pub use display_avatar as avatar;
pub use display_comment as comment;
pub use display_description_list as description_list;
pub use display_empty as empty;
pub use display_image as image;
pub use display_qrcode as qrcode;
pub use display_tag as tag;
