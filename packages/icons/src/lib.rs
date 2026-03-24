//! # Hikari Icons
//!
//! Material Design Icons integration for Tairitsu framework.
//!
//! ## Usage
//!
//! ```rust,ignore
//! use hikari_icons::{Icon, MdiIcon};
//!
//! rsx! {
//!     Icon { icon: MdiIcon::MoonWaningCrescent, size: 24, class: "text-primary" }
//! }
//! ```
//!
//! ## Icon Shortcuts
//!
//! ```rust,ignore
//! use hikari_icons::mdi;
//!
//! rsx! {
//!     mdi::Moon("w-6 h-6".to_string())
//! }
//! ```

pub mod generated;
pub mod mdi_minimal;

#[cfg(feature = "dioxus")]
use dioxus::prelude::*;
#[cfg(feature = "tairitsu")]
use tairitsu_macros::{define_props, rsx};
#[cfg(feature = "tairitsu")]
use tairitsu_vdom::VNode as Element;

// Re-export MDI icon enum
pub use mdi_minimal::MdiIcon;

// Re-export icon data types
pub use generated::mdi_selected::{get, IconData, PathData, SvgElem};

// StyleStringBuilder for building styles
#[cfg(feature = "dioxus")]
pub use hikari_animation::style::{CssProperty, StyleStringBuilder};

/// Default SVG fallback icon
#[allow(dead_code)]
const DEFAULT_SVG: &str = r#"<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>"#;

/// Icon reference wrapper
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
}

/// Build SVG string from IconData
#[macro_export]
macro_rules! build_svg {
    ($icon_data:expr) => {{
        let data = $icon_data;
        let mut svg = String::from(r#"<svg xmlns="http://www.w3.org/2000/svg""#);

        if let Some(vb) = data.view_box {
            svg.push_str(&format!(r#" viewBox="{}""#, vb));
        }
        if let Some(w) = data.width {
            svg.push_str(&format!(r#" width="{}""#, w));
        }
        if let Some(h) = data.height {
            svg.push_str(&format!(r#" height="{}""#, h));
        }
        svg.push('>');

        if let Some(p) = data.path {
            svg.push_str(&format!(r#"<path fill="currentColor" d="{}"/>"#, p));
        }

        for path in data.paths {
            svg.push_str("<path");
            if let Some(d) = path.d {
                svg.push_str(&format!(r#" d="{}""#, d));
            }
            svg.push_str(r#" fill="currentColor"/>"#);
        }

        svg.push_str("</svg>");
        svg
    }};
}

// ============================================================================
// Dioxus Icon Component
// ============================================================================

#[cfg(feature = "dioxus")]
#[component]
pub fn Icon(
    #[props(into)] icon: IconRef,
    #[props(default)] class: String,
    #[props(default = 24)] size: u32,
    #[props(default)] color: String,
) -> Element {
    let icon_data_opt = get(&icon.name());

    let final_svg = if let Some(icon_data) = icon_data_opt {
        use_memo(move || build_svg!(icon_data))
    } else {
        use_memo(|| String::from(DEFAULT_SVG))
    };

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
            dangerous_inner_html: "{final_svg}",
        }
    }
}

// ============================================================================
// Tairitsu Icon Component
// ============================================================================

#[cfg(feature = "tairitsu")]
#[define_props]
pub struct IconProps {
    #[default(MdiIcon::Help)]
    pub icon: MdiIcon,
    #[default(String::new())]
    pub class: String,
    #[default(24)]
    pub size: u32,
    #[default(String::new())]
    pub color: String,
}

#[cfg(feature = "tairitsu")]
#[allow(non_snake_case)]
pub fn Icon(props: IconProps) -> Element {
    let icon_ref = IconRef(props.icon);
    let icon_name = icon_ref.name();
    let icon_data_opt = get(&icon_name);

    let final_svg = if let Some(icon_data) = icon_data_opt {
        build_svg!(icon_data)
    } else {
        String::from(DEFAULT_SVG)
    };

    let full_style = if props.color.is_empty() {
        format!("width:{}px;height:{}px;", props.size, props.size)
    } else {
        format!(
            "width:{}px;height:{}px;color:{};",
            props.size, props.size, props.color
        )
    };

    let full_class = format!("hikari-icon {}", props.class);

    rsx! {
        div {
            class: full_class,
            style: full_style,
            dangerous_inner_html: final_svg,
        }
    }
}

// ============================================================================
// MDI Icon Shortcuts
// ============================================================================

#[cfg(any(feature = "dioxus", feature = "tairitsu"))]
#[allow(non_snake_case)]
pub mod mdi {
    use super::*;

    macro_rules! icon_shortcut {
        ($name:ident, $icon:expr) => {
            pub fn $name(class: String) -> Element {
                #[cfg(feature = "dioxus")]
                {
                    rsx! { Icon { icon: $icon, class } }
                }
                #[cfg(all(not(feature = "dioxus"), feature = "tairitsu"))]
                {
                    Icon(IconProps {
                        icon: $icon,
                        class,
                        ..Default::default()
                    })
                }
            }
        };
    }

    icon_shortcut!(Moon, MdiIcon::MoonWaningCrescent);
    icon_shortcut!(Sun, MdiIcon::WhiteBalanceSunny);
    icon_shortcut!(Settings, MdiIcon::Cog);
    icon_shortcut!(Account, MdiIcon::Account);
    icon_shortcut!(Home, MdiIcon::Home);
    icon_shortcut!(Search, MdiIcon::Magnify);
    icon_shortcut!(Close, MdiIcon::Close);
    icon_shortcut!(Check, MdiIcon::Check);
    icon_shortcut!(Menu, MdiIcon::Menu);
    icon_shortcut!(Bell, MdiIcon::BellOutline);
    icon_shortcut!(Star, MdiIcon::Star);
    icon_shortcut!(Heart, MdiIcon::Heart);
    icon_shortcut!(Calendar, MdiIcon::Calendar);
    icon_shortcut!(Clock, MdiIcon::ClockOutline);
    icon_shortcut!(ChevronLeft, MdiIcon::ChevronLeft);
    icon_shortcut!(ChevronRight, MdiIcon::ChevronRight);
    icon_shortcut!(ChevronUp, MdiIcon::ChevronUp);
    icon_shortcut!(ChevronDown, MdiIcon::ChevronDown);
    icon_shortcut!(User, MdiIcon::Account);
    icon_shortcut!(X, MdiIcon::Close);
    icon_shortcut!(Award, MdiIcon::TrophyAward);
    icon_shortcut!(Book, MdiIcon::Book);
    icon_shortcut!(Badge, MdiIcon::Alert);
}
