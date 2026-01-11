//! # Hikari Extra Components
//!
//! Advanced utility components that extend the base Hikari component library.
//! These components provide specialized functionality for complex use cases.
//!
//! ## Overview
//!
//! `hikari-extra-components` provides:
//!
//! - **Node Graph System** - Visual node editors with canvas, connections, ports, and minimap
//! - **Drag Layer** - Advanced drag-drop functionality with boundary constraints
//! - **Collapsible** - Animated collapsible panels with slide-in/out animations
//! - **Zoom Controls** - Zoomable containers with keyboard shortcuts and smooth scaling
//!
//! ## Quick Start
//!
//! ### Collapsible Panel
//!
//! ```rust,no_run
//! use hikari_extra_components::Collapsible;
//! use dioxus::prelude::*;
//!
//! fn app() -> Element {
//!     let mut is_open = use_signal(|| true);
//!
//!     rsx! {
//!         Collapsible {
//!             is_open: is_open(),
//!             duration: 300,
//!             header: rsx! {
//!                 div {
//!                     onclick: move |_| is_open.toggle(),
//!                     "Click to toggle"
//!                 }
//!             },
//!             div { class: "content",
//!                 p { "This content can be collapsed" }
//!             }
//!         }
//!     }
//! }
//! ```
//!
//! ### Drag Layer
//!
//! ```rust,no_run
//! use hikari_extra_components::DragLayer;
//! use dioxus::prelude::*;
//!
//! fn app() -> Element {
//!     let mut position = use_signal(|| (0.0, 0.0));
//!
//!     rsx! {
//!         DragLayer {
//!             ondragstart: move |_| {},
//!             ondragmove: move |pos| { position.set(pos) },
//!             ondragend: move |_| {},
//!             div {
//!                 style: "position: absolute; left: {position.0}px; top: {position.1}px;",
//!                 "Drag me around!"
//!             }
//!         }
//!     }
//! }
//! ```
//!
//! ### Zoom Controls
//!
//! ```rust,no_run
//! use hikari_extra_components::ZoomControls;
//! use dioxus::prelude::*;
//!
//! fn app() -> Element {
//!     let mut zoom = use_signal(|| 1.0);
//!
//!     rsx! {
//!         ZoomControls {
//!             zoom: zoom(),
//!             min_zoom: 0.5,
//!             max_zoom: 3.0,
//!             onzoomchange: move |z| zoom.set(z),
//!             div {
//!                 style: "transform: scale({zoom});",
//!                 div { class: "zoomable-content",
//!                     h1 { "Zoomable Content" }
//!                 }
//!             }
//!         }
//!     }
//! }
//! ```
//!
//! ## Components
//!
//! ### Core Components
//!
//! - [`Collapsible`] - Collapsible content containers with slide animations
//! - [`DragLayer`] - Drag and drop layer management with constraints
//! - [`ZoomControls`] - Zoom controls for interactive content
//!
//! ### Node Graph System
//!
//! - [`NodeGraph`] - Visual node editor with canvas and connections
//! - [`Node`] - Node data structure with inputs, outputs, and position
//! - [`Connection`] - Bezier curve connections between node ports
//! - [`MinimapConfig`] - Minimap configuration for navigation
//!
//! ## Use Cases
//!
//! - **Visual Programming Language** - Build node-based editors
//! - **Workflow Builders** - Create automation workflow interfaces
//! - **Shader Editors** - Visual shader composition tools
//! - **Interactive Canvases** - Zoomable, pannable content areas
//! - **Complex UIs** - Collapsible panels and draggable elements
//!
//! ## Dependencies
//!
//! `hikari-extra-components` depends on:
//! - `hikari-components` - For base components and theming
//! - `hikari-theme` - For ThemeProvider integration
//! - `hikari-palette` - For traditional Chinese colors
//! - `hikari-animation` - For animation support (optional)
//!
//! ## Props Reference
//!
//! ### Collapsible
//!
//! | Prop | Type | Default | Description |
//! |------|------|---------|-------------|
//! | `is_open` | `bool` | `true` | Whether content is visible |
//! | `duration` | `u64` | `300` | Animation duration in ms |
//! | `header` | `Element` | - | Clickable header element |
//! | `class` | `String` | `""` | Additional CSS classes |
//! | `children` | `Element` | - | Collapsible content |
//!
//! ### DragLayer
//!
//! | Prop | Type | Default | Description |
//! |------|------|---------|-------------|
//! | `ondragstart` | `EventHandler<(f64, f64)>` | - | Drag start handler |
//! | `ondragmove` | `EventHandler<(f64, f64)>` | - | Drag move handler |
//! | `ondragend` | `EventHandler<(f64, f64)>` | - | Drag end handler |
//! | `disabled` | `bool` | `false` | Disable dragging |
//! | `class` | `String` | `""` | Additional CSS classes |
//! | `children` | `Element` | - | Draggable content |
//!
//! ### ZoomControls
//!
//! | Prop | Type | Default | Description |
//! |------|------|---------|-------------|
//! | `zoom` | `f64` | - | Current zoom level |
//! | `min_zoom` | `f64` | `0.5` | Minimum zoom level |
//! | `max_zoom` | `f64` | `3.0` | Maximum zoom level |
//! | `onzoomchange` | `EventHandler<f64>` | - | Zoom change handler |
//! | `show_controls` | `bool` | `true` | Show zoom buttons |
//! | `controls_position` | `ControlsPosition` | `BottomRight` | Control button position |
//! | `wheel_enabled` | `bool` | `true` | Enable mouse wheel zoom |
//! | `class` | `String` | `""` | Additional CSS classes |
//! | `children` | `Element` | - | Zoomable content |

pub mod extra;
pub mod prelude;

pub use extra::*;
pub use prelude::*;
