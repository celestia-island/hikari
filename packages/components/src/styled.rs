//! Styling infrastructure
//!
//! Provides styling system infrastructure for Hikari components
//! including a [`StyleRegistry`] for managing CSS styles
//! and a [`StyledComponent`] trait for styled components.

use std::collections::BTreeMap;

#[derive(Default, Clone)]
pub struct StyleRegistry {
    styles: BTreeMap<&'static str, &'static str>,
}

impl StyleRegistry {
    /// Registers a component's CSS styles with the given name
    pub fn register(&mut self, name: &'static str, css: &'static str) {
        self.styles.insert(name, css);
    }

    /// Returns all registered CSS as a single bundled string
    #[must_use]
    pub fn css_bundle(&self) -> String {
        let mut result = String::new();
        for (i, css) in self.styles.values().copied().enumerate() {
            if i > 0 {
                result.push('\n');
            }
            result.push_str(css);
        }
        result
    }

    /// Gets the CSS for a component by name
    #[must_use]
    pub fn get(&self, name: &str) -> Option<&'static str> {
        self.styles.get(name).copied()
    }

    /// Returns a clone of all registered styles
    #[must_use]
    pub fn get_all(&self) -> BTreeMap<&'static str, &'static str> {
        self.styles.clone()
    }

    /// Checks if a component is registered
    #[must_use]
    pub fn has(&self, name: &str) -> bool {
        self.styles.contains_key(name)
    }

    /// Returns the number of registered components
    #[must_use]
    pub fn len(&self) -> usize {
        self.styles.len()
    }

    /// Returns true if no components are registered
    #[must_use]
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
        use crate::layout::DividerComponent;
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
        DividerComponent::register(self);
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
        use crate::feedback::alert::AlertComponent;
        use crate::feedback::drawer::DrawerComponent;
        use crate::feedback::glow::GlowComponent;
        use crate::feedback::modal::ModalComponent;
        use crate::feedback::popover::PopoverComponent;
        use crate::feedback::progress::ProgressComponent;
        use crate::feedback::spin::SpinComponent;
        use crate::feedback::toast::ToastComponent;
        use crate::feedback::tooltip::TooltipComponent;
        AlertComponent::register(self);
        GlowComponent::register(self);
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
            CalendarComponent, CarouselComponent, CommentComponent, DragLayerComponent,
            EmptyComponent, QRCodeComponent, SkeletonComponent, TagComponent, TimelineComponent,
            UserGuideComponent, ZoomControlsComponent,
        };
        TagComponent::register(self);
        EmptyComponent::register(self);
        SkeletonComponent::register(self);
        CommentComponent::register(self);
        QRCodeComponent::register(self);
        CalendarComponent::register(self);
        CarouselComponent::register(self);
        DragLayerComponent::register(self);
        TimelineComponent::register(self);
        UserGuideComponent::register(self);
        ZoomControlsComponent::register(self);
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

    /// Registers all layout components
    #[cfg(feature = "layout")]
    pub fn register_layout_components(&mut self) {
        use crate::layout::{
            AsideComponent, ContainerComponent, FooterComponent, HeaderComponent, LayoutComponent,
            ScrollbarContainerComponent,
        };
        LayoutComponent::register(self);
        HeaderComponent::register(self);
        AsideComponent::register(self);
        FooterComponent::register(self);
        ContainerComponent::register(self);
        ScrollbarContainerComponent::register(self);
    }

    #[cfg(not(feature = "layout"))]
    pub fn register_layout_components(&mut self) {}

    /// Registers all production components
    #[cfg(feature = "production")]
    pub fn register_production_components(&mut self) {
        use crate::production::{
            AudioPlayerComponent, CodeHighlightComponent, MarkdownEditorComponent,
            RichTextEditorComponent, VideoPlayerComponent,
        };
        CodeHighlightComponent::register(self);
        MarkdownEditorComponent::register(self);
        AudioPlayerComponent::register(self);
        VideoPlayerComponent::register(self);
        RichTextEditorComponent::register(self);
    }

    #[cfg(not(feature = "production"))]
    pub fn register_production_components(&mut self) {}

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

        #[cfg(feature = "layout")]
        self.register_layout_components();

        #[cfg(feature = "production")]
        self.register_production_components();
    }

    /// Registers all components regardless of feature flags
    pub fn register_all(&mut self) {
        self.register_basic_components();
        self.register_data_components();
        self.register_feedback_components();
        self.register_navigation_components();
        self.register_display_components();
        self.register_entry_components();
        self.register_layout_components();
        self.register_production_components();
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

#[cfg(test)]
mod tests {
    use super::*;

    struct MockButton;

    impl StyledComponent for MockButton {
        fn styles() -> &'static str {
            ".mock-button { color: red; }"
        }

        fn name() -> &'static str {
            "mock-button"
        }
    }

    struct MockInput;

    impl StyledComponent for MockInput {
        fn styles() -> &'static str {
            ".mock-input { border: 1px solid; }"
        }

        fn name() -> &'static str {
            "mock-input"
        }
    }

    #[test]
    fn new_is_empty() {
        let reg = StyleRegistry::default();
        assert!(reg.is_empty());
        assert_eq!(reg.len(), 0);
    }

    #[test]
    fn register_single_style() {
        let mut reg = StyleRegistry::default();
        reg.register("button", ".button { color: blue; }");

        assert!(!reg.is_empty());
        assert_eq!(reg.len(), 1);
        assert!(reg.has("button"));
        assert_eq!(reg.get("button"), Some(".button { color: blue; }"));
    }

    #[test]
    fn register_overwrites_previous() {
        let mut reg = StyleRegistry::default();
        reg.register("button", ".button { color: blue; }");
        reg.register("button", ".button { color: red; }");

        assert_eq!(reg.len(), 1);
        assert_eq!(reg.get("button"), Some(".button { color: red; }"));
    }

    #[test]
    fn css_bundle_concatenates_all() {
        let mut reg = StyleRegistry::default();
        reg.register("a", ".a {}");
        reg.register("b", ".b {}");
        reg.register("c", ".c {}");

        let bundle = reg.css_bundle();
        assert!(bundle.contains(".a {}"));
        assert!(bundle.contains(".b {}"));
        assert!(bundle.contains(".c {}"));
        assert_eq!(bundle.matches('\n').count(), 2);
    }

    #[test]
    fn get_nonexistent_returns_none() {
        let reg = StyleRegistry::default();
        assert_eq!(reg.get("nonexistent"), None);
    }

    #[test]
    fn get_all_returns_everything() {
        let mut reg = StyleRegistry::default();
        reg.register("x", ".x {}");
        reg.register("y", ".y {}");

        let all = reg.get_all();
        assert_eq!(all.len(), 2);
        assert_eq!(all.get("x"), Some(&".x {}"));
        assert_eq!(all.get("y"), Some(&".y {}"));
    }

    #[test]
    fn register_basic_components() {
        let mut reg = StyleRegistry::default();
        reg.register_basic_components();
        assert!(!reg.is_empty());
    }

    #[test]
    fn register_available_populates() {
        let mut reg = StyleRegistry::default();
        reg.register_available();
        assert!(!reg.is_empty());
    }

    #[test]
    fn register_all_populates() {
        let mut reg = StyleRegistry::default();
        reg.register_all();
        assert!(!reg.is_empty());
    }

    #[test]
    fn styled_component_trait_register() {
        let mut reg = StyleRegistry::default();
        MockButton::register(&mut reg);

        assert!(reg.has("mock-button"));
        assert_eq!(reg.get("mock-button"), Some(".mock-button { color: red; }"));
        assert_eq!(MockButton::styles(), ".mock-button { color: red; }");
        assert_eq!(MockButton::name(), "mock-button");
    }

    #[test]
    fn styled_component_multiple_registers() {
        let mut reg = StyleRegistry::default();
        MockButton::register(&mut reg);
        MockInput::register(&mut reg);

        assert_eq!(reg.len(), 2);
        assert!(reg.has("mock-button"));
        assert!(reg.has("mock-input"));

        let bundle = reg.css_bundle();
        assert!(bundle.contains(".mock-button { color: red; }"));
        assert!(bundle.contains(".mock-input { border: 1px solid; }"));
    }
}
