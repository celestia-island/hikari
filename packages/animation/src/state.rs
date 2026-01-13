//! Animation state for state machine support
//!
//! Provides state management for complex animations with custom data,
//! allowing animations to maintain and update their own state across frames.

use std::collections::HashMap;

/// Animation state for managing custom data across animation frames
///
/// This allows animations to maintain state information that persists
/// between frames, enabling complex state machine patterns and
/// continuous animations with custom logic.
///
/// # Examples
///
/// ```ignore
/// use animation::state::{AnimationState, StateValue};
///
/// let mut state = AnimationState::new();
///
/// // Set custom values
/// state.set("angle", StateValue::F64(0.0));
/// state.set("direction", StateValue::I32(1));
///
/// // Get values with defaults
/// let angle = state.get_f64("angle", 0.0);
/// let direction = state.get_i32("direction", 1);
/// ```
#[derive(Debug, Clone)]
pub struct AnimationState {
    /// Internal state storage
    values: HashMap<String, StateValue>,
}

/// Supported state value types for animations
#[derive(Debug, Clone, PartialEq)]
pub enum StateValue {
    /// 64-bit floating point number
    F64(f64),
    /// 32-bit integer
    I32(i32),
    /// 64-bit integer
    I64(i64),
    /// Boolean value
    Bool(bool),
    /// String value
    String(String),
    /// Vector of f64 values
    VecF64(Vec<f64>),
}

impl AnimationState {
    /// Create a new empty animation state
    pub fn new() -> Self {
        Self {
            values: HashMap::new(),
        }
    }

    /// Create animation state with initial values
    pub fn with_values(values: HashMap<String, StateValue>) -> Self {
        Self { values }
    }

    /// Set a state value
    pub fn set(&mut self, key: &str, value: StateValue) {
        self.values.insert(key.to_string(), value);
    }

    /// Get a state value
    pub fn get(&self, key: &str) -> Option<&StateValue> {
        self.values.get(key)
    }

    /// Check if a key exists
    pub fn contains_key(&self, key: &str) -> bool {
        self.values.contains_key(key)
    }

    /// Remove a state value
    pub fn remove(&mut self, key: &str) -> Option<StateValue> {
        self.values.remove(key)
    }

    /// Clear all state values
    pub fn clear(&mut self) {
        self.values.clear();
    }

    // ===== Typed getters with defaults =====

    /// Get f64 value with default
    pub fn get_f64(&self, key: &str, default: f64) -> f64 {
        match self.get(key) {
            Some(StateValue::F64(v)) => *v,
            _ => default,
        }
    }

    /// Get i32 value with default
    pub fn get_i32(&self, key: &str, default: i32) -> i32 {
        match self.get(key) {
            Some(StateValue::I32(v)) => *v,
            _ => default,
        }
    }

    /// Get i64 value with default
    pub fn get_i64(&self, key: &str, default: i64) -> i64 {
        match self.get(key) {
            Some(StateValue::I64(v)) => *v,
            _ => default,
        }
    }

    /// Get bool value with default
    pub fn get_bool(&self, key: &str, default: bool) -> bool {
        match self.get(key) {
            Some(StateValue::Bool(v)) => *v,
            _ => default,
        }
    }

    /// Get string value with default
    pub fn get_string(&self, key: &str, default: &str) -> String {
        match self.get(key) {
            Some(StateValue::String(v)) => v.clone(),
            _ => default.to_string(),
        }
    }

    /// Get Vec<f64> value with default
    pub fn get_vec_f64(&self, key: &str, default: Vec<f64>) -> Vec<f64> {
        match self.get(key) {
            Some(StateValue::VecF64(v)) => v.clone(),
            _ => default,
        }
    }

    // ===== Convenient setters =====

    /// Set f64 value
    pub fn set_f64(&mut self, key: &str, value: f64) {
        self.set(key, StateValue::F64(value));
    }

    /// Set i32 value
    pub fn set_i32(&mut self, key: &str, value: i32) {
        self.set(key, StateValue::I32(value));
    }

    /// Set i64 value
    pub fn set_i64(&mut self, key: &str, value: i64) {
        self.set(key, StateValue::I64(value));
    }

    /// Set bool value
    pub fn set_bool(&mut self, key: &str, value: bool) {
        self.set(key, StateValue::Bool(value));
    }

    /// Set string value
    pub fn set_string(&mut self, key: &str, value: &str) {
        self.set(key, StateValue::String(value.to_string()));
    }

    // ===== Math operations =====

    /// Add to f64 value (creating if doesn't exist)
    pub fn add_f64(&mut self, key: &str, delta: f64) {
        let current = self.get_f64(key, 0.0);
        self.set_f64(key, current + delta);
    }

    /// Multiply f64 value (creating if doesn't exist)
    pub fn mul_f64(&mut self, key: &str, factor: f64) {
        let current = self.get_f64(key, 0.0);
        self.set_f64(key, current * factor);
    }

    /// Increment i32 value (creating if doesn't exist)
    pub fn inc_i32(&mut self, key: &str) {
        let current = self.get_i32(key, 0);
        self.set_i32(key, current + 1);
    }

    /// Toggle bool value (creating if doesn't exist)
    pub fn toggle_bool(&mut self, key: &str) {
        let current = self.get_bool(key, false);
        self.set_bool(key, !current);
    }

    // ===== Advanced operations =====

    /// Lerp between two f64 values based on t (0.0 to 1.0)
    pub fn lerp_f64(&self, from_key: &str, to_key: &str, t: f64) -> f64 {
        let from = self.get_f64(from_key, 0.0);
        let to = self.get_f64(to_key, 0.0);
        from + (to - from) * t.clamp(0.0, 1.0)
    }

    /// Clamp f64 value to range
    pub fn clamp_f64(&mut self, key: &str, min: f64, max: f64) {
        let current = self.get_f64(key, 0.0);
        self.set_f64(key, current.clamp(min, max));
    }

    /// Check if f64 value is within range
    pub fn in_range_f64(&self, key: &str, min: f64, max: f64) -> bool {
        let value = self.get_f64(key, 0.0);
        value >= min && value <= max
    }

    /// Get all keys
    pub fn keys(&self) -> Vec<String> {
        self.values.keys().cloned().collect()
    }

    /// Get number of values
    pub fn len(&self) -> usize {
        self.values.len()
    }

    /// Check if empty
    pub fn is_empty(&self) -> bool {
        self.values.is_empty()
    }
}

impl Default for AnimationState {
    fn default() -> Self {
        Self::new()
    }
}
