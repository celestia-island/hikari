//! SegmentedTabs — the Rust SSR form of Vue `HkTabs variant="segmented"`.
//!
//! ONE static radiogroup whose DOM is exactly what the Vue component renders
//! before its measurement pass: root `.hk-tabs[data-variant="segmented"]` >
//! `.hk-tabs-list[role="radiogroup"]` > the sliding-indicator node (opaque
//! only once the runtime measures it via `data-ready`) > `role="radio"`
//! triggers carrying `aria-checked`, `data-active` and roving tabindex. The
//! canonical sheet is the vendored mirror of `HkTabs.scss` — both forms ship
//! the same look, so a server-built page shows the family pill from the first
//! byte and the hydrated Vue control replaces it without a visual swap.
//!
//! Static BY DESIGN: no signals, no context, no change events. A host that
//! needs the interactive control mounts the Vue `HkTabs` (the docs shell
//! re-parents this node's slot to it on boot). Triggers carry their option
//! `key` on `data-key` and any passthrough attributes verbatim (a host hooks
//! its own behaviour with e.g. `data-pane`).

use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct SegmentedTabsComponent;

/// One option of the segmented strip.
#[derive(Clone, PartialEq, Debug, Default)]
pub struct SegmentedTabOption {
    /// Stable option identity (mirrors HkTabs `tabs[].key`).
    pub key: String,
    /// Visible trigger label.
    pub label: String,
    /// Verbatim attribute pairs on this trigger (`("data-pane", "preview")`).
    pub attrs: Vec<(String, String)>,
    /// Disabled triggers render `aria-disabled` + `data-disabled` and are
    /// skipped by the roving tabindex, mirroring HkTabs.
    pub disabled: bool,
}

#[define_props]
pub struct SegmentedTabsProps {
    /// The options, in display order.
    pub items: Vec<SegmentedTabOption>,

    /// The `key` of the active option.
    pub active_key: String,

    /// Accessible name for the radiogroup (mirrors HkTabs `ariaLabel`).
    #[default("".to_string())]
    pub aria_label: String,

    #[default]
    pub class: String,
}

/// The provenance contract of the emitted DOM, in one place:
///
/// - root: `hk-tabs` + `data-variant="segmented"` (+ the literal
///   `data-tauri-drag-region="false"` the Vue render emits);
/// - track: `hk-tabs-list` + `data-variant="segmented"`, `role="radiogroup"`,
///   `aria-label` only when a name was given;
/// - the indicator node with NO `data-ready` (the sheet keeps it transparent
///   until the runtime has measured a frame);
/// - triggers: `hk-tabs-trigger`, `type="button"`, `role="radio"`,
///   `aria-checked`, `data-active` on the active one only, `aria-disabled` +
///   `data-disabled` on disabled ones, roving tabindex (`-1` on every
///   non-active option — the active one joins the page tab sequence).
///
/// MUT:segmented-static-shape — diverging from any of these (dropping the
/// variant markers, the indicator node, `aria-checked`, the roving tabindex
/// or the passthrough attributes) turns the SSR contract test red.
#[component]
pub fn SegmentedTabs(props: SegmentedTabsProps) -> Element {
    let root_class = if props.class.is_empty() {
        "hk-tabs".to_string()
    } else {
        format!("hk-tabs {}", props.class)
    };

    rsx! {
        div {
            class: root_class,
            "data-variant": "segmented",
            // Same literal the Vue render emits: a tab strip is interactive
            // content, never a window-drag surface.
            "data-tauri-drag-region": "false",

            div {
                class: "hk-tabs-list",
                "data-variant": "segmented",
                role: "radiogroup",
                "aria-label": (!props.aria_label.is_empty()).then_some(props.aria_label.clone()),

                div { class: "hk-tabs-indicator" }

                for option in props.items.iter() {
                    {
                        let active = option.key == props.active_key;
                        let base = rsx! {
                            button {
                                class: "hk-tabs-trigger",
                                r#type: "button",
                                role: "radio",
                                // STRING value on purpose: the rsx bool
                                // shorthand means "attr presence" and would
                                // emit aria-checked="aria-checked".
                                "aria-checked": if active { "true" } else { "false" },
                                "data-active": active.then_some("true"),
                                "aria-disabled": option.disabled.then_some("true"),
                                "data-disabled": option.disabled.then_some("true"),
                                tabindex: if active { None } else { Some("-1") },
                                "data-key": option.key.clone(),
                                {option.label.clone()}
                            }
                        };
                        // Passthrough attributes ride LAST so a host value can
                        // never be silently overwritten by the mirror's own.
                        match base {
                            VNode::Element(el) => {
                                let mut ve = *el;
                                for (name, value) in &option.attrs {
                                    ve = ve.attr(name, value.as_str());
                                }
                                VNode::Element(Box::new(ve))
                            }
                            other => other,
                        }
                    }
                }
            }
        }
    }
}

impl StyledComponent for SegmentedTabsComponent {
    fn styles() -> &'static str {
        // The canonical Vue sheet, compiled verbatim (no_hash keeps the
        // `.hk-tabs*` names literal so this CSS matches the Vue build).
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkTabs.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "segmented-tabs"
    }
}
