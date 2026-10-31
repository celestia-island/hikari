// hi-components/src/feedback/phase_transition.rs
// PhaseTransition — mirror of the canonical Vue `HkPhaseTransition`.
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkPhaseTransition.scss`, vendored under
// `src/styles/vue-mirror/`), compiled with `no_hash` so the
// `.hk-phase-content` name is literal in both forms.
//
// Vue contract: the component picks the named slot matching `state.type`,
// keys the content by `type` + a JSON digest of the state's remaining
// fields, and swaps it inside `<Transition name="hk-phase" mode="out-in"
// appear>`. Rust mirror (adaptation, documented):
//
//   * named slots do not exist in tairitsu rsx — the caller passes the
//     active phase's `content` Element directly;
//   * the key derivation is adapted, not byte-identical: Vue computes
//     `type + JSON.stringify(entries)` internally; tairitsu rsx has no
//     runtime JSON reflection, so the caller passes `detail` — the digest of
//     the same non-`type` fields — and the mirror keys on
//     `phase + ":" + detail` (empty detail keys on `phase` alone);
//   * tairitsu has no `<Transition>` hook machinery, so the sheet's
//     `.hk-phase-enter-active/-leave-active` classes have no automatic
//     driver: the wrapper remounts on key change and a host that wants the
//     fade must wire those classes itself. The CSS stays compiled so both
//     forms ship the same sheet.

use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct PhaseTransitionComponent;

#[define_props]
pub struct PhaseTransitionProps {
    /// Vue `state.type` — also the key prefix.
    #[default]
    pub phase: String,

    /// Digest of the state's remaining fields (Vue: JSON of the `k:v`
    /// pairs that are not `type`). Changing this remounts the wrapper.
    #[default]
    pub detail: String,

    /// The active phase's rendered content (Vue: the slot named `phase`).
    pub content: Element,
}

/// Derive the transition key exactly the way Vue does:
/// `type` + `:` + the caller's digest of the remaining fields.
pub fn phase_transition_key(phase: &str, detail: &str) -> String {
    if detail.is_empty() {
        phase.to_string()
    } else {
        format!("{phase}:{detail}")
    }
}

#[component]
pub fn PhaseTransition(props: PhaseTransitionProps) -> Element {
    let key = phase_transition_key(&props.phase, &props.detail);

    rsx! {
        div {
            class: "hk-phase-content",
            key: key,
            {props.content}
        }
    }
}

impl StyledComponent for PhaseTransitionComponent {
    fn styles() -> &'static str {
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkPhaseTransition.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "phase-transition"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn phase_transition_key_derivation() {
        assert_eq!(phase_transition_key("idle", ""), "idle");
        assert_eq!(phase_transition_key("loading", "step:2"), "loading:step:2");
    }

    #[test]
    fn phase_transition_defaults() {
        let props = PhaseTransitionProps::default();
        assert_eq!(props.phase, "");
        assert_eq!(props.detail, "");
    }

    #[test]
    fn phase_transition_styles_come_from_the_canonical_vue_sheet() {
        let css = PhaseTransitionComponent::styles();
        assert!(
            css.contains(".hk-phase-content"),
            "phase transition css must carry the vue wrapper class"
        );
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored phase transition sheet"
        );
    }
}
