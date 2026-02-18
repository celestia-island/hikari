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
pub mod positioning;
pub mod provider;
pub mod render;
pub mod types;

pub use positioning::calculate_position;
pub use provider::{generate_portal_id, use_portal, PortalContext, PortalProvider};
pub use types::{
    ModalAnimationState, PortalEntry, PortalMaskMode, PortalPositionStrategy, ToastPosition,
    TriggerPlacement, PORTAL_ID_COUNTER,
};
