//! Reactive state management for interactive component examples.
//!
//! This module provides:
//! - State container for component instances
//! - JavaScript bridge for runtime interactivity
//! - State persistence across page navigation
//! - Clean state isolation between examples

use std::collections::HashMap;
use std::sync::{Arc, OnceLock, RwLock};
use tairitsu_macros::rsx;
use tairitsu_vdom::{VElement, VNode, VText};

/// Global reactive state manager shared across all component instances.
static REACTIVE_STATE: OnceLock<Arc<RwLock<ReactiveState>>> = OnceLock::new();

/// Get or initialize the global reactive state manager.
fn get_global_state_locked() -> Arc<RwLock<ReactiveState>> {
    REACTIVE_STATE
        .get_or_init(|| Arc::new(RwLock::new(ReactiveState::new())))
        .clone()
}

/// Reactive state container managing all interactive component instances.
#[derive(Debug)]
pub struct ReactiveState {
    /// Component instances indexed by their unique ID
    instances: HashMap<String, ComponentInstance>,
    /// Counter for generating unique instance IDs
    instance_counter: usize,
}

impl ReactiveState {
    /// Create a new reactive state container.
    pub fn new() -> Self {
        Self {
            instances: HashMap::new(),
            instance_counter: 0,
        }
    }

    /// Generate a unique instance ID for a component.
    pub fn generate_instance_id(&mut self, component_type: &str) -> String {
        let id = format!("{}-{}", component_type, self.instance_counter);
        self.instance_counter += 1;
        id
    }

    /// Register a new component instance.
    pub fn register_instance(&mut self, id: String, instance: ComponentInstance) {
        self.instances.insert(id, instance);
    }

    /// Get a component instance by ID.
    pub fn get_instance(&self, id: &str) -> Option<&ComponentInstance> {
        self.instances.get(id)
    }

    /// Update a component instance's state.
    pub fn update_instance(&mut self, id: &str, state: ComponentState) -> bool {
        if let Some(instance) = self.instances.get_mut(id) {
            instance.state = state;
            return true;
        }
        false
    }

    /// Remove a component instance (for cleanup).
    pub fn remove_instance(&mut self, id: &str) -> Option<ComponentInstance> {
        self.instances.remove(id)
    }

    /// Get all instance IDs for a specific component type.
    pub fn get_instances_by_type(&self, component_type: &str) -> Vec<String> {
        self.instances
            .keys()
            .filter(|k| k.starts_with(component_type))
            .cloned()
            .collect()
    }

    /// Clear all instances (for page navigation cleanup).
    pub fn clear_all(&mut self) {
        self.instances.clear();
        self.instance_counter = 0;
    }
}

/// Represents a single interactive component instance.
#[derive(Debug, Clone)]
pub struct ComponentInstance {
    /// Unique instance identifier
    pub id: String,
    /// Component type (e.g., "switch", "button-counter", "input")
    pub component_type: String,
    /// Current state of the component
    pub state: ComponentState,
}

/// State values for different component types.
#[derive(Debug, Clone, PartialEq)]
pub enum ComponentState {
    /// Switch toggle state
    Switch { checked: bool },
    /// Button click counter
    ButtonCounter { count: u32 },
    /// Input text value
    Input { value: String, placeholder: String },
    /// Generic key-value state
    Generic(HashMap<String, String>),
}

impl ComponentState {
    /// Create a new switch state.
    pub fn switch(checked: bool) -> Self {
        ComponentState::Switch { checked }
    }

    /// Create a new button counter state.
    pub fn button_counter(count: u32) -> Self {
        ComponentState::ButtonCounter { count }
    }

    /// Create a new input state.
    pub fn input(value: String, placeholder: String) -> Self {
        ComponentState::Input { value, placeholder }
    }

    /// Serialize state to JSON-compatible key-value pairs.
    pub fn to_map(&self) -> HashMap<String, String> {
        let mut map = HashMap::new();
        match self {
            ComponentState::Switch { checked } => {
                map.insert("type".to_string(), "switch".to_string());
                map.insert("checked".to_string(), checked.to_string());
            }
            ComponentState::ButtonCounter { count } => {
                map.insert("type".to_string(), "button-counter".to_string());
                map.insert("count".to_string(), count.to_string());
            }
            ComponentState::Input { value, placeholder } => {
                map.insert("type".to_string(), "input".to_string());
                map.insert("value".to_string(), value.clone());
                map.insert("placeholder".to_string(), placeholder.clone());
            }
            ComponentState::Generic(data) => {
                map.extend(data.clone());
            }
        }
        map
    }
}

/// Builder for creating interactive component placeholders.
pub struct InteractiveComponentBuilder {
    component_type: String,
    initial_state: ComponentState,
    label: Option<String>,
    classes: Vec<String>,
}

impl InteractiveComponentBuilder {
    /// Create a new builder for the specified component type.
    pub fn new(component_type: impl Into<String>) -> Self {
        Self {
            component_type: component_type.into(),
            initial_state: ComponentState::Generic(HashMap::new()),
            label: None,
            classes: Vec::new(),
        }
    }

    /// Set the initial state for the component.
    pub fn initial_state(mut self, state: ComponentState) -> Self {
        self.initial_state = state;
        self
    }

    /// Set a display label for the component.
    pub fn label(mut self, label: impl Into<String>) -> Self {
        self.label = Some(label.into());
        self
    }

    /// Add a CSS class to the component.
    pub fn class(mut self, class: impl Into<String>) -> Self {
        self.classes.push(class.into());
        self
    }

    /// Build the component, registering it with the global state manager.
    pub fn build(self) -> (String, VNode) {
        let global_state = get_global_state_locked();
        let mut state = global_state.write().unwrap_or_else(|e| e.into_inner());

        let instance_id = state.generate_instance_id(&self.component_type);

        let instance = ComponentInstance {
            id: instance_id.clone(),
            component_type: self.component_type.clone(),
            state: self.initial_state.clone(),
        };

        state.register_instance(instance_id.clone(), instance);

        let vnode = self.render_vnode(&instance_id);

        (instance_id, vnode)
    }

    /// Render the VNode for this interactive component.
    fn render_vnode(&self, instance_id: &str) -> VNode {
        let mut element = VElement::new("div")
            .class("hi-interactive-component")
            .attr("data-component-type", &self.component_type)
            .attr("data-instance-id", instance_id);

        // Add custom classes
        for class in &self.classes {
            element = element.class(class.as_str());
        }

        // Add initial state as data attributes
        let state_map = self.initial_state.to_map();
        for (key, value) in &state_map {
            element = element.attr(&format!("data-state-{}", key), value);
        }

        // Build children
        let mut children: Vec<VNode> = Vec::new();

        if let Some(label) = &self.label {
            children.push(VNode::Element(
                VElement::new("div")
                    .class("hi-interactive-label")
                    .child(VNode::Text(VText::new(label))),
            ));
        }

        children.push(self.render_component_content(instance_id));

        VNode::Element(element.children(children))
    }

    /// Render the actual component content based on type.
    fn render_component_content(&self, instance_id: &str) -> VNode {
        match self.component_type.as_str() {
            "switch" => self.render_switch(instance_id),
            "button-counter" => self.render_button_counter(instance_id),
            "input" => self.render_input(instance_id),
            _ => VNode::Element(
                VElement::new("div")
                    .class("hi-interactive-placeholder")
                    .child(VNode::Text(VText::new(&format!(
                        "Unknown component: {}",
                        self.component_type
                    )))),
            ),
        }
    }

    /// Render a switch component.
    fn render_switch(&self, instance_id: &str) -> VNode {
        let checked = matches!(self.initial_state, ComponentState::Switch { checked: true });

        rsx! {
            label {
                class: "hi-switch hi-interactive-switch",
                "data-instance-id": instance_id,
                input {
                    r#type: "checkbox",
                    class: "hi-switch__input",
                    "data-instance-id": instance_id,
                    checked: checked.to_string(),
                }
                span { class: "hi-switch__rail" }
            }
        }
    }

    /// Render a button counter component.
    fn render_button_counter(&self, instance_id: &str) -> VNode {
        let count = if let ComponentState::ButtonCounter { count } = self.initial_state {
            count
        } else {
            0
        };

        let count_text = VNode::Text(VText::new(&format!("Count: {}", count)));

        rsx! {
            div {
                class: "hi-button-counter hi-interactive-counter",
                "data-instance-id": instance_id,
                button {
                    class: "hi-btn hi-btn--primary hi-counter-btn",
                    "data-action": "increment",
                    "data-instance-id": instance_id,
                    r#type: "button",
                    "Click me!"
                }
                div { class: "hi-counter-display", {count_text} }
            }
        }
    }

    /// Render an input component.
    fn render_input(&self, instance_id: &str) -> VNode {
        let (value, placeholder) =
            if let ComponentState::Input { value, placeholder } = &self.initial_state {
                (value.clone(), placeholder.clone())
            } else {
                (String::new(), "Enter text...".to_string())
            };

        let display_value = if value.is_empty() { "(empty)" } else { &value };
        let value_text = VNode::Text(VText::new(&format!("Value: {}", display_value)));

        rsx! {
            div {
                class: "hi-interactive-input-wrapper",
                "data-instance-id": instance_id,
                input {
                    class: "hi-input hi-interactive-input",
                    r#type: "text",
                    "data-instance-id": instance_id,
                    placeholder: &placeholder,
                    value: &value,
                }
                div { class: "hi-input-display", {value_text} }
            }
        }
    }
}

/// Convenience function to create a switch component.
pub fn switch(checked: bool, label: Option<&str>) -> (String, VNode) {
    let label_str = label.unwrap_or("Toggle").to_string();
    InteractiveComponentBuilder::new("switch")
        .initial_state(ComponentState::switch(checked))
        .label(label_str)
        .build()
}

/// Convenience function to create a button counter component.
pub fn button_counter(initial_count: u32, label: Option<&str>) -> (String, VNode) {
    let builder = InteractiveComponentBuilder::new("button-counter")
        .initial_state(ComponentState::button_counter(initial_count));
    let builder = if let Some(label_str) = label {
        builder.label(label_str.to_string())
    } else {
        builder
    };
    builder.build()
}

/// Convenience function to create an input component.
pub fn interactive_input(value: &str, placeholder: &str, label: Option<&str>) -> (String, VNode) {
    let builder = InteractiveComponentBuilder::new("input").initial_state(ComponentState::input(
        value.to_string(),
        placeholder.to_string(),
    ));
    let builder = if let Some(label_str) = label {
        builder.label(label_str.to_string())
    } else {
        builder
    };
    builder.build()
}

/// Get the global reactive state manager.
pub fn get_global_state() -> Arc<RwLock<ReactiveState>> {
    get_global_state_locked()
}

/// Initialize the JavaScript bridge for reactive state updates.
///
/// This function injects the necessary JavaScript code to handle
/// interactive component events.
pub fn init_js_bridge() -> VNode {
    VNode::Element(
        VElement::new("script")
            .attr("type", "module")
            .child(VNode::Text(VText::new(JS_BRIDGE_CODE))),
    )
}

/// JavaScript code for the reactive state bridge.
const JS_BRIDGE_CODE: &str = r#"
(function() {
    'use strict';

    // State storage for all component instances
    const componentStates = new Map();

    // Initialize state from data attributes on DOM elements
    function initializeComponentStates() {
        const components = document.querySelectorAll('[data-instance-id]');
        components.forEach(el => {
            const instanceId = el.getAttribute('data-instance-id');
            const componentType = el.getAttribute('data-component-type') ||
                                 el.closest('[data-component-type]')?.getAttribute('data-component-type');

            if (!instanceId || !componentType) return;

            if (!componentStates.has(instanceId)) {
                const state = loadStateFromElement(el, instanceId, componentType);
                componentStates.set(instanceId, state);
            }
        });
    }

    // Load initial state from DOM element's data attributes
    function loadStateFromElement(el, instanceId, componentType) {
        const container = el.closest('[data-instance-id]');
        if (!container) return { type: componentType };

        const state = { type: componentType };
        const attrs = container.attributes;

        for (let i = 0; i < attrs.length; i++) {
            const attr = attrs[i];
            if (attr.name.startsWith('data-state-')) {
                const key = attr.name.replace('data-state-', '');
                state[key] = attr.value;
            }
        }

        return state;
    }

    // Save state to localStorage for persistence
    function saveState(instanceId, state) {
        try {
            const key = 'hikari-component-state-' + instanceId;
            localStorage.setItem(key, JSON.stringify(state));
        } catch (e) {
            console.warn('Failed to save component state:', e);
        }
    }

    // Load state from localStorage
    function loadState(instanceId) {
        try {
            const key = 'hikari-component-state-' + instanceId;
            const stored = localStorage.getItem(key);
            if (stored) {
                return JSON.parse(stored);
            }
        } catch (e) {
            console.warn('Failed to load component state:', e);
        }
        return null;
    }

    // Update component state and reflect changes in DOM
    function updateState(instanceId, updates) {
        const state = componentStates.get(instanceId) || {};
        const newState = { ...state, ...updates };
        componentStates.set(instanceId, newState);
        saveState(instanceId, newState);
        renderUpdate(instanceId, newState);
    }

    // Render state updates to the DOM
    function renderUpdate(instanceId, state) {
        const container = document.querySelector(`[data-instance-id="${instanceId}"]`);
        if (!container) return;

        switch (state.type) {
            case 'switch':
                renderSwitchUpdate(container, state);
                break;
            case 'button-counter':
                renderCounterUpdate(container, state);
                break;
            case 'input':
                renderInputUpdate(container, state);
                break;
        }
    }

    function renderSwitchUpdate(container, state) {
        const input = container.querySelector('.hi-switch__input');
        const display = container.querySelector('.hi-switch-display');

        if (input) {
            input.checked = state.checked === 'true' || state.checked === true;
        }

        if (display) {
            display.textContent = 'Switch is ' + (state.checked === 'true' || state.checked === true ? 'ON' : 'OFF');
        }
    }

    function renderCounterUpdate(container, state) {
        const display = container.querySelector('.hi-counter-display');
        if (display) {
            const count = parseInt(state.count) || 0;
            display.textContent = 'Count: ' + count;
        }
    }

    function renderInputUpdate(container, state) {
        const display = container.querySelector('.hi-input-display');
        if (display) {
            const value = state.value || '';
            display.textContent = 'Value: ' + (value || '(empty)');
        }
    }

    // Event delegation for all interactive components
    function handleEvent(e) {
        const target = e.target;
        const instanceId = target.getAttribute('data-instance-id');
        const action = target.getAttribute('data-action');

        if (!instanceId) return;

        const container = target.closest('[data-component-type]');
        const componentType = container?.getAttribute('data-component-type');

        if (componentType === 'switch' && target.type === 'checkbox') {
            updateState(instanceId, { checked: target.checked });
            e.preventDefault();
        } else if (componentType === 'button-counter' && action === 'increment') {
            const currentState = componentStates.get(instanceId) || {};
            const count = parseInt(currentState.count) || 0;
            updateState(instanceId, { count: count + 1 });
            e.preventDefault();
        } else if (componentType === 'input' && target.type === 'text') {
            // For input, update state on input event
            updateState(instanceId, { value: target.value });
        }
    }

    // Set up event listeners
    function setupEventListeners() {
        // Use event delegation for better performance
        document.addEventListener('change', handleEvent, true);
        document.addEventListener('input', handleEvent, true);
        document.addEventListener('click', handleEvent, true);
    }

    // Clean up states for removed components
    function cleanupRemovedComponents() {
        const currentIds = new Set(
            Array.from(document.querySelectorAll('[data-instance-id]'))
                .map(el => el.getAttribute('data-instance-id'))
        );

        for (const [id] of componentStates) {
            if (!currentIds.has(id)) {
                componentStates.delete(id);
            }
        }
    }

    // Initialize when DOM is ready
    function init() {
        initializeComponentStates();

        // Restore states from localStorage
        for (const [instanceId, state] of componentStates) {
            const savedState = loadState(instanceId);
            if (savedState) {
                componentStates.set(instanceId, { ...state, ...savedState });
                renderUpdate(instanceId, savedState);
            }
        }

        setupEventListeners();

        // Set up MutationObserver for dynamically added components
        const observer = new MutationObserver((mutations) => {
            let shouldInit = false;
            for (const mutation of mutations) {
                if (mutation.addedNodes.length > 0) {
                    shouldInit = true;
                    break;
                }
            }
            if (shouldInit) {
                initializeComponentStates();
                cleanupRemovedComponents();
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        // Expose API globally
        window.hikariReactive = {
            getState: (instanceId) => componentStates.get(instanceId),
            setState: updateState,
            getAllStates: () => Object.fromEntries(componentStates),
            clearAllStates: () => {
                componentStates.clear();
                // Clear localStorage
                for (let i = localStorage.length - 1; i >= 0; i--) {
                    const key = localStorage.key(i);
                    if (key && key.startsWith('hikari-component-state-')) {
                        localStorage.removeItem(key);
                    }
                }
            }
        };
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Re-initialize after WASM hydration
    setTimeout(init, 200);
})();
"#;
