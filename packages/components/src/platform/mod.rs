//! Platform abstraction layer for components
//!
//! This module provides platform-agnostic APIs for DOM operations,
//! abstracting over the three backends a build can target:
//!
//! * `web` — `wasm32-unknown-unknown`, the browser through `web_sys`;
//! * `wit` — `wasm32-wasip2`, the browser through tairitsu-web's WIT host
//!   world (a component never links `web_sys`);
//! * `stub` — everything else (native, SSR): no-ops and fixed readings.
//!
//! Components call the free functions and never name the backend. The element
//! type is whatever the active backend hands out (`web_sys::Element`,
//! tairitsu-web's `WitElement`, `()` on the stub); callers only pass an
//! element back to the same backend, so it never appears in a component's
//! own signature.

use tairitsu_vdom::platform::MutationObserverInit;

/// Options for [`observe_mutations`]: which tree changes a mutation observer
/// reports. `subtree: None` means the node itself only.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct MutationObserverOptions {
    pub child_list: bool,
    pub attributes: bool,
    pub character_data: bool,
    pub subtree: Option<bool>,
}

impl Default for MutationObserverOptions {
    fn default() -> Self {
        Self {
            child_list: true,
            attributes: false,
            character_data: false,
            subtree: Some(true),
        }
    }
}

impl MutationObserverOptions {
    /// The same selection in tairitsu's shape: the WIT backend's observer
    /// takes an init record. Old values are never requested — no consumer of
    /// [`observe_mutations`] reads them. Only the WIT backend calls this; the
    /// tests below keep it honest on every target.
    #[cfg_attr(not(all(target_arch = "wasm32", target_os = "wasi")), allow(dead_code))]
    pub(crate) fn into_init(self) -> MutationObserverInit {
        MutationObserverInit {
            child_list: self.child_list,
            attributes: self.attributes,
            character_data: self.character_data,
            subtree: self.subtree.unwrap_or(false),
            attribute_old_value: false,
            character_data_old_value: false,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The default watches child lists across the subtree, like
    /// `MutationObserverInit::new()` plus `subtree: true` in the browser.
    #[test]
    fn observer_options_default_to_the_subtree_child_list() {
        let init = MutationObserverOptions::default().into_init();
        assert!(init.child_list);
        assert!(init.subtree);
        assert!(!init.attributes);
        assert!(!init.character_data);
        assert!(!init.attribute_old_value);
        assert!(!init.character_data_old_value);
    }

    /// `subtree: None` means the node itself; every flag maps one to one.
    #[test]
    fn observer_options_map_onto_the_tairitsu_init() {
        let init = MutationObserverOptions {
            child_list: false,
            attributes: true,
            character_data: true,
            subtree: None,
        }
        .into_init();
        assert!(!init.child_list);
        assert!(init.attributes);
        assert!(init.character_data);
        assert!(!init.subtree);
    }
}

/// Where a page-wide capture `click` landed, as the outside-click seam asks
/// about it: "did the click land inside an element matching `selector`?" —
/// the element under the pointer or one of its ancestors. The backend owns
/// the element type, so the question travels instead of the element.
pub trait ClickLocation {
    fn inside(&self, selector: &str) -> bool;
}

#[cfg(not(target_arch = "wasm32"))]
pub mod stub;
#[cfg(all(target_arch = "wasm32", target_os = "unknown"))]
pub mod web;
#[cfg(all(target_arch = "wasm32", target_os = "wasi"))]
pub mod wit;

#[cfg(not(target_arch = "wasm32"))]
pub use stub::*;
#[cfg(all(target_arch = "wasm32", target_os = "unknown"))]
pub use web::*;
#[cfg(all(target_arch = "wasm32", target_os = "wasi"))]
pub use wit::*;
