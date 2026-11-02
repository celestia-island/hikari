//! Compatibility layer for migrating from Dioxus to Tairitsu
//!
//! This module provides type aliases and re-exports to ease the migration process.

// Re-export tairitsu core types
// Re-export tairitsu hooks
pub use tairitsu_hooks::{
    AnimationConfig,
    AnimationDirection,
    AnimationState,
    // Interaction state machine for animated components
    ButtonStateMachine,
    // Context type from tairitsu
    Context,
    EasingFunction,
    InteractionCallback,
    InteractionEvent,
    InteractionState,
    // Memo type
    Memo,
    UseRef,
    provide_context,
    // Dioxus compatibility alias
    provide_context as use_context_provider,
    use_animation,
    use_callback,
    use_context,
    // consume_context is use_context in tairitsu
    use_context as consume_context,
    // try_consume_context is use_context (returns Option)
    use_context as try_consume_context,
    use_effect,
    use_interaction_state,
    // Dioxus compatibility
    use_memo,
    use_ref,
    use_signal,
    use_simple_animation,
    use_state,
};
pub use tairitsu_macros::component as derive_props;
// Re-export tairitsu macros
pub use tairitsu_macros::{Props, component, define_props, rsx};
// Re-export Event as a type alias for Dioxus compatibility
pub use tairitsu_vdom::Event;
pub use tairitsu_vdom::{
    Callback, ChangeEvent, Classes, DataTransfer, DragEvent, ElementHandle, EventData, EventHandle,
    EventHandler, FileData, FocusEvent, FormData, FormEvent, InputEvent, IntoAttrValue, Key,
    KeyboardEvent, MouseData, MouseEvent, Signal, Style, VElement, VNode, VNode as Element, VText,
    batch, create_effect,
};

/// Helper function to create an event handler
pub fn event_handler<F, T>(f: F) -> EventHandler<T>
where
    F: Fn(T) + 'static,
{
    EventHandler::new(f)
}

pub fn empty_vnode() -> VNode {
    VNode::Text(VText::new(""))
}

// Re-export styled components
// Re-export Icon component and types from hikari-icons for convenience
pub use hikari_icons::{Icon, IconProps, MdiIcon};

// Add ArrowProps from basic module
pub use crate::basic::ArrowProps;
// Re-export Props types from components for use in rsx! macro
// When using Component { ... } in rsx!, the macro generates Component(ComponentProps { ... })
// These types need to be in scope

// Basic component Props
pub use crate::basic::{
    AvatarProps, BackgroundProps, BadgeProps, ButtonProps, CardProps, CheckboxProps,
    ColorPickerProps, DatePickerProps, DateTagProps, DateTimePickerProps, FileBrowserDialogProps,
    FileFieldProps, FilePickerFieldProps, FileUploadProps, FormFieldProps, IconButtonGroupProps,
    IconButtonProps, IconChipProps, InputProps, InputWrapperProps, KbdProps, LabelProps,
    OtpInputProps, PhoneInputProps, RadioGroupProps, RollingNumberProps, SearchInputProps,
    SelectProps, SliderFieldProps, SliderProps, SwitchProps, TagInputProps, TemplateTextProps,
    TextareaProps, TimeZoneGlobeProps, TokenInputProps,
};
// Data component Props
pub use crate::data::{
    BarChartProps, CalendarHeatmapProps, CardListProps, CellProps, CollapseProps, ColumnProps,
    DonutChartProps, DragDropTreeProps, FilterBarProps, FilterChipProps, FilterOperatorIconProps,
    FilterPanelProps, FilterTriggerProps, GaugeRingProps, ListRowProps, PaginationButtonProps,
    PaginationProps, RenderDragNodeProps, RowSelectionProps, SelectionGridProps, SelectionProps,
    SelectionWaterfallProps, SortProps, StatCardProps, TableProps, TagDotRowProps,
    TreeNodeArrowProps, TreeNodeContentProps, TreeNodeLabelProps, TreeNodeProps, TreeProps,
    TreemapProps, TreemapStageProps, TrendChartProps, UserPickerProps, VirtualTreeProps,
    WaterfallProps,
};
// Display component Props
pub use crate::display::{
    CalendarProps, CarouselProps, CommentProps, CountdownDigitProps, CrossfadeProps,
    DiffViewerProps, DragLayerProps, EmptyStateProps, HoverRevealActionProps, ImageLightboxProps,
    ImagePreviewProps, ImageViewerProps, InfiniteTailProps, JsonTreeProps, ListTransitionProps,
    LoadMoreProps, LogWindowProps, MarkdownRendererProps, MediaControlBarProps, MediaPlayerProps,
    MediaSliderProps, MediaVisualizerProps, QrCodeProps, SkeletonProps, StepGuideProps, TagProps,
    TerminalProps, TimelineProps, TransitionContainerProps, UserGuideProps, ZoomControlsProps,
};
// Entry component Props
pub use crate::entry::{
    AutoCompleteProps, CascaderProps, NumberInputProps, NumberSteppersProps, SearchProps,
    TransferProps,
};
// Feedback component Props
pub use crate::feedback::{
    AlertProps, BlockingToastCardProps, BlockingToastProps, ConfirmDialogProps, DrawerProps,
    GlowProps, LoadingVeilProps, MessageBoxProps, ModalAction, ModalActionVariant, ModalProps,
    PersistentToastGroupProps, PersistentToastProps, PhaseTransitionProps, PopoverProps,
    ProgressBarProps, ProgressRingProps, SpinnerProps, ToastItemViewProps, ToastProps,
    TooltipProps,
};
// Layout component Props
pub use crate::layout::{
    AdminHeaderProps, AdminShellProps, AdminTablePageProps, AffixPickerProps, ContainerProps,
    DividerProps as LayoutDividerProps, DockBarProps, FaceShellProps, FlexBoxProps, FooterProps,
    HeaderPickerProps, LocalePickerPopupProps, LocalePickerProps, NavItemProps, NavSidebarProps,
    PageHeaderProps, PaneHolderProps, SectionCardProps, ShareBarProps, SidebarRailSwapProps,
    SidebarRailToggleProps, SolarLocationSettingProps, SpaceProps, StatusBarProps, StatusPillProps,
    StatusRowProps, StepFlowProps, TitleBarProps, WindowControlsProps,
};
// Navigation component Props
// `StepsProps` is the deprecated shim of `StepperProps`; re-exported so the
// migration window keeps existing prelude users compiling.
#[allow(deprecated)]
pub use crate::navigation::{
    BreadcrumbItemProps, BreadcrumbProps, KeywordSearchModalProps, LocalizedInputProps,
    MenuIdentityItemProps, MenuItemProps, MenuPanelProps, MenuProps, MenuSectionProps,
    ModalBreadcrumbProps, SearchTriggerProps, SidebarItemProps, SidebarLeafProps, SidebarProps,
    SidebarSectionProps, StepsProps, SubMenuProps, TabPaneProps, TabsProps,
};
// Production component Props
pub use crate::production::{
    AudioPlayerProps, CodeHighlightProps, MarkdownEditorProps, RichTextEditorProps,
    VideoPlayerProps,
};
pub use crate::styled::{StyleRegistry, StyledComponent};
// Overlay + auth family Props
pub use crate::auth::{
    AltSignInProps, AuthCardProps, AuthMethodListProps, AuthSubmitButtonProps, CaptchaModalProps,
    CaptchaWidgetProps, CookieConsentProps, MfaVerifyCardProps, PasswordSurfaceProps,
    SignInCardProps, ThirdPartySignInCardProps,
};
pub use crate::overlay::{
    AdaptiveDialogProps, ContextMenuProviderProps, FloatingLayerProps, PopupSelectProps,
    ProtocolModalProps, SelectPanelProps,
};
// Scene family Props
pub use crate::scene::{
    BlankCanvasProps, Board3DProps, BoardProps, DraggableGridProps, DraggableListProps,
    KanbanProps, Minimap3DProps, MinimapProps, NodeCanvasProps, StarSystemProps, WindowedItemProps,
    ZoomToolbarProps,
};

// Theme + misc family Props
pub use crate::entry::TemplateFieldProps;
pub use crate::theme::{
    AboutModalProps, ActionBarProps, AvatarButtonProps, ColorSchemeDialogProps,
    ColorSchemeEditorProps, ConnectionStatusProps, CopyBadgeProps, ErrorBoundaryProps,
    ErrorLandingProps, LogoProps, SecretRevealModalProps, SettingsDialogProps, SplashProps,
    ThemeDecorProps, ThemePanelContentProps, ThemeToggleProps, WallpaperBackdropProps,
};
