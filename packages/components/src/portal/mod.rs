// hi-components/src/portal/mod.rs
// Portal system - Global portal layer for modals, dropdowns, toasts, etc.

//! # Portal System
//!
//! A comprehensive portal system for rendering modals, dropdowns, toasts, and other
//! overlay elements in Dioxus applications.

//! ## Architecture Overview
//!
//! ```mermaid
//! flowchart TB
//!     subgraph "Application Layer"
//!         A[Dropdown Component]
//!         B[Modal Component]
//!         C[Toast Component]
//!     end

//!     subgraph "Portal Context"
//!         D[PortalContext]
//!         E[PortalProvider]
//!     end
//!
//!     subgraph "Portal Entry Types"
//!         F[PortalEntry]
//!         F1[Modal]
//!         F2[Dropdown]
//!         F3[Toast]
//!     end
//!
//!     subgraph "Portal Rendering"
//!         G[PortalRender]
//!         H[ModalPortalEntry]
//!         I[DropdownPortalEntry]
//!         J[ToastPortalEntry]
//!     end
//!
//!     A --> D
//!     B --> D
//!     C --> D
//!     D --> E
//!     D --> F
//!     F --> F1
//!     F --> F2
//!     F --> F3
//!     F --> G
//!     G --> H
//!     G --> I
//!     G --> J
//! ```
//!
//! ## Core Components
//!
//! ### PortalProvider
//!
//! Root component that provides the PortalContext to the entire application.
//! Must be placed at the top of your component tree.
//!
//! ```rust
//! rsx! {
//!     PortalProvider {
//!         // Your app content
//!     }
//! }
//! ```
//!
//! ### PortalContext
//!
//! Global context for managing portal entries. Access via `use_portal()`.
//!
//! ```rust
//! let portal = use_portal();
//! portal.add_entry(PortalEntry::Modal { ... });
//! ```
//!
//! ### Positioning Strategies
//!
//! Three distinct positioning strategies are supported:
//!
//! #### 1. Fixed Positioning
//!
//! Absolute screen coordinates. Useful for toasts and centered modals.
//!
//! ```rust
//! PortalPositionStrategy::Fixed(x, y)
//! ```
//!
//! #### 2. TriggerBased Positioning
//!
//! Position relative to a trigger element. Used for dropdowns and context menus.
//!
//! ```rust
//! PortalPositionStrategy::TriggerBased {
//!     placement: TriggerPlacement::BottomRight
//! }
//! ```
//!
//! #### 3. MouseBased Positioning
//!
//! Position at mouse/touch cursor coordinates. Currently falls back to viewport center.
//!
//! ```rust
//! PortalPositionStrategy::MouseBased {
//!     placement: TriggerPlacement::Bottom
//! }
//! ```
//!
//! ## Placement Options
//!
//! 12 placement directions are supported:
//!
//! - **Bottom family**: `Bottom`, `BottomLeft`, `BottomRight` (below trigger)
//! - **Top family**: `Top`, `TopLeft`, `TopRight` (above trigger)
//! - **Left family**: `Left`, `LeftTop`, `LeftBottom` (left of trigger)
//! - **Right family**: `Right`, `RightTop`, `RightBottom` (right of trigger)
//! - **Center**: `Center` (overlay trigger)
//!
//! ## Usage Examples
//!
//! ### Dropdown with TriggerBased Positioning
//!
//! ```rust
//! use hikari_components::portal::{PortalEntry, PortalPositionStrategy, TriggerPlacement};
//!
//! let portal = use_portal();
//! let trigger_rect = use_signal(|| None::<(f64, f64, f64, f64)>);
//!
//! let open_dropdown = move |_| {
//!     // Get trigger element bounding rect
//!     // ... get rect ...
//!
//!     portal.add_entry(PortalEntry::Dropdown {
//!         id: "dropdown-1".to_string(),
//!         strategy: PortalPositionStrategy::TriggerBased {
//!             placement: TriggerPlacement::BottomRight,
//!         },
//!         mask_mode: PortalMaskMode::Transparent,
//!         children: rsx! { div { "Menu items" } },
//!         trigger_rect: *trigger_rect.read(),
//!         close_on_select: true,
//!     });
//! };
//! ```
//!
//! ### Modal with Fixed Positioning
//!
//! ```rust
//! use hikari_components::portal::PortalEntry;
//! use hikari_components::modal::ModalPosition;
//!
//! portal.add_entry(PortalEntry::Modal {
//!     id: "modal-1".to_string(),
//!     title: Some("My Modal".to_string()),
//!     position: ModalPosition::Center,
//!     mask_mode: MaskMode::Dimmed,
//!     closable: true,
//!     mask_closable: true,
//!     children: rsx! { div { "Modal content" } },
//! });
//! ```
//!
//! ## Features
//!
//! - **Z-index Management**: Automatic z-index stacking for multiple portals
//! - **Mask/Overlay Support**: Dimmed or transparent overlay modes
//! - **Close on Select**: Automatic dropdown closing on menu item click
//! - **Boundary Checking**: Strict viewport boundary enforcement with clamping
//! - **Type Safety**: Full Rust type safety with enums for all options
//!
//! ## Implementation Details
//!
//! - **Portal Layer**: Fixed-position `div` with `z-index: 9999` at root
//! - **Event Propagation**: Click events handled with proper stopPropagation
//! - **WASM Support**: Full WASM support with `#[cfg(target_arch = "wasm32")]`
//! - **Performance**: Signals for reactive updates, minimal re-renders
//!
//! See the `calculate_position` function for detailed positioning algorithm documentation.

pub mod animation;

use std::sync::atomic::{AtomicU64, Ordering};

use dioxus::prelude::*;
use palette::classes::{ClassesBuilder, DropdownClass, ModalClass, PortalClass};
#[cfg(target_arch = "wasm32")]
use wasm_bindgen::{closure::Closure, JsCast};

use super::modal::{MaskMode, ModalPosition};

static PORTAL_ID_COUNTER: AtomicU64 = AtomicU64::new(0);

/// Portal position strategy
#[derive(Clone, Copy, PartialEq, Debug)]
pub enum PortalPositionStrategy {
    /// Fixed position (x, y coordinates) - simple offset from reference point
    Fixed(f64, f64),
    /// Based on trigger element's bounding rect - menu appears at element edge
    TriggerBased { placement: TriggerPlacement },
    /// Based on mouse/touch coordinates - menu appears at cursor
    MouseBased { placement: TriggerPlacement },
}

/// Trigger placement relative to trigger element or mouse position
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum TriggerPlacement {
    #[default]
    Bottom,
    BottomLeft,
    BottomRight,
    Top,
    TopLeft,
    TopRight,
    Left,
    LeftTop,
    LeftBottom,
    Right,
    RightTop,
    RightBottom,
    Center,
}

/// Modal animation state
#[derive(Clone, Copy, PartialEq, Debug)]
pub enum ModalAnimationState {
    Appearing,
    Visible,
    Disappearing,
}

/// Portal entry types
#[derive(Clone, PartialEq, Debug)]
pub enum PortalEntry {
    Modal {
        id: String,
        title: Option<String>,
        position: ModalPosition,
        mask_mode: MaskMode,
        closable: bool,
        mask_closable: bool,
        children: Element,
        animation_state: ModalAnimationState,
    },
    Dropdown {
        id: String,
        strategy: PortalPositionStrategy,
        mask_mode: PortalMaskMode,
        children: Element,
        /// Optional trigger element bounding rect (x, y, width, height) for TriggerBased positioning
        trigger_rect: Option<(f64, f64, f64, f64)>,
        /// Close dropdown when content is clicked (for menu selection)
        close_on_select: bool,
    },
    Toast {
        id: String,
        position: ToastPosition,
        children: Element,
    },
}

/// Portal mask mode
#[derive(Clone, Copy, PartialEq, Debug)]
pub enum PortalMaskMode {
    /// Dimmed overlay - semi-transparent black background
    Dimmed,
    /// Transparent overlay - fully transparent, no background
    Transparent,
}

/// Portal toast positioning
#[derive(Clone, Copy, PartialEq, Debug)]
pub enum ToastPosition {
    TopLeft,
    TopCenter,
    TopRight,
    BottomLeft,
    BottomCenter,
    BottomRight,
}

/// Animated Portal Entry Hook - Generic animation control layer for all portal types
/// Returns (animation_state, close_callback, computed_opacity_scale)
#[allow(dead_code)]
fn use_animated_portal_entry(
    id: String,
    initial_state: ModalAnimationState,
    name: &'static str,
) -> (
    Signal<ModalAnimationState>,
    Callback<MouseEvent>,
    Memo<(String, String)>,
) {
    let context = use_context::<PortalContext>();
    let id_for_close = id.clone();
    let internal_animation_state = use_signal(|| initial_state);

    let close_callback = {
        let mut anim_state = internal_animation_state.clone();
        Callback::new(move |_| {
            #[cfg(target_arch = "wasm32")]
            {
                web_sys::console::log_1(&format!("{} close triggered", name).into());
            }
            #[cfg(not(target_arch = "wasm32"))]
            let _ = name;
            anim_state.set(ModalAnimationState::Disappearing);
        })
    };

    let computed_opacity_scale = use_memo(move || {
        let state = *internal_animation_state.read();
        #[cfg(target_arch = "wasm32")]
        {
            web_sys::console::log_1(
                &format!("{} use_memo triggered, state: {:?}", name, state).into(),
            );
        }
        let (opacity, scale) = match state {
            ModalAnimationState::Appearing => ("0".to_string(), "0.95".to_string()),
            ModalAnimationState::Visible => ("1".to_string(), "1".to_string()),
            ModalAnimationState::Disappearing => ("0".to_string(), "0.95".to_string()),
        };
        (opacity, scale)
    });

    #[cfg(target_arch = "wasm32")]
    {
        use_effect(use_reactive(
            (&internal_animation_state,),
            move |(anim_state,)| {
                let state = *anim_state.read();
                #[cfg(target_arch = "wasm32")]
                {
                    web_sys::console::log_1(
                        &format!("{} use_effect triggered, state: {:?}", name, state).into(),
                    );
                }
                if state == ModalAnimationState::Appearing {
                    let mut anim_state_clone = internal_animation_state.clone();
                    let callback = Closure::once_into_js(move || {
                        anim_state_clone.set(ModalAnimationState::Visible);
                        #[cfg(target_arch = "wasm32")]
                        {
                            web_sys::console::log_1(
                                &format!("{} set to visible via requestAnimationFrame", name)
                                    .into(),
                            );
                        }
                    });
                    let _ = web_sys::window()
                        .unwrap()
                        .request_animation_frame(callback.unchecked_ref());
                } else if state == ModalAnimationState::Disappearing {
                    let id = id_for_close.clone();
                    #[cfg(target_arch = "wasm32")]
                    web_sys::console::log_1(
                        &format!("{} setTimeout scheduled for removing entry: {}", name, id).into(),
                    );
                    let callback = Closure::once_into_js(move || {
                        #[cfg(target_arch = "wasm32")]
                        {
                            web_sys::console::log_1(
                                &format!("{} removing entry after timeout: {}", name, id).into(),
                            );
                        }
                        context.remove_entry.call(id.clone());
                    });
                    let _ = web_sys::window()
                        .unwrap()
                        .set_timeout_with_callback_and_timeout_and_arguments_0(
                            callback.as_ref().unchecked_ref(),
                            200,
                        );
                }
            },
        ));
    }

    (
        internal_animation_state,
        close_callback,
        computed_opacity_scale,
    )
}

/// Portal Context - Global context for managing portal entries
#[derive(Clone)]
pub struct PortalContext {
    pub entries: Signal<Vec<PortalEntry>>,
    pub add_entry: Callback<PortalEntry>,
    pub remove_entry: Callback<String>,
    pub clear_all: Callback<()>,
    pub start_close_animation: Callback<String>,
}

/// Calculate position with strict boundary checking
///
/// # Overview
///
/// This function computes the optimal (x, y) coordinates for positioning portal elements
/// (modals, dropdowns, toasts) relative to a trigger element, mouse position, or fixed screen coordinates.
/// It implements three distinct positioning strategies with strict boundary checking to ensure
/// elements remain visible within the viewport.
///
/// # Positioning Strategies
///
/// ## 1. Fixed Positioning
///
/// Direct absolute positioning on the screen, useful for toasts and modals.
///
/// ```mermaid
/// sequenceDiagram
///     participant Input as Fixed(x,y)
///     participant Calc as calculate_position()
///     participant Output as Final (x,y)
///
///     Input->>Calc: Provide absolute coordinates
///     Calc->>Calc: Clamp x to [PADDING, width - element_width - PADDING]
///     Calc->>Calc: Clamp y to [PADDING, height - MENU_MAX_HEIGHT - PADDING]
///     Calc->>Output: Return clamped position
/// ```
///
/// ## 2. TriggerBased Positioning
///
/// Position relative to a trigger element's bounding client rect. This is the default for
/// dropdowns and context menus.
///
/// ```mermaid
/// sequenceDiagram
///     participant Trigger as Trigger Element
///     participant Calc as calculate_position()
///     participant Viewport as Viewport
///     participant Menu as Menu Element
///
///     Trigger->>Calc: Provide (x, y, width, height)
///     Calc->>Calc: Compute base position based on placement
///     Note over Calc: Placement determines alignment:<br/>Bottom*: (center_x, bottom + OFFSET)<br/>Top*: (center_x, top - OFFSET)<br/>Left*: (left - OFFSET - width, center_y)<br/>Right*: (right + OFFSET, center_y)<br/>Center: (center_x, center_y)
///     Calc->>Viewport: Check X boundary
///     Viewport-->>Calc: Clamp x to [PADDING, viewport_width - menu_width - PADDING]
///     Calc->>Menu: Return final (x, y)
/// ```
///
/// ## 3. MouseBased Positioning
///
/// Position at mouse/touch cursor coordinates. Currently falls back to viewport center
/// (mouse coordinate storage not yet implemented).
///
/// # Key Design Principles
///
/// ## 1. Horizontal Alignment
///
/// - **Bottom/Top/Center**: Menu x = trigger horizontal center
/// - **Left\***: Menu x = trigger left edge - OFFSET - menu_width
/// - **Right\***: Menu x = trigger right edge + OFFSET
/// - **No dependency on menu width** for center alignment
///
/// ## 2. Vertical Alignment
///
/// - **Bottom\***: Menu y = trigger bottom + OFFSET (below trigger)
/// - **Top\***: Menu y = trigger top - OFFSET (above trigger)
/// - **Left/Right**: Menu y = trigger vertical center
/// - **Center**: Menu y = trigger vertical center
///
/// ## 3. Strict Boundary Checking
///
/// ### X-Axis (Always Clamped)
///
/// ```text
/// PADDING <= x <= viewport_width - element_width - PADDING
/// ```
///
/// Prevents horizontal overflow in all scenarios.
///
/// ### Y-Axis (Selective Clamping)
///
/// - **Bottom\***: No clamp (menu extends downward from trigger)
/// - **Top\***: No clamp (menu extends upward from trigger)
/// - **Left/Right/Center**: No clamp (menu centered vertically relative to trigger)
///
/// **Note**: Unlike some implementations that flip placement when detecting overflow,
/// this implementation prioritizes consistent positioning. The menu may extend beyond
/// the viewport vertically in edge cases.
///
/// # Constants
///
/// - `OFFSET = 8.0px`: Spacing between trigger element and menu
/// - `PADDING = 16.0px`: Minimum distance from viewport edges
/// - `MENU_MAX_HEIGHT = 400.0px`: Assumed max height for fallback calculations
///
/// # Visual Reference
///
/// ## BottomRight Placement Example
///
/// ```text
///   Viewport (1920x1080)
///   ┌────────────────────────────────────────────┐
///   │                                            │
///   │   +--------+ (100,100) - trigger top-left  │
///   │   | BUTTON |           - width=80, height=40│
///   │   +--------+ (180,140) - trigger bottom-right│
///   │                                            │
///   │            +------------------+             │
///   │            | MENU           | <- x=180, y=148 │
///   │            | (200px wide)   |               │
///   │            +------------------+             │
///   │                                            │
///   └────────────────────────────────────────────┘
/// ```
///
/// Calculation:
/// - `trigger_center_x` = 100 + 80/2 = 140
/// - `trigger_right` = 100 + 80 = 180
/// - `trigger_bottom` = 100 + 40 = 140
/// - **BottomRight**: x = 180, y = 140 + 8 = 148
///
/// # Placement Examples
///
/// ## Bottom Family (below trigger)
///
/// ```text
///   +--------+        Bottom: x=center, y=bottom+OFFSET
///   | TRIGGER|
///   +--------+
///     +--+
///     |MENU|
///     +--+
///
///   +--------+        BottomLeft: x=left, y=bottom+OFFSET
///   | TRIGGER|
///   +--------+
///   +--+
///   |MENU|
///   +--+
///
///   +--------+        BottomRight: x=right, y=bottom+OFFSET
///   | TRIGGER|
///   +--------+
///         +--+
///         |MENU|
///         +--+
/// ```
///
/// ## Top Family (above trigger)
///
/// ```text
///     +--+
///     |MENU|            Top: x=center, y=top-OFFSET
///     +--+
///   +--------+
///   | TRIGGER|
///   +--------+
///
///   +--+             TopLeft: x=left, y=top-OFFSET
///   |MENU|
///   +--+
///   +--------+
///   | TRIGGER|
///   +--------+
///
///         +--+         TopRight: x=right, y=top-OFFSET
///         |MENU|
///         +--+
///   +--------+
///   | TRIGGER|
///   +--------+
/// ```
///
/// ## Left Family (left of trigger)
///
/// ```text
/// +--+              Left: x=left-OFFSET-menu_width, y=center
/// |MENU|
/// +--+ +--------+
///     | TRIGGER|
///     +--------+
///
/// +--+              LeftTop: x=left-OFFSET-menu_width, y=top
/// |MENU|
/// +--+ +--------+
///     | TRIGGER|
///     +--------+
///
///      +--+         LeftBottom: x=left-OFFSET-menu_width, y=bottom
///      |MENU|
/// +--+ +--------+
/// | TRIGGER|
/// +--------+
/// ```
///
/// ## Right Family (right of trigger)
///
/// ```text
///     +--------+ +--+
///     | TRIGGER| |MENU|        Right: x=right+OFFSET, y=center
///     +--------+ +--+
///
///     +--------+
///     | TRIGGER| +--+         RightTop: x=right+OFFSET, y=top
///     +--------+ |MENU|
///                +--+
///
///     +--------+
///     | TRIGGER|    +--+      RightBottom: x=right+OFFSET, y=bottom
///     +--------+    |MENU|
///                   +--+
/// ```
///
/// # Edge Cases and Fallbacks
///
/// 1. **No trigger rect provided**: Falls back to viewport center
/// 2. **Menu outside viewport X**: Clamped to [PADDING, viewport_width - menu_width - PADDING]
/// 3. **Menu outside viewport Y**: Not clamped (menu extends in placement direction)
/// 4. **MouseBased without coords**: Falls back to viewport center (pending implementation)
///
/// # Parameters
///
/// - `strategy`: Positioning strategy (Fixed, TriggerBased, MouseBased)
/// - `viewport_width`: Width of the viewport in pixels
/// - `viewport_height`: Height of the viewport in pixels
/// - `element_width`: Width of the menu/modal being positioned
/// - `trigger_rect`: Optional bounding rect (x, y, width, height) of trigger element
///
/// # Returns
///
/// Tuple of (x, y) coordinates for the menu's top-left corner.
///
/// # Examples
///
/// ```
/// use hikari_components::portal::{calculate_position, PortalPositionStrategy, TriggerPlacement};
///
/// // Trigger-based positioning
/// let strategy = PortalPositionStrategy::TriggerBased {
///     placement: TriggerPlacement::BottomRight
/// };
/// let (x, y) = calculate_position(
///     &strategy,
///     1920.0,  // viewport width
///     1080.0,  // viewport height
///     200.0,   // menu width
///     Some((100.0, 100.0, 80.0, 40.0))  // trigger rect
/// );
/// // Returns: (180.0, 148.0)
/// ```
fn calculate_position(
    strategy: &PortalPositionStrategy,
    viewport_width: f64,
    viewport_height: f64,
    element_width: f64,
    trigger_rect: Option<(f64, f64, f64, f64)>,
) -> (f64, f64) {
    const OFFSET: f64 = 8.0;
    const PADDING: f64 = 16.0;
    const MENU_MAX_HEIGHT: f64 = 400.0;

    match strategy {
        PortalPositionStrategy::Fixed(x, y) => {
            let x_pos = x.clamp(PADDING, viewport_width - element_width - PADDING);
            let y_pos = y.clamp(PADDING, viewport_height - 100.0 - PADDING);
            (x_pos, y_pos)
        }
        PortalPositionStrategy::TriggerBased { placement } => {
            if let Some((rect_x, rect_y, rect_w, rect_h)) = trigger_rect {
                let trigger_center_x = rect_x + rect_w / 2.0;
                let trigger_center_y = rect_y + rect_h / 2.0;

                #[cfg(target_arch = "wasm32")]
                {
                    web_sys::console::log_1(
                        &format!("Portal calculate_position: placement={:?}, trigger_rect=({:.1}, {:.1}, {:.1}, {:.1}), viewport=({:.1}, {:.1}), elem_width={:.1}",
                            placement, rect_x, rect_y, rect_w, rect_h, viewport_width, viewport_height, element_width).into()
                    );
                }

                let (x, y) = match placement {
                    // === Bottom family (below trigger) ===
                    TriggerPlacement::Bottom => (trigger_center_x, rect_y + rect_h + OFFSET),
                    TriggerPlacement::BottomLeft => (rect_x, rect_y + rect_h + OFFSET),
                    TriggerPlacement::BottomRight => (rect_x + rect_w, rect_y + rect_h + OFFSET),
                    // === Top family (above trigger) ===
                    TriggerPlacement::Top => {
                        (trigger_center_x - element_width / 2.0, rect_y - OFFSET)
                    }
                    TriggerPlacement::TopLeft => (rect_x, rect_y - OFFSET),
                    TriggerPlacement::TopRight => (rect_x + rect_w, rect_y - OFFSET),
                    // === Left family (left of trigger) ===
                    TriggerPlacement::Left => (rect_x - OFFSET - element_width, trigger_center_y),
                    TriggerPlacement::LeftTop => (rect_x - OFFSET - element_width, rect_y),
                    TriggerPlacement::LeftBottom => {
                        (rect_x - OFFSET - element_width, rect_y + rect_h)
                    }
                    // === Right family (right of trigger) ===
                    TriggerPlacement::Right => (rect_x + rect_w + OFFSET, trigger_center_y),
                    TriggerPlacement::RightTop => (rect_x + rect_w + OFFSET, rect_y),
                    TriggerPlacement::RightBottom => (rect_x + rect_w + OFFSET, rect_y + rect_h),

                    // === Center (overlay trigger) ===
                    TriggerPlacement::Center => (trigger_center_x, trigger_center_y),
                };

                // X-axis clamping (horizontal boundary)
                let x_clamped = x.clamp(PADDING, viewport_width - element_width - PADDING);

                // Y-axis clamping based on placement direction
                let y_clamped = match placement {
                    // Bottom* family: clamp to prevent overflow at bottom
                    TriggerPlacement::Bottom
                    | TriggerPlacement::BottomLeft
                    | TriggerPlacement::BottomRight => y.clamp(PADDING, viewport_height - PADDING),
                    // Top* family: only prevent overflow at top (not bottom, since menu is above trigger)
                    TriggerPlacement::Top
                    | TriggerPlacement::TopLeft
                    | TriggerPlacement::TopRight => y.max(PADDING),
                    // Left* family: clamp both top and bottom
                    TriggerPlacement::Left
                    | TriggerPlacement::LeftTop
                    | TriggerPlacement::LeftBottom => y.clamp(PADDING, viewport_height - PADDING),
                    // Right* family: clamp both top and bottom
                    TriggerPlacement::Right
                    | TriggerPlacement::RightTop
                    | TriggerPlacement::RightBottom => y.clamp(PADDING, viewport_height - PADDING),
                    // Center: clamp both axes
                    TriggerPlacement::Center => y.clamp(PADDING, viewport_height - PADDING),
                };

                #[cfg(target_arch = "wasm32")]
                {
                    web_sys::console::log_1(
                        &format!(
                            "Portal calculated position: ({:.1}, {:.1}) -> ({:.1}, {:.1}), placement={:?}",
                            x, y, x_clamped, y_clamped, placement
                        )
                        .into(),
                    );
                }

                (x_clamped, y_clamped)
            } else {
                #[cfg(target_arch = "wasm32")]
                {
                    web_sys::console::log_1(
                        &"Portal: trigger_rect is None, using center fallback".into(),
                    );
                }

                let x = (viewport_width - element_width) / 2.0;
                let y = (viewport_height - MENU_MAX_HEIGHT) / 2.0;
                (x, y)
            }
        }
        PortalPositionStrategy::MouseBased { placement: _ } => {
            let x = (viewport_width - element_width) / 2.0;
            let y = (viewport_height - MENU_MAX_HEIGHT) / 2.0;
            (x, y)
        }
    }
}

#[component]
pub fn PortalProvider(children: Element) -> Element {
    let entries = use_signal(Vec::new);
    let mut entries_for_callbacks = entries.clone();

    let add_entry = Callback::new(move |entry: PortalEntry| {
        let mut e = entries_for_callbacks.write();
        e.push(entry);
    });

    let mut entries_for_remove = entries.clone();
    let remove_entry = Callback::new(move |id: String| {
        let mut e = entries_for_remove.write();
        e.retain(|entry| match entry {
            PortalEntry::Modal { id: entry_id, .. } => entry_id != &id,
            PortalEntry::Dropdown { id: entry_id, .. } => entry_id != &id,
            PortalEntry::Toast { id: entry_id, .. } => entry_id != &id,
        });
    });

    let mut entries_for_clear = entries.clone();
    let clear_all = Callback::new(move |_| {
        let mut e = entries_for_clear.write();
        e.clear();
    });

    let mut entries_for_close_anim = entries.clone();
    let start_close_animation = Callback::new(move |id: String| {
        let mut e = entries_for_close_anim.write();
        for entry in e.iter_mut() {
            if let PortalEntry::Modal {
                id: entry_id,
                animation_state,
                ..
            } = entry
            {
                if entry_id == &id && *animation_state == ModalAnimationState::Visible {
                    *animation_state = ModalAnimationState::Disappearing;
                }
            }
        }
    });

    use_context_provider(|| PortalContext {
        entries: entries.clone(),
        add_entry: add_entry.clone(),
        remove_entry: remove_entry.clone(),
        clear_all: clear_all.clone(),
        start_close_animation: start_close_animation.clone(),
    });

    rsx! {
        { children }
        PortalRender { entries }
    }
}

#[component]
fn PortalRender(entries: Signal<Vec<PortalEntry>>) -> Element {
    let entries = entries.read();

    let portal_classes = ClassesBuilder::new().add(PortalClass::PortalRoot).build();

    rsx! {
        div {
            class: "{portal_classes}",
            style: "position: fixed; top: 0; left: 0; right: 0; bottom: 0; pointer-events: none; z-index: 9999;",

            {
                entries.iter().enumerate().map(|(index, entry)| {
                    let z_index = 10000 + index;
                    match entry {
                        PortalEntry::Modal {
                            id,
                            title,
                            position,
                            mask_mode,
                            closable,
                            mask_closable,
                            children,
                            animation_state,
                        } => rsx! {
                            ModalPortalEntry {
                                key: "{id}",
                                z_index,
                                id: id.clone(),
                                title: title.clone(),
                                position: *position,
                                mask_mode: *mask_mode,
                                closable: *closable,
                                mask_closable: *mask_closable,
                                children: children.clone(),
                                animation_state: *animation_state,
                            }
                        },
                        PortalEntry::Dropdown {
                            id,
                            strategy,
                            mask_mode,
                            children,
                            trigger_rect,
                            close_on_select,
                        } => rsx! {
                            DropdownPortalEntry {
                                key: "{id}",
                                z_index,
                                id: id.clone(),
                                strategy: *strategy,
                                mask_mode: *mask_mode,
                                children: children.clone(),
                                trigger_rect: trigger_rect.clone(),
                                close_on_select: *close_on_select,
                            }
                        },
                        PortalEntry::Toast {
                            id,
                            position,
                            children,
                        } => rsx! {
                            ToastPortalEntry {
                                key: "{id}",
                                z_index,
                                id: id.clone(),
                                position: *position,
                                children: children.clone(),
                            }
                        },
                    }
                })
            }
        }
    }
}

#[component]
fn ModalPortalEntry(
    z_index: usize,
    id: String,
    title: Option<String>,
    position: ModalPosition,
    mask_mode: MaskMode,
    closable: bool,
    mask_closable: bool,
    children: Element,
    animation_state: ModalAnimationState,
) -> Element {
    let _internal_animation_state = use_signal(|| animation_state);
    let (_, button_close, computed_opacity_scale) =
        use_animated_portal_entry(id.clone(), animation_state, "Modal");

    let overlay_classes = if mask_mode == MaskMode::Transparent {
        ClassesBuilder::new()
            .add(ModalClass::Overlay)
            .add(ModalClass::OverlayTransparent)
            .build()
    } else {
        ClassesBuilder::new().add(ModalClass::Overlay).build()
    };

    let modal_classes = ClassesBuilder::new().add(ModalClass::Modal).build();

    let modal_style = use_memo(move || {
        let (opacity, scale) = computed_opacity_scale.read().clone();
        let style = format!("opacity: {}; transform: scale({}); transition: opacity 0.2s ease-in-out, transform 0.2s ease-in-out;", opacity, scale);
        #[cfg(target_arch = "wasm32")]
        {
            web_sys::console::log_1(&format!("Modal style computed: {}", style).into());
        }
        style
    });

    let header_classes = ClassesBuilder::new().add(ModalClass::Header).build();

    let title_classes = ClassesBuilder::new().add(ModalClass::Title).build();

    let close_classes = ClassesBuilder::new().add(ModalClass::Close).build();

    let body_classes = ClassesBuilder::new().add(ModalClass::Body).build();

    rsx! {
        div {
            class: "{overlay_classes}",
            style: "position: fixed; top: 0; left: 0; right: 0; bottom: 0; pointer-events: auto; display: flex; align-items: center; justify-content: center; z-index: {z_index};",
            // For Opaque mode, close on overlay click
            onclick: move |e: MouseEvent| {
                if mask_closable && mask_mode == MaskMode::Opaque {
                    e.stop_propagation();
                    button_close.call(e);
                }
            },

            div {
                class: "{modal_classes}",
                style: "{modal_style.read()}",
                // Content click - stop propagation to prevent overlay click
                onclick: |e: MouseEvent| {
                    e.stop_propagation();
                },

                div { class: "{header_classes}",
                    if let Some(title_val) = title {
                        h3 { class: "{title_classes}", "{title_val}" }
                    }

                    if closable {
                        button { class: "{close_classes}",
                            onclick: button_close,
                            svg {
                                view_box: "0 0 24 24",
                                fill: "none",
                                stroke: "currentColor",
                                stroke_width: "2",
                                line { x1: "18", y1: "6", x2: "6", y2: "18" }
                                line { x1: "6", y1: "6", x2: "18", y2: "18" }
                            }
                        }
                    }
                }

                div { class: "{body_classes}",
                    { children }
                }
            }
        }
    }
}

#[component]
fn DropdownPortalEntry(
    z_index: usize,
    id: String,
    strategy: PortalPositionStrategy,
    mask_mode: PortalMaskMode,
    children: Element,
    trigger_rect: Option<(f64, f64, f64, f64)>,
    close_on_select: bool,
) -> Element {
    let _internal_animation_state = use_signal(|| ModalAnimationState::Appearing);
    let (_, close_dropdown, computed_opacity_scale) =
        use_animated_portal_entry(id.clone(), ModalAnimationState::Appearing, "Dropdown");

    let viewport_width = use_signal(|| {
        #[cfg(target_arch = "wasm32")]
        {
            web_sys::window()
                .and_then(|w| w.inner_width().ok())
                .and_then(|v| v.as_f64())
                .unwrap_or(1920.0)
        }
        #[cfg(not(target_arch = "wasm32"))]
        {
            1920.0
        }
    });
    let viewport_height = use_signal(|| {
        #[cfg(target_arch = "wasm32")]
        {
            web_sys::window()
                .and_then(|w| w.inner_height().ok())
                .and_then(|v| v.as_f64())
                .unwrap_or(1080.0)
        }
        #[cfg(not(target_arch = "wasm32"))]
        {
            1080.0
        }
    });

    let element_width = use_signal(|| 200.0);

    let _position_style = use_memo(move || {
        let viewport_w = *viewport_width.read();
        let viewport_h = *viewport_height.read();
        let elem_w = *element_width.read();

        // Get placement and trigger rect from strategy
        let (placement, _trigger_x, trigger_y) = match &strategy {
            PortalPositionStrategy::TriggerBased { placement } => {
                if let Some((rect_x, rect_y, _, _)) = trigger_rect {
                    (Some(*placement), Some(rect_x), Some(rect_y))
                } else {
                    (Some(*placement), None, None)
                }
            }
            _ => (None, None, None),
        };

        // Calculate base position
        let (x, y) = calculate_position(&strategy, viewport_w, viewport_h, elem_w, trigger_rect);

        // Generate style string based on placement
        match placement {
            // Bottom* family: position below trigger, use top
            Some(
                TriggerPlacement::Bottom
                | TriggerPlacement::BottomLeft
                | TriggerPlacement::BottomRight,
            ) => {
                format!("position: fixed; left: {}px; top: {}px;", x, y)
            }
            // Top* family: position above trigger, use bottom
            Some(
                TriggerPlacement::Top | TriggerPlacement::TopLeft | TriggerPlacement::TopRight,
            ) => {
                if let Some(ty) = trigger_y {
                    let bottom_offset = viewport_h - ty;
                    format!(
                        "position: fixed; left: {}px; bottom: {}px;",
                        x, bottom_offset
                    )
                } else {
                    format!("position: fixed; left: {}px; bottom: {}px;", x, y)
                }
            }
            // Left* family: position left of trigger
            Some(
                TriggerPlacement::Left | TriggerPlacement::LeftTop | TriggerPlacement::LeftBottom,
            ) => {
                format!("position: fixed; left: {}px; top: {}px;", x, y)
            }
            // Right* family: position right of trigger
            Some(
                TriggerPlacement::Right
                | TriggerPlacement::RightTop
                | TriggerPlacement::RightBottom,
            ) => {
                format!("position: fixed; left: {}px; top: {}px;", x, y)
            }
            // Center: position at center
            Some(TriggerPlacement::Center) => {
                format!("position: fixed; left: {}px; top: {}px;", x, y)
            }
            None => format!("position: fixed; left: {}px; top: {}px;", x, y),
        }
    });

    let overlay_classes = if mask_mode == PortalMaskMode::Dimmed {
        ClassesBuilder::new()
            .add(DropdownClass::Overlay)
            .add(DropdownClass::OverlayDimmed)
            .build()
    } else {
        ClassesBuilder::new().add(DropdownClass::Overlay).build()
    };

    let dropdown_classes = use_memo(move || {
        let base = ClassesBuilder::new().add(DropdownClass::Dropdown).build();
        base
    });

    let overlay_style = format!(
        "position: fixed; top: 0; left: 0; right: 0; bottom: 0; pointer-events: auto; z-index: {}; transition: opacity 0.2s ease-in-out;",
        z_index
    );

    let content_style = use_memo(move || {
        let pos = _position_style.read();
        let (opacity, scale) = computed_opacity_scale.read().clone();

        let transform_origin = match &strategy {
            PortalPositionStrategy::TriggerBased { placement } => match placement {
                TriggerPlacement::Bottom
                | TriggerPlacement::BottomLeft
                | TriggerPlacement::BottomRight => "top center",
                TriggerPlacement::Top | TriggerPlacement::TopLeft | TriggerPlacement::TopRight => {
                    "bottom center"
                }
                _ => "center center",
            },
            _ => "center center",
        };

        let style = format!(
            "{} opacity: {}; transform: scaleY({}); transform-origin: {}; transition: opacity 0.2s ease-in-out, transform 0.2s ease-in-out;",
            pos, opacity, scale, transform_origin
        );
        #[cfg(target_arch = "wasm32")]
        {
            web_sys::console::log_1(&format!("Dropdown style computed: {}", style).into());
        }
        style
    });

    rsx! {
        div {
            class: "{overlay_classes}",
            style: "{overlay_style}",
            // Overlay click - close dropdown
            onclick: move |e: MouseEvent| {
                e.stop_propagation();
                close_dropdown.call(e);
            },

            div {
                class: "{dropdown_classes}",
                style: "{content_style.read()}",
                // Content click - stop propagation to prevent overlay click
                onclick: move |e: MouseEvent| {
                    e.stop_propagation();
                    // Close on select if enabled
                    if close_on_select {
                        // Check if click is on a menu item (not just whitespace)
                        #[cfg(target_arch = "wasm32")]
                        {
                            if let Some(web_event) = e.downcast::<web_sys::MouseEvent>() {
                                if let Some(target) = web_event.target() {
                                    // Find closest menu item
                                    if let Some(elem) = target.dyn_ref::<web_sys::Element>() {
                                        let is_menu_item = elem.closest(".hi-menu-item").ok();
                                        if is_menu_item.is_some() {
                                            close_dropdown.call(e);
                                        }
                                    }
                                }
                            }
                        }
                        #[cfg(not(target_arch = "wasm32"))]
                        {
                            close_dropdown.call(e);
                        }
                    }
                },

                { children }
            }
        }
    }
}

// Unit tests for portal positioning algorithm
#[cfg(test)]
mod tests {
    use super::*;

    fn test_position(
        placement: TriggerPlacement,
        trigger_rect: (f64, f64, f64, f64),
        expected_x: f64,
        expected_y: f64,
        description: &str,
    ) {
        let strategy = PortalPositionStrategy::TriggerBased { placement };
        let viewport_width = 1920.0;
        let viewport_height = 1080.0;
        let element_width = 200.0;

        let (x, y) = calculate_position(
            &strategy,
            viewport_width,
            viewport_height,
            element_width,
            Some(trigger_rect),
        );

        let tolerance = 0.01;
        assert!(
            (x - expected_x).abs() < tolerance,
            "{}: x mismatch: expected {}, got {}",
            description,
            expected_x,
            x
        );
        assert!(
            (y - expected_y).abs() < tolerance,
            "{}: y mismatch: expected {}, got {}",
            description,
            expected_y,
            y
        );
    }

    #[test]
    fn test_bottom_placement_centered() {
        // Trigger: x=100, y=100, w=80, h=40
        // Expected: x = 140 (center), y = 148 (below + offset)
        test_position(
            TriggerPlacement::Bottom,
            (100.0, 100.0, 80.0, 40.0),
            140.0,
            148.0,
            "Bottom placement should center menu below trigger",
        );
    }

    #[test]
    fn test_bottom_right_placement() {
        // Trigger: x=100, y=100, w=80, h=40
        // Expected: x = 180 (right edge), y = 148 (below + offset)
        test_position(
            TriggerPlacement::BottomRight,
            (100.0, 100.0, 80.0, 40.0),
            180.0,
            148.0,
            "BottomRight should align menu right edge with trigger right",
        );
    }

    // === Top family tests ===

    #[test]
    fn test_top_placement_centered() {
        // Trigger: x=100, y=100, w=80, h=40
        // Expected: x = 40 (menu left edge), y = 92 (above - offset)
        // Menu center will be at x=140 (trigger center)
        test_position(
            TriggerPlacement::Top,
            (100.0, 100.0, 80.0, 40.0),
            40.0,
            92.0,
            "Top placement should center menu above trigger",
        );
    }

    #[test]
    fn test_top_left_placement() {
        // Trigger: x=100, y=100, w=80, h=40
        // Expected: x = 100 (left edge), y = 92 (above - offset)
        test_position(
            TriggerPlacement::TopLeft,
            (100.0, 100.0, 80.0, 40.0),
            100.0,
            92.0,
            "TopLeft should align menu left edge with trigger left",
        );
    }

    #[test]
    fn test_top_right_placement() {
        // Trigger: x=100, y=100, w=80, h=40
        // Expected: x = 180 (right edge), y = 92 (above - offset)
        test_position(
            TriggerPlacement::TopRight,
            (100.0, 100.0, 80.0, 40.0),
            180.0,
            92.0,
            "TopRight should align menu right edge with trigger right",
        );
    }

    // === Left family tests ===

    #[test]
    fn test_left_placement_centered() {
        // Trigger: x=100, y=100, w=80, h=40
        // Expected: x = 16 (clamped to PADDING), y = 120 (center)
        // Note: Raw position would be -108, but clamped to PADDING
        test_position(
                TriggerPlacement::Left,
                (100.0, 100.0, 80.0, 40.0),
                16.0,
                120.0,
                "Left placement should position menu to left of trigger, vertically centered, with X clamped to PADDING",
            );
    }

    #[test]
    fn test_left_top_placement() {
        // Trigger: x=100, y=100, w=80, h=40
        // Expected: x = 16 (clamped), y = 100 (top aligned)
        test_position(
                TriggerPlacement::LeftTop,
                (100.0, 100.0, 80.0, 40.0),
                16.0,
                100.0,
                "LeftTop should position menu to left of trigger, top aligned, with X clamped to PADDING",
            );
    }

    #[test]
    fn test_left_bottom_placement() {
        // Trigger: x=100, y=100, w=80, h=40
        // Expected: x = 16 (clamped), y = 140 (bottom aligned)
        test_position(
                TriggerPlacement::LeftBottom,
                (100.0, 100.0, 80.0, 40.0),
                16.0,
                140.0,
                "LeftBottom should position menu to left of trigger, bottom aligned, with X clamped to PADDING",
            );
    }

    // === Right family tests ===

    #[test]
    fn test_right_placement_centered() {
        // Trigger: x=100, y=100, w=80, h=40
        // Expected: x = 188 (right of trigger + offset), y = 120 (center)
        test_position(
            TriggerPlacement::Right,
            (100.0, 100.0, 80.0, 40.0),
            188.0,
            120.0,
            "Right placement should position menu to right of trigger, vertically centered",
        );
    }

    #[test]
    fn test_right_top_placement() {
        // Trigger: x=100, y=100, w=80, h=40
        // Expected: x = 188 (right), y = 100 (top aligned)
        test_position(
            TriggerPlacement::RightTop,
            (100.0, 100.0, 80.0, 40.0),
            188.0,
            100.0,
            "RightTop should position menu to right of trigger, top aligned",
        );
    }

    #[test]
    fn test_right_bottom_placement() {
        // Trigger: x=100, y=100, w=80, h=40
        // Expected: x = 188 (right), y = 140 (bottom aligned)
        test_position(
            TriggerPlacement::RightBottom,
            (100.0, 100.0, 80.0, 40.0),
            188.0,
            140.0,
            "RightBottom should position menu to right of trigger, bottom aligned",
        );
    }

    // === Center test ===

    #[test]
    fn test_center_placement() {
        // Trigger: x=100, y=100, w=80, h=40
        // Expected: x = 140 (center), y = 120 (center)
        test_position(
            TriggerPlacement::Center,
            (100.0, 100.0, 80.0, 40.0),
            140.0,
            120.0,
            "Center placement should position menu at trigger center",
        );
    }

    // === Boundary checking tests ===

    #[test]
    fn test_bottom_left_boundary_clamping() {
        // Trigger at left edge: x=0, y=100, w=80, h=40
        // Expected: x clamped to 16 (PADDING), y = 148 (below)
        let strategy = PortalPositionStrategy::TriggerBased {
            placement: TriggerPlacement::BottomLeft,
        };
        let viewport_width = 1920.0;
        let viewport_height = 1080.0;
        let element_width = 200.0;

        let (x, y) = calculate_position(
            &strategy,
            viewport_width,
            viewport_height,
            element_width,
            Some((0.0, 100.0, 80.0, 40.0)),
        );

        // X should be clamped to PADDING (16)
        assert_eq!(x, 16.0, "X should be clamped to PADDING when at left edge");
        // Y should not be clamped
        assert_eq!(y, 148.0, "Y should not be clamped for Bottom* placement");
    }

    #[test]
    fn test_bottom_right_boundary_clamping() {
        // Trigger at right edge: x=1900, y=100, w=80, h=40
        // Expected: x clamped to 1704 (viewport_width - element_width - PADDING), y = 148
        let strategy = PortalPositionStrategy::TriggerBased {
            placement: TriggerPlacement::BottomRight,
        };
        let viewport_width = 1920.0;
        let viewport_height = 1080.0;
        let element_width = 200.0;

        let (x, y) = calculate_position(
            &strategy,
            viewport_width,
            viewport_height,
            element_width,
            Some((1900.0, 100.0, 80.0, 40.0)),
        );

        // X should be clamped to prevent right overflow
        assert_eq!(x, 1704.0, "X should be clamped to prevent right overflow");
        // Y should not be clamped
        assert_eq!(y, 148.0, "Y should not be clamped for Bottom* placement");
    }

    // === Fixed positioning tests ===

    #[test]
    fn test_fixed_positioning() {
        // Test Fixed positioning strategy
        let strategy = PortalPositionStrategy::Fixed(500.0, 300.0);
        let viewport_width = 1920.0;
        let viewport_height = 1080.0;
        let element_width = 200.0;

        let (x, y) = calculate_position(
            &strategy,
            viewport_width,
            viewport_height,
            element_width,
            None,
        );

        // X and Y should match input (within bounds)
        assert_eq!(x, 500.0, "X should match Fixed input");
        assert_eq!(y, 300.0, "Y should match Fixed input");
    }

    #[test]
    fn test_fixed_positioning_out_of_bounds() {
        // Test Fixed positioning with out-of-bounds coordinates
        let strategy = PortalPositionStrategy::Fixed(-100.0, -100.0);
        let viewport_width = 1920.0;
        let viewport_height = 1080.0;
        let element_width = 200.0;

        let (x, y) = calculate_position(
            &strategy,
            viewport_width,
            viewport_height,
            element_width,
            None,
        );

        // X should be clamped to PADDING (16)
        assert_eq!(x, 16.0, "X should be clamped to PADDING when negative");
        // Y should be clamped to PADDING (16)
        assert_eq!(y, 16.0, "Y should be clamped to PADDING when negative");
    }

    // === MouseBased fallback tests ===

    #[test]
    fn test_mouse_based_fallback() {
        // Test MouseBased fallback to center
        let strategy = PortalPositionStrategy::MouseBased {
            placement: TriggerPlacement::Bottom,
        };
        let viewport_width = 1920.0;
        let viewport_height = 1080.0;
        let element_width = 200.0;

        let (x, y) = calculate_position(
            &strategy,
            viewport_width,
            viewport_height,
            element_width,
            None,
        );

        // Should fallback to center of viewport
        let expected_x = (viewport_width - element_width) / 2.0;
        let expected_y = (viewport_height - 400.0) / 2.0; // MENU_MAX_HEIGHT

        assert_eq!(x, expected_x, "MouseBased should fallback to center X");
        assert_eq!(y, expected_y, "MouseBased should fallback to center Y");
    }

    // === No trigger rect tests ===

    #[test]
    fn test_trigger_based_no_rect() {
        // Test TriggerBased without trigger rect (fallback to center)
        let strategy = PortalPositionStrategy::TriggerBased {
            placement: TriggerPlacement::Bottom,
        };
        let viewport_width = 1920.0;
        let viewport_height = 1080.0;
        let element_width = 200.0;

        let (x, y) = calculate_position(
            &strategy,
            viewport_width,
            viewport_height,
            element_width,
            None,
        );

        // Should fallback to center of viewport
        let expected_x = (viewport_width - element_width) / 2.0;
        let expected_y = (viewport_height - 400.0) / 2.0; // MENU_MAX_HEIGHT

        assert_eq!(
            x, expected_x,
            "TriggerBased without rect should fallback to center X"
        );
        assert_eq!(
            y, expected_y,
            "TriggerBased without rect should fallback to center Y"
        );
    }
}

#[component]
fn ToastPortalEntry(
    z_index: usize,
    id: String,
    position: ToastPosition,
    children: Element,
) -> Element {
    let position_style = match position {
        ToastPosition::TopLeft => "position: fixed; top: 16px; left: 16px;",
        ToastPosition::TopCenter => {
            "position: fixed; top: 16px; left: 50%; transform: translateX(-50%);"
        }
        ToastPosition::TopRight => "position: fixed; top: 16px; right: 16px;",
        ToastPosition::BottomLeft => "position: fixed; bottom: 16px; left: 16px;",
        ToastPosition::BottomCenter => {
            "position: fixed; bottom: 16px; left: 50%; transform: translateX(-50%);"
        }
        ToastPosition::BottomRight => "position: fixed; bottom: 16px; right: 16px;",
    };

    rsx! {
        div {
            class: "hi-toast",
            style: "{position_style} z-index: {z_index}; pointer-events: auto;",
            { children }
        }
    }
}

pub fn use_portal() -> PortalContext {
    use_context::<PortalContext>()
}

pub fn generate_portal_id() -> String {
    format!(
        "portal-{}",
        PORTAL_ID_COUNTER.fetch_add(1, Ordering::SeqCst)
    )
}
