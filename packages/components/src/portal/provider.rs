// hi-components/src/portal/provider.rs
// PortalProvider and PortalContext

use std::sync::atomic::Ordering;

use dioxus::prelude::*;

use super::render::PortalRender;
use crate::portal::types::{ModalAnimationState, PortalEntry, PORTAL_ID_COUNTER};

#[derive(Clone)]
pub struct PortalContext {
    pub entries: Signal<Vec<PortalEntry>>,
    pub add_entry: Callback<PortalEntry>,
    pub remove_entry: Callback<String>,
    pub clear_all: Callback<()>,
    pub start_close_animation: Callback<String>,
}

#[component]
pub fn PortalProvider(children: Element) -> Element {
    let entries = use_signal(Vec::new);
    let mut entries_for_callbacks = entries;

    let add_entry = Callback::new(move |entry: PortalEntry| {
        let mut e = entries_for_callbacks.write();
        e.push(entry);
    });

    let mut entries_for_remove = entries;
    let remove_entry = Callback::new(move |id: String| {
        let mut e = entries_for_remove.write();
        e.retain(|entry| match entry {
            PortalEntry::Modal { id: entry_id, .. } => entry_id != &id,
            PortalEntry::Dropdown { id: entry_id, .. } => entry_id != &id,
            PortalEntry::Toast { id: entry_id, .. } => entry_id != &id,
            PortalEntry::Popover { id: entry_id, .. } => entry_id != &id,
        });
    });

    let mut entries_for_clear = entries;
    let clear_all = Callback::new(move |_| {
        let mut e = entries_for_clear.write();
        e.clear();
    });

    let mut entries_for_close_anim = entries;
    let start_close_animation = Callback::new(move |id: String| {
        let mut e = entries_for_close_anim.write();
        for entry in e.iter_mut() {
            if let PortalEntry::Modal {
                id: entry_id,
                animation_state,
                ..
            } = entry
                && entry_id == &id
                && *animation_state == ModalAnimationState::Visible
            {
                *animation_state = ModalAnimationState::Disappearing;
            }
        }
    });

    use_context_provider(|| PortalContext {
        entries,
        add_entry,
        remove_entry,
        clear_all,
        start_close_animation,
    });

    rsx! {
        {children}
        PortalRender { entries }
    }
}

pub fn use_portal() -> PortalContext {
    use_context::<PortalContext>()
}

pub fn generate_portal_id() -> String {
    format!(
        "portal-{}",
        PORTAL_ID_COUNTER.fetch_add(1, Ordering::SeqCst)
    )
}
