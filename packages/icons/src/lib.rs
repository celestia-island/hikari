// Hikari Icons - Material Design Icons integration for Dioxus
//
// This crate provides type-safe icon components integrating with:
// - Material Design Icons (https://pictogrammers.com/library/mdi/) - 7,447 icons
//
// # Usage
//
// ```rust,ignore
// use hikari_icons::{Icon, MdiIcon};
//
// rsx! {
//     Icon { icon: MdiIcon::MoonWaningCrescent, class: "w-6 h-6" }
//     Icon { icon: MdiIcon::WhiteBalanceSunny, size: 32 }
// }
// ```

pub mod mdi_minimal;

use dioxus::prelude::*;

// Re-export MDI icon enum (minimal version to avoid WASM size limits)
pub use mdi_minimal::MdiIcon;

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
///
/// # Example
///
/// ```rust,ignore
/// use hikari_icons::{Icon, MdiIcon};
///
/// rsx! {
///     Icon { icon: MdiIcon::MoonWaningCrescent, class: "w-6 h-6" }
///     Icon { icon: MdiIcon::WhiteBalanceSunny, size: 32 }
/// }
/// ```
#[component]
pub fn Icon(
    #[props(into)] icon: IconRef,
    #[props(default)] class: String,
    #[props(default = 24)] size: u32,
) -> Element {
    let icon_path = format!("/icons/{}.svg", icon.name());
    let svg_content = use_resource(move || {
        let path = icon_path.clone();
        async move { fetch_svg(&path).await }
    });

    let size_class = format!("hikari-icon-{size}");
    let full_class = format!("hikari-icon {size_class} {class}");

    rsx! {
        div {
            class: full_class,
            dangerous_inner_html: match &*svg_content.read() {
                Some(svg) => svg.as_str(),
                None => DEFAULT_SVG,
            },
        }
    }
}

#[cfg(target_arch = "wasm32")]
async fn fetch_svg(path: &str) -> String {
    use wasm_bindgen::JsCast;
    use web_sys::{Request, RequestInit, RequestMode, Response};

    let opts = RequestInit::new();
    opts.set_method("GET");
    opts.set_mode(RequestMode::Cors);

    if let Ok(request) = Request::new_with_str_and_init(path, &opts) {
        if let Some(window) = web_sys::window() {
            if let Ok(response_val) =
                wasm_bindgen_futures::JsFuture::from(window.fetch_with_request(&request)).await
            {
                if let Ok(response) = response_val.dyn_into::<Response>() {
                    if let Ok(text) = response.text() {
                        if let Ok(svg) = wasm_bindgen_futures::JsFuture::from(text).await {
                            if let Some(s) = svg.as_string() {
                                return s;
                            }
                        }
                    }
                }
            }
        }
    }
    DEFAULT_SVG.to_string()
}

#[cfg(not(target_arch = "wasm32"))]
async fn fetch_svg(_path: &str) -> String {
    // On non-wasm32 targets, return default SVG
    DEFAULT_SVG.to_string()
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
