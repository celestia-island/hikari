//! Styling infrastructure
//!
//! Provides styling system infrastructure for Hikari components
//! including a [`StyleRegistry`] for managing CSS styles
//! and a [`StyledComponent`] trait for styled components.

use std::collections::HashMap;

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

    /// Registers the canonical Vue token fallbacks (`:root` custom
    /// properties) mirrored from `packages/vue/src/tokens.scss` +
    /// `scale.scss`. The mirrored component sheets reference this runtime
    /// vocabulary (`--color-*`, `--space-*`, `--radius-*`, ...); without
    /// these fallbacks their `var()` uses are invalid at computed-value
    /// time for a host that only assembles the registry bundle.
    /// Registers the mirrored shared chrome the family surfaces render
    /// from but do not define: the window-close affordance
    /// (`.hk-window-close`) and the button voice (`.hk-btn*`). Same
    /// rationale as the token fallbacks — a registry-only host must get the
    /// same shared layers the builder bundle carries.
    pub fn register_vue_chrome(&mut self) {
        self.register("vue-window-close", vue_window_close_css());
        self.register("vue-button-chrome", vue_button_chrome_css());
        self.register("vue-corner-badge", vue_corner_badge_css());
    }

    pub fn register_vue_token_fallbacks(&mut self) {
        // BOTH canonical base layers: `tokens.scss` carries the channel
        // vocabulary (--color-*) and `scale.scss` the spacing/radius/type
        // scale (--space-*, --radius-*, --text-*, ...). The mirrored family
        // sheets reference both, so a registry-only host needs both.
        self.register("vue-token-fallbacks", vue_token_fallbacks_css());
        self.register("vue-scale-fallbacks", vue_scale_fallbacks_css());
    }

    /// Returns all registered CSS as a single bundled string
    pub fn css_bundle(&self) -> String {
        // Deterministic order: HashMap iteration order would make the bundle
        // (and any same-specificity token override) depend on the hasher
        // seed. Sort by registration name so `:root` layers concatenate in a
        // stable, reviewable order.
        let mut names: Vec<&&'static str> = self.styles.keys().collect();
        names.sort();
        names
            .into_iter()
            .map(|name| self.styles[name])
            .collect::<Vec<_>>()
            .join("\n")
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
            ArrowComponent, AvatarComponent, BackgroundComponent, BadgeComponent, ButtonComponent,
            CanvasComponent, CardComponent, CheckboxComponent, ColorPickerComponent,
            DatePickerComponent, DateTagComponent, DateTimePickerComponent, FabComponent,
            FileBrowserDialogComponent, FileFieldComponent, FilePickerFieldComponent,
            FileUploadComponent, FormFieldComponent, IconButtonComponent, IconButtonGroupComponent,
            IconChipComponent, InputComponent, KbdComponent, LabelComponent, OtpInputComponent,
            PhoneInputComponent, RadioGroupComponent, RollingNumberComponent, SearchInputComponent,
            SelectComponent, SliderComponent, SliderFieldComponent, SwitchComponent,
            TagInputComponent, TemplateTextComponent, TextareaComponent, TimeZoneGlobeComponent,
            TokenInputComponent,
        };
        ArrowComponent::register(self);
        BackgroundComponent::register(self);
        ButtonComponent::register(self);
        IconButtonGroupComponent::register(self);
        AvatarComponent::register(self);
        IconChipComponent::register(self);
        KbdComponent::register(self);
        LabelComponent::register(self);
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
        ColorPickerComponent::register(self);
        DateTagComponent::register(self);
        DateTimePickerComponent::register(self);
        FabComponent::register(self);
        FileBrowserDialogComponent::register(self);
        FileFieldComponent::register(self);
        FilePickerFieldComponent::register(self);
        OtpInputComponent::register(self);
        PhoneInputComponent::register(self);
        RollingNumberComponent::register(self);
        SearchInputComponent::register(self);
        SliderFieldComponent::register(self);
        TagInputComponent::register(self);
        TemplateTextComponent::register(self);
        TimeZoneGlobeComponent::register(self);
        TokenInputComponent::register(self);
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
        use crate::feedback::blocking_toast::BlockingToastComponent;
        use crate::feedback::confirm_dialog::ConfirmDialogComponent;
        use crate::feedback::drawer::DrawerComponent;
        use crate::feedback::loading_veil::LoadingVeilComponent;
        use crate::feedback::message_box::MessageBoxComponent;
        use crate::feedback::modal::ModalComponent;
        use crate::feedback::persistent_toast::PersistentToastComponent;
        use crate::feedback::persistent_toast_group::PersistentToastGroupComponent;
        use crate::feedback::phase_transition::PhaseTransitionComponent;
        use crate::feedback::popover::PopoverComponent;
        use crate::feedback::progress_bar::ProgressBarComponent;
        use crate::feedback::progress_dialog::ProgressDialogComponent;
        use crate::feedback::progress_ring::ProgressRingComponent;
        use crate::feedback::spinner::SpinnerComponent;
        use crate::feedback::toast::ToastComponent;
        use crate::feedback::tooltip::TooltipComponent;
        AlertComponent::register(self);
        BlockingToastComponent::register(self);
        ConfirmDialogComponent::register(self);
        LoadingVeilComponent::register(self);
        MessageBoxComponent::register(self);
        PhaseTransitionComponent::register(self);
        PersistentToastComponent::register(self);
        PersistentToastGroupComponent::register(self);
        ProgressBarComponent::register(self);
        ProgressDialogComponent::register(self);
        ProgressRingComponent::register(self);
        ToastComponent::register(self);
        TooltipComponent::register(self);
        ModalComponent::register(self);
        DrawerComponent::register(self);
        PopoverComponent::register(self);
        SpinnerComponent::register(self);
    }

    #[cfg(not(feature = "feedback"))]
    pub fn register_feedback_components(&mut self) {
        // No-op
    }

    /// Registers all navigation components
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
            AutoCompleteComponent, CascaderComponent, NumberInputComponent,
            NumberSteppersComponent, SearchComponent, TransferComponent,
        };
        NumberInputComponent::register(self);
        NumberSteppersComponent::register(self);
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
        self.register_vue_token_fallbacks();
        self.register_vue_chrome();

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
        self.register_vue_token_fallbacks();
        self.register_vue_chrome();
        self.register_basic_components();
        self.register_data_components();
        self.register_feedback_components();
        self.register_navigation_components();
        self.register_display_components();
        self.register_entry_components();
    }
}

/// CSS custom-property fallbacks mirrored from the canonical Vue token
/// sheets (`packages/vue/src/tokens.scss` + `scale.scss`; vendored copies
/// under `src/styles/vue-mirror/`, kept in sync by
/// `scripts/sync-vue-mirror.py` with the drift test in
/// `tests/vue_mirror_drift_tests.rs`). Register once per registry via
/// [`StyleRegistry::register_vue_token_fallbacks`].
pub fn vue_token_fallbacks_css() -> &'static str {
    tairitsu_macros::scss! { file: "src/styles/vue-mirror/tokens.scss", no_hash }.0
}

/// The mirrored window-close chrome (`packages/vue/src/components/window-close.scss`).
pub fn vue_window_close_css() -> &'static str {
    tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/window-close.scss", no_hash }.0
}

/// The mirrored corner-badge dots (`HkCornerBadge.scss`) — IconButton's
/// per-tone dot backgrounds live here.
pub fn vue_corner_badge_css() -> &'static str {
    tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkCornerBadge.scss", no_hash }
        .0
}

/// The mirrored button voice (`packages/vue/src/components/HkButton.scss`),
/// used by the mirrored toast/footer surfaces.
pub fn vue_button_chrome_css() -> &'static str {
    tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkButton.scss", no_hash }.0
}

/// The second canonical base layer: the spacing / radius / type scale
/// (`packages/vue/src/scale.scss`, vendored under `src/styles/vue-mirror/`).
pub fn vue_scale_fallbacks_css() -> &'static str {
    tairitsu_macros::scss! { file: "src/styles/vue-mirror/scale.scss", no_hash }.0
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
