use tairitsu_vdom::{VElement, VNode, VText};

use crate::hooks::{self, Language};

const THEME_TOGGLE_JS: &str = r#"(function(){var a=document.getElementById('hikari-app');if(!a)return;var t=a.getAttribute('data-theme')||'hikari';var n=t==='hikari'?'tairitsu':'hikari';a.setAttribute('data-theme',n);if(t==='hikari'){a.classList.remove('hi-layout-light');a.classList.add('hi-layout-dark')}else{a.classList.remove('hi-layout-dark');a.classList.add('hi-layout-light')}this.textContent=n==='hikari'?'\u263E':'\u2600';})()""#;

const LANG_CHANGE_JS: &str =
    r#"(function(){location.hash='#lang='+this.value;location.reload();})()""#;

pub fn render() -> VNode {
    let mut lang_options: Vec<VNode> = Vec::new();

    let current_lang = hooks::detect_language();
    for (lang, name) in hooks::supported_languages() {
        let mut option = VElement::new("option")
            .attr("value", lang.code())
            .child(VNode::Text(VText::new(name)));
        if *lang == current_lang {
            option = option.attr("selected", "");
        }
        lang_options.push(VNode::Element(option));
    }

    VNode::Element(
        VElement::new("div")
            .class("hi-aside-footer")
            .child(VNode::Element(
                VElement::new("button")
                    .class("hi-aside-footer__btn")
                    .attr("title", "Toggle theme")
                    .attr("onclick", THEME_TOGGLE_JS)
                    .child(VNode::Text(VText::new(if current_lang == Language::En {
                        "\u{263E}"
                    } else {
                        "\u{263E}"
                    }))),
            ))
            .child(VNode::Element(
                VElement::new("select")
                    .class("hi-aside-footer__select")
                    .attr("title", "Language")
                    .attr("onchange", LANG_CHANGE_JS)
                    .children(lang_options),
            )),
    )
}
