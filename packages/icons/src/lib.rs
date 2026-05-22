//! # Hikari Icons
//!
//! Full Material Design Icons (7447 icons) for Tairitsu framework.
//!
//! ## Typed API
//!
//! ```rust,ignore
//! use hikari_icons::{Icon, MdiIcon};
//! rsx! { Icon { icon: MdiIcon::RocketLaunch, size: 24 } }
//! ```
//!
//! ## String lookup
//!
//! ```rust,ignore
//! use hikari_icons::get;
//! let path_d = get("rocket-launch").unwrap();
//! let svg = build_svg_from_path(path_d, 24);
//! ```

#[allow(non_camel_case_types)]
#[rustfmt::skip]
mod mdi_data {
    include!(concat!(env!("OUT_DIR"), "/mdi_data.rs"));
}

#[allow(non_camel_case_types)]
#[rustfmt::skip]
mod mdi_enum {
    include!(concat!(env!("OUT_DIR"), "/mdi_enum.rs"));
}

pub use mdi_data::get;
pub use mdi_enum::MdiIcon;

#[derive(Clone, Copy, PartialEq, Eq, Debug, Hash)]
pub struct IconRef(pub MdiIcon);

impl From<MdiIcon> for IconRef {
    fn from(icon: MdiIcon) -> Self {
        IconRef(icon)
    }
}

impl IconRef {
    pub fn name(&self) -> String {
        self.0.to_string()
    }
}

/// Build an SVG string from a raw path `d` attribute.
pub fn build_svg_from_path(path_d: &str, size: u32) -> String {
    format!(
        r#"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="{size}" height="{size}"><path fill="currentColor" d="{path_d}"/></svg>"#
    )
}

/// Fallback "?" icon SVG.
pub const FALLBACK_ICON_SVG: &str = r#"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>"#;

#[cfg(feature = "tairitsu")]
use tairitsu_macros::{define_props, rsx};
#[cfg(feature = "tairitsu")]
use tairitsu_vdom::VNode as Element;

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
    let icon_name = props.icon.to_string();
    let final_svg = match get(&icon_name) {
        Some(d) => build_svg_from_path(d, props.size),
        None => FALLBACK_ICON_SVG.to_string(),
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

#[cfg(feature = "tairitsu")]
#[allow(non_snake_case)]
pub mod mdi {
    use super::*;

    macro_rules! icon_shortcut {
        ($name:ident, $icon:expr) => {
            pub fn $name(class: String) -> Element {
                Icon(IconProps {
                    icon: $icon,
                    class,
                    ..Default::default()
                })
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
