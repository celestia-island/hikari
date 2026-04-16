use tairitsu_vdom::{get_bounding_client_rect, set_style, VElement, VNode};

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
            Self::Primary => "var(--hi-glow-button-primary, rgba(255,192,203,0.6))",
            Self::Ghost => "var(--hi-ghost-glow, rgba(128,128,128,0.5))",
            Self::Secondary => "var(--hi-glow-button-secondary, rgba(6,82,121,0.6))",
            Self::Danger => "var(--hi-glow-button-danger, rgba(239,68,68,0.6))",
            Self::Success => "var(--hi-glow-button-success, rgba(34,197,94,0.6))",
        }
    }
}

impl GlowIntensity {
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

pub fn glow_wrap(children: VNode, config: GlowConfig) -> VNode {
    let intensity_class = config.intensity.class_name();
    let color_var = config.color.css_var();

    let init_vars = format!("--glow-x:50%;--glow-y:50%;--hi-glow-color:{color_var};");

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

    let onmousemove = move |e: std::boxed::Box<dyn tairitsu_vdom::EventData>| {
        if let Some(me) = e.as_any().downcast_ref::<tairitsu_vdom::MouseEvent>() {
            let elem = me.current_target.or(me.target);
            if let Some(target) = elem {
                let rect = get_bounding_client_rect(target);
                if rect.width > 0.0 && rect.height > 0.0 {
                    let px = (me.offset_x as f64 / rect.width * 100.0).clamp(0.0, 100.0);
                    let py = (me.offset_y as f64 / rect.height * 100.0).clamp(0.0, 100.0);
                    set_style(target, "--glow-x", &format!("{:.1}%", px));
                    set_style(target, "--glow-y", &format!("{:.1}%", py));
                }
            }
        }
    };

    let onmouseleave = move |e: std::boxed::Box<dyn tairitsu_vdom::EventData>| {
        if let Some(me) = e.as_any().downcast_ref::<tairitsu_vdom::MouseEvent>() {
            let elem = me.current_target.or(me.target);
            if let Some(target) = elem {
                set_style(target, "--glow-x", "50%");
                set_style(target, "--glow-y", "50%");
            }
        }
    };

    VNode::Element(
        VElement::new("div")
            .class(classes)
            .attr("data-glow", "true")
            .attr("style", &init_vars)
            .on_event("mousemove", onmousemove)
            .on_event("mouseleave", onmouseleave)
            .child(children),
    )
}
