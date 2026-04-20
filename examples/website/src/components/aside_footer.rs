use std::cell::{Cell, RefCell};
use std::rc::Rc;

use tairitsu_vdom::{
    get_bounding_client_rect, set_attribute, set_style, DomHandle, EventData, MouseEvent,
    VElement, VNode, VText,
};

use crate::hooks;

pub fn render(app_ref: Rc<RefCell<Option<Box<dyn std::any::Any>>>>) -> VNode {
    let current_lang = hooks::detect_language();
    let current_name = current_lang.native_name();

    let is_dark = Rc::new(Cell::new(false));
    let is_open = Rc::new(Cell::new(false));

    let app_ref_t = app_ref.clone();
    let is_dark_t = is_dark.clone();
    let theme_on_click = move |e: Box<dyn EventData>| {
        if let Some(_me) = e.as_any().downcast_ref::<MouseEvent>() {
            let dark = !is_dark_t.get();
            is_dark_t.set(dark);
            if let Some(ref cell) = *app_ref_t.borrow() {
                if let Some(handle) = cell.downcast_ref::<u64>() {
                    let h = DomHandle::from_raw(*handle);
                    let theme = if dark { "tairitsu" } else { "hikari" };
                    set_attribute(h, "data-theme", theme);
                    set_attribute(
                        h,
                        "class",
                        if dark {
                            "hi-layout hi-layout-dark hi-layout-has-sidebar hi-ambient-bg"
                        } else {
                            "hi-layout hi-layout-light hi-layout-has-sidebar hi-ambient-bg"
                        },
                    );
                }
            }
        }
    };

    let dropdown_ref: Rc<RefCell<Option<Box<dyn std::any::Any>>>> = Rc::new(RefCell::new(None));
    let select_ref: Rc<RefCell<Option<Box<dyn std::any::Any>>>> = Rc::new(RefCell::new(None));
    let backdrop_ref: Rc<RefCell<Option<Box<dyn std::any::Any>>>> = Rc::new(RefCell::new(None));

    let is_open_toggle = is_open.clone();
    let dropdown_ref_t = dropdown_ref.clone();
    let select_ref_t = select_ref.clone();
    let backdrop_ref_t = backdrop_ref.clone();
    let trigger_on_click = move |e: Box<dyn EventData>| {
        if let Some(me) = e.as_any().downcast_ref::<MouseEvent>() {
            let now_open = !is_open_toggle.get();
            is_open_toggle.set(now_open);

            if let Some(ref cell) = *dropdown_ref_t.borrow() {
                if let Some(handle) = cell.downcast_ref::<u64>() {
                    let dd_h = DomHandle::from_raw(*handle);
                    if now_open {
                        if let Some(target) = me.current_target {
                            let trigger_h = DomHandle::from_raw(target);
                            let rect = get_bounding_client_rect(trigger_h);
                            set_style(dd_h, "left", &format!("{}px", rect.x));
                            set_style(
                                dd_h,
                                "width",
                                &format!("{}px", rect.width.max(120.0)),
                            );
                            set_style(
                                dd_h,
                                "bottom",
                                &format!("calc(100vh - {}px)", rect.y - 4.0),
                            );
                            set_style(dd_h, "top", "auto");
                            set_style(dd_h, "display", "block");
                        }
                        if let Some(ref sc) = *select_ref_t.borrow() {
                            if let Some(sh) = sc.downcast_ref::<u64>() {
                                set_attribute(
                                    DomHandle::from_raw(*sh),
                                    "class",
                                    "hi-select hi-select-sm hi-select-open",
                                );
                            }
                        }
                        if let Some(ref bc) = *backdrop_ref_t.borrow() {
                            if let Some(bh) = bc.downcast_ref::<u64>() {
                                set_style(DomHandle::from_raw(*bh), "display", "block");
                            }
                        }
                    } else {
                        set_style(dd_h, "display", "none");
                        if let Some(ref sc) = *select_ref_t.borrow() {
                            if let Some(sh) = sc.downcast_ref::<u64>() {
                                set_attribute(
                                    DomHandle::from_raw(*sh),
                                    "class",
                                    "hi-select hi-select-sm",
                                );
                            }
                        }
                        if let Some(ref bc) = *backdrop_ref_t.borrow() {
                            if let Some(bh) = bc.downcast_ref::<u64>() {
                                set_style(DomHandle::from_raw(*bh), "display", "none");
                            }
                        }
                    }
                }
            }
        }
    };

    let is_open_close = is_open.clone();
    let dropdown_ref_c = dropdown_ref.clone();
    let select_ref_c = select_ref.clone();
    let backdrop_ref_c = backdrop_ref.clone();
    let backdrop_on_click = move |_e: Box<dyn EventData>| {
        if !is_open_close.get() {
            return;
        }
        is_open_close.set(false);
        if let Some(ref cell) = *dropdown_ref_c.borrow() {
            if let Some(handle) = cell.downcast_ref::<u64>() {
                set_style(DomHandle::from_raw(*handle), "display", "none");
            }
        }
        if let Some(ref sc) = *select_ref_c.borrow() {
            if let Some(sh) = sc.downcast_ref::<u64>() {
                set_attribute(
                    DomHandle::from_raw(*sh),
                    "class",
                    "hi-select hi-select-sm",
                );
            }
        }
        if let Some(ref bc) = *backdrop_ref_c.borrow() {
            if let Some(bh) = bc.downcast_ref::<u64>() {
                set_style(DomHandle::from_raw(*bh), "display", "none");
            }
        }
    };

    let options: Vec<VNode> = hooks::supported_languages()
        .iter()
        .map(|(lang, name)| {
            let code = lang.code().to_string();
            let is_open_opt = is_open.clone();
            let dropdown_ref_opt = dropdown_ref.clone();
            let select_ref_opt = select_ref.clone();
            let backdrop_ref_opt = backdrop_ref.clone();
            VNode::Element(
                VElement::new("div")
                    .class(format!(
                        "hi-select-option{}",
                        if *lang == current_lang {
                            " hi-select-option--selected"
                        } else {
                            ""
                        }
                    ))
                    .attr("data-value", code.as_str())
                    .on_event("click", move |e: Box<dyn EventData>| {
                        is_open_opt.set(false);
                        if let Some(ref cell) = *dropdown_ref_opt.borrow() {
                            if let Some(handle) = cell.downcast_ref::<u64>() {
                                set_style(DomHandle::from_raw(*handle), "display", "none");
                            }
                        }
                        if let Some(ref sc) = *select_ref_opt.borrow() {
                            if let Some(sh) = sc.downcast_ref::<u64>() {
                                set_attribute(
                                    DomHandle::from_raw(*sh),
                                    "class",
                                    "hi-select hi-select-sm",
                                );
                            }
                        }
                        if let Some(ref bc) = *backdrop_ref_opt.borrow() {
                            if let Some(bh) = bc.downcast_ref::<u64>() {
                                set_style(DomHandle::from_raw(*bh), "display", "none");
                            }
                        }
                        #[cfg(target_arch = "wasm32")]
                        {
                            use tairitsu_web::wit_platform::wasm_impl::bindings::tairitsu_browser::full::history;
                            history::push_state("", "", Some(&format!("#lang={}", code)));
                            history::go(Some(0));
                        }
                    })
                    .child(VNode::Text(VText::new(*name))),
            )
        })
        .collect();

    VNode::Element(
        VElement::new("div")
            .class("hi-aside-footer")
            .child(
                VNode::Element(
                    VElement::new("button")
                        .class("hi-aside-footer__btn")
                        .attr("title", "Toggle theme")
                        .on_event("click", theme_on_click)
                        .child(VNode::Element(
                            VElement::new("span")
                                .class("hi-aside-footer__icon")
                                .child(VNode::Text(VText::new("\u{263E}"))),
                        )),
                ),
            )
            .child(
                VNode::Element(
                    VElement::new("div")
                        .class("hi-select hi-select-sm")
                        .ref_(select_ref.clone())
                        .child(
                            VNode::Element(
                                VElement::new("div")
                                    .class("hi-select-trigger hi-select-sm")
                                    .on_event("click", trigger_on_click)
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
                            ),
                        )
                        .child(
                            VNode::Element(
                                VElement::new("div")
                                    .class("hi-select-dropdown")
                                    .ref_(dropdown_ref.clone())
                                    .children(options),
                            ),
                        ),
                ),
            )
            .child(
                VNode::Element(
                    VElement::new("div")
                        .attr("data-dropdown-backdrop", "true")
                        .style("position:fixed;inset:0;z-index:9998;display:none;")
                        .ref_(backdrop_ref.clone())
                        .on_event("click", backdrop_on_click),
                ),
            ),
    )
}
