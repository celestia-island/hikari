//! Styling infrastructure
//!
//! Provides styling system infrastructure for Hikari components
//! including a [`StyleRegistry`] for managing CSS styles
//! and a [`StyledComponent`] trait for styled components.

use std::collections::HashMap;

// TODO: Re-export type-safe CSS value types when tairitsu_css_values is available
// pub use tairitsu_css_values::{CssBinOp, CssExpression, CssLength, LengthUnit};

/// Registry for managing component CSS styles
#[derive(Default, Clone)]
pub struct StyleRegistry {
    styles: HashMap<&'static str, &'static str>,
}

impl StyleRegistry {
    /// Registers a component's CSS styles with the given name
    pub fn register(&mut self, name: &'static str, css: &'static str) {
        self.styles.insert(name, css);
    }

    /// Returns all registered CSS as a single bundled string
    pub fn css_bundle(&self) -> String {
        self.styles.values().copied().collect::<Vec<_>>().join("\n")
    }

    /// Gets the CSS for a component by name
    pub fn get(&self, name: &str) -> Option<&'static str> {
        self.styles.get(name).copied()
    }

    /// Returns a clone of all registered styles
    pub fn get_all(&self) -> HashMap<&'static str, &'static str> {
        self.styles.clone()
    }

    /// Checks if a component is registered
    pub fn has(&self, name: &str) -> bool {
        self.styles.contains_key(name)
    }

    /// Returns the number of registered components
    pub fn len(&self) -> usize {
        self.styles.len()
    }

    /// Returns true if no components are registered
    pub fn is_empty(&self) -> bool {
        self.styles.is_empty()
    }

    /// Registers all basic components
    #[cfg(feature = "basic")]
    pub fn register_basic_components(&mut self) {
        use crate::basic::{
            ArrowComponent, BackgroundComponent, BadgeComponent, ButtonComponent, CanvasComponent,
            CardComponent, CheckboxComponent, DatePickerComponent, FileUploadComponent,
            FormFieldComponent, IconButtonComponent, InputComponent, RadioGroupComponent,
            SelectComponent, SliderComponent, SwitchComponent, TextareaComponent,
        };
        ArrowComponent::register(self);
        BackgroundComponent::register(self);
        ButtonComponent::register(self);
        CanvasComponent::register(self);
        InputComponent::register(self);
        CardComponent::register(self);
        BadgeComponent::register(self);
        CheckboxComponent::register(self);
        RadioGroupComponent::register(self);
        SelectComponent::register(self);
        SwitchComponent::register(self);
        SliderComponent::register(self);
        TextareaComponent::register(self);
        IconButtonComponent::register(self);
        FileUploadComponent::register(self);
        FormFieldComponent::register(self);
        DatePickerComponent::register(self);
    }

    #[cfg(not(feature = "basic"))]
    pub fn register_basic_components(&mut self) {
        // No-op
    }

    /// Registers all data components
    #[cfg(feature = "data")]
    pub fn register_data_components(&mut self) {
        use crate::data::{
            CollapseComponent, DragComponent, FilterComponent, PaginationButtonComponent,
            PaginationComponent, SelectionComponent, SortComponent, TableComponent, TreeComponent,
            VirtualScrollComponent,
        };
        TableComponent::register(self);
        TreeComponent::register(self);
        PaginationComponent::register(self);
        PaginationButtonComponent::register(self);
        VirtualScrollComponent::register(self);
        CollapseComponent::register(self);
        DragComponent::register(self);
        SortComponent::register(self);
        FilterComponent::register(self);
        SelectionComponent::register(self);
    }

    #[cfg(not(feature = "data"))]
    pub fn register_data_components(&mut self) {
        // No-op
    }

    /// Registers all feedback components
    #[cfg(feature = "feedback")]
    pub fn register_feedback_components(&mut self) {
        use crate::feedback::{
            alert::AlertComponent, drawer::DrawerComponent, modal::ModalComponent,
            popover::PopoverComponent, progress::ProgressComponent, spin::SpinComponent,
            toast::ToastComponent, tooltip::TooltipComponent,
        };
        AlertComponent::register(self);
        ToastComponent::register(self);
        TooltipComponent::register(self);
        ModalComponent::register(self);
        DrawerComponent::register(self);
        PopoverComponent::register(self);
        ProgressComponent::register(self);
        SpinComponent::register(self);
    }

    #[cfg(not(feature = "feedback"))]
    pub fn register_feedback_components(&mut self) {
        // No-op
    }

    /// Registers all navigation components
    #[cfg(feature = "navigation")]
    pub fn register_navigation_components(&mut self) {
        use crate::navigation::{
            BreadcrumbComponent, MenuComponent, SidebarComponent, StepsComponent, TabsComponent,
        };
        MenuComponent::register(self);
        TabsComponent::register(self);
        BreadcrumbComponent::register(self);
        SidebarComponent::register(self);
        StepsComponent::register(self);
    }

    #[cfg(not(feature = "navigation"))]
    pub fn register_navigation_components(&mut self) {
        // No-op
    }

    /// Registers all display components
    #[cfg(feature = "display")]
    pub fn register_display_components(&mut self) {
        use crate::display::{
            CommentComponent, EmptyComponent, QRCodeComponent, SkeletonComponent, TagComponent,
        };
        TagComponent::register(self);
        EmptyComponent::register(self);
        SkeletonComponent::register(self);
        CommentComponent::register(self);
        QRCodeComponent::register(self);
    }

    #[cfg(not(feature = "display"))]
    pub fn register_display_components(&mut self) {
        // No-op
    }

    /// Registers all entry components
    #[cfg(feature = "entry")]
    pub fn register_entry_components(&mut self) {
        use crate::entry::{
            AutoCompleteComponent, CascaderComponent, NumberInputComponent, SearchComponent,
            TransferComponent,
        };
        NumberInputComponent::register(self);
        SearchComponent::register(self);
        AutoCompleteComponent::register(self);
        CascaderComponent::register(self);
        TransferComponent::register(self);
    }

    #[cfg(not(feature = "entry"))]
    pub fn register_entry_components(&mut self) {
        // No-op
    }

    /// Registers all available components based on feature flags
    pub fn register_available(&mut self) {
        #[cfg(feature = "basic")]
        self.register_basic_components();

        #[cfg(feature = "data")]
        self.register_data_components();

        #[cfg(feature = "feedback")]
        self.register_feedback_components();

        #[cfg(feature = "navigation")]
        self.register_navigation_components();

        #[cfg(feature = "display")]
        self.register_display_components();

        #[cfg(feature = "entry")]
        self.register_entry_components();
    }

    /// Registers all components regardless of feature flags
    pub fn register_all(&mut self) {
        self.register_basic_components();
        self.register_data_components();
        self.register_feedback_components();
        self.register_navigation_components();
        self.register_display_components();
        self.register_entry_components();
    }
}

/// Trait for components that provide their own CSS styles
pub trait StyledComponent: Sized {
    /// Returns the CSS styles for this component
    fn styles() -> &'static str;

    /// Registers this component's styles with the registry
    fn register(registry: &mut StyleRegistry) {
        registry.register(Self::name(), Self::styles());
    }

    /// Returns the name of this component
    fn name() -> &'static str;
}
