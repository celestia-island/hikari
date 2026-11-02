// hi-components/src/feedback/persistent_toast_group.rs
// PersistentToastGroup — mirror of the canonical Vue
// `HkPersistentToastGroup` (a chrome-bar row of persistent-toast chips with
// a "+N" overflow counter).
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkPersistentToastGroup.scss`, vendored under
// `src/styles/vue-mirror/`), compiled with `no_hash` so the
// `.hk-persistent-toast-group*` class names are literal and identical in
// both forms. The DOM contract below mirrors the Vue render output
// one-to-one:
//
//   span.hk-persistent-toast-group
//     {the first `max_visible` chips, in caller order}
//     span.hk-persistent-toast-group__extra        (only when items overflow)
//         "+N"
//
// Behaviour contract taken from the Vue source (`HkPersistentToastGroup.tsx`):
// `visible = children.slice(0, max(0, maxVisible))`,
// `extra = children.length - visible.length`, the counter renders only when
// `extra > 0`, and hidden children are UNMOUNTED rather than hidden — their
// hover cards and timers are their own state and die with the vnode, so a chip
// that re-enters the visible window starts fresh (a persistent toast has no
// state worth preserving across an overflow eviction).
//
// Adaptation deltas vs Vue (deliberate, listed instead of hidden):
//   * CHILDREN — Vue takes the default slot's vnode array; Rust props have no
//     slot, so the chips arrive as `items: Vec<Element>`. The caller builds
//     them, which means an "empty" item still counts toward the overflow
//     (Vue filters Comment vnodes out before slicing) — pass only real chips.
//   * UNMOUNTING — the slice drops the EVICTION of hidden chips from the
//     render, which is the observable half of "unmounted, not hidden"; the
//     Rust side has no per-chip instance to tear down beyond that.
//
// New file (the family had no Rust counterpart): nothing is replaced.

use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct PersistentToastGroupComponent;

/// Default visible chip count (Vue: `maxVisible` default 3).
pub const PERSISTENT_TOAST_GROUP_MAX_VISIBLE: usize = 3;

/// Vue's slice arithmetic: how many chips stay visible and how many collapse
/// into the "+N" counter. `max_visible` is clamped like Vue's
/// `Math.max(0, maxVisible)` (a `usize` cannot go negative).
pub fn persistent_toast_group_split(total: usize, max_visible: usize) -> (usize, usize) {
    let visible = total.min(max_visible);
    (visible, total - visible)
}

#[define_props]
pub struct PersistentToastGroupProps {
    /// How many chips stay visible before the "+N" counter takes over.
    #[default(3)]
    pub max_visible: usize,

    /// The chips, in caller order (Vue: the default slot).
    pub items: Vec<Element>,
}

#[component]
pub fn PersistentToastGroup(props: PersistentToastGroupProps) -> Element {
    let (visible_count, extra) = persistent_toast_group_split(props.items.len(), props.max_visible);
    let visible: Vec<Element> = props.items.into_iter().take(visible_count).collect();

    rsx! {
        span { class: "hk-persistent-toast-group",
            {VNode::Fragment(visible)}
            if extra > 0 {
                span { class: "hk-persistent-toast-group__extra",
                    "+{extra}"
                }
            }
        }
    }
}

impl StyledComponent for PersistentToastGroupComponent {
    fn styles() -> &'static str {
        // The canonical Vue sheet, compiled verbatim (no_hash keeps the
        // `.hk-persistent-toast-group*` names literal so this CSS matches the
        // Vue build).
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkPersistentToastGroup.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "persistent-toast-group"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn persistent_toast_group_props_default_matches_the_vue_props() {
        let props = PersistentToastGroupProps::default();
        assert_eq!(props.max_visible, PERSISTENT_TOAST_GROUP_MAX_VISIBLE);
        assert_eq!(props.max_visible, 3);
        assert!(props.items.is_empty());
    }

    #[test]
    fn persistent_toast_group_split_slices_the_first_n_and_counts_the_rest() {
        // No overflow: every chip stays visible, no counter.
        assert_eq!(persistent_toast_group_split(0, 3), (0, 0));
        assert_eq!(persistent_toast_group_split(3, 3), (3, 0));
        // Overflow: the first N stay, the rest collapse.
        assert_eq!(persistent_toast_group_split(5, 3), (3, 2));
        assert_eq!(persistent_toast_group_split(9, 1), (1, 8));
        // Vue's Math.max(0, maxVisible): a zero budget hides everything.
        assert_eq!(persistent_toast_group_split(4, 0), (0, 4));
        // The mirror's reference consumer: one chip + "+N" (wowsp title bar).
        assert_eq!(persistent_toast_group_split(3, 1), (1, 2));
    }

    #[test]
    fn persistent_toast_group_styles_come_from_the_canonical_vue_sheet() {
        let css = PersistentToastGroupComponent::styles();
        for class_name in [
            ".hk-persistent-toast-group",
            ".hk-persistent-toast-group__extra",
        ] {
            assert!(
                css.contains(class_name),
                "persistent toast group css must come from the vue-mirror sheet (missing {class_name})"
            );
        }
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored persistent-toast-group sheet"
        );
    }
}
