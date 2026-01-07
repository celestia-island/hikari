// hi-components/src/basic/button.rs
// Button component with Arknights + FUI styling

use dioxus::prelude::*;
use wasm_bindgen::prelude::*;

#[cfg(target_arch = "wasm32")]
use wasm_bindgen::JsCast;
#[cfg(target_arch = "wasm32")]
use web_sys::HtmlElement;
#[cfg(target_arch = "wasm32")]
use std::collections::HashMap;
#[cfg(target_arch = "wasm32")]
use wasm_bindgen::JsValue;
#[cfg(target_arch = "wasm32")]
use animation::AnimationBuilder;
#[cfg(target_arch = "wasm32")]
use animation::style::CssProperty;

use crate::styled::StyledComponent;

/// Animation types for button hover/focus effects
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum ButtonAnimation {
    /// No animation
    #[default]
    None,
    /// Subtle scale animation (1.0 → 1.05)
    Scale,
    /// Scale with shadow elevation
    ScaleElevate,
    /// Ripple effect on click
    Ripple,
    /// Icon rotation (if icon present)
    IconRotate,
}

/// Button component type wrapper (for implementing StyledComponent)
pub struct ButtonComponent;

/// Button visual variants
///
/// Different visual styles for a button component.
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum ButtonVariant {
    /// Primary button (most prominent, uses primary color)
    #[default]
    Primary,
    /// Secondary button (less prominent)
    Secondary,
    /// Ghost button (transparent background, border only)
    Ghost,
    /// Danger button (uses danger color for destructive actions)
    Danger,
    /// Success button (uses success color for positive actions)
    Success,
}

/// Button size variants
///
/// Different size options for a button component.
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum ButtonSize {
    /// Medium size (default)
    #[default]
    Medium,
    /// Small size (compact)
    Small,
    /// Large size (prominent)
    Large,
}

#[derive(Clone, PartialEq, Props)]
pub struct ButtonProps {
    #[props(default)]
    pub variant: ButtonVariant,

    #[props(default)]
    pub size: ButtonSize,

    #[props(default)]
    pub disabled: bool,

    #[props(default)]
    pub loading: bool,

    #[props(default)]
    pub block: bool,

    #[props(default)]
    pub icon: Option<Element>,

    #[props(default)]
    pub children: Element,

    #[props(default)]
    pub class: String,

    #[props(default)]
    pub animation: ButtonAnimation,

    pub onclick: Option<EventHandler<MouseEvent>>,
}

impl Default for ButtonProps {
    fn default() -> Self {
        Self {
            variant: Default::default(),
            size: Default::default(),
            disabled: false,
            loading: false,
            block: false,
            icon: None,
            children: VNode::empty(),
            class: String::default(),
            animation: Default::default(),
            onclick: None,
        }
    }
}

/// Button component with Arknights + FUI styling
///
/// # Examples
///
/// ```rust
/// use dioxus::prelude::*;
/// use hikari_components::Button;
///
/// fn app() -> Element {
///     rsx! {
///         Button { variant: ButtonVariant::Primary, "Click me" }
///         Button { variant: ButtonVariant::Secondary, "Cancel" }
///         Button {
///             variant: ButtonVariant::Primary,
///             animation: ButtonAnimation::ScaleElevate,
///             "Animated Button"
///         }
///     }
/// }
/// ```
#[component]
pub fn Button(props: ButtonProps) -> Element {
    let variant_class = match props.variant {
        ButtonVariant::Primary => "hi-button-primary",
        ButtonVariant::Secondary => "hi-button-secondary",
        ButtonVariant::Ghost => "hi-button-ghost",
        ButtonVariant::Danger => "hi-button-danger",
        ButtonVariant::Success => "hi-button-success",
    };

    let size_class = match props.size {
        ButtonSize::Small => "hi-button-sm",
        ButtonSize::Medium => "hi-button-md",
        ButtonSize::Large => "hi-button-lg",
    };

    let disabled = props.disabled || props.loading;
    let loading_class = if props.loading {
        "hi-button-loading"
    } else {
        ""
    };
    let block_class = if props.block {
        "hi-button-block"
    } else {
        ""
    };

    // Convert animation type to data attribute value
    let animation_attr = match props.animation {
        ButtonAnimation::None => None,
        ButtonAnimation::Scale => Some("scale"),
        ButtonAnimation::ScaleElevate => Some("scale-elevate"),
        ButtonAnimation::Ripple => Some("ripple"),
        ButtonAnimation::IconRotate => Some("icon-rotate"),
    };

    rsx! {
        button {
            class: format!(
                "hi-button {variant_class} {size_class} {loading_class} {block_class} {}",
                props.class
            ),
            "data-button-animation": animation_attr,
            disabled: disabled,
            onclick: move |e| {
                if let Some(handler) = props.onclick.as_ref() {
                    handler(e);
                }
            },

            if props.loading {
                span { class: "hi-button-spinner", "" }
            }

            if let Some(icon) = props.icon {
                span {
                    class: "hi-button-icon",
                    "data-button-icon": "true",
                    { icon }
                }
            }

            { props.children }
        }
    }
}

impl StyledComponent for ButtonComponent {
    fn styles() -> &'static str {
        include_str!(concat!(env!("OUT_DIR"), "/styles/button.css"))
    }

    fn name() -> &'static str {
        "button"
    }
}

// ===== Button Animation Setup (WASM) =====

#[cfg(target_arch = "wasm32")]
/// Initialize button animations for all buttons with data-button-animation attribute
#[wasm_bindgen(js_name = initButtonAnimations)]
pub fn init_button_animations() {
    let window = match web_sys::window() {
        Some(w) => w,
        None => return,
    };
    let document = match window.document() {
        Some(d) => d,
        None => return,
    };

    // Find all buttons with animation attribute
    let buttons = match document.query_selector_all("[data-button-animation]") {
        Ok(els) => els,
        Err(_) => return,
    };

    for i in 0..buttons.length() {
        if let Some(button) = buttons.get(i) {
            if let Some(element) = button.dyn_ref::<HtmlElement>() {
                let animation_type = element.get_attribute("data-button-animation");

                if let Some(anim_type) = animation_type {
                    match anim_type.as_str() {
                        "scale" => setup_scale_animation(element),
                        "scale-elevate" => setup_scale_elevate_animation(element),
                        "ripple" => setup_ripple_animation(element),
                        "icon-rotate" => setup_icon_rotate_animation(element),
                        _ => {}
                    }
                }
            }
        }
    }
}

#[cfg(target_arch = "wasm32")]
/// Setup simple scale animation
fn setup_scale_animation(element: &HtmlElement) {
    let element_clone = element.clone();

    let closure_enter = Closure::wrap(Box::new(move |_event: web_sys::MouseEvent| {
        let mut elements = HashMap::new();
        elements.insert("button".to_string(), JsValue::from(element_clone.clone()));

        AnimationBuilder::new(&elements)
            .add_style("button", CssProperty::Transform, "scale(1.05)")
            .apply_with_transition("200ms", "ease-out");
    }) as Box<dyn FnMut(_)>);

    let _ = element.add_event_listener_with_callback(
        "mouseenter",
        closure_enter.as_ref().unchecked_ref(),
    );
    closure_enter.forget();

    let element_clone = element.clone();

    let closure_leave = Closure::wrap(Box::new(move |_event: web_sys::MouseEvent| {
        let mut elements = HashMap::new();
        elements.insert("button".to_string(), JsValue::from(element_clone.clone()));

        AnimationBuilder::new(&elements)
            .add_style("button", CssProperty::Transform, "scale(1.0)")
            .apply_with_transition("200ms", "ease-out");
    }) as Box<dyn FnMut(_)>);

    let _ = element.add_event_listener_with_callback(
        "mouseleave",
        closure_leave.as_ref().unchecked_ref(),
    );
    closure_leave.forget();
}

#[cfg(target_arch = "wasm32")]
/// Setup scale + shadow elevation animation
fn setup_scale_elevate_animation(element: &HtmlElement) {
    let element_clone = element.clone();

    let closure_enter = Closure::wrap(Box::new(move |_event: web_sys::MouseEvent| {
        let mut elements = HashMap::new();
        elements.insert("button".to_string(), JsValue::from(element_clone.clone()));

        AnimationBuilder::new(&elements)
            .add_style("button", CssProperty::Transform, "scale(1.05)")
            .add_style("button", CssProperty::BoxShadow, "0 4px 12px rgba(0, 0, 0, 0.15)")
            .apply_with_transition("200ms", "ease-out");
    }) as Box<dyn FnMut(_)>);

    let _ = element.add_event_listener_with_callback(
        "mouseenter",
        closure_enter.as_ref().unchecked_ref(),
    );
    closure_enter.forget();

    let element_clone = element.clone();

    let closure_leave = Closure::wrap(Box::new(move |_event: web_sys::MouseEvent| {
        let mut elements = HashMap::new();
        elements.insert("button".to_string(), JsValue::from(element_clone.clone()));

        AnimationBuilder::new(&elements)
            .add_style("button", CssProperty::Transform, "scale(1.0)")
            .add_style("button", CssProperty::BoxShadow, "0 2px 8px rgba(0, 0, 0, 0.1)")
            .apply_with_transition("200ms", "ease-out");
    }) as Box<dyn FnMut(_)>);

    let _ = element.add_event_listener_with_callback(
        "mouseleave",
        closure_leave.as_ref().unchecked_ref(),
    );
    closure_leave.forget();
}

#[cfg(target_arch = "wasm32")]
/// Setup ripple effect on click
fn setup_ripple_animation(element: &HtmlElement) {
    let element_clone = element.clone();

    let closure_click = Closure::wrap(Box::new(move |event: web_sys::MouseEvent| {
        let rect = element_clone.get_bounding_client_rect();
        let x = event.client_x() as f64 - rect.left();
        let y = event.client_y() as f64 - rect.top();

        let window = match web_sys::window() {
            Some(w) => w,
            None => return,
        };
        let document = match window.document() {
            Some(d) => d,
            None => return,
        };

        let ripple = match document.create_element("span") {
            Ok(el) => el,
            Err(_) => return,
        };

        let _ = ripple.class_list().add_1("hi-button-ripple");

        let ripple_html = match ripple.dyn_ref::<HtmlElement>() {
            Some(el) => el,
            None => return,
        };

        let size = rect.width().max(rect.height());
        animation::StyleBuilder::new(ripple_html)
            .add(CssProperty::Position, "absolute")
            .add(CssProperty::Left, &format!("{}px", x - size / 2.0))
            .add(CssProperty::Top, &format!("{}px", y - size / 2.0))
            .add(CssProperty::Width, &format!("{}px", size))
            .add(CssProperty::Height, &format!("{}px", size))
            .add(CssProperty::BorderRadius, "50%")
            .add(CssProperty::BackgroundColor, "rgba(255, 255, 255, 0.5)")
            .add(CssProperty::Transform, "scale(0)")
            .add(CssProperty::PointerEvents, "none")
            .apply();

        let _ = element_clone.append_child(&ripple);

        let ripple_clone = ripple.clone();
        let element_clone2 = element_clone.clone();

        animation::StyleBuilder::new(ripple_html)
            .add(CssProperty::Transition, "transform 0.6s ease-out, opacity 0.6s ease-out")
            .apply();

        let _ = ripple_html.offset_width();

        animation::StyleBuilder::new(ripple_html)
            .add(CssProperty::Transform, "scale(2)")
            .add(CssProperty::Opacity, "0")
            .apply();

        let closure = Closure::wrap(Box::new(move || {
            let _ = element_clone2.remove_child(&ripple_clone);
        }) as Box<dyn FnMut()>);

        let _ = window.set_timeout_with_callback(closure.as_ref().unchecked_ref());
        closure.forget();
    }) as Box<dyn FnMut(_)>);

    let _ = element.add_event_listener_with_callback(
        "click",
        closure_click.as_ref().unchecked_ref(),
    );
    closure_click.forget();
}

#[cfg(target_arch = "wasm32")]
/// Setup icon rotation animation
fn setup_icon_rotate_animation(element: &HtmlElement) {
    let icon_query = element.query_selector("[data-button-icon]");
    let icon = match icon_query {
        Ok(Some(icon)) => match icon.dyn_ref::<HtmlElement>() {
            Some(el) => el.clone(),
            None => return,
        },
        _ => return,
    };

    let element_clone = element.clone();
    let icon_clone = icon.clone();

    let closure_enter = Closure::wrap(Box::new(move |_event: web_sys::MouseEvent| {
        let mut elements = HashMap::new();
        elements.insert("button".to_string(), JsValue::from(element_clone.clone()));
        elements.insert("icon".to_string(), JsValue::from(icon_clone.clone()));

        AnimationBuilder::new(&elements)
            .add_style("button", CssProperty::Transform, "scale(1.05)")
            .add_style("icon", CssProperty::Transform, "rotate(90deg) scale(1.1)")
            .apply_with_transition("300ms", "cubic-bezier(0.68, -0.55, 0.265, 1.55)");
    }) as Box<dyn FnMut(_)>);

    let _ = element.add_event_listener_with_callback(
        "mouseenter",
        closure_enter.as_ref().unchecked_ref(),
    );
    closure_enter.forget();

    let element_clone = element.clone();
    let icon_clone = icon.clone();

    let closure_leave = Closure::wrap(Box::new(move |_event: web_sys::MouseEvent| {
        let mut elements = HashMap::new();
        elements.insert("button".to_string(), JsValue::from(element_clone.clone()));
        elements.insert("icon".to_string(), JsValue::from(icon_clone.clone()));

        AnimationBuilder::new(&elements)
            .add_style("button", CssProperty::Transform, "scale(1.0)")
            .add_style("icon", CssProperty::Transform, "rotate(0deg) scale(1.0)")
            .apply_with_transition("300ms", "cubic-bezier(0.68, -0.55, 0.265, 1.55)");
    }) as Box<dyn FnMut(_)>);

    let _ = element.add_event_listener_with_callback(
        "mouseleave",
        closure_leave.as_ref().unchecked_ref(),
    );
    closure_leave.forget();
}
