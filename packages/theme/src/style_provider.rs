//! Style Provider component
//!
//! Provides global style configuration to child components via context.

use std::collections::HashMap;

use crate::prelude::*;

/// Style configuration
#[derive(Clone, PartialEq)]
pub struct StyleConfig {
    /// Custom CSS class prefix (default: "hi")
    pub class_prefix: String,

    /// Extra global CSS classes to apply
    pub extra_classes: Vec<String>,

    /// Component style overrides (component name -> CSS class)
    pub component_overrides: HashMap<String, String>,
}

/// Style context for accessing configuration
#[derive(Clone, Default)]
pub struct StyleContext {
    /// Current configuration
    pub config: StyleConfig,
}

impl StyleContext {
    /// Get the class prefix
    pub fn class_prefix(&self) -> String {
        self.config.class_prefix.clone()
    }

    /// Get extra classes as a space-separated string
    pub fn extra_classes_string(&self) -> String {
        self.config.extra_classes.join(" ")
    }

    /// Get override class for a component
    pub fn get_override_class(&self, component_name: &str) -> Option<String> {
        self.config.component_overrides.get(component_name).cloned()
    }

    /// Get the complete class name for a component (base class + override class)
    pub fn get_component_class(&self, component_name: &str, base_class: &str) -> String {
        let mut classes = vec![base_class.to_string()];

        if let Some(override_class) = self.get_override_class(component_name) {
            classes.push(override_class);
        }

        classes.join(" ")
    }
}

/// StyleProvider Props
#[derive(Debug, Clone)]
pub struct StyleProviderProps {
    /// Custom CSS class prefix (default: "hi")
    pub class_prefix: String,
    /// Extra global CSS classes to apply
    pub extra_classes: Vec<String>,
    /// Component style overrides (component name -> CSS class)
    pub component_overrides: HashMap<String, String>,
    /// Child elements
    pub children: Vec<VNode>,
}

impl Default for StyleProviderProps {
    fn default() -> Self {
        Self {
            class_prefix: "hi".to_string(),
            extra_classes: Vec::new(),
            component_overrides: HashMap::new(),
            children: Vec::new(),
        }
    }
}

/// StyleProvider component
///
/// Provides global style configuration to child components.
///
/// # Features
/// - Custom class prefix
/// - Extra global classes
/// - Component-level class overrides
///
/// # Example
///
/// ```rust,no_run
/// use hikari_theme::StyleProvider;
///
/// rsx! {
///     StyleProvider {
///         class_prefix: "my-app".to_string(),
///         extra_classes: vec!["dark-mode".to_string()],
///         component_overrides: [
///             ("button".to_string(), "my-button".to_string()),
///         ].into_iter().collect(),
///
///         // App { }
///     }
/// }
/// ```
#[allow(non_snake_case)]
pub fn StyleProvider(props: StyleProviderProps) -> VNode {
    let context = StyleContext {
        config: StyleConfig {
            class_prefix: props.class_prefix,
            extra_classes: props.extra_classes,
            component_overrides: props.component_overrides,
        },
    };

    provide_context(context.clone());

    let css_vars = format!("--hi-style-class-prefix: {};", context.config.class_prefix);
    let extra_classes_str = context.config.extra_classes.join(" ");
    let class = format!("hi-style-provider {}", extra_classes_str);

    rsx! {
        div {
            class: class,
            style: css_vars,
            ..props.children
        }
    }
}

/// Hook: Get style configuration context
///
/// # Panics
///
/// Panics if called outside of a StyleProvider.
pub fn use_style() -> StyleContext {
    consume_context()
}

/// Hook: Try to get style configuration context
///
/// Returns None if called outside of a StyleProvider.
pub fn try_use_style() -> Option<StyleContext> {
    use_context::<StyleContext>().map(|ctx| ctx.get().clone())
}

/// Hook: Get the complete class name for a component
///
/// Combines base class with any override class from StyleProvider.
/// If no StyleProvider is present, returns just the base class.
///
/// # Example
///
/// ```rust,no_run
/// use hikari_theme::use_component_class;
///
/// fn MyButton() -> VNode {
///     let class = use_component_class("button", "hi-button");
///
///     rsx! {
///         button {
///             class: class,
///             "Click me"
///         }
///     }
/// }
/// ```
pub fn use_component_class(component_name: &str, base_class: &str) -> String {
    if let Some(ctx) = try_use_style() {
        ctx.get_component_class(component_name, base_class)
    } else {
        base_class.to_string()
    }
}

impl Default for StyleConfig {
    fn default() -> Self {
        Self {
            class_prefix: "hi".to_string(),
            extra_classes: Vec::new(),
            component_overrides: HashMap::new(),
        }
    }
}
