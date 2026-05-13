use tairitsu_vdom::{VElement, VNode, get_bounding_client_rect, set_style};

pub use hikari_components::feedback::glow::{GlowBlur, GlowColor, GlowIntensity};

pub struct GlowConfig {
    pub intensity: GlowIntensity,
    pub color: GlowColor,
    pub block: bool,
    pub blur: GlowBlur,
    pub extra_class: &'static str,
    pub radius: &'static str,
}

impl Default for GlowConfig {
    fn default() -> Self {
        Self {
            intensity: GlowIntensity::Soft,
            color: GlowColor::Primary,
            block: false,
            blur: GlowBlur::None,
            extra_class: "",
            radius: "var(--hi-button-radius, var(--hi-radius-md, 8px))",
        }
    }
}

pub fn glow_wrap(children: VNode, config: GlowConfig) -> VNode {
    let intensity_class = match config.intensity {
        GlowIntensity::Dim => "hi-glow-dim",
        GlowIntensity::Soft => "hi-glow-soft",
        GlowIntensity::Bright => "hi-glow-bright",
    };

    let blur_class = match config.blur {
        GlowBlur::None => "hi-glow-blur-none",
        GlowBlur::Light => "hi-glow-blur-light",
        GlowBlur::Medium => "hi-glow-blur-medium",
        GlowBlur::Heavy => "hi-glow-blur-heavy",
    };

    let glow_color = match config.color {
        GlowColor::Ghost => "var(--hi-ghost-glow, rgba(128, 128, 128, 0.5))",
        GlowColor::Primary => "var(--hi-glow-button-primary)",
        GlowColor::Secondary => "var(--hi-glow-button-secondary)",
        GlowColor::Danger => "var(--hi-glow-button-danger)",
        GlowColor::Success => "var(--hi-glow-button-success)",
        GlowColor::Warning => "var(--hi-glow-button-warning)",
        GlowColor::Info => "var(--hi-glow-button-info)",
    };

    let radius = config.radius;
    let base_opacity = match config.intensity {
        GlowIntensity::Dim => 0.07,
        GlowIntensity::Soft => 0.15,
        GlowIntensity::Bright => 0.30,
    };

    let init_vars = format!(
        "--hi-glow-x:50%;--hi-glow-y:50%;--hi-glow-color:{glow_color};--hi-glow-radius:{radius};--hi-glow-opacity:{base_opacity:.3};--hi-glow-intensity-scale:0;"
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
    let classes = format!("hi-glow-wrapper{block_class} {blur_class} {intensity_class}{extra}");

    let onmousemove = move |e: std::boxed::Box<dyn tairitsu_vdom::EventData>| {
        if let Some(me) = e.as_any().downcast_ref::<tairitsu_vdom::MouseEvent>() {
            let elem = me.current_target.or(me.target);
            if let Some(target) = elem {
                let h = tairitsu_vdom::DomHandle::from_raw(target);
                let rect = get_bounding_client_rect(h);
                if rect.width > 0.0 && rect.height > 0.0 {
                    let px = (me.offset_x as f64 / rect.width * 100.0).clamp(0.0, 100.0);
                    let py = (me.offset_y as f64 / rect.height * 100.0).clamp(0.0, 100.0);
                    set_style(h, "--hi-glow-x", &format!("{:.1}%", px));
                    set_style(h, "--hi-glow-y", &format!("{:.1}%", py));
                    set_style(h, "--hi-glow-intensity-scale", "0.5");
                    set_style(h, "--hi-glow-opacity", &format!("{:.3}", base_opacity * 2.0));
                }
            }
        }
    };

    let onmouseleave = move |e: std::boxed::Box<dyn tairitsu_vdom::EventData>| {
        if let Some(me) = e.as_any().downcast_ref::<tairitsu_vdom::MouseEvent>() {
            let elem = me.current_target.or(me.target);
            if let Some(target) = elem {
                let h = tairitsu_vdom::DomHandle::from_raw(target);
                set_style(h, "--hi-glow-x", "50%");
                set_style(h, "--hi-glow-y", "50%");
                set_style(h, "--hi-glow-intensity-scale", "0");
                set_style(h, "--hi-glow-opacity", "0");
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
