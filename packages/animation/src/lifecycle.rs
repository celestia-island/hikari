//! Simplified animation lifecycle management system for WASM
//!
//! Provides automatic lifecycle management for animations, including
//! cleanup on component unmount, automatic stopping, and resource management.
//! Simplified for single-threaded WASM environment.

use std::collections::HashMap;

use wasm_bindgen::JsValue;

use super::{builder::AnimationBuilder, state::AnimationState};

/// Animation registry for managing active animations
///
/// This registry tracks all active animations and provides
/// automatic cleanup when components unmount or animations complete.
/// Simplified for WASM single-threaded environment.
pub struct AnimationRegistry {
    /// Map of animation IDs to their stop functions
    animations: HashMap<String, Box<dyn FnOnce()>>,
    /// Next animation ID counter
    next_id: u64,
}

impl AnimationRegistry {
    /// Create a new animation registry
    pub fn new() -> Self {
        Self {
            animations: HashMap::new(),
            next_id: 0,
        }
    }

    /// Register a new animation and return its ID
    ///
    /// # Arguments
    ///
    /// * `stop_fn` - Function to call when stopping animation
    ///
    /// Returns: Unique animation ID
    pub fn register_animation(&mut self, stop_fn: Box<dyn FnOnce()>) -> String {
        let id = format!("animation_{}", self.next_id);
        self.next_id += 1;

        self.animations.insert(id.clone(), stop_fn);
        id
    }

    /// Stop and remove an animation by ID
    ///
    /// # Arguments
    ///
    /// * `id` - Animation ID to stop
    pub fn stop_animation(&mut self, id: &str) -> bool {
        if let Some(stop_fn) = self.animations.remove(id) {
            stop_fn();
            true
        } else {
            false
        }
    }

    /// Stop all animations
    pub fn stop_all(&mut self) {
        // Clear registry first
        let animations: Vec<Box<dyn FnOnce()>> = self
            .animations
            .drain()
            .map(|(_, stop_fn)| stop_fn)
            .collect();

        // Call all stop functions
        for stop_fn in animations {
            stop_fn();
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

    /// Start a managed animation
    ///
    /// The animation will be automatically tracked and cleaned up
    /// when manager is dropped or `cleanup` is called.
    ///
    /// # Arguments
    ///
    /// * `elements` - Map of element names to DOM references
    ///
    /// Returns: Animation ID for manual control if needed
    pub fn start_animation(&mut self, builder: AnimationBuilder) -> String {
        let stop_fn = builder.start_continuous_animation();
        let id = self.registry.register_animation(stop_fn);

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
    ///
    /// Returns: Animation ID for manual control if needed
    pub fn start_animation_with_state(
        &mut self,
        elements: &HashMap<String, JsValue>,
        initial_state: AnimationState,
    ) -> String {
        let builder = AnimationBuilder::new_with_state(elements, initial_state);
        self.start_animation(builder)
    }

    /// Stop a specific animation
    ///
    /// # Arguments
    ///
    /// * `id` - Animation ID to stop
    pub fn stop_animation(&mut self, id: &str) -> bool {
        let stopped = self.registry.stop_animation(id);
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
            self.registry.stop_animation(&id);
        }
        self.component_ids.clear();
    }

    /// Get count of managed animations
    pub fn managed_count(&self) -> usize {
        self.component_ids.len()
    }

    /// Get active animation IDs
    pub fn managed_ids(&self) -> Vec<String> {
        self.component_ids.clone()
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
