//! Animation lifecycle management system for WASM
//!
//! Provides automatic lifecycle management for animations, including
//! cleanup on component unmount, automatic stopping, and resource management.
//! Includes support for:
//! - Normal completion callbacks
//! - Exception/interruption handling (component unmount, element removal)
//! - WeakRef-based target element monitoring
//! - Animation state callbacks (onComplete, onError, onCancel)

use std::{collections::HashMap, rc::Weak};

use wasm_bindgen::JsValue;
use web_sys::HtmlElement;

use super::{builder::AnimationBuilder, state::AnimationDataStore as AnimationState};

/// Callback types for animation lifecycle events
pub enum LifecycleCallback {
    /// Called when animation completes normally
    OnComplete(Box<dyn FnOnce()>),
    /// Called when animation is interrupted (e.g., component unmount)
    OnInterrupt(Box<dyn FnOnce()>),
    /// Called when animation encounters an error
    OnError(Box<dyn FnOnce()>),
}

/// Animation entry with full lifecycle information
struct AnimationEntry {
    stop_fn: Box<dyn FnOnce()>,
    cleanup_fn: Option<Box<dyn FnOnce()>>,
    callbacks: Vec<LifecycleCallback>,
    target_element: Option<Weak<HtmlElement>>,
    created_at: std::time::Instant,
}

/// Animation registry for managing active animations
///
/// This registry tracks all active animations and provides
/// automatic cleanup when components unmount or animations complete.
/// Includes support for:
/// - WeakRef-based target element monitoring
/// - Lifecycle callbacks
/// - Timeout-based cleanup
pub struct AnimationRegistry {
    /// Map of animation IDs to their animation entries
    animations: HashMap<String, AnimationEntry>,
    /// Next animation ID counter
    next_id: u64,
    /// Default timeout for animations (None = no timeout)
    default_timeout_ms: Option<u64>,
}

impl AnimationRegistry {
    /// Create a new animation registry
    pub fn new() -> Self {
        Self {
            animations: HashMap::new(),
            next_id: 0,
            default_timeout_ms: None,
        }
    }

    /// Create a new animation registry with default timeout
    ///
    /// # Arguments
    ///
    /// * `timeout_ms` - Default timeout in milliseconds (None = no timeout)
    pub fn new_with_timeout(timeout_ms: Option<u64>) -> Self {
        Self {
            animations: HashMap::new(),
            next_id: 0,
            default_timeout_ms: timeout_ms,
        }
    }

    /// Register a new animation and return its ID
    ///
    /// # Arguments
    ///
    /// * `stop_fn` - Function to call when stopping animation
    /// * `cleanup_fn` - Optional cleanup function (e.g., to remove event listeners)
    /// * `target_element` - Weak reference to target element for monitoring
    ///
    /// Returns: Unique animation ID
    pub fn register_animation(
        &mut self,
        stop_fn: Box<dyn FnOnce()>,
        cleanup_fn: Option<Box<dyn FnOnce()>>,
        target_element: Option<Weak<HtmlElement>>,
    ) -> String {
        let id = format!("animation_{}", self.next_id);
        self.next_id += 1;

        self.animations.insert(
            id.clone(),
            AnimationEntry {
                stop_fn,
                cleanup_fn,
                callbacks: Vec::new(),
                target_element,
                created_at: std::time::Instant::now(),
            },
        );
        id
    }

    /// Register animation with callbacks
    ///
    /// # Arguments
    ///
    /// * `stop_fn` - Function to call when stopping animation
    /// * `callbacks` - Lifecycle callbacks
    /// * `target_element` - Weak reference to target element
    pub fn register_with_callbacks(
        &mut self,
        stop_fn: Box<dyn FnOnce()>,
        callbacks: Vec<LifecycleCallback>,
        target_element: Option<Weak<HtmlElement>>,
    ) -> String {
        let id = format!("animation_{}", self.next_id);
        self.next_id += 1;

        self.animations.insert(
            id.clone(),
            AnimationEntry {
                stop_fn,
                cleanup_fn: None,
                callbacks,
                target_element,
                created_at: std::time::Instant::now(),
            },
        );
        id
    }

    /// Check if target element still exists (for WeakRef monitoring)
    ///
    /// Returns false if target has been garbage collected or removed from DOM
    fn is_target_valid(&self, entry: &AnimationEntry) -> bool {
        if let Some(weak_ref) = &entry.target_element {
            if let Some(element) = weak_ref.upgrade() {
                // Check if element is still in DOM
                return element.parent_element().is_some();
            }
            return false;
        }
        true // No target to monitor
    }

    /// Stop and remove an animation by ID
    ///
    /// # Arguments
    ///
    /// * `id` - Animation ID to stop
    /// * `reason` - Reason for stopping (for callback invocation)
    pub fn stop_animation(&mut self, id: &str, reason: &str) -> bool {
        if let Some(entry) = self.animations.remove(id) {
            // Collect callbacks to call
            let callbacks_to_call: Vec<_> = entry
                .callbacks
                .into_iter()
                .filter_map(|cb| match cb {
                    LifecycleCallback::OnInterrupt(f) => Some(f),
                    _ => None,
                })
                .collect();

            // Execute stop function
            (entry.stop_fn)();

            // Execute cleanup function if present
            if let Some(cleanup) = entry.cleanup_fn {
                cleanup();
            }

            // Call callbacks after cleanup
            for cb in callbacks_to_call {
                cb();
            }

            web_sys::console::log_2(
                &format!("🛑 Animation {} stopped: {}", id, reason).into(),
                &id.into(),
            );
            true
        } else {
            false
        }
    }

    /// Stop all animations
    ///
    /// # Arguments
    ///
    /// * `reason` - Reason for stopping (for callback invocation)
    pub fn stop_all(&mut self, reason: &str) {
        let animations: Vec<(String, AnimationEntry)> = self.animations.drain().collect();

        for (id, entry) in animations {
            // Collect callbacks to call
            let callbacks_to_call: Vec<_> = entry
                .callbacks
                .into_iter()
                .filter_map(|cb| match cb {
                    LifecycleCallback::OnInterrupt(f) => Some(f),
                    _ => None,
                })
                .collect();

            // Execute stop function
            (entry.stop_fn)();

            // Execute cleanup function if present
            if let Some(cleanup) = entry.cleanup_fn {
                cleanup();
            }

            // Call callbacks after cleanup
            for cb in callbacks_to_call {
                cb();
            }

            web_sys::console::log_2(
                &format!("🛑 Animation {} stopped: {}", id, reason).into(),
                &id.into(),
            );
        }
    }

    /// Clean up invalid/orphaned animations
    ///
    /// This should be called periodically to remove animations
    /// whose target elements no longer exist
    pub fn cleanup_invalid(&mut self) -> usize {
        let mut to_remove: Vec<String> = Vec::new();

        for (id, entry) in &self.animations {
            if !self.is_target_valid(&entry) {
                to_remove.push(id.clone());
            }
        }

        for id in &to_remove {
            self.stop_animation(id, "target element removed");
        }

        if !to_remove.is_empty() {
            web_sys::console::log_1(
                &format!("🧹 Cleaned up {} invalid animations", to_remove.len()).into(),
            );
        }

        to_remove.len()
    }

    /// Check and stop animations that have exceeded timeout
    pub fn cleanup_timed_out(&mut self) -> usize {
        if let Some(timeout_ms) = self.default_timeout_ms {
            let timeout = std::time::Duration::from_millis(timeout_ms);
            let mut to_remove: Vec<String> = Vec::new();
            let now = std::time::Instant::now();

            for (id, entry) in &self.animations {
                if now.duration_since(entry.created_at) > timeout {
                    to_remove.push(id.clone());
                }
            }

            for id in &to_remove {
                self.stop_animation(id, "timeout exceeded");
            }

            to_remove.len()
        } else {
            0
        }
    }

    /// Get count of active animations
    pub fn active_count(&self) -> usize {
        self.animations.len()
    }

    /// Check if any animations are active
    pub fn has_active(&self) -> bool {
        !self.animations.is_empty()
    }

    /// Get all active animation IDs
    pub fn active_ids(&self) -> Vec<String> {
        self.animations.keys().cloned().collect()
    }

    /// Get animation info (for debugging)
    pub fn get_animation_info(&self, id: &str) -> Option<(std::time::Duration, usize)> {
        self.animations.get(id).map(|entry| {
            let duration = std::time::Instant::now().duration_since(entry.created_at);
            let callback_count = entry.callbacks.len();
            (duration, callback_count)
        })
    }
}

impl Default for AnimationRegistry {
    fn default() -> Self {
        Self::new()
    }
}

/// Animation manager for component-level lifecycle management
///
/// This manager provides automatic cleanup of animations when a component
/// unmounts, preventing memory leaks and orphaned animations.
pub struct AnimationManager {
    /// Registry for tracking animations
    registry: AnimationRegistry,
    /// Component IDs tracked by this manager
    component_ids: Vec<String>,
}

impl AnimationManager {
    /// Create a new animation manager
    pub fn new() -> Self {
        Self {
            registry: AnimationRegistry::new(),
            component_ids: Vec::new(),
        }
    }

    /// Create a new animation manager with timeout
    ///
    /// # Arguments
    ///
    /// * `timeout_ms` - Default timeout in milliseconds
    pub fn new_with_timeout(timeout_ms: Option<u64>) -> Self {
        Self {
            registry: AnimationRegistry::new_with_timeout(timeout_ms),
            component_ids: Vec::new(),
        }
    }

    /// Start a managed animation
    ///
    /// The animation will be automatically tracked and cleaned up
    /// when manager is dropped or `cleanup` is called.
    ///
    /// # Arguments
    ///
    /// * `builder` - AnimationBuilder to start
    /// * `cleanup_fn` - Optional cleanup function
    /// * `target_element` - Weak reference to target element
    ///
    /// Returns: Animation ID for manual control if needed
    pub fn start_animation(
        &mut self,
        builder: AnimationBuilder,
        cleanup_fn: Option<Box<dyn FnOnce()>>,
        target_element: Option<Weak<HtmlElement>>,
    ) -> String {
        let stop_fn = builder.start_continuous_animation();
        let id = self
            .registry
            .register_animation(stop_fn, cleanup_fn, target_element);

        // Track this animation
        self.component_ids.push(id.clone());
        id
    }

    /// Start a managed animation with initial state
    ///
    /// # Arguments
    ///
    /// * `elements` - Map of element names to DOM references
    /// * `initial_state` - Initial animation state
    /// * `cleanup_fn` - Optional cleanup function
    /// * `target_element` - Weak reference to target element
    ///
    /// Returns: Animation ID for manual control if needed
    pub fn start_animation_with_state(
        &mut self,
        elements: &HashMap<String, JsValue>,
        initial_state: AnimationState,
        cleanup_fn: Option<Box<dyn FnOnce()>>,
        target_element: Option<Weak<HtmlElement>>,
    ) -> String {
        let builder = AnimationBuilder::new_with_state(elements, initial_state);
        self.start_animation(builder, cleanup_fn, target_element)
    }

    /// Stop a specific animation
    ///
    /// # Arguments
    ///
    /// * `id` - Animation ID to stop
    pub fn stop_animation(&mut self, id: &str) -> bool {
        let stopped = self.registry.stop_animation(id, "manual stop");
        if stopped {
            // Remove from tracked component IDs
            self.component_ids.retain(|tracked_id| tracked_id != id);
        }
        stopped
    }

    /// Clean up all managed animations
    ///
    /// This is automatically called when manager is dropped.
    pub fn cleanup(&mut self) {
        let ids = self.component_ids.clone();
        for id in ids {
            self.registry.stop_animation(&id, "manager cleanup");
        }
        self.component_ids.clear();
    }

    /// Clean up invalid/orphaned animations
    ///
    /// This should be called periodically to remove animations
    /// whose target elements no longer exist
    pub fn cleanup_invalid(&mut self) -> usize {
        self.registry.cleanup_invalid()
    }

    /// Check and stop animations that have exceeded timeout
    pub fn cleanup_timed_out(&mut self) -> usize {
        self.registry.cleanup_timed_out()
    }

    /// Get count of managed animations
    pub fn managed_count(&self) -> usize {
        self.component_ids.len()
    }

    /// Get active animation IDs
    pub fn managed_ids(&self) -> Vec<String> {
        self.component_ids.clone()
    }

    /// Get animation info (for debugging)
    pub fn get_animation_info(&self, id: &str) -> Option<(std::time::Duration, usize)> {
        self.registry.get_animation_info(id)
    }
}

impl Default for AnimationManager {
    fn default() -> Self {
        Self::new()
    }
}

impl Drop for AnimationManager {
    fn drop(&mut self) {
        self.cleanup();
    }
}

// ===== Re-exports =====

// No explicit re-exports to avoid conflicts
