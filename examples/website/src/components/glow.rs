use std::cell::RefCell;
use std::rc::Rc;

use tairitsu_vdom::{
    get_bounding_client_rect, request_animation_frame, set_style, VElement, VNode,
};

#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub enum GlowIntensity {
    #[default]
    Soft,
    Dim,
    Bright,
}

#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub enum GlowColor {
    #[default]
    Primary,
    Ghost,
    Secondary,
    Danger,
    Success,
}

impl GlowColor {
    fn css_var(&self) -> &'static str {
        match self {
            Self::Primary => "var(--hi-glow-button-primary, rgba(245,169,169,0.10))",
            Self::Ghost => "var(--hi-ghost-glow, rgba(128,128,128,0.06))",
            Self::Secondary => "var(--hi-glow-button-secondary, rgba(81,154,115,0.08))",
            Self::Danger => "var(--hi-glow-button-danger, rgba(239,68,68,0.08))",
            Self::Success => "var(--hi-glow-button-success, rgba(34,197,94,0.08))",
        }
    }
}

impl GlowIntensity {
    fn opacity(&self) -> f32 {
        match self {
            Self::Dim => 0.35,
            Self::Soft => 0.50,
            Self::Bright => 0.80,
        }
    }
    fn spread(&self) -> f32 {
        match self {
            Self::Dim => 0.55,
            Self::Soft => 0.45,
            Self::Bright => 0.35,
        }
    }
    fn class_name(&self) -> &'static str {
        match self {
            Self::Dim => "hi-glow-dim",
            Self::Soft => "hi-glow-soft",
            Self::Bright => "hi-glow-bright",
        }
    }
}

pub struct GlowConfig {
    pub intensity: GlowIntensity,
    pub color: GlowColor,
    pub block: bool,
    pub extra_class: &'static str,
}

impl Default for GlowConfig {
    fn default() -> Self {
        Self {
            intensity: GlowIntensity::Soft,
            color: GlowColor::Primary,
            block: false,
            extra_class: "",
        }
    }
}

struct GlowState {
    element: u64,
    mouse_x: f64,
    mouse_y: f64,
    active: bool,
}

pub fn glow_wrap(children: VNode, config: GlowConfig) -> VNode {
    let intensity = config.intensity;
    let opacity = intensity.opacity();
    let spread = intensity.spread();
    let intensity_class = intensity.class_name();
    let color_var = config.color.css_var();

    let initial_style = format!(
        "--glow-x:50%;--glow-y:50%;--glow-opacity:{opacity};--glow-spread:{spread};--hi-glow-color:{color_var};"
    );

    let block_class = if config.block {
        " hi-glow-wrapper-block"
    } else {
        ""
    };
    let extra = if !config.extra_class.is_empty() {
        format!(" {}", config.extra_class)
    } else {
        String::new()
    };
    let classes = format!("hi-glow-wrapper{block_class} {intensity_class}{extra}");

    let state: Rc<RefCell<Option<GlowState>>> = Rc::new(RefCell::new(None));

    let onmouseenter = {
        let state = Rc::clone(&state);
        move |e: std::boxed::Box<dyn tairitsu_vdom::EventData>| {
            if let Some(me) = e.as_any().downcast_ref::<tairitsu_vdom::MouseEvent>() {
                let elem = me.current_target.or(me.target);
                if let Some(target) = elem {
                    let mut s = state.borrow_mut();
                    *s = Some(GlowState {
                        element: target,
                        mouse_x: 50.0,
                        mouse_y: 50.0,
                        active: true,
                    });
                    let rect = get_bounding_client_rect(target);
                    if rect.width > 0.0 && rect.height > 0.0 {
                        let px = (me.offset_x as f64 / rect.width * 100.0).clamp(0.0, 100.0);
                        let py = (me.offset_y as f64 / rect.height * 100.0).clamp(0.0, 100.0);
                        (*s).as_mut().unwrap().mouse_x = px;
                        (*s).as_mut().unwrap().mouse_y = py;
                    }
                    drop(s);
                    start_glow_loop(Rc::clone(&state));
                }
            }
        }
    };

    let onmousemove = {
        let state = Rc::clone(&state);
        move |e: std::boxed::Box<dyn tairitsu_vdom::EventData>| {
            if let Some(me) = e.as_any().downcast_ref::<tairitsu_vdom::MouseEvent>() {
                let elem = me.current_target.or(me.target);
                if let Some(target) = elem {
                    let mut s = state.borrow_mut();
                    if let Some(ref mut gs) = *s {
                        gs.element = target;
                        let rect = get_bounding_client_rect(target);
                        if rect.width > 0.0 && rect.height > 0.0 {
                            let px = (me.offset_x as f64 / rect.width * 100.0).clamp(0.0, 100.0);
                            let py = (me.offset_y as f64 / rect.height * 100.0).clamp(0.0, 100.0);
                            gs.mouse_x = px;
                            gs.mouse_y = py;
                        }
                    }
                }
            }
        }
    };

    let onmouseleave = {
        let state = Rc::clone(&state);
        move |e: std::boxed::Box<dyn tairitsu_vdom::EventData>| {
            if let Some(me) = e.as_any().downcast_ref::<tairitsu_vdom::MouseEvent>() {
                let elem = me.current_target.or(me.target);
                if let Some(target) = elem {
                    if let Some(ref mut gs) = *state.borrow_mut() {
                        gs.active = false;
                    }
                    set_style(target, "--glow-x", "50%");
                    set_style(target, "--glow-y", "50%");
                }
            }
        }
    };

    VNode::Element(
        VElement::new("div")
            .class(classes)
            .attr("data-glow", "true")
            .attr("style", &initial_style)
            .on_event("mouseenter", onmouseenter)
            .on_event("mousemove", onmousemove)
            .on_event("mouseleave", onmouseleave)
            .child(children),
    )
}

fn start_glow_loop(state: Rc<RefCell<Option<GlowState>>>) {
    request_animation_frame(Box::new(move |_timestamp| {
        let (element, x, y, still_active) = {
            let s = state.borrow();
            match s.as_ref() {
                Some(gs) => (gs.element, gs.mouse_x, gs.mouse_y, gs.active),
                None => return,
            }
        };

        if still_active {
            set_style(element, "--glow-x", &format!("{:.1}%", x));
            set_style(element, "--glow-y", &format!("{:.1}%", y));
            start_glow_loop(state);
        }
    }));
}
