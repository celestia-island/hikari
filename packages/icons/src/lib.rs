// Hikari Icons - Lucide Icons integration for Dioxus
//
// This crate provides a type-safe Icon component that integrates
// with Lucide Icons (https://lucide.dev).
//
// # Usage
//
// ```rust,ignore
// use icons::{Icon, LucideIcon};
//
// rsx! {
//     Icon { icon: LucideIcon::Menu, class: "w-6 h-6" }
//     Icon { icon: LucideIcon::ChevronRight, size: 32 }
// }
// ```

pub mod generated;

use dioxus::prelude::*;
pub use generated::lucide::LucideIcon;

/// Icon component that renders Lucide icons as inline SVG
///
/// # Props
/// - `icon`: The Lucide icon to render (from the LucideIcon enum)
/// - `class`: Optional CSS classes (e.g., Tailwind classes)
/// - `size`: Optional size in pixels (default: 24)
///
/// # Example
/// ```rust,ignore
/// use icons::{Icon, LucideIcon};
///
/// rsx! {
///     Icon { icon: LucideIcon::Menu, class: "w-6 h-6" }
///     Icon { icon: LucideIcon::ChevronRight, size: 32 }
///     Icon { icon: LucideIcon::Home, class: "text-blue-600", size: 20 }
/// }
/// ```
#[component]
pub fn Icon(
    icon: LucideIcon,
    #[props(default)] class: String,
    #[props(default = 24)] size: u32,
) -> Element {
    // Get SVG content from the icon
    let svg_content = icon.get_svg();

    rsx! {
        div {
            class: "hikari-icon {class}",
            style: "display: inline-block; width: {size}px; height: {size}px;",
            dangerous_inner_html: svg_content
        }
    }
}

/// Extension trait for LucideIcon to get SVG content
pub trait IconExt {
    /// Get the SVG content for this icon
    fn get_svg(&self) -> &'static str;
}

impl IconExt for LucideIcon {
    fn get_svg(&self) -> &'static str {
        // Use the get function from generated module's svgs submodule
        generated::lucide::svgs::get(&self.to_string().as_str()).unwrap_or_else(|| {
            // Fallback to question mark icon
            r#"<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>"#
        })
    }
}

/// Common icon shortcuts
///
/// Provides convenient shortcuts for frequently used icons
///
/// Note: These shortcuts only use icons that exist in the currently generated Lucide icon set.
/// The icon generation may be incomplete - for more icons, consider regenerating with the latest script.
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

    /// X icon (for closing/dismissing) - uses cross as alternative
    pub fn X(class: String) -> Element {
        rsx! { Icon { icon: LucideIcon::cross, class: class } }
    }

    /// Settings icon (uses cog as alternative)
    pub fn Settings(class: String) -> Element {
        rsx! { Icon { icon: LucideIcon::cog, class: class } }
    }

    /// Star icon (uses circle_star as alternative)
    pub fn Star(class: String) -> Element {
        rsx! { Icon { icon: LucideIcon::circle_star, class: class } }
    }

    /// Award icon (badge/trophy)
    pub fn Award(class: String) -> Element {
        rsx! { Icon { icon: LucideIcon::award, class: class } }
    }

    /// Calendar icon
    pub fn Calendar(class: String) -> Element {
        rsx! { Icon { icon: LucideIcon::calendar, class: class } }
    }

    /// Clock icon
    pub fn Clock(class: String) -> Element {
        rsx! { Icon { icon: LucideIcon::clock, class: class } }
    }

    /// Book icon
    pub fn Book(class: String) -> Element {
        rsx! { Icon { icon: LucideIcon::book, class: class } }
    }

    /// Check icon
    pub fn Check(class: String) -> Element {
        rsx! { Icon { icon: LucideIcon::check, class: class } }
    }

    /// Alert/Badge icon
    pub fn Badge(class: String) -> Element {
        rsx! { Icon { icon: LucideIcon::badge, class: class } }
    }
}
