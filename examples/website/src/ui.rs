//! UI components with animation support
//!
//! This module provides VElement builders for common UI components
//! that integrate seamlessly with the hikari-animation system.

use crate::animation::{animation_attrs, AnimationId};
use tairitsu_vdom::{VElement, VNode};

/// Button component with animation support
pub struct Button {
    element: VElement,
}

impl Button {
    /// Create a new button
    pub fn new() -> Self {
        Self {
            element: VElement::new("button").class("hi-btn hi-btn--primary"),
        }
    }

    /// Set button text
    pub fn text(mut self, text: impl Into<String>) -> Self {
        use tairitsu_vdom::VText;
        let text_str = text.into();
        self.element = self.element.child(VNode::Text(VText::new(&text_str)));
        self
    }

    /// Set button variant
    pub fn variant(mut self, variant: ButtonVariant) -> Self {
        self.element = self.element.class(variant.class_name());
        self
    }

    /// Set button size
    pub fn size(mut self, size: ButtonSize) -> Self {
        self.element = self.element.class(size.class_name());
        self
    }

    /// Set button as disabled
    pub fn disabled(mut self, disabled: bool) -> Self {
        if disabled {
            self.element = self.element.attr("disabled", "true");
        }
        self
    }

    /// Add animation to button
    pub fn animation(mut self, animation: AnimationId) -> Self {
        for (name, value) in animation_attrs(animation) {
            self.element = self.element.attr(name, &value);
        }
        self
    }

    /// Add custom class
    pub fn class(mut self, class: impl Into<String>) -> Self {
        let class_str = class.into();
        self.element = self.element.class(class_str.as_str());
        self
    }

    /// Add custom attribute
    pub fn attr(mut self, name: impl Into<String>, value: impl Into<String>) -> Self {
        let name_str = name.into();
        let value_str = value.into();
        self.element = self.element.attr(&name_str, &value_str);
        self
    }

    /// Build into VNode
    pub fn build(self) -> VNode {
        VNode::Element(self.element)
    }
}

impl Default for Button {
    fn default() -> Self {
        Self::new()
    }
}

/// Button variants
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum ButtonVariant {
    Primary,
    Secondary,
    Danger,
    Ghost,
}

impl ButtonVariant {
    fn class_name(&self) -> &'static str {
        match self {
            Self::Primary => "hi-btn--primary",
            Self::Secondary => "hi-btn--secondary",
            Self::Danger => "hi-btn--danger",
            Self::Ghost => "hi-btn--ghost",
        }
    }
}

/// Button sizes
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum ButtonSize {
    Small,
    Medium,
    Large,
}

impl ButtonSize {
    fn class_name(&self) -> &'static str {
        match self {
            Self::Small => "hi-btn--sm",
            Self::Medium => "",
            Self::Large => "hi-btn--lg",
        }
    }
}

/// Input component with animation support
pub struct Input {
    element: VElement,
}

impl Input {
    /// Create a new input
    pub fn new() -> Self {
        Self {
            element: VElement::new("input").class("hi-input"),
        }
    }

    /// Set input type
    pub fn input_type(mut self, input_type: InputType) -> Self {
        self.element = self.element.attr("type", input_type.as_str());
        self
    }

    /// Set placeholder
    pub fn placeholder(mut self, placeholder: impl Into<String>) -> Self {
        let placeholder_str = placeholder.into();
        self.element = self.element.attr("placeholder", &placeholder_str);
        self
    }

    /// Set value
    pub fn value(mut self, value: impl Into<String>) -> Self {
        let value_str = value.into();
        self.element = self.element.attr("value", &value_str);
        self
    }

    /// Set as disabled
    pub fn disabled(mut self, disabled: bool) -> Self {
        if disabled {
            self.element = self.element.attr("disabled", "true");
        }
        self
    }

    /// Set error state
    pub fn error(mut self, error: bool) -> Self {
        if error {
            self.element = self.element.class("hi-input--error");
        }
        self
    }

    /// Add animation to input
    pub fn animation(mut self, animation: AnimationId) -> Self {
        for (name, value) in animation_attrs(animation) {
            self.element = self.element.attr(name, &value);
        }
        self
    }

    /// Add custom class
    pub fn class(mut self, class: impl Into<String>) -> Self {
        let class_str = class.into();
        self.element = self.element.class(class_str.as_str());
        self
    }

    /// Add custom attribute
    pub fn attr(mut self, name: impl Into<String>, value: impl Into<String>) -> Self {
        let name_str = name.into();
        let value_str = value.into();
        self.element = self.element.attr(&name_str, &value_str);
        self
    }

    /// Build into VNode
    pub fn build(self) -> VNode {
        VNode::Element(self.element)
    }
}

impl Default for Input {
    fn default() -> Self {
        Self::new()
    }
}

/// Input types
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum InputType {
    Text,
    Password,
    Email,
    Number,
    Search,
    Tel,
    Url,
}

impl InputType {
    fn as_str(&self) -> &'static str {
        match self {
            Self::Text => "text",
            Self::Password => "password",
            Self::Email => "email",
            Self::Number => "number",
            Self::Search => "search",
            Self::Tel => "tel",
            Self::Url => "url",
        }
    }
}

/// Card component with animation support
pub struct Card {
    element: VElement,
}

impl Card {
    /// Create a new card
    pub fn new() -> Self {
        Self {
            element: VElement::new("div").class("card"),
        }
    }

    /// Set card as clickable (adds link behavior)
    pub fn clickable(mut self, href: impl Into<String>) -> Self {
        let href_str = href.into();
        self.element = VElement::new("a")
            .class("card card--link")
            .attr("href", &href_str);
        self
    }

    /// Add animation to card
    pub fn animation(mut self, animation: AnimationId) -> Self {
        for (name, value) in animation_attrs(animation) {
            self.element = self.element.attr(name, &value);
        }
        self
    }

    /// Set card title
    pub fn title(mut self, title: impl Into<String>) -> Self {
        use tairitsu_vdom::VText;
        let title_str = title.into();
        self.element = self.element.child(VNode::Element(
            VElement::new("h3")
                .class("card__title")
                .child(VNode::Text(VText::new(&title_str))),
        ));
        self
    }

    /// Set card body content
    pub fn body(mut self, content: impl Into<String>) -> Self {
        use tairitsu_vdom::VText;
        let content_str = content.into();
        self.element = self.element.child(VNode::Element(
            VElement::new("p")
                .class("card__body")
                .child(VNode::Text(VText::new(&content_str))),
        ));
        self
    }

    /// Add custom child
    pub fn child(mut self, child: VNode) -> Self {
        self.element = self.element.child(child);
        self
    }

    /// Add custom class
    pub fn class(mut self, class: impl Into<String>) -> Self {
        let class_str = class.into();
        self.element = self.element.class(class_str.as_str());
        self
    }

    /// Add custom attribute
    pub fn attr(mut self, name: impl Into<String>, value: impl Into<String>) -> Self {
        let name_str = name.into();
        let value_str = value.into();
        self.element = self.element.attr(&name_str, &value_str);
        self
    }

    /// Build into VNode
    pub fn build(self) -> VNode {
        VNode::Element(self.element)
    }
}

impl Default for Card {
    fn default() -> Self {
        Self::new()
    }
}

/// Convenience function to create a button with hover scale animation
pub fn button_hover_scale(text: impl Into<String>) -> VNode {
    Button::new()
        .text(text)
        .animation(AnimationId::HoverScale)
        .build()
}

/// Convenience function to create a button with hover glow animation
pub fn button_hover_glow(text: impl Into<String>) -> VNode {
    Button::new()
        .text(text)
        .animation(AnimationId::HoverGlow)
        .build()
}

/// Convenience function to create an input with focus glow animation
pub fn input_focus_glow(placeholder: impl Into<String>) -> VNode {
    Input::new()
        .placeholder(placeholder)
        .animation(AnimationId::FocusGlow)
        .build()
}

/// Convenience function to create a card with hover lift animation
pub fn card_hover_lift(title: impl Into<String>, body: impl Into<String>) -> VNode {
    Card::new()
        .title(title)
        .body(body)
        .animation(AnimationId::HoverLift)
        .build()
}
