// hikari-extra-components/src/node_graph/canvas.rs
// Infinite canvas component for node graph

use dioxus::prelude::*;

/// Canvas position offset
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub struct PanOffset {
    pub x: f64,
    pub y: f64,
}

impl PanOffset {
    pub fn new(x: f64, y: f64) -> Self {
        Self { x, y }
    }
}

/// Canvas component props
#[derive(Props, Clone, PartialEq)]
pub struct CanvasProps {
    /// Child nodes to render on the canvas
    pub children: Element,

    /// Current zoom level (default: 1.0)
    #[props(default = 1.0)]
    pub zoom: f64,

    /// Pan offset in pixels
    #[props(default = PanOffset::default())]
    pub pan_offset: PanOffset,

    /// Minimum zoom level (default: 0.1)
    #[props(default = 0.1)]
    pub min_zoom: f64,

    /// Maximum zoom level (default: 5.0)
    #[props(default = 5.0)]
    pub max_zoom: f64,

    /// Grid spacing in pixels (default: 20)
    #[props(default = 20.0)]
    pub grid_spacing: f64,

    /// Grid style: dots or lines (default: dots)
    #[props(default = GridStyle::Dots)]
    pub grid_style: GridStyle,
}

/// Grid background style
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum GridStyle {
    #[default]
    Dots,
    Lines,
    Cross,
}

/// Infinite canvas component
///
/// Features:
/// - Infinite scrolling/panning
/// - Zoom support via props
/// - Grid background (dots, lines, or cross)
/// - Hardware-accelerated CSS transforms
/// - Coordinate transformation helpers
#[component]
pub fn Canvas(props: CanvasProps) -> Element {
    // Calculate grid background
    let grid_background = match props.grid_style {
        GridStyle::Dots => {
            let spacing = props.grid_spacing * props.zoom;
            let offset_x = props.pan_offset.x % spacing;
            let offset_y = props.pan_offset.y % spacing;

            format!(
                r#"
                <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
                    <defs>
                        <pattern id="grid-dots-{}" x="{}" y="{}" width="{}" height="{}" patternUnits="userSpaceOnUse">
                            <circle cx="1.5" cy="1.5" r="1" fill="currentColor" opacity="0.3"/>
                        </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#grid-dots-{})"/>
                </svg>
                "#,
                props.zoom, offset_x, offset_y, spacing, spacing, props.zoom
            )
        }
        GridStyle::Lines => {
            let spacing = props.grid_spacing * props.zoom;
            let offset_x = props.pan_offset.x % spacing;
            let offset_y = props.pan_offset.y % spacing;

            format!(
                r#"
                <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
                    <defs>
                        <pattern id="grid-lines-{}" x="0" y="0" width="{}" height="{}" patternUnits="userSpaceOnUse">
                            <path d="M {} 0 L {} 0" stroke="currentColor" stroke-width="0.5" opacity="0.2" fill="none"/>
                            <path d="M 0 {} L 0 {}" stroke="currentColor" stroke-width="0.5" opacity="0.2" fill="none"/>
                        </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#grid-lines-{})"/>
                </svg>
                "#,
                props.zoom, spacing, spacing, spacing, spacing, spacing, spacing, props.zoom
            )
        }
        GridStyle::Cross => {
            let spacing = props.grid_spacing * props.zoom;
            let offset_x = props.pan_offset.x % spacing;
            let offset_y = props.pan_offset.y % spacing;

            format!(
                r#"
                <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
                    <defs>
                        <pattern id="grid-cross-{}" x="{}" y="{}" width="{}" height="{}" patternUnits="userSpaceOnUse">
                            <path d="M 2 0 L 2 4 M 0 2 L 4 2" stroke="currentColor" stroke-width="1" opacity="0.3" fill="none"/>
                        </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#grid-cross-{})"/>
                </svg>
                "#,
                props.zoom, offset_x, offset_y, spacing, spacing, props.zoom
            )
        }
    };

    rsx! {
        div {
            class: "hikari-canvas-container",
            style: "position: relative; overflow: hidden; width: 100%; height: 100%; cursor: grab; outline: none;",

            // Grid background layer
            div {
                class: "hikari-canvas-grid",
                dangerous_inner_html: grid_background,
                style: "position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; color: rgba(255, 255, 255, 0.5);",
            }

            // Transform layer for zoom and pan
            div {
                class: "hikari-canvas-content",
                style: format!(
                    "position: absolute; top: 0; left: 0; width: 100%; height: 100%; \
                     transform-origin: 0 0; \
                     transform: translate({}px, {}px) scale({}); \
                     transform-style: preserve-3d; will-change: transform;",
                    props.pan_offset.x, props.pan_offset.y, props.zoom
                ),

                // Render children nodes
                {props.children}
            }
        }
    }
}

/// Coordinate transformation utilities
pub struct CoordinateUtils;

impl CoordinateUtils {
    /// Transform screen coordinates to world coordinates
    pub fn screen_to_world(
        screen_x: f64,
        screen_y: f64,
        zoom: f64,
        pan_offset: PanOffset,
    ) -> (f64, f64) {
        let world_x = (screen_x - pan_offset.x) / zoom;
        let world_y = (screen_y - pan_offset.y) / zoom;
        (world_x, world_y)
    }

    /// Transform world coordinates to screen coordinates
    pub fn world_to_screen(
        world_x: f64,
        world_y: f64,
        zoom: f64,
        pan_offset: PanOffset,
    ) -> (f64, f64) {
        let screen_x = world_x * zoom + pan_offset.x;
        let screen_y = world_y * zoom + pan_offset.y;
        (screen_x, screen_y)
    }

    /// Convert screen distance to world distance
    pub fn screen_distance_to_world(screen_distance: f64, zoom: f64) -> f64 {
        screen_distance / zoom
    }

    /// Convert world distance to screen distance
    pub fn world_distance_to_screen(world_distance: f64, zoom: f64) -> f64 {
        world_distance * zoom
    }
}
