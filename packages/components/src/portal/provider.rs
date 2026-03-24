// hi-components/src/portal/provider.rs
// PortalProvider and PortalContext

#![expect(clippy::needless_update)]

use std::sync::atomic::Ordering;

use super::render::{PortalRender, PortalRenderProps};
use crate::{
    portal::types::{ModalAnimationState, PORTAL_ID_COUNTER, PortalEntry},
    prelude::*,
};

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
    let mut entries_for_callbacks = entries.clone();

    let add_entry = Callback::new(move |entry: PortalEntry| {
        let mut e = entries_for_callbacks.write();
        e.push(entry);
    });

    let mut entries_for_remove = entries.clone();
    let remove_entry = Callback::new(move |id: String| {
        let mut e = entries_for_remove.write();
        e.retain(|entry| match entry {
            PortalEntry::Modal { id: entry_id, .. } => entry_id != &id,
            PortalEntry::Dropdown { id: entry_id, .. } => entry_id != &id,
            PortalEntry::Toast { id: entry_id, .. } => entry_id != &id,
            PortalEntry::Popover { id: entry_id, .. } => entry_id != &id,
            PortalEntry::Tooltip { id: entry_id, .. } => entry_id != &id,
        });
    });

    let mut entries_for_clear = entries.clone();
    let clear_all = Callback::new(move |_| {
        let mut e = entries_for_clear.write();
        e.clear();
    });

    let entries_for_close_anim = entries.clone();
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

    let entries_for_context = entries.clone();
    let entries_for_render = entries.clone();

    use_context_provider(|| PortalContext {
        entries: entries_for_context,
        add_entry,
        remove_entry,
        clear_all,
        start_close_animation,
    });

    rsx! {
        children {}
        PortalRender { entries: Some(entries_for_render) }
    }
}

pub fn use_portal() -> PortalContext {
    let ctx = use_context::<PortalContext>().expect("PortalContext not found");
    ctx.get().clone()
}

pub fn generate_portal_id() -> String {
    format!(
        "portal-{}",
        PORTAL_ID_COUNTER.fetch_add(1, Ordering::SeqCst)
    )
}
