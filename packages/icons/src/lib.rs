//! # Hikari Icons
//!
//! Type-safe Material Design Icons (MDI) integration for Dioxus with 7,447 icons.
//!
//! ## Overview
//!
//! `hikari-icons` provides:
//!
//! - **7,447 MDI Icons** - Complete Material Design Icons collection
//! - **Type-Safe Enum** - Compile-time icon name checking
//! - **Inline SVG Rendering** - No external requests or icon fonts
//! - **Zero Runtime Overhead** - Icons loaded on-demand
//! - **Convenient Shortcuts** - Helper functions for common icons
//!
//! ## Icon Sources
//!
//! - Material Design Icons (https://pictogrammers.com/library/mdi/) - 7,447 icons
//!
//! ## Quick Start
//!
//! ### Static Icons
//!
//! ```rust,ignore
//! use hikari_icons::{Icon, MdiIcon};
//!
//! rsx! {
//!     Icon { icon: MdiIcon::Search, size: 24, class: "text-primary" }
//!     Icon { icon: MdiIcon::MoonWaningCrescent, class: "w-6 h-6" }
//!     Icon { icon: MdiIcon::WhiteBalanceSunny, size: 32 }
//! }
//! ```
//!
//! ### Icon Shortcuts
//!
//! ```rust,ignore
//! use hikari_icons::mdi;
//!
//! rsx! {
//!     mdi::Moon("w-6 h-6".to_string())
//!     mdi::Sun("text-yellow-500".to_string())
//!     mdi::Settings("cursor-pointer".to_string())
//! }
//! ```
//!
//! ## Dynamic Icons
//!
//! **⚠️ Important**: When you need to dynamically change icons based on state
//! (e.g., theme toggle, status change), you MUST use a `key` attribute on a **wrapper component**.
//!
//! ### Why This Happens
//!
//! The `Icon` component uses `use_resource` to asynchronously fetch SVG content.
//! This hook only runs once when the component is first mounted.
//! When the `icon` prop changes, `use_resource` does NOT re-run automatically,
//! so the SVG content won't update.
//!
//! ### Correct Solution: Reactive Key on Wrapper
//!
//! ```rust,ignore
//! use hikari_icons::{Icon, MdiIcon};
//! use dioxus::prelude::*;
//!
//! #[component]
//! fn ThemeToggleButton() -> Element {
//!     let mut is_dark = use_signal(|| false);
//!
//!     // ✅ REACTIVE: Create a key that changes when the theme changes
//!     let icon_key = use_memo(move || {
//!         if *is_dark.read() { "moon" } else { "sun" }
//!     });
//!
//!     rsx! {
//!         button {
//!             onclick: move |_| is_dark.toggle(),
//!
//!             // ✅ IMPORTANT: Key on wrapper, not on Icon
//!             key: "{icon_key}",
//!
//!             Icon {
//!                 icon: if *is_dark.read() {
//!                     MdiIcon::MoonWaningCrescent
//!                 } else {
//!                     MdiIcon::WhiteBalanceSunny
//!                 },
//!                 size: 20,
//!             }
//!         }
//!     }
//! }
//! ```
//!
//! ### Why a Helper Component Like `DynamicIcon` Doesn't Work
//!
//! You might try to create a helper component to handle the key automatically:
//!
//! ```rust,ignore
//! #[component]
//! pub fn DynamicIcon(
//!     #[props(into)] icon: IconRef,
//!     #[props(default)] class: String,
//!     #[props(default = 24)] size: u32,
//! ) -> Element {
//!     // ⚠️ STATIC: Key calculated once, never changes
//!     let icon_key = format!("{:?}", icon);
//!
//!     rsx! {
//!         Icon {
//!             key: "{icon_key}",  // Key never updates!
//!             icon: icon,
//!             class: class,
//!             size: size,
//!         }
//!     }
//! }
//! ```
//!
//! **Why it doesn't work**: The `icon_key` is calculated **once** when the `DynamicIcon` component
//! function runs. It's a static calculation, not reactive. Even when the `icon` prop changes,
//! `icon_key` is not recalculated, so it remains at its initial value.
//!
//! **The correct approach** is to create a **reactive** key using `use_memo` in the
//! parent component, then apply the key to a wrapper component.
//!
//! ## Available Icons
//!
//! ### Icon Categories
//!
//! #### Navigation Icons
//! - `Home`, `Menu`, `Search`, `Settings`
//! - `ChevronLeft`, `ChevronRight`, `ChevronUp`, `ChevronDown`
//! - `ArrowLeft`, `ArrowRight`, `ArrowUp`, `ArrowDown`
//!
//! #### Action Icons
//! - `Edit`, `Trash`, `Check`, `Close`, `Plus`, `Minus`
//! - `Copy`, `Cut`, `Paste`
//! - `Undo`, `Redo`
//! - `ZoomIn`, `ZoomOut`
//!
//! #### Status Icons
//! - `Alert`, `AlertCircle`, `AlertOctagon`
//! - `CheckCircle`, `Information`, `Help`
//! - `Loading`, `Refresh`
//!
//! #### UI Icons
//! - `Account`, `Lock`, `Unlock`, `Eye`, `EyeOff`
//! - `Calendar`, `Clock`, `MapPin`, `Navigation`
//!
//! #### And 7,000+ more...
//!
//! See [Material Design Icons](https://pictogrammers.com/library/mdi/) for the complete list.
//!
//! ## Icon Shortcuts
//!
//! Use convenient shortcuts for frequently used icons:
//!
//! | Shortcut | MDI Icon | Description |
//! |----------|-----------|-------------|
//! | `Moon(class)` | `MoonWaningCrescent` | Moon icon |
//! | `Sun(class)` | `WhiteBalanceSunny` | Sun icon |
//! | `Settings(class)` | `Cog` | Settings gear icon |
//! | `Account(class)` | `Account` | User account icon |
//! | `Home(class)` | `Home` | Home icon |
//! | `Search(class)` | `Magnify` | Search icon |
//! | `Close(class)` | `Close` | Close/X icon |
//! | `Check(class)` | `Check` | Checkmark icon |
//! | `Menu(class)` | `Menu` | Menu/hamburger icon |
//! | `Bell(class)` | `BellOutline` | Notification bell icon |
//! | `Star(class)` | `Star` | Star/favorite icon |
//! | `Heart(class)` | `Heart` | Heart icon |
//! | `Calendar(class)` | `Calendar` | Calendar icon |
//! | `Clock(class)` | `ClockOutline` | Clock/time icon |
//! | `ChevronLeft(class)` | `ChevronLeft` | Left chevron |
//! | `ChevronRight(class)` | `ChevronRight` | Right chevron |
//! | `ChevronUp(class)` | `ChevronUp` | Up chevron |
//! | `ChevronDown(class)` | `ChevronDown` | Down chevron |
//! | `X(class)` | `Close` | X icon |
//! | `Award(class)` | `TrophyAward` | Award/trophy icon |
//! | `Book(class)` | `Book` | Book icon |
//! | `Badge(class)` | `Alert` | Alert/badge icon |
//!
//! ## Props
//!
//! ### `Icon` Component
//!
//! | Prop | Type | Default | Description |
//! |------|------|---------|-------------|
//! | `icon` | `IconRef` (MdiIcon) | (required) | Icon to render |
//! | `class` | `String` | `""` | CSS classes to apply |
//! | `size` | `u32` | `24` | Icon size in pixels |
//!
//! ## Integration with Other Crates
//!
//! - **hikari-components** - Icons used in Button, Input, and other components
//! - **hikari-render-service** - Static icon file service
//! - **hikari-theme** - Icon colors inherit from theme
//!
//! ```rust,ignore
//! use hikari_theme::ThemeProvider;
//! use hikari_icons::Icon;
//!
//! rsx! {
//!     ThemeProvider { palette: "hikari".to_string(),
//!         // Icon colors inherit from theme
//!         Icon { icon: MdiIcon::Star, class: "text-primary" }
//!     }
//! }
//! ```

pub mod generated;
pub mod mdi_minimal;
pub mod svg_macro;

use dioxus::prelude::*;

// Re-export MDI icon enum (minimal version to avoid WASM size limits)
pub use mdi_minimal::MdiIcon;

// Re-export structured icon data types
pub use generated::mdi_selected::{get, IconData, PathData, SvgElem};

// Re-export generated data module
pub use generated::mdi_selected::data;

// StyleStringBuilder for building styles
pub use hikari_animation::style::{CssProperty, StyleStringBuilder};

/// Icon reference - wrapper for MDI icon
#[derive(Clone, Copy, PartialEq, Eq, Debug, Hash)]
pub struct IconRef(pub MdiIcon);

impl From<MdiIcon> for IconRef {
    fn from(icon: MdiIcon) -> Self {
        IconRef(icon)
    }
}

impl IconRef {
    /// Get the icon name as a string
    pub fn name(&self) -> String {
        self.0.to_string()
    }

    /// Get the SVG path for this icon
    pub fn svg_path(&self) -> String {
        format!("/icons/{}.svg", self.0.to_string())
    }
}

/// Icon component that renders MDI icons as inline SVG
///
/// # Props
/// - `icon`: The MDI icon to render (automatically converts from `MdiIcon`)
/// - `class`: Optional CSS classes
/// - `size`: Optional size in pixels (default: 24)
/// - `color`: Optional color (default: inherits from theme's text primary color)
///
/// # Static Icons
///
/// For static icons (icon doesn't change during component lifecycle), use directly:
///
/// ```rust,ignore
/// use hikari_icons::{Icon, MdiIcon};
///
/// rsx! {
///     // Inherits theme text color
///     Icon { icon: MdiIcon::MoonWaningCrescent }
///     // Custom size
///     Icon { icon: MdiIcon::WhiteBalanceSunny, size: 32 }
///     // Custom color (hex)
///     Icon { icon: MdiIcon::Settings, color: "#FF0000" }
///     // Use CSS variable from theme
///     Icon { icon: MdiIcon::Search, color: "var(--hi-primary)" }
/// }
/// ```
///
/// # Color Inheritance
///
/// By default, icons inherit their color from the current theme's text primary color
/// (`--hi-text-primary`). This means icons automatically switch between light and dark
/// themes along with text:
///
/// - **Hikari (light)**: Icons use dark text color (#50616D)
/// - **Tairitsu (dark)**: Icons use light text color (#D6ECF0)
///
/// # Custom Colors
///
/// You can override the default color using the `color` prop:
///
/// ```rust,ignore
/// // Use semantic color from theme
/// Icon { icon: MdiIcon::Star, color: "var(--hi-accent)" }
///
/// // Use specific hex color
/// Icon { icon: MdiIcon::Warning, color: "#FBBF24" }
///
/// // Use CSS color name
/// Icon { icon: MdiIcon::Error, color: "red" }
/// ```
///
/// # CSS Classes for Colors
///
/// Alternatively, you can use utility classes:
///
/// ```rust,ignore
/// // Primary color
/// Icon { icon: MdiIcon::Heart, class: "hikari-icon-primary" }
///
/// // Secondary color
/// Icon { icon: MdiIcon::Share, class: "hikari-icon-secondary" }
///
/// // Accent color
/// Icon { icon: MdiIcon::Star, class: "hikari-icon-accent" }
///
/// // Success color
/// Icon { icon: MdiIcon::Check, class: "hikari-icon-success" }
///
/// // Warning color
/// Icon { icon: MdiIcon::Alert, class: "hikari-icon-warning" }
///
/// // Danger color
/// Icon { icon: MdiIcon::Close, class: "hikari-icon-danger" }
///
/// // Muted text color
/// Icon { icon: MdiIcon::Info, class: "hikari-icon-muted" }
/// ```
///
/// # Structured Icon Data
///
/// This component uses structured icon data and macros to generate SVG at runtime,
/// avoiding the need for external HTTP requests or raw SVG strings in the binary.
///
/// The icon data is generated at build time from parsed SVG files, stored as
/// compile-time constants (`IconData`), and reconstructed using the `build_svg!` macro.
///
/// # Dynamic Icons
///
/// **Important**: When you need to dynamically change icon based on state
/// (e.g., theme toggle, status change), you MUST use a `key` attribute.
///
/// The Icon component uses `use_memo` to rebuild SVG content reactively,
/// which automatically updates when the `icon` prop changes.
///
/// ## Why This Happens
///
/// The SVG content is built using the `build_svg!` macro:
///
/// ```rust,ignore
/// let icon_data = generated::get(icon.name()).unwrap();
/// let svg_content = use_memo(move || {
///     build_svg!(icon_data)
/// });
/// ```
///
/// The `use_memo` creates a reactive dependency on the `icon_data`,
/// automatically rebuilding the SVG when the icon changes.
///
/// ## Correct Solution: Reactive Key with `use_memo`
///
/// The solution is to create a **reactive** key using `use_memo` in the
/// parent component, then apply the key to a **wrapper component**:
///
/// ```rust,ignore
/// use hikari_icons::{Icon, MdiIcon};
/// use dioxus::prelude::*;
///
/// #[component]
/// fn ThemeToggleButton() -> Element {
///     let mut is_dark = use_signal(|| false);
///
///     // ✅ REACTIVE: Create a key that changes when theme changes
///     let icon_key = use_memo(move || {
///         if *is_dark.read() { "moon" } else { "sun" }
///     });
///
///     rsx! {
///         button {
///             onclick: move |_| is_dark.toggle(),
///
///             // ✅ IMPORTANT: Key on wrapper, not on Icon
///             key: "{icon_key}",
///
///             Icon {
///                 icon: if *is_dark.read() {
///                     MdiIcon::MoonWaningCrescent
///                 } else {
///                     MdiIcon::WhiteBalanceSunny
///                 },
///                 size: 20,
///             }
///         }
///     }
/// }
/// ```
///
/// **Why this works**:
///
/// 1. `use_memo` creates a **reactive** dependency on `is_dark`
/// 2. When `is_dark` changes, `icon_key` is **automatically recalculated**
/// 3. The `key` prop on `button` changes, forcing Dioxus to:
///    - Completely destroy and recreate the `button` component
///    - Which destroys and recreates the `Icon` component inside
///    - Which triggers `use_memo` to run again and rebuild the SVG
///
/// **Key Point**: The key must be on the **wrapper component** (the button),
/// not on the `Icon` itself. When the key is on the wrapper component, Dioxus
/// recreates the entire component tree, ensuring the SVG is rebuilt correctly.
///
/// ## Why Key on Wrapper, Not on Icon?
///
/// The `key` attribute forces Dioxus to completely destroy and recreate the
/// component tree when the key changes. When the key is on the wrapper
/// component (the Button), it forces the Button to be recreated, which in turn
/// forces the Icon to be recreated, triggering `use_memo` to run again
/// and rebuild the SVG.
#[component]
pub fn Icon(
    #[props(into)] icon: IconRef,
    #[props(default)] class: String,
    #[props(default = 24)] size: u32,
    #[props(default)] color: String,
) -> Element {
    // Get icon data from generated constants
    let icon_data = match get(&icon.name()) {
        Some(data) => data,
        None => {
            eprintln!("Icon not found: {}", icon.name());
            return rsx! {
                div {
                    class: "hikari-icon",
                    dangerous_inner_html: DEFAULT_SVG,
                }
            };
        }
    };

    // Build SVG reactively using the macro
    let svg_content = use_memo(move || build_svg!(icon_data));

    // Use StyleStringBuilder for type-safe style construction
    let full_style = if color.is_empty() {
        StyleStringBuilder::new()
            .add_px(CssProperty::Width, size)
            .add_px(CssProperty::Height, size)
            .build_clean()
    } else {
        StyleStringBuilder::new()
            .add_px(CssProperty::Width, size)
            .add_px(CssProperty::Height, size)
            .add(CssProperty::Color, &color)
            .build_clean()
    };

    let full_class = format!("hikari-icon {class}");

    rsx! {
        div {
            class: full_class,
            style: "{full_style}",
            dangerous_inner_html: "{svg_content}",
        }
    }
}

/// Default SVG fallback icon (exclamation mark)
const DEFAULT_SVG: &str = r#"<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>"#;

// ======== Material Design Icon Shortcuts ========

/// MDI icon shortcuts
#[allow(non_snake_case)]
pub mod mdi {
    use super::*;

    /// Moon icon (for dark mode toggle)
    pub fn Moon(class: String) -> Element {
        rsx! { Icon { icon: MdiIcon::MoonWaningCrescent, class: class } }
    }

    /// Sun icon (for light mode toggle)
    pub fn Sun(class: String) -> Element {
        rsx! { Icon { icon: MdiIcon::WhiteBalanceSunny, class: class } }
    }

    /// Settings icon
    pub fn Settings(class: String) -> Element {
        rsx! { Icon { icon: MdiIcon::Cog, class: class } }
    }

    /// User/Account icon
    pub fn Account(class: String) -> Element {
        rsx! { Icon { icon: MdiIcon::Account, class: class } }
    }

    /// Home icon
    pub fn Home(class: String) -> Element {
        rsx! { Icon { icon: MdiIcon::Home, class: class } }
    }

    /// Search icon
    pub fn Search(class: String) -> Element {
        rsx! { Icon { icon: MdiIcon::Magnify, class: class } }
    }

    /// Close/X icon
    pub fn Close(class: String) -> Element {
        rsx! { Icon { icon: MdiIcon::Close, class: class } }
    }

    /// Check icon
    pub fn Check(class: String) -> Element {
        rsx! { Icon { icon: MdiIcon::Check, class: class } }
    }

    /// Menu/Hamburger icon
    pub fn Menu(class: String) -> Element {
        rsx! { Icon { icon: MdiIcon::Menu, class: class } }
    }

    /// Bell/Notification icon
    pub fn Bell(class: String) -> Element {
        rsx! { Icon { icon: MdiIcon::BellOutline, class: class } }
    }

    /// Star icon
    pub fn Star(class: String) -> Element {
        rsx! { Icon { icon: MdiIcon::Star, class: class } }
    }

    /// Heart icon
    pub fn Heart(class: String) -> Element {
        rsx! { Icon { icon: MdiIcon::Heart, class: class } }
    }

    /// Calendar icon
    pub fn Calendar(class: String) -> Element {
        rsx! { Icon { icon: MdiIcon::Calendar, class: class } }
    }

    /// Clock icon
    pub fn Clock(class: String) -> Element {
        rsx! { Icon { icon: MdiIcon::ClockOutline, class: class } }
    }

    /// Chevron left icon
    pub fn ChevronLeft(class: String) -> Element {
        rsx! { Icon { icon: MdiIcon::ChevronLeft, class: class } }
    }

    /// Chevron right icon
    pub fn ChevronRight(class: String) -> Element {
        rsx! { Icon { icon: MdiIcon::ChevronRight, class: class } }
    }

    /// Chevron up icon
    pub fn ChevronUp(class: String) -> Element {
        rsx! { Icon { icon: MdiIcon::ChevronUp, class: class } }
    }

    /// Chevron down icon
    pub fn ChevronDown(class: String) -> Element {
        rsx! { Icon { icon: MdiIcon::ChevronDown, class: class } }
    }

    /// User icon
    pub fn User(class: String) -> Element {
        rsx! { Icon { icon: MdiIcon::Account, class: class } }
    }

    /// X icon
    pub fn X(class: String) -> Element {
        rsx! { Icon { icon: MdiIcon::Close, class: class } }
    }

    /// Award icon
    pub fn Award(class: String) -> Element {
        rsx! { Icon { icon: MdiIcon::TrophyAward, class: class } }
    }

    /// Book icon
    pub fn Book(class: String) -> Element {
        rsx! { Icon { icon: MdiIcon::Book, class: class } }
    }

    /// Alert/Badge icon
    pub fn Badge(class: String) -> Element {
        rsx! { Icon { icon: MdiIcon::Alert, class: class } }
    }
}
