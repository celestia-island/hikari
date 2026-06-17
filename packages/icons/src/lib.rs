//! # Hikari Icons
//!
//! Multi-source icon integration for the Tairitsu framework.
//!
//! Supported icon sets: MDI (Material Design Icons), and more via tairitsu-packager.
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

mod generated {
    include!(concat!(env!("OUT_DIR"), "/icons/manifest.rs"));
}

pub use generated::{MdiIcon, get_icon_path};

#[must_use]
pub fn get(name: &str) -> Option<&'static str> {
    generated::get_icon_path("mdi", name)
}

#[must_use]
pub fn get_from(set: &str, name: &str) -> Option<&'static str> {
    generated::get_icon_path(set, name)
}

#[must_use]
pub fn build_svg_from_path(path_d: &str, size: u32, view_box: &str) -> String {
    format!(
        r#"<svg xmlns="http://www.w3.org/2000/svg" viewBox="{view_box}" width="{size}" height="{size}"><path fill="currentColor" d="{path_d}"/></svg>"#
    )
}

#[must_use]
pub fn build_svg_default(path_d: &str, size: u32) -> String {
    build_svg_from_path(path_d, size, "0 0 24 24")
}

pub const FALLBACK_ICON_SVG: &str = r#"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>"#;

#[derive(Clone, Copy, PartialEq, Eq, Debug, Hash, Default)]
pub enum IconRenderMode {
    #[default]
    SvgInline,
    FontGlyph,
}

#[cfg(feature = "tairitsu")]
use tairitsu_macros::{component, define_props, rsx};
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
    #[default(IconRenderMode::SvgInline)]
    pub render_mode: IconRenderMode,
}

#[cfg(feature = "tairitsu")]
#[component]
pub fn Icon(props: IconProps) -> Element {
    match props.render_mode {
        IconRenderMode::SvgInline => render_svg_inline(&props),
        IconRenderMode::FontGlyph => render_font_glyph(&props),
    }
}

#[cfg(feature = "tairitsu")]
fn render_svg_inline(props: &IconProps) -> Element {
    let icon_name = props.icon.to_string();
    let final_svg = match get(&icon_name) {
        Some(d) => build_svg_default(d, props.size),
        None => FALLBACK_ICON_SVG.to_string(),
    };

    let full_style = build_icon_style(props.size, &props.color);
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
fn render_font_glyph(props: &IconProps) -> Element {
    let icon_name = props.icon.to_string();
    let font_family = font_family_for_icon(props.icon);
    let mut style = format!(
        "font-family:'{}';font-size:{}px;line-height:{}px;display:inline-block;text-align:center;",
        font_family, props.size, props.size
    );
    if !props.color.is_empty() {
        style.push_str(&format!("color:{};", props.color));
    }
    let full_class = format!("hikari-icon hikari-icon-font {}", props.class);

    rsx! {
        span {
            class: full_class,
            style: style,
            dangerous_inner_html: icon_name,
        }
    }
}

#[must_use]
pub fn font_family_for_icon(_icon: MdiIcon) -> &'static str {
    "Material Design Icons"
}

#[cfg(feature = "tairitsu")]
fn build_icon_style(size: u32, color: &str) -> String {
    if color.is_empty() {
        format!("width:{}px;height:{}px;", size, size)
    } else {
        format!("width:{}px;height:{}px;color:{};", size, size, color)
    }
}

#[cfg(feature = "tairitsu")]
pub mod mdi {
    use super::*;

    macro_rules! icon_shortcut {
        ($name:ident, $icon:expr) => {
            #[component]
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
    icon_shortcut!(Award, MdiIcon::TrophyAward);
    icon_shortcut!(Book, MdiIcon::Book);
    icon_shortcut!(Badge, MdiIcon::Alert);
}

pub mod dynamic_fetch;
