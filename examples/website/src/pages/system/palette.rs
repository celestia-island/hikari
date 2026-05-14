//! Color palette showcase page — renders all primary theme colors using hikari-palette.

use hikari_palette::{Hikari, Tairitsu, default_theme};
use tairitsu_vdom::{VElement, VNode, VText};

use crate::components::demo_page::render_demo_page;

fn txt(s: &str) -> VNode {
    VNode::Text(VText::new(s))
}

fn color_swatch(name: &str, hex: &str, is_dark: bool) -> VNode {
    let text_class = if is_dark {
        "color-swatch__name color-swatch__name--light"
    } else {
        "color-swatch__name color-swatch__name--dark"
    };
    let style_val = format!("background-color: {};", hex);

    VNode::Element(
        VElement::new("div")
            .class("color-swatch")
            .attr("style", &style_val)
            .child(VNode::Element(
                VElement::new("span").class(text_class).child(txt(name)),
            ))
            .child(VNode::Element(
                VElement::new("span")
                    .class("color-swatch__hex")
                    .child(txt(hex)),
            )),
    )
}

fn theme_section(title: &str, palette: &hikari_palette::Palette) -> VNode {
    let colors: Vec<(&str, String, bool)> = vec![
        ("primary", palette.primary.hex(), palette.primary.is_dark()),
        (
            "secondary",
            palette.secondary.hex(),
            palette.secondary.is_dark(),
        ),
        ("accent", palette.accent.hex(), palette.accent.is_dark()),
        ("success", palette.success.hex(), palette.success.is_dark()),
        ("warning", palette.warning.hex(), palette.warning.is_dark()),
        ("danger", palette.danger.hex(), palette.danger.is_dark()),
        (
            "background",
            palette.background.hex(),
            palette.background.is_dark(),
        ),
        ("surface", palette.surface.hex(), palette.surface.is_dark()),
        ("border", palette.border.hex(), palette.border.is_dark()),
        (
            "text-primary",
            palette.text_primary.hex(),
            palette.text_primary.is_dark(),
        ),
        (
            "text-secondary",
            palette.text_secondary.hex(),
            palette.text_secondary.is_dark(),
        ),
    ];

    let swatches: Vec<VNode> = colors
        .iter()
        .map(|(name, hex, dark)| color_swatch(name, hex, *dark))
        .collect();

    VNode::Element(
        VElement::new("div")
            .class("palette-section")
            .child(VNode::Element(
                VElement::new("h2")
                    .class("palette-section__title")
                    .child(txt(title)),
            ))
            .child(VNode::Element(
                VElement::new("div")
                    .class("color-swatches")
                    .children(swatches),
            )),
    )
}

pub fn render() -> VNode {
    let hikari = Hikari::palette();
    let tairitsu = Tairitsu::palette();
    let default = default_theme();

    render_demo_page(
        "page-system-palette",
        "Color Palette",
        "660+ named colors powering two official themes.",
        VNode::Fragment(vec![
            theme_section("Hikari Theme (Light)", &hikari),
            theme_section("Tairitsu Theme (Dark)", &tairitsu),
            theme_section("Default Theme", &default),
        ]),
    )
}
