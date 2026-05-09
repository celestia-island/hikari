use std::cell::{Cell, RefCell};
use std::rc::Rc;

use hikari_icons::generated::mdi_selected::get;
use hikari_icons::MdiIcon;
use tairitsu_vdom::{
    get_bounding_client_rect, set_attribute, set_style, DomHandle, EventData, MouseEvent,
    VElement, VNode, VText,
};
use tairitsu_web::wit_platform::WitElement;

use crate::hooks;

const DROPDOWN_MAX_HEIGHT: f64 = 240.0;
const DROPDOWN_MIN_WIDTH: f64 = 120.0;
const DROPDOWN_OFFSET: f64 = 4.0;
const VIEWPORT_PADDING: f64 = 8.0;

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
enum DropdownPlacement {
    Bottom,
    Top,
    Right,
    Left,
}

impl DropdownPlacement {
    fn default_arrow_direction(&self) -> &'static str {
        match self {
            Self::Bottom | Self::Top => "right",
            Self::Right | Self::Left => "down",
        }
    }

    fn open_arrow_direction(&self) -> &'static str {
        match self {
            Self::Bottom => "down",
            Self::Top => "up",
            Self::Right => "right",
            Self::Left => "left",
        }
    }
}

fn best_placement(
    trigger_x: f64,
    trigger_y: f64,
    trigger_w: f64,
    trigger_h: f64,
    vw: f64,
    vh: f64,
) -> DropdownPlacement {
    let space_bottom = vh - trigger_y - trigger_h - VIEWPORT_PADDING;
    let space_top = trigger_y - VIEWPORT_PADDING;
    let space_right = vw - trigger_x - trigger_w - VIEWPORT_PADDING;
    let space_left = trigger_x - VIEWPORT_PADDING;

    let need_height = DROPDOWN_MAX_HEIGHT.min(200.0);
    let need_width = DROPDOWN_MIN_WIDTH;

    if space_bottom >= need_height {
        DropdownPlacement::Bottom
    } else if space_top >= need_height {
        DropdownPlacement::Top
    } else if space_right >= need_width {
        DropdownPlacement::Right
    } else if space_left >= need_width {
        DropdownPlacement::Left
    } else if space_bottom >= space_top {
        DropdownPlacement::Bottom
    } else {
        DropdownPlacement::Top
    }
}

fn position_dropdown(
    placement: DropdownPlacement,
    dd_handle: DomHandle,
    trigger_x: f64,
    trigger_y: f64,
    trigger_w: f64,
    trigger_h: f64,
    _dd_width: f64,
) {
    match placement {
        DropdownPlacement::Bottom => {
            set_style(dd_handle, "left", &format!("{}px", trigger_x));
            set_style(dd_handle, "top", &format!("{}px", trigger_y + trigger_h + DROPDOWN_OFFSET));
            set_style(dd_handle, "bottom", "auto");
            set_style(dd_handle, "right", "auto");
        }
        DropdownPlacement::Top => {
            set_style(dd_handle, "left", &format!("{}px", trigger_x));
            set_style(dd_handle, "top", "auto");
            set_style(
                dd_handle,
                "bottom",
                &format!("{}px", vh_safety() - trigger_y + DROPDOWN_OFFSET),
            );
            set_style(dd_handle, "right", "auto");
        }
        DropdownPlacement::Right => {
            set_style(dd_handle, "left", &format!("{}px", trigger_x + trigger_w + DROPDOWN_OFFSET));
            set_style(dd_handle, "top", &format!("{}px", trigger_y));
            set_style(dd_handle, "bottom", "auto");
            set_style(dd_handle, "right", "auto");
        }
        DropdownPlacement::Left => {
            set_style(dd_handle, "left", "auto");
            set_style(dd_handle, "top", &format!("{}px", trigger_y));
            set_style(dd_handle, "bottom", "auto");
            set_style(
                dd_handle,
                "right",
                &format!("{}px", vw_safety() - trigger_x + DROPDOWN_OFFSET),
            );
        }
    }
}

#[cfg(target_arch = "wasm32")]
fn vh_safety() -> f64 {
    use tairitsu_web::wit_platform::wasm_impl::bindings::tairitsu_browser::full::window;
    window::get_inner_height() as f64
}

#[cfg(not(target_arch = "wasm32"))]
fn vh_safety() -> f64 {
    768.0
}

#[cfg(target_arch = "wasm32")]
fn vw_safety() -> f64 {
    use tairitsu_web::wit_platform::wasm_impl::bindings::tairitsu_browser::full::window;
    window::get_inner_width() as f64
}

#[cfg(not(target_arch = "wasm32"))]
fn vw_safety() -> f64 {
    1024.0
}

fn viewport_size() -> (f64, f64) {
    #[cfg(target_arch = "wasm32")]
    {
        use tairitsu_web::wit_platform::wasm_impl::bindings::tairitsu_browser::full::window;
        (window::get_inner_width() as f64, window::get_inner_height() as f64)
    }
    #[cfg(not(target_arch = "wasm32"))]
    {
        (1024.0, 768.0)
    }
}

fn build_icon_svg(icon: MdiIcon) -> String {
    get(icon.to_string().as_str())
        .map(|data| {
            format!(
                r#"<svg xmlns="http://www.w3.org/2000/svg" viewBox="{}" width="18" height="18"><path fill="currentColor" d="{}"/></svg>"#,
                data.view_box.as_deref().unwrap_or("0 0 24 24"),
                data.path.as_deref().unwrap_or("")
            )
        })
        .unwrap_or_else(|| String::from(
            r#"<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>"#
        ))
}

pub fn render(app_ref: Rc<RefCell<Option<Box<dyn std::any::Any>>>>) -> VNode {
    let current_lang = hooks::detect_language();
    let current_name = current_lang.native_name();

    let is_dark = Rc::new(Cell::new(false));
    let is_open = Rc::new(Cell::new(false));
    let current_placement: Rc<Cell<DropdownPlacement>> =
        Rc::new(Cell::new(DropdownPlacement::Bottom));

    let icon_ref: Rc<RefCell<Option<Box<dyn std::any::Any>>>> = Rc::new(RefCell::new(None));

    let app_ref_t = app_ref.clone();
    let is_dark_t = is_dark.clone();
    let icon_ref_t = icon_ref.clone();
    let theme_on_click = move |e: Box<dyn EventData>| {
        if let Some(_me) = e.as_any().downcast_ref::<MouseEvent>() {
            let dark = !is_dark_t.get();
            is_dark_t.set(dark);

            let theme_icon = if dark {
                MdiIcon::WhiteBalanceSunny
            } else {
                MdiIcon::MoonWaningCrescent
            };
            let svg_str = build_icon_svg(theme_icon);

            if let Some(ref cell) = *icon_ref_t.borrow() {
                if let Some(handle) = cell.downcast_ref::<WitElement>() {
                    let h = DomHandle::from_raw(handle.as_raw());
                    set_attribute(h, "innerHTML", &svg_str);
                    set_attribute(
                        h,
                        "class",
                        if dark {
                            "hi-aside-footer__icon hikari-icon hi-aside-footer__icon--dark"
                        } else {
                            "hi-aside-footer__icon hikari-icon"
                        },
                    );
                }
            }

            if let Some(ref cell) = *app_ref_t.borrow() {
                if let Some(handle) = cell.downcast_ref::<WitElement>() {
                    let h = DomHandle::from_raw(handle.as_raw());
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
    let arrow_ref: Rc<RefCell<Option<Box<dyn std::any::Any>>>> = Rc::new(RefCell::new(None));
    let backdrop_ref: Rc<RefCell<Option<Box<dyn std::any::Any>>>> = Rc::new(RefCell::new(None));

    let is_open_toggle = is_open.clone();
    let dropdown_ref_t = dropdown_ref.clone();
    let select_ref_t = select_ref.clone();
    let arrow_ref_t = arrow_ref.clone();
    let backdrop_ref_t = backdrop_ref.clone();
    let placement_t = current_placement.clone();
    let trigger_on_click = move |e: Box<dyn EventData>| {
        if let Some(me) = e.as_any().downcast_ref::<MouseEvent>() {
            let now_open = !is_open_toggle.get();
            is_open_toggle.set(now_open);

            if now_open {
                let mut trigger_rect_opt: Option<(f64, f64, f64, f64)> = None;

                if let Some(ref sc) = *select_ref_t.borrow() {
                    if let Some(sh) = sc.downcast_ref::<WitElement>() {
                        let handle = DomHandle::from_raw(sh.as_raw());
                        if handle.is_valid() {
                            let r = get_bounding_client_rect(handle);
                            trigger_rect_opt = Some((r.x, r.y, r.width, r.height));
                        }
                    }
                }

                if trigger_rect_opt.is_none() {
                    if let Some(ct) = me.current_target {
                        let handle = DomHandle::from_raw(ct);
                        if handle.is_valid() {
                            let r = get_bounding_client_rect(handle);
                            trigger_rect_opt = Some((r.x, r.y, r.width, r.height));
                        }
                    }
                }

                let (tx, ty, tw, th) = trigger_rect_opt.unwrap_or((0.0, 0.0, 120.0, 32.0));
                let (vw, vh) = viewport_size();
                let placement = best_placement(tx, ty, tw, th, vw, vh);
                placement_t.set(placement);

                if let Some(ref cell) = *dropdown_ref_t.borrow() {
                    if let Some(handle) = cell.downcast_ref::<WitElement>() {
                        let dd_h = DomHandle::from_raw(handle.as_raw());
                        position_dropdown(placement, dd_h, tx, ty, tw, th, DROPDOWN_MIN_WIDTH);
                        set_style(dd_h, "display", "block");
                    }
                }

                if let Some(ref sc) = *select_ref_t.borrow() {
                    if let Some(sh) = sc.downcast_ref::<WitElement>() {
                        let sel_h = DomHandle::from_raw(sh.as_raw());
                        set_attribute(sel_h, "class", "hi-select hi-select-sm hi-select-open");
                        set_attribute(sel_h, "aria-expanded", "true");
                    }
                }

                if let Some(ref ar) = *arrow_ref_t.borrow() {
                    if let Some(ah) = ar.downcast_ref::<WitElement>() {
                        let arr_h = DomHandle::from_raw(ah.as_raw());
                        let dir = placement.open_arrow_direction();
                        set_attribute(arr_h, "data-dir", dir);
                    }
                }

                if let Some(ref bc) = *backdrop_ref_t.borrow() {
                    if let Some(bh) = bc.downcast_ref::<WitElement>() {
                        set_style(DomHandle::from_raw(bh.as_raw()), "display", "block");
                    }
                }
            } else {
                close_dropdown(
                    &dropdown_ref_t,
                    &select_ref_t,
                    &arrow_ref_t,
                    &backdrop_ref_t,
                );
            }
        }
    };

    let is_open_close = is_open.clone();
    let dropdown_ref_c = dropdown_ref.clone();
    let select_ref_c = select_ref.clone();
    let arrow_ref_c = arrow_ref.clone();
    let backdrop_ref_c = backdrop_ref.clone();
    let backdrop_on_click = move |_e: Box<dyn EventData>| {
        if !is_open_close.get() {
            return;
        }
        is_open_close.set(false);
        close_dropdown(&dropdown_ref_c, &select_ref_c, &arrow_ref_c, &backdrop_ref_c);
    };

    let options: Vec<VNode> = hooks::supported_languages()
        .iter()
        .map(|(lang, name)| {
            let code = lang.code().to_string();
            let is_selected = *lang == current_lang;

            let is_open_opt = is_open.clone();
            let dropdown_ref_opt = dropdown_ref.clone();
            let select_ref_opt = select_ref.clone();
            let arrow_ref_opt = arrow_ref.clone();
            let backdrop_ref_opt = backdrop_ref.clone();

            VNode::Element(
                VElement::new("div")
                    .class(format!(
                        "hi-select-option{}",
                        if is_selected {
                            " hi-select-option--selected"
                        } else {
                            ""
                        }
                    ))
                    .attr("data-value", code.as_str())
                    .attr("role", "option")
                    .attr("aria-selected", if is_selected { "true" } else { "false" })
                    .on_event("click", move |_e: Box<dyn EventData>| {
                        is_open_opt.set(false);
                        close_dropdown(
                            &dropdown_ref_opt,
                            &select_ref_opt,
                            &arrow_ref_opt,
                            &backdrop_ref_opt,
                        );

                        #[cfg(target_arch = "wasm32")]
                        {
                            use tairitsu_web::i18n::set_locale;
                            set_locale(*lang);
                            use tairitsu_web::wit_platform::wasm_impl::bindings::tairitsu_browser::full;
                            let href = full::location::get_href();
                            let sep = if href.contains('#') { "" } else { "#" };
                            full::location::assign(&format!("{}{}lang={}", href, sep, code));
                        }
                    })
                    .child(VNode::Text(VText::new(*name))),
            )
        })
        .collect();

    VNode::Element(
        VElement::new("div")
            .class("hi-aside-footer")
            .child(VNode::Element(
                VElement::new("button")
                    .class("hi-aside-footer__btn")
                    .attr("type", "button")
                    .attr("role", "switch")
                    .attr("aria-checked", "false")
                    .attr("aria-label", &hikari_i18n::t!("label.toggle_dark_mode"))
                    .attr("title", hikari_i18n::t!("label.toggle_theme"))
                    .on_event("click", theme_on_click)
                    .child(VNode::Element(
                        VElement::new("span")
                            .class("hi-aside-footer__icon hikari-icon")
                            .ref_(icon_ref.clone())
                            .inner_html(build_icon_svg(MdiIcon::MoonWaningCrescent)),
                    )),
            ))
            .child(VNode::Element(
                VElement::new("div")
                    .class("hi-select hi-select-sm hi-select--borderless")
                    .attr("role", "combobox")
                    .attr("aria-haspopup", "listbox")
                    .attr("aria-expanded", "false")
                    .ref_(select_ref.clone())
                    .child(VNode::Element(
                        VElement::new("div")
                            .class("hi-select-trigger hi-select-trigger--borderless")
                            .on_event("click", trigger_on_click)
                            .child(VNode::Element(
                                VElement::new("span")
                                    .class("hi-select-value")
                                    .child(VNode::Text(VText::new(current_name))),
                            ))
                            .child(VNode::Element(
                                VElement::new("span")
                                    .class("hi-select-arrow")
                                    .attr("data-dir", "right")
                                    .attr("aria-hidden", "true")
                                    .ref_(arrow_ref.clone())
                                    .inner_html(
                                        r#"<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>"#,
                                    ),
                            )),
                    ))
                    .child(VNode::Element(
                        VElement::new("div")
                            .class("hi-select-dropdown")
                            .attr("role", "listbox")
                            .ref_(dropdown_ref.clone())
                            .children(options),
                    )),
            ))
            .child(VNode::Element(
                VElement::new("div")
                    .attr("data-dropdown-backdrop", "true")
                    .class("dropdown-backdrop")
                    .ref_(backdrop_ref.clone())
                    .on_event("click", backdrop_on_click),
            )),
    )
}

fn close_dropdown(
    dropdown_ref: &Rc<RefCell<Option<Box<dyn std::any::Any>>>>,
    select_ref: &Rc<RefCell<Option<Box<dyn std::any::Any>>>>,
    arrow_ref: &Rc<RefCell<Option<Box<dyn std::any::Any>>>>,
    backdrop_ref: &Rc<RefCell<Option<Box<dyn std::any::Any>>>>,
) {
    if let Some(ref cell) = *dropdown_ref.borrow() {
        if let Some(handle) = cell.downcast_ref::<WitElement>() {
            set_style(DomHandle::from_raw(handle.as_raw()), "display", "none");
        }
    }
    if let Some(ref sc) = *select_ref.borrow() {
        if let Some(sh) = sc.downcast_ref::<WitElement>() {
            set_attribute(
                DomHandle::from_raw(sh.as_raw()),
                "class",
                "hi-select hi-select-sm hi-select--borderless",
            );
            set_attribute(DomHandle::from_raw(sh.as_raw()), "aria-expanded", "false");
        }
    }
    if let Some(ref ar) = *arrow_ref.borrow() {
        if let Some(ah) = ar.downcast_ref::<WitElement>() {
            set_attribute(DomHandle::from_raw(ah.as_raw()), "data-dir", "right");
        }
    }
    if let Some(ref bc) = *backdrop_ref.borrow() {
        if let Some(bh) = bc.downcast_ref::<WitElement>() {
            set_style(DomHandle::from_raw(bh.as_raw()), "display", "none");
        }
    }
}
