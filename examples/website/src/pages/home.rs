use hikari_i18n::t;
use crate::components::glow::{glow_wrap, GlowColor, GlowConfig, GlowIntensity};
use tairitsu_vdom::{VElement, VNode, VText};

fn txt(s: &str) -> VNode {
    VNode::Text(VText::new(s))
}

fn glow_btn(href: &str, class: &str, text: &str, arrow: Option<&str>) -> VNode {
    let mut btn = VElement::new("a")
        .attr("href", href)
        .class(class)
        .child(txt(text));
    if let Some(arrow_text) = arrow {
        btn = btn.child(VNode::Element(
            VElement::new("span")
                .class("btn-arrow")
                .child(txt(arrow_text)),
        ));
    }
    glow_wrap(
        VNode::Element(btn),
        GlowConfig {
            intensity: GlowIntensity::Soft,
            color: GlowColor::Primary,
            ..Default::default()
        },
    )
}

fn glow_card(title: &str, body: &str) -> VNode {
    let card = VNode::Element(
        VElement::new("div")
            .class("card")
            .child(VNode::Element(
                VElement::new("h3").class("card__title").child(txt(title)),
            ))
            .child(VNode::Element(
                VElement::new("p").class("card__body").child(txt(body)),
            )),
    );
    glow_wrap(
        card,
        GlowConfig {
            intensity: GlowIntensity::Dim,
            color: GlowColor::Primary,
            block: true,
            radius: "var(--hi-card-radius, var(--hi-radius-lg, 12px))",
            ..Default::default()
        },
    )
}

pub fn render() -> VNode {
    VNode::Element(
        VElement::new("div")
            .attr("id", "page-home")
            .class("hikari-page")
            .child(VNode::Element(
                VElement::new("section").class("page-hero").child(VNode::Element(
                    VElement::new("div").class("page-hero__inner")
                        .child(VNode::Element(
                            VElement::new("img")
                                .class("page-hero__logo")
                                .attr("src", "/images/logo.png")
                                .attr("alt", "Hikari Logo")
                                .attr("width", "80"),
                        ))
                        .child(VNode::Element(
                            VElement::new("h1").class("page-hero__title").child(txt(&t!("page.home.hero.title"))),
                        ))
                        .child(VNode::Element(
                            VElement::new("p").class("page-hero__subtitle").child(txt(&t!("page.home.hero.subtitle"))),
                        ))
                        .child(VNode::Element(
                            VElement::new("p").class("page-hero__tagline").child(txt(&t!("page.home.hero.tagline"))),
                        ))
                        .child(VNode::Element(
                            VElement::new("div").class("page-hero__actions")
                                .child(glow_btn("/components", "hi-button hi-button-primary hi-button-lg", &t!("label.explore_components"), Some("→")))
                                .child(glow_btn("/system", "hi-button hi-button-secondary hi-button-lg", &t!("label.view_documentation"), None)),
                        )),
                )),
            ))
            .child(VNode::Element(
                VElement::new("section").class("page-section")
                    .child(VNode::Element(
                        VElement::new("h2").class("page-section__title").child(txt(&t!("page.home.section_what.title"))),
                    ))
                    .child(VNode::Element(
                        VElement::new("div").class("card-grid")
                            .child(glow_card(&t!("page.home.section_what.card_lib_title"), &t!("page.home.section_what.card_lib_desc")))
                            .child(glow_card(&t!("page.home.section_what.card_design_title"), &t!("page.home.section_what.card_design_desc")))
                            .child(glow_card(&t!("page.home.section_what.card_wasm_title"), &t!("page.home.section_what.card_wasm_desc"))),
                    )),
            ))
            .child(VNode::Element(
                VElement::new("section").class("page-section")
                    .child(VNode::Element(
                        VElement::new("h2").class("page-section__title").child(txt(&t!("page.home.section_demos.title"))),
                    ))
                    .child(VNode::Element(
                        VElement::new("p").class("page-section__desc").child(txt(&t!("page.home.section_demos.desc"))),
                    )),
            )),
    )
}
