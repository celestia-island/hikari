use tairitsu_vdom::{VElement, VNode, VText};

use crate::hooks::{self, Language};

const THEME_TOGGLE_JS: &str = r#"(function(){var el=event.currentTarget;var a=document.getElementById('hikari-app');if(!a)return;var t=a.getAttribute('data-theme')||'hikari';var n=t==='hikari'?'tairitsu':'hikari';a.setAttribute('data-theme',n);if(t==='hikari'){a.classList.remove('hi-layout-light');a.classList.add('hi-layout-dark')}else{a.classList.remove('hi-layout-dark');a.classList.add('hi-layout-light')}var b=el.querySelector('.hi-aside-footer__icon');if(b){b.textContent=n==='hikari'?'\u263E':'\u2600'}})()""#;

const LANG_SELECT_JS: &str = r#"(function(){
  var el=event.currentTarget;
  var trigger=el.closest('.hi-select');
  if(!trigger) return;
  var isOpen=trigger.classList.toggle('hi-select-open');
  if(!isOpen) return;
  function close(e){
    if(!trigger.contains(e.target)){
      trigger.classList.remove('hi-select-open');
      document.removeEventListener('click',close);
    }
  }
  setTimeout(function(){document.addEventListener('click',close)},0);
})()""#;

const LANG_OPTION_JS: &str = r#"(function(){
  var el=event.currentTarget;
  var val=el.getAttribute('data-value');
  var trigger=el.closest('.hi-select');
  if(trigger){
    var label=trigger.querySelector('.hi-select-value');
    if(label) label.textContent=el.textContent;
    trigger.classList.remove('hi-select-open');
  }
  location.hash='#lang='+val;
  location.reload();
})()""#;

fn option(label: &str, code: &str, selected: bool) -> VNode {
    let mut classes = "hi-select-option".to_string();
    if selected {
        classes.push_str(" hi-select-option--selected");
    }
    VNode::Element(
        VElement::new("div")
            .class(classes)
            .attr("data-value", code)
            .attr("onclick", LANG_OPTION_JS)
            .child(VNode::Text(VText::new(label))),
    )
}

pub fn render() -> VNode {
    let current_lang = hooks::detect_language();
    let current_code = current_lang.code();
    let current_name = current_lang.native_name();

    let options: Vec<VNode> = hooks::supported_languages()
        .iter()
        .map(|(lang, name)| option(name, lang.code(), *lang == current_lang))
        .collect();

    VNode::Element(
        VElement::new("div")
            .class("hi-aside-footer")
            .child(VNode::Element(
                VElement::new("button")
                    .class("hi-aside-footer__btn")
                    .attr("title", "Toggle theme")
                    .attr("onclick", THEME_TOGGLE_JS)
                    .child(VNode::Element(
                        VElement::new("span")
                            .class("hi-aside-footer__icon")
                            .child(VNode::Text(VText::new("\u{263E}"))),
                    )),
            ))
            .child(VNode::Element(
                VElement::new("div")
                    .class("hi-select hi-select-sm")
                    .child(VNode::Element(
                        VElement::new("div")
                            .class("hi-select-trigger hi-select-sm")
                            .attr("onclick", LANG_SELECT_JS)
                            .child(VNode::Element(
                                VElement::new("span")
                                    .class("hi-select-value")
                                    .child(VNode::Text(VText::new(current_name))),
                            ))
                            .child(VNode::Element(
                                VElement::new("span")
                                    .class("hi-select-arrow")
                                    .inner_html(
                                        r#"<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>"#,
                                    ),
                            )),
                    ))
                    .child(VNode::Element(
                        VElement::new("div")
                            .class("hi-select-dropdown")
                            .children(options),
                    )),
            )),
    )
}
