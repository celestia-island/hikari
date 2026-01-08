//! Animation context for dynamic value computation
//!
//! Provides runtime information for computing dynamic animation values,
//! including DOM dimensions, mouse positions, and element metrics.

use wasm_bindgen::{prelude::*, JsCast};
use web_sys::{HtmlElement, Window};

/// Context for computing dynamic animation values
///
/// This context provides access to runtime information that can be used
/// to compute animation values dynamically, such as:
/// - DOM element dimensions
/// - Mouse cursor position
/// - Scroll position
/// - Window size
/// - Current timestamp
///
/// # Example
///
/// ```ignore
/// use animation::AnimationContext;
///
/// let ctx = AnimationContext::new(&element);
///
/// // Get element dimensions
/// let width = ctx.element_width();
/// let height = ctx.element_height();
///
/// // Get mouse position relative to element
/// let mouse_x = ctx.mouse_x();
/// let mouse_y = ctx.mouse_y();
///
/// // Get scroll position
/// let scroll_y = ctx.scroll_y();
/// ```
pub struct AnimationContext {
    /// Target element for the animation
    element: HtmlElement,
    /// Window reference
    window: Window,
}

impl AnimationContext {
    /// Create a new AnimationContext for the given element
    pub fn new(element: &HtmlElement) -> Self {
        let window = web_sys::window().expect("No window reference");

        Self {
            element: element.clone(),
            window,
        }
    }

    /// Get the target element
    pub fn element(&self) -> &HtmlElement {
        &self.element
    }

    /// Get the window reference
    pub fn window(&self) -> &Window {
        &self.window
    }

    // ===== Element Dimensions =====

    /// Get element width in pixels (including padding, but not border)
    pub fn element_width(&self) -> f64 {
        self.element.offset_width() as f64
    }

    /// Get element height in pixels (including padding, but not border)
    pub fn element_height(&self) -> f64 {
        self.element.offset_height() as f64
    }

    /// Get element client width (including padding, excluding scrollbars)
    pub fn client_width(&self) -> f64 {
        self.element.client_width() as f64
    }

    /// Get element client height (including padding, excluding scrollbars)
    pub fn client_height(&self) -> f64 {
        self.element.client_height() as f64
    }

    /// Get element scroll width
    pub fn scroll_width(&self) -> f64 {
        self.element.scroll_width() as f64
    }

    /// Get element scroll height
    pub fn scroll_height(&self) -> f64 {
        self.element.scroll_height() as f64
    }

    /// Get element bounding rectangle
    pub fn bounding_rect(&self) -> web_sys::DomRect {
        self.element.get_bounding_client_rect()
    }

    // ===== Element Position =====

    /// Get element offset left relative to offset parent
    pub fn offset_left(&self) -> f64 {
        self.element.offset_left() as f64
    }

    /// Get element offset top relative to offset parent
    pub fn offset_top(&self) -> f64 {
        self.element.offset_top() as f64
    }

    /// Get element's left position relative to viewport
    pub fn viewport_left(&self) -> f64 {
        self.bounding_rect().left()
    }

    /// Get element's top position relative to viewport
    pub fn viewport_top(&self) -> f64 {
        self.bounding_rect().top()
    }

    /// Get element's right position relative to viewport
    pub fn viewport_right(&self) -> f64 {
        self.bounding_rect().right()
    }

    /// Get element's bottom position relative to viewport
    pub fn viewport_bottom(&self) -> f64 {
        self.bounding_rect().bottom()
    }

    // ===== Mouse Position =====

    /// Get mouse X position relative to viewport
    pub fn mouse_x_viewport(&self) -> f64 {
        // This would need to be stored elsewhere or passed in
        // For now, return 0.0
        0.0
    }

    /// Get mouse Y position relative to viewport
    pub fn mouse_y_viewport(&self) -> f64 {
        0.0
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

    /// Get element scroll X position
    pub fn scroll_x(&self) -> f64 {
        self.element.scroll_left() as f64
    }

    /// Get element scroll Y position
    pub fn scroll_y(&self) -> f64 {
        self.element.scroll_top() as f64
    }

    /// Get document scroll X position
    pub fn document_scroll_x(&self) -> f64 {
        self.document()
            .and_then(|doc| doc.body())
            .map(|body| body.scroll_left() as f64)
            .or_else(|| self.window.scroll_x().ok())
            .unwrap_or(0.0)
    }

    /// Get document scroll Y position
    pub fn document_scroll_y(&self) -> f64 {
        self.document()
            .and_then(|doc| doc.body())
            .map(|body| body.scroll_top() as f64)
            .or_else(|| self.window.scroll_y().ok())
            .unwrap_or(0.0)
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
        self.window
            .inner_width()
            .ok()
            .and_then(|w| w.as_f64())
            .unwrap_or(0.0)
    }

    /// Get window inner height
    pub fn window_height(&self) -> f64 {
        self.window
            .inner_height()
            .ok()
            .and_then(|h| h.as_f64())
            .unwrap_or(0.0)
    }

    // ===== Time =====

    /// Get current timestamp in milliseconds
    pub fn now(&self) -> f64 {
        self.window.performance().map(|p| p.now()).unwrap_or(0.0)
    }

    // ===== Helpers =====

    /// Get the document reference
    fn document(&self) -> Option<web_sys::Document> {
        self.window.document()
    }

    /// Calculate distance from element center to mouse
    pub fn distance_from_center(&self) -> f64 {
        let center_x = self.element_width() / 2.0;
        let center_y = self.element_height() / 2.0;
        let dx = self.mouse_x() - center_x;
        let dy = self.mouse_y() - center_y;
        (dx * dx + dy * dy).sqrt()
    }

    /// Calculate angle from element center to mouse (in radians)
    pub fn angle_from_center(&self) -> f64 {
        let center_x = self.element_width() / 2.0;
        let center_y = self.element_height() / 2.0;
        (self.mouse_y() - center_y).atan2(self.mouse_x() - center_x)
    }

    /// Check if mouse is inside element
    pub fn is_mouse_inside(&self) -> f64 {
        let x = self.mouse_x();
        let y = self.mouse_y();
        let width = self.element_width();
        let height = self.element_height();

        if x >= 0.0 && x <= width && y >= 0.0 && y <= height {
            1.0
        } else {
            0.0
        }
    }
}
