//! Compatibility layer for migrating from Dioxus to Tairitsu
//!
//! This module provides type aliases and re-exports to ease the migration process.

// Re-export tairitsu core types
pub use tairitsu_vdom::{
    batch, create_effect, AnimationEvent, Callback, ChangeEvent, Classes, DataTransfer, DragEvent,
    ElementHandle, EventData, EventHandle, EventHandler, FileData, FocusEvent, FormData, FormEvent,
    InputEvent, IntoAttrValue, Key, KeyboardEvent, MouseData, MouseEvent, Signal, Style, VElement,
    VNode, VNode as Element, VText,
};

// Re-export Event as a type alias for Dioxus compatibility
pub use tairitsu_vdom::Event;

// Re-export tairitsu hooks
pub use tairitsu_hooks::{
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
};

// Re-export tairitsu macros
pub use tairitsu_macros::{component, define_props, rsx, Props};

pub use tairitsu_macros::component as derive_props;

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
pub use crate::styled::{StyleRegistry, StyledComponent};

// Re-export Props types from components for use in rsx! macro
// When using Component { ... } in rsx!, the macro generates Component(ComponentProps { ... })
// These types need to be in scope

// Basic component Props
pub use crate::basic::{
    BackgroundProps, BadgeProps, ButtonProps, CardActionsProps, CardContentProps, CardHeaderProps,
    CardMediaProps, CardProps, CheckboxProps, DatePickerProps, DividerProps, FileUploadProps,
    FormFieldProps, IconButtonProps, InputProps, InputWrapperProps, LinkProps, RadioButtonProps,
    RadioGroupProps, SelectProps, SliderProps, SwitchProps, TextareaProps, TypographyProps,
};

// Feedback component Props
pub use crate::feedback::{
    AlertProps, DrawerProps, GlowProps, PopoverProps, ProgressProps, SpinProps, ToastProps,
    TooltipProps,
};

// Display component Props
pub use crate::display::{
    CalendarProps, CarouselProps, CommentProps, DragLayerProps, EmptyProps, QRCodeProps,
    SkeletonCardProps, SkeletonProps, SkeletonTableProps, TagProps, TimelineItemProps,
    TimelineProps, UserGuideProps, ZoomControlsProps,
};

// Data component Props
pub use crate::data::{
    CellProps, CollapseProps, ColumnProps, DragDropTreeProps, FilterProps, PaginationButtonProps,
    PaginationProps, RenderDragNodeProps, RowSelectionProps, SelectionProps, SortProps, TableProps,
    TreeNodeArrowProps, TreeNodeContentProps, TreeNodeLabelProps, TreeNodeProps, TreeProps,
    VirtualTreeProps,
};

// Navigation component Props
pub use crate::navigation::{
    BreadcrumbItemProps, BreadcrumbProps, MenuItemProps, MenuProps, SidebarItemProps,
    SidebarLeafProps, SidebarProps, SidebarSectionProps, StepsProps, SubMenuProps, TabPaneProps,
    TabsProps,
};

// Entry component Props
pub use crate::entry::{
    AutoCompleteProps, CascaderProps, NumberInputProps, SearchProps, TransferProps,
};

// Production component Props
pub use crate::production::{
    AudioPlayerProps, CodeHighlightProps, MarkdownEditorProps, RichTextEditorProps,
    VideoPlayerProps,
};

// Layout component Props
pub use crate::layout::{
    ContainerProps, DividerProps as LayoutDividerProps, FlexBoxProps, FooterProps, SpaceProps,
};

// Add ArrowProps from basic module
pub use crate::basic::ArrowProps;

// Re-export IconProps from hikari-icons for convenience
pub use hikari_icons::IconProps;
