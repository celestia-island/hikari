use tairitsu_vdom::{EventHandler, MouseEvent, VText};

use crate::basic::button::{ButtonAnimation, ButtonProps, ButtonSize, ButtonVariant, ButtonWidth};
use crate::prelude::*;
use crate::utils::glow_types::{GlowBlur, GlowColor, GlowIntensity};

pub struct ButtonBuilder {
    label: Option<String>,
    variant: ButtonVariant,
    size: ButtonSize,
    width: ButtonWidth,
    disabled: bool,
    loading: bool,
    block: bool,
    glow: bool,
    glow_blur: GlowBlur,
    glow_color: Option<GlowColor>,
    glow_intensity: GlowIntensity,
    animation: ButtonAnimation,
    class: String,
    on_click: Option<EventHandler<MouseEvent>>,
}

impl ButtonBuilder {
    #[must_use]
    pub fn new() -> Self {
        Self {
            label: None,
            variant: ButtonVariant::default(),
            size: ButtonSize::default(),
            width: ButtonWidth::default(),
            disabled: false,
            loading: false,
            block: false,
            glow: true,
            glow_blur: GlowBlur::default(),
            glow_color: None,
            glow_intensity: GlowIntensity::default(),
            animation: ButtonAnimation::default(),
            class: String::new(),
            on_click: None,
        }
    }

    pub fn label(mut self, label: impl Into<String>) -> Self {
        self.label = Some(label.into());
        self
    }

    #[must_use]
    pub fn variant(mut self, variant: ButtonVariant) -> Self {
        self.variant = variant;
        self
    }

    #[must_use]
    pub fn size(mut self, size: ButtonSize) -> Self {
        self.size = size;
        self
    }

    #[must_use]
    pub fn width(mut self, width: ButtonWidth) -> Self {
        self.width = width;
        self
    }

    #[must_use]
    pub fn disabled(mut self, disabled: bool) -> Self {
        self.disabled = disabled;
        self
    }

    #[must_use]
    pub fn loading(mut self, loading: bool) -> Self {
        self.loading = loading;
        self
    }

    #[must_use]
    pub fn block(mut self, block: bool) -> Self {
        self.block = block;
        self
    }

    #[must_use]
    pub fn glow(mut self, enabled: bool) -> Self {
        self.glow = enabled;
        self
    }

    #[must_use]
    pub fn glow_blur(mut self, blur: GlowBlur) -> Self {
        self.glow_blur = blur;
        self
    }

    #[must_use]
    pub fn glow_color(mut self, color: GlowColor) -> Self {
        self.glow_color = Some(color);
        self
    }

    #[must_use]
    pub fn glow_intensity(mut self, intensity: GlowIntensity) -> Self {
        self.glow_intensity = intensity;
        self
    }

    #[must_use]
    pub fn animation(mut self, animation: ButtonAnimation) -> Self {
        self.animation = animation;
        self
    }

    pub fn class(mut self, class: impl Into<String>) -> Self {
        self.class = class.into();
        self
    }

    pub fn on_click(mut self, handler: impl Fn(MouseEvent) + 'static) -> Self {
        self.on_click = Some(EventHandler::new(handler));
        self
    }

    #[must_use]
    pub fn build(self) -> Element {
        let label = self.label.unwrap_or_default();
        let children = VNode::Text(VText::new(&label));

        crate::basic::Button(ButtonProps {
            variant: self.variant,
            size: self.size,
            width: self.width,
            disabled: self.disabled,
            loading: self.loading,
            block: self.block,
            glow: self.glow,
            glow_blur: self.glow_blur,
            glow_color: self.glow_color,
            glow_intensity: self.glow_intensity,
            animation: self.animation,
            class: self.class,
            onclick: self.on_click,
            icon: None,
            suffix: None,
            icon_color: None,
            text_color: None,
            background_color: None,
            border_color: None,
            animation_id: None,
            css_vars: None,
            children,
        })
    }
}

impl Default for ButtonBuilder {
    fn default() -> Self {
        Self::new()
    }
}
