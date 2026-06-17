//! Framework compatibility and type re-exports
//!
//! This module provides a unified import surface for component implementations.
//!
//! # Organization
//!
//! - **Framework types** (tairitsu_*): Core VDOM, hooks, and macro types
//! - **Helper functions**: Event handler creation, empty node creation
//! - **Icon types**: From hikari-icons
//! - **Styled components**: StyleRegistry and StyledComponent
//!
//! Component Props types are available via the `props` submodule
//! for targeted imports, or glob-imported here for convenience.

// Framework: tairitsu hooks
pub use tairitsu_hooks::{
    AnimationConfig, AnimationDirection, AnimationState, ButtonStateMachine, Context,
    EasingFunction, InteractionCallback, InteractionEvent, InteractionState, Memo, UseRef,
    provide_context, use_animation, use_callback, use_context, use_context_provider, use_effect,
    use_interaction_state, use_memo, use_ref, use_signal, use_simple_animation, use_state,
};
pub use tairitsu_macros::{Props, component, define_props, rsx};
pub use tairitsu_vdom::{
    AnimationEvent, Callback, ChangeEvent, Classes, DataTransfer, DragEvent, ElementHandle, Event,
    EventData, EventHandle, EventHandler, FileData, FocusEvent, FormData, FormEvent, InputEvent,
    IntoAttrValue, Key, KeyboardEvent, MouseData, MouseEvent, Signal, Style, VElement, VNode,
    VText, batch, create_effect,
};

/// Component return type
pub type Element = VNode;

pub fn event_handler<F, T>(f: F) -> EventHandler<T>
where
    F: Fn(T) + 'static,
{
    EventHandler::new(f)
}

#[must_use]
pub fn empty_vnode() -> VNode {
    VNode::empty()
}

pub use hikari_icons::{IconProps, IconRenderMode};

pub use crate::basic::ArrowProps;
pub use crate::styled::{StyleRegistry, StyledComponent};
// Shared design types (from utils)
pub use crate::utils::glow_types::{GlowBlur, GlowColor, GlowConfig, GlowIntensity, GlowPreset};
pub use crate::utils::portal_types::{MaskMode, ModalPosition, ModalSize, PopoverPlacement};

// Props submodule for targeted imports
pub mod props {
    pub use crate::basic::{
        BackgroundProps, BadgeProps, ButtonProps, CardActionsProps, CardContentProps,
        CardHeaderProps, CardMediaProps, CardProps, CheckboxProps, DatePickerProps,
        FileUploadProps, FormFieldProps, IconButtonProps, InputProps, InputWrapperProps, LinkProps,
        RadioButtonProps, RadioGroupProps, SelectProps, SliderProps, SwitchProps, TextareaProps,
        TypographyProps,
    };
    pub use crate::data::{
        CellProps, CollapseProps, ColumnProps, DragDropTreeProps, FilterProps,
        PaginationButtonProps, PaginationProps, RenderDragNodeProps, RowSelectionProps,
        SelectionProps, SortProps, TableProps, TreeNodeArrowProps, TreeNodeContentProps,
        TreeNodeLabelProps, TreeNodeProps, TreeProps, VirtualTreeProps,
    };
    pub use crate::display::{
        CalendarProps, CarouselProps, CommentProps, DragLayerProps, EmptyProps, QRCodeProps,
        SkeletonCardProps, SkeletonProps, SkeletonTableProps, TagProps, TimelineItemProps,
        TimelineProps, UserGuideProps, ZoomControlsProps,
    };
    pub use crate::entry::{
        AutoCompleteProps, CascaderProps, NumberInputProps, SearchProps, TransferProps,
    };
    pub use crate::feedback::{
        AlertProps, DrawerProps, GlowProps, PopoverProps, ProgressProps, SpinProps, ToastProps,
        TooltipProps,
    };
    pub use crate::layout::{ContainerProps, DividerProps, FlexBoxProps, FooterProps, SpaceProps};
    pub use crate::navigation::{
        BreadcrumbItemProps, BreadcrumbProps, MenuItemProps, MenuProps, SidebarItemProps,
        SidebarLeafProps, SidebarProps, SidebarSectionProps, StepsProps, SubMenuProps,
        TabPaneProps, TabsProps,
    };
    pub use crate::production::{
        AudioPlayerProps, CodeHighlightProps, MarkdownEditorProps, RichTextEditorProps,
        VideoPlayerProps,
    };
}

// Glob-re-export Props for backward compatibility with existing `use crate::prelude::*`
pub use props::*;
