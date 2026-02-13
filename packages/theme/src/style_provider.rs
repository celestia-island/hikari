//! Style Provider component
//!
//! Provides global style configuration to child components via context.

use std::collections::HashMap;

use dioxus::prelude::*;

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

impl Default for StyleConfig {
    fn default() -> Self {
        Self {
            class_prefix: "hi".to_string(),
            extra_classes: Vec::new(),
            component_overrides: HashMap::new(),
        }
    }
}

/// Style context for accessing configuration
#[derive(Clone)]
pub struct StyleContext {
    /// Current configuration
    pub config: Signal<StyleConfig>,

    /// Callback to update configuration
    pub set_config: Callback<StyleConfig>,
}

impl StyleContext {
    /// Get the class prefix
    pub fn class_prefix(&self) -> String {
        self.config.read().class_prefix.clone()
    }

    /// Get extra classes as a space-separated string
    pub fn extra_classes_string(&self) -> String {
        self.config.read().extra_classes.join(" ")
    }

    /// Get override class for a component
    pub fn get_override_class(&self, component_name: &str) -> Option<String> {
        self.config
            .read()
            .component_overrides
            .get(component_name)
            .cloned()
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
#[derive(Clone, Props, PartialEq)]
pub struct StyleProviderProps {
    /// Custom CSS class prefix (default: "hi")
    #[props(default)]
    pub class_prefix: Option<String>,

    /// Extra global CSS classes to apply
    #[props(default)]
    pub extra_classes: Option<Vec<String>>,

    /// Component style overrides (component name -> CSS class)
    #[props(default)]
    pub component_overrides: Option<HashMap<String, String>>,

    children: Element,
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
///         class_prefix: Some("my-app".to_string()),
///         extra_classes: Some(vec!["dark-mode".to_string()]),
///         component_overrides: Some([
///             ("button".to_string(), "my-button".to_string()),
///         ].into_iter().collect()),
///
///         App { }
///     }
/// }
/// ```
#[component]
pub fn StyleProvider(props: StyleProviderProps) -> Element {
    let initial_config = StyleConfig {
        class_prefix: props
            .class_prefix
            .clone()
            .unwrap_or_else(|| "hi".to_string()),
        extra_classes: props.extra_classes.clone().unwrap_or_default(),
        component_overrides: props.component_overrides.clone().unwrap_or_default(),
    };

    let config = use_signal(|| initial_config);

    let mut config_for_callback = config;
    let set_config = Callback::new(move |new_config: StyleConfig| {
        config_for_callback.set(new_config);
    });

    use_context_provider(move || StyleContext { config, set_config });

    let css_vars = use_memo(move || {
        let cfg = config.read();
        format!("--hi-style-class-prefix: {};", cfg.class_prefix)
    });

    let extra_classes = use_memo(move || config.read().extra_classes.join(" "));

    rsx! {
        div {
            class: "hi-style-provider {extra_classes}",
            style: "{css_vars}",
            {props.children}
        }
    }
}

/// Hook: Get style configuration context
///
/// # Panics
///
/// Panics if called outside of a StyleProvider.
pub fn use_style() -> StyleContext {
    use_context()
}

/// Hook: Try to get style configuration context
///
/// Returns None if called outside of a StyleProvider.
pub fn try_use_style() -> Option<StyleContext> {
    try_consume_context::<StyleContext>()
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
/// fn MyButton() -> Element {
///     let class = use_component_class("button", "hi-button");
///
///     rsx! {
///         button {
///             class: "{class}",
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
