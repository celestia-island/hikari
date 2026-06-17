//! Animation context for dynamic value computation
//!
//! Provides runtime information for computing dynamic animation values,
//! including DOM dimensions, mouse positions, and element metrics.
//!
//! This module uses the tairitsu-vdom Platform trait for cross-platform
//! browser API access, working consistently in both WASM and server environments.

use std::cell::RefCell;
use std::rc::Rc;

use tairitsu_vdom::{DomRect, Platform};

/// Context for computing dynamic animation values
///
/// This context provides access to runtime information that can be used
/// to compute animation values dynamically, such as:
/// - DOM element dimensions (via bounding rect)
/// - Mouse cursor position
/// - Scroll position
/// - Window size
/// - Current timestamp
/// - Delta time for smooth frame-based animations
///
/// # Example
///
/// ```ignore
/// use animation::AnimationContext;
///
/// let ctx = AnimationContext::new(platform, element_handle);
///
/// // Get element dimensions
/// let width = ctx.element_width();
/// let height = ctx.element_height();
///
/// // Get delta time for smooth animations
/// let delta = ctx.delta_time();
/// let new_pos = current_pos + speed * delta;
/// ```
pub struct AnimationContext<P: Platform> {
    /// Target element handle for the animation
    element: P::Element,
    /// Platform reference for DOM operations
    platform: Rc<RefCell<P>>,
    /// Cached bounding rect for the element
    bounding_rect: DomRect,
    /// Previous frame timestamp for delta calculation
    previous_time: f64,
    /// Current frame timestamp
    current_time: f64,
    /// Delta time between frames (in milliseconds)
    delta_time: f64,
    /// Mouse position (stored separately, typically from events)
    mouse_pos: Option<(f64, f64)>,
}

impl<P: Platform> AnimationContext<P> {
    /// Create a new AnimationContext for the given element
    pub fn new(platform: Rc<RefCell<P>>, element: P::Element) -> Self {
        let bounding_rect = platform.borrow_mut().get_bounding_client_rect(&element);

        Self {
            element,
            platform,
            bounding_rect,
            previous_time: 0.0,
            current_time: 0.0,
            delta_time: 16.67, // ~60fps default
            mouse_pos: None,
        }
    }

    /// Create a new AnimationContext with custom timing
    pub fn new_with_timing(
        platform: Rc<RefCell<P>>,
        element: P::Element,
        previous_time: f64,
        current_time: f64,
    ) -> Self {
        let bounding_rect = platform.borrow_mut().get_bounding_client_rect(&element);
        let delta_time = current_time - previous_time;

        Self {
            element,
            platform,
            bounding_rect,
            previous_time,
            current_time,
            delta_time: delta_time.max(0.0),
            mouse_pos: None,
        }
    }

    /// Update timing for the next frame
    pub fn update_timing(&mut self, new_time: f64) {
        self.previous_time = self.current_time;
        self.current_time = new_time;
        self.delta_time = (self.current_time - self.previous_time).max(0.0);
    }

    /// Set the mouse position (typically called from event handlers)
    pub const fn set_mouse_position(&mut self, x: f64, y: f64) {
        self.mouse_pos = Some((x, y));
    }

    /// Get the target element handle
    pub fn element(&self) -> P::Element {
        self.element.clone()
    }

    // ===== Element Dimensions =====

    /// Get element width in pixels
    ///
    /// Note: This returns the bounding rect width, which includes padding
    /// but not borders or margins.
    pub const fn element_width(&self) -> f64 {
        self.bounding_rect.width
    }

    /// Get element height in pixels
    ///
    /// Note: This returns the bounding rect height, which includes padding
    /// but not borders or margins.
    pub const fn element_height(&self) -> f64 {
        self.bounding_rect.height
    }

    /// Get element client width (approximated)
    pub const fn client_width(&self) -> f64 {
        self.bounding_rect.width
    }

    /// Get element client height (approximated)
    pub const fn client_height(&self) -> f64 {
        self.bounding_rect.height
    }

    /// Get element scroll width (approximated as element width)
    pub const fn scroll_width(&self) -> f64 {
        self.bounding_rect.width
    }

    /// Get element scroll height (approximated as element height)
    pub const fn scroll_height(&self) -> f64 {
        self.bounding_rect.height
    }

    /// Get element bounding rectangle
    pub const fn bounding_rect(&self) -> DomRect {
        self.bounding_rect
    }

    // ===== Element Position =====

    /// Get element offset left relative to offset parent (approximated)
    pub const fn offset_left(&self) -> f64 {
        self.bounding_rect.x
    }

    /// Get element offset top relative to offset parent (approximated)
    pub const fn offset_top(&self) -> f64 {
        self.bounding_rect.y
    }

    /// Get element's left position relative to viewport
    pub const fn viewport_left(&self) -> f64 {
        self.bounding_rect.x
    }

    /// Get element's top position relative to viewport
    pub const fn viewport_top(&self) -> f64 {
        self.bounding_rect.y
    }

    /// Get element's right position relative to viewport
    pub fn viewport_right(&self) -> f64 {
        self.bounding_rect.x + self.bounding_rect.width
    }

    /// Get element's bottom position relative to viewport
    pub fn viewport_bottom(&self) -> f64 {
        self.bounding_rect.y + self.bounding_rect.height
    }

    // ===== Mouse Position =====

    /// Get mouse X position relative to viewport
    pub fn mouse_x_viewport(&self) -> f64 {
        self.mouse_pos.map_or(0.0, |(x, _)| x)
    }

    /// Get mouse Y position relative to viewport
    pub fn mouse_y_viewport(&self) -> f64 {
        self.mouse_pos.map_or(0.0, |(_, y)| y)
    }

    /// Get mouse X position relative to element
    pub fn mouse_x(&self) -> f64 {
        self.mouse_x_viewport() - self.viewport_left()
    }

    /// Get mouse Y position relative to element
    pub fn mouse_y(&self) -> f64 {
        self.mouse_y_viewport() - self.viewport_top()
    }

    /// Get mouse X position as percentage of element width
    pub fn mouse_x_percent(&self) -> f64 {
        let width = self.element_width();
        if width > 0.0 {
            (self.mouse_x() / width) * 100.0
        } else {
            0.0
        }
    }

    /// Get mouse Y position as percentage of element height
    pub fn mouse_y_percent(&self) -> f64 {
        let height = self.element_height();
        if height > 0.0 {
            (self.mouse_y() / height) * 100.0
        } else {
            0.0
        }
    }

    // ===== Scroll Position =====

    /// Get element scroll X position (not directly available via WIT, returns 0.0)
    pub const fn scroll_x(&self) -> f64 {
        // WIT bindings don't provide direct scroll position access
        // This would need to be tracked separately or added to the WIT interface
        0.0
    }

    /// Get element scroll Y position (not directly available via WIT, returns 0.0)
    pub const fn scroll_y(&self) -> f64 {
        // WIT bindings don't provide direct scroll position access
        // This would need to be tracked separately or added to the WIT interface
        0.0
    }

    /// Get document scroll X position (not directly available via WIT, returns 0.0)
    pub const fn document_scroll_x(&self) -> f64 {
        0.0
    }

    /// Get document scroll Y position (not directly available via WIT, returns 0.0)
    pub const fn document_scroll_y(&self) -> f64 {
        0.0
    }

    /// Get maximum scrollable X distance
    pub fn max_scroll_x(&self) -> f64 {
        self.scroll_width() - self.client_width()
    }

    /// Get maximum scrollable Y distance
    pub fn max_scroll_y(&self) -> f64 {
        self.scroll_height() - self.client_height()
    }

    /// Get scroll progress as percentage (0.0 to 1.0)
    pub fn scroll_progress_x(&self) -> f64 {
        let max = self.max_scroll_x();
        if max > 0.0 {
            self.scroll_x() / max
        } else {
            0.0
        }
    }

    /// Get scroll progress as percentage (0.0 to 1.0)
    pub fn scroll_progress_y(&self) -> f64 {
        let max = self.max_scroll_y();
        if max > 0.0 {
            self.scroll_y() / max
        } else {
            0.0
        }
    }

    // ===== Window Dimensions =====

    /// Get window inner width
    pub fn window_width(&self) -> f64 {
        f64::from(self.platform.borrow().inner_width())
    }

    /// Get window inner height
    pub fn window_height(&self) -> f64 {
        f64::from(self.platform.borrow().inner_height())
    }

    // ===== Time =====

    /// Get current timestamp in milliseconds
    pub const fn now(&self) -> f64 {
        self.current_time
    }

    /// Get previous frame timestamp in milliseconds
    pub const fn previous_time(&self) -> f64 {
        self.previous_time
    }

    /// Get delta time between frames in milliseconds
    pub const fn delta_time(&self) -> f64 {
        self.delta_time
    }

    /// Get delta time in seconds (useful for physics calculations)
    pub fn delta_seconds(&self) -> f64 {
        self.delta_time / 1000.0
    }

    /// Get frames per second based on delta time
    pub fn fps(&self) -> f64 {
        if self.delta_time > 0.0 {
            1000.0 / self.delta_time
        } else {
            60.0
        }
    }

    // ===== Helpers =====

    /// Calculate distance from element center to mouse
    pub fn distance_from_center(&self) -> f64 {
        let center_x = self.element_width() / 2.0;
        let center_y = self.element_height() / 2.0;
        let dx = self.mouse_x() - center_x;
        let dy = self.mouse_y() - center_y;
        dx.hypot(dy)
    }

    /// Calculate angle from element center to mouse (in radians)
    pub fn angle_from_center(&self) -> f64 {
        let center_x = self.element_width() / 2.0;
        let center_y = self.element_height() / 2.0;
        (self.mouse_y() - center_y).atan2(self.mouse_x() - center_x)
    }

    /// Check if mouse is inside element
    pub fn is_mouse_inside(&self) -> bool {
        let x = self.mouse_x();
        let y = self.mouse_y();
        let width = self.element_width();
        let height = self.element_height();

        x >= 0.0 && x <= width && y >= 0.0 && y <= height
    }

    /// Refresh the cached bounding rect from the platform
    pub fn refresh_bounding_rect(&mut self) {
        self.bounding_rect = self
            .platform
            .borrow_mut()
            .get_bounding_client_rect(&self.element);
    }
}
