//! Styling infrastructure
//!
//! Provides styling system infrastructure for Hikari components
//! including a [`StyleRegistry`] for managing CSS styles
//! and a [`StyledComponent`] trait for styled components.

use std::collections::HashMap;

/// Style registry for managing component styles
///
/// Central registry that stores CSS styles for all registered
/// components and can generate a CSS bundle.
///
/// # Example
///
/// ```rust
/// use hikari_components::StyleRegistry;
///
/// let mut registry = StyleRegistry::default();
/// registry.register("my-component", ".my-component { color: red; }");
/// let css = registry.css_bundle();
/// ```
#[derive(Default, Clone)]
pub struct StyleRegistry {
    styles: HashMap<&'static str, &'static str>,
}

impl StyleRegistry {
    /// Register a single component's styles
    ///
    /// # Arguments
    /// * `name` - Component identifier
    /// * `css` - CSS styles for the component
    pub fn register(&mut self, name: &'static str, css: &'static str) {
        self.styles.insert(name, css);
    }

    /// Get aggregated CSS bundle (all registered components)
    ///
    /// # Returns
    /// CSS bundle with all registered component styles
    pub fn css_bundle(&self) -> String {
        self.styles.values().copied().collect::<Vec<_>>().join("\n")
    }

    /// Get CSS for a single component
    ///
    /// # Arguments
    /// * `name` - Component identifier
    ///
    /// # Returns
    /// CSS styles for the component, if registered
    pub fn get(&self, name: &str) -> Option<&'static str> {
        self.styles.get(name).copied()
    }

    /// Get all registered styles
    ///
    /// # Returns
    /// Clone of the complete style registry
    pub fn get_all(&self) -> HashMap<&'static str, &'static str> {
        self.styles.clone()
    }

    /// Check if component is registered
    ///
    /// # Arguments
    /// * `name` - Component identifier
    ///
    /// # Returns
    /// true if component is registered
    pub fn has(&self, name: &str) -> bool {
        self.styles.contains_key(name)
    }

    /// Get count of registered components
    ///
    /// # Returns
    /// Number of registered components
    pub fn len(&self) -> usize {
        self.styles.len()
    }

    /// Check if registry is empty
    ///
    /// # Returns
    /// true if no components are registered
    pub fn is_empty(&self) -> bool {
        self.styles.is_empty()
    }

    /// Batch register: basic components
    ///
    /// Registers all basic UI components.
    #[cfg(feature = "basic")]
    pub fn register_basic_components(&mut self) {
        use crate::basic::{
            ArrowComponent, BackgroundComponent, BadgeComponent, ButtonComponent, CardComponent,
            DividerComponent, InputComponent,
        };
        ArrowComponent::register(self);
        BackgroundComponent::register(self);
        ButtonComponent::register(self);
        InputComponent::register(self);
        CardComponent::register(self);
        BadgeComponent::register(self);
        DividerComponent::register(self);
    }

    /// No-op if basic feature is disabled
    #[cfg(not(feature = "basic"))]
    pub fn register_basic_components(&mut self) {
        // No-op
    }

    /// Batch register: data components
    ///
    /// Registers all data display components.
    #[cfg(feature = "data")]
    pub fn register_data_components(&mut self) {
        use crate::data::{
            CollapseComponent, DragComponent, FilterComponent, PaginationComponent,
            SelectionComponent, SortComponent, TableComponent, TreeComponent,
            VirtualScrollComponent,
        };
        TableComponent::register(self);
        TreeComponent::register(self);
        PaginationComponent::register(self);
        VirtualScrollComponent::register(self);
        CollapseComponent::register(self);
        DragComponent::register(self);
        SortComponent::register(self);
        FilterComponent::register(self);
        SelectionComponent::register(self);
    }

    /// No-op if data feature is disabled
    #[cfg(not(feature = "data"))]
    pub fn register_data_components(&mut self) {
        // No-op
    }

    /// Batch register: feedback components
    ///
    /// Registers all feedback and notification components.
    #[cfg(feature = "feedback")]
    pub fn register_feedback_components(&mut self) {
        use crate::feedback::{
            alert::AlertComponent, toast::ToastComponent, tooltip::TooltipComponent,
        };
        AlertComponent::register(self);
        ToastComponent::register(self);
        TooltipComponent::register(self);
    }

    /// No-op if feedback feature is disabled
    #[cfg(not(feature = "feedback"))]
    pub fn register_feedback_components(&mut self) {
        // No-op
    }

    /// Batch register: navigation components
    ///
    /// Registers all navigation and routing components.
    #[cfg(feature = "navigation")]
    pub fn register_navigation_components(&mut self) {
        use crate::navigation::{
            BreadcrumbComponent, MenuComponent, SidebarComponent, TabsComponent,
        };
        MenuComponent::register(self);
        TabsComponent::register(self);
        BreadcrumbComponent::register(self);
        SidebarComponent::register(self);
    }

    /// No-op if navigation feature is disabled
    #[cfg(not(feature = "navigation"))]
    pub fn register_navigation_components(&mut self) {
        // No-op
    }

    /// Auto-register based on enabled features
    ///
    /// Registers all components for enabled features.
    pub fn register_available(&mut self) {
        #[cfg(feature = "basic")]
        self.register_basic_components();

        #[cfg(feature = "data")]
        self.register_data_components();

        #[cfg(feature = "feedback")]
        self.register_feedback_components();

        #[cfg(feature = "navigation")]
        self.register_navigation_components();
    }

    /// Batch register: all components
    ///
    /// Registers all available components.
    pub fn register_all(&mut self) {
        self.register_basic_components();
        self.register_data_components();
        self.register_feedback_components();
        self.register_navigation_components();
    }
}

/// Styled component trait
///
/// All styled components should implement this trait
/// to provide their CSS styles.
///
/// # Example
///
/// ```rust
/// struct MyComponent;
///
/// impl StyledComponent for MyComponent {
///     fn styles() -> &'static str {
///         ".my-component { color: red; }"
///     }
///
///     fn name() -> &'static str {
///         "my-component"
///     }
/// }
/// ```
pub trait StyledComponent: Sized {
    /// Get the component's CSS styles
    ///
    /// # Returns
    /// CSS styles string
    fn styles() -> &'static str;

    /// Register the component to the style registry
    ///
    /// # Arguments
    /// * `registry` - Style registry to register with
    fn register(registry: &mut StyleRegistry) {
        registry.register(Self::name(), Self::styles());
    }

    /// Component name
    ///
    /// # Returns
    /// Default type name in lowercase
    fn name() -> &'static str;
}
