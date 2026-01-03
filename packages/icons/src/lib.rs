// Hikari Icons - Lucide Icons integration for Dioxus
//
// This crate provides a type-safe Icon component that integrates
// with Lucide Icons (https://lucide.dev).

pub mod generated;

use dioxus::prelude::*;
pub use generated::lucide::LucideIcon;

/// Icon component that renders Lucide icons
///
/// # Props
/// - `icon`: The Lucide icon to render (from the LucideIcon enum)
/// - `class`: Optional CSS classes (e.g., Tailwind classes)
/// - `size`: Optional size in pixels (default: 24)
///
/// # Example
/// ```rust,ignore
/// use hikari_icons::{Icon, LucideIcon};
///
/// rsx! {
///     Icon { icon: LucideIcon::Menu, class: "w-6 h-6" }
///     Icon { icon: LucideIcon::ChevronRight, size: 32 }
/// }
/// ```
#[component]
pub fn Icon(
    icon: LucideIcon,
    #[props(default)] class: String,
    #[props(default = 24)] size: u32,
) -> Element {
    let icon_name = icon.to_string();

    rsx! {
        div {
            class: "lucide-icon {class}",
            style: "display: inline-block; width: {size}px; height: {size}px;",
            "data-lucide": "{icon_name}",
            "data-icon": "{icon_name}",
        }
    }
}

/// Common icon shortcuts
///
/// Provides convenient shortcuts for frequently used icons
///
/// Note: These shortcuts use icons that actually exist in Lucide.
/// For the full list of available icons, see: https://lucide.dev/icons/
#[allow(non_snake_case)]
pub mod shortcuts {
    use super::*;

    /// Chevron left icon
    pub fn ChevronLeft(class: String) -> Element {
        rsx! { Icon { icon: LucideIcon::chevron_left, class: class } }
    }

    /// Chevron right icon
    pub fn ChevronRight(class: String) -> Element {
        rsx! { Icon { icon: LucideIcon::chevron_right, class: class } }
    }

    /// Chevron up icon
    pub fn ChevronUp(class: String) -> Element {
        rsx! { Icon { icon: LucideIcon::chevron_up, class: class } }
    }

    /// Chevron down icon
    pub fn ChevronDown(class: String) -> Element {
        rsx! { Icon { icon: LucideIcon::chevron_down, class: class } }
    }

    /// Bell icon (notifications)
    pub fn Bell(class: String) -> Element {
        rsx! { Icon { icon: LucideIcon::bell, class: class } }
    }

    /// User icon (circle with user silhouette)
    pub fn User(class: String) -> Element {
        rsx! { Icon { icon: LucideIcon::circle_user, class: class } }
    }

    /// X icon (for closing/dismissing)
    pub fn X(class: String) -> Element {
        rsx! { Icon { icon: LucideIcon::cross, class: class } }
    }
}
