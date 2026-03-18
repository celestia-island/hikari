//! Compatibility layer for migrating from Dioxus to Tairitsu
//!
//! This module provides type aliases and re-exports to ease the migration process.

// Re-export tairitsu core types
pub use tairitsu_vdom::{
    VNode as Element,
    VNode,
    VElement,
    VText,
    Classes,
    Style,
    Signal,
    batch,
    create_effect,
    EventData,
    MouseEvent,
    MouseData,
    KeyboardEvent,
    InputEvent,
    FocusEvent,
    ChangeEvent,
    FormData,
    FormEvent,
    FileData,
    DragEvent,
    DataTransfer,
    ElementHandle,
    EventHandle,
    // Use tairitsu's Callback and EventHandler (which implement Clone)
    Callback,
    EventHandler,
    // Key type for keyboard events
    Key,
    // Attribute value trait
    IntoAttrValue,
};

// Re-export Event as a type alias for Dioxus compatibility
pub use tairitsu_vdom::Event;

// Re-export tairitsu hooks
pub use tairitsu_hooks::{
    use_signal,
    use_state,
    use_effect,
    use_ref,
    use_context,
    provide_context,
    // consume_context is use_context in tairitsu
    use_context as consume_context,
    // try_consume_context is use_context (returns Option)
    use_context as try_consume_context,
    // Dioxus compatibility alias
    provide_context as use_context_provider,
    // Context type from tairitsu
    Context,
    UseRef,
    use_animation,
    use_simple_animation,
    AnimationConfig,
    AnimationDirection,
    AnimationState,
    EasingFunction,
    // Dioxus compatibility
    use_memo,
    use_callback,
    // Memo type
    Memo,
};

// Re-export tairitsu macros
pub use tairitsu_macros::{rsx, component, Props, define_props};

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
pub use crate::styled::{StyledComponent, StyleRegistry};

// Re-export Props types from components for use in rsx! macro
// When using Component { ... } in rsx!, the macro generates Component(ComponentProps { ... })
// These types need to be in scope

// Basic component Props
pub use crate::basic::{
    BackgroundProps, BadgeProps, ButtonProps, CardActionsProps, CardContentProps,
    CardHeaderProps, CardMediaProps, CardProps, CheckboxProps, DatePickerProps,
    FileUploadProps, FormFieldProps, IconButtonProps, InputProps,
    InputWrapperProps, RadioButtonProps, RadioGroupProps, SelectProps, SliderProps,
    SwitchProps, TextareaProps,
};

// Feedback component Props
pub use crate::feedback::{
    AlertProps, DrawerProps, GlowProps, PopoverProps,
    ProgressProps, SpinProps, ToastProps, TooltipProps,
};

// Display component Props
pub use crate::display::{
    CalendarProps, CarouselProps, CommentProps, DragLayerProps, EmptyProps,
    QRCodeProps, SkeletonCardProps, SkeletonProps, SkeletonTableProps,
    TagProps, TimelineItemProps, TimelineProps, UserGuideProps, ZoomControlsProps,
};

// Data component Props
pub use crate::data::{
    CellProps, CollapseProps, ColumnProps, DragDropTreeProps, FilterProps,
    PaginationButtonProps, PaginationProps, RenderDragNodeProps, RowSelectionProps,
    SelectionProps, SortProps, TableProps, TreeNodeArrowProps, TreeNodeContentProps,
    TreeNodeLabelProps, TreeNodeProps, TreeProps, VirtualTreeProps,
};

// Navigation component Props
pub use crate::navigation::{
    BreadcrumbItemProps, BreadcrumbProps, MenuItemProps, MenuProps,
    SidebarItemProps, SidebarLeafProps, SidebarProps, SidebarSectionProps,
    StepsProps, SubMenuProps, TabPaneProps, TabsProps,
};

// Entry component Props
pub use crate::entry::{
    AutoCompleteProps, CascaderProps, NumberInputProps, SearchProps, TransferProps,
};

// Production component Props
pub use crate::production::{
    AudioPlayerProps, CodeHighlightProps, MarkdownEditorProps,
    RichTextEditorProps, VideoPlayerProps,
};

// Layout component Props
pub use crate::layout::{
    ContainerProps, DividerProps as LayoutDividerProps, FlexBoxProps,
    FooterProps, SpaceProps,
};

// Add ArrowProps from basic module
pub use crate::basic::ArrowProps;

// Re-export IconProps from hikari-icons for convenience
pub use hikari_icons::IconProps;
