// hi-components/src/basic/rolling_number.rs
// RollingNumber — mirror of the canonical Vue `HkRollingNumber`: a value cut
// into character cells where a changed digit rolls (old digit out upward, new
// digit in) on a pure CSS keyframe.
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkRollingNumber.scss`, vendored under
// `src/styles/vue-mirror/` and guarded by `tests/vue_mirror_drift_tests.rs`),
// compiled with `no_hash` so `.hk-rolling-number` and the `[data-el=…]` hooks
// are literal and identical in both forms. DOM contract (mirrors Vue
// one-to-one):
//
//   span.hk-rolling-number
//     span[data-el="char"]                                  (at rest)
//       {character}
//     span[data-el="slot"]                                  (a rolling digit)
//       span[data-el="roll"]                                (animationend)
//         span[data-el="digit"][data-variant="old"]  {previous digit}
//         span[data-el="digit"][data-variant="new"]  {current digit}
//
// Vue prop mapping: `value: number | string` → [`RollingNumberProps::value`],
// a `String` — Vue renders `String(props.value)` anyway and a Rust prop must be
// `Default`-constructible, so numeric hosts pass `value.to_string()`.
// [`RollingNumberProps::instance_key`] is mirror-only (see the state note).
//
// Behaviour, taken from Vue's `update()` character by character:
//   * the value is cut into CHARACTERS, not digits;
//   * when the character count changes the cell list is REBUILT and nothing
//     animates (Vue returns `false` from that branch);
//   * when it stays, every position whose character changed becomes an
//     animating slot carrying `prev` and `current`; untouched positions stay
//     plain char cells;
//   * only ASCII digits (`/^[0-9]$/`) ever roll — a changed `,`, `.` or `-`
//     swaps in place;
//   * a committed roll collapses back to its char cell on the NEXT render.
//
// State home: tairitsu 0.5.22 has no per-instance component state (`use_signal`
// allocates on every render, `use_state` is one shared hook slot), so the cell
// list lives in a module `thread_local!` registry keyed by
// [`RollingNumberProps::instance_key`] — the pattern
// `feedback/persistent_toast.rs` uses for its chips. Without a key every
// instance shares one default slot, so two unkeyed rolling numbers rendering
// DIFFERENT values can briefly show each other's previous character while the
// roll plays; pass distinct keys when that can happen.
//
// Deltas vs Vue (documented, not accidental):
//   * COMMIT — Vue clears `animating` in `onAnimationend` AND arms a 350ms
//     `cronBus` one-shot, and both re-render the component. The mirror owns no
//     signal to re-render from, so the same two paths only COMMIT the registry
//     entry (`animating = false`): the keyframe is declared `… forwards`, so the
//     resting DOM already shows the new digit exactly where the committed cell
//     would put it, and the next render (any value/origin change) emits the
//     plain char cell. A host without timer ops (`set_timeout` → `0`) keeps
//     just the `animationend` path, which is also the live-browser path.
//   * Vue's `split("")` cuts UTF-16 CODE UNITS; the mirror cuts Unicode scalar
//     values, so a non-BMP character is one cell here and two half-cells in
//     Vue (a lone surrogate cell could never be a digit, so nothing about the
//     roll behaviour changes).
//   * no `key={i}` on the cells (rsx has no key concept): they are positional.
//   * the registry entry is never released (tairitsu 0.5.22 has no unmount
//     hook); a remounted instance re-uses its slot, which is exactly what the
//     previous-character tracking wants.
//   * `class` is accepted and appended last (Vue attribute fallthrough).
//
// New file: the family had no Rust counterpart.

use std::cell::RefCell;
use std::collections::HashMap;

use tairitsu_vdom::AnimationEvent;
use tairitsu_vdom::dom_ops::{clear_timeout, set_timeout};

use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct RollingNumberComponent;

/// Vue's `ROLL_COMMIT_MS`: the fallback that force-commits a roll when
/// `animationend` never fires (the global `data-css-animations="0"` switch
/// parks the keyframe at 0%, so the OLD digit would stay visible forever).
pub const ROLLING_NUMBER_COMMIT_MS: u32 = 350;

/// The registry slot used when a caller passes no `instance_key`.
pub const ROLLING_NUMBER_DEFAULT_KEY: &str = "hk-rolling-number";

/// One character cell: what it shows, what it showed before, and whether the
/// roll for this change is still running (Vue's `CharState`).
#[derive(Clone, PartialEq, Debug, Default)]
pub struct RollingNumberChar {
    pub current: String,
    pub prev: String,
    pub animating: bool,
}

/// The outcome of feeding a new value into a cell list.
#[derive(Clone, PartialEq, Debug, Default)]
pub struct RollingNumberUpdate {
    /// Positions that started rolling on this change.
    pub rolling: Vec<usize>,
    /// The character COUNT changed, so the list was replaced outright and
    /// nothing animates (Vue's early `return false`).
    pub reset: bool,
}

/// Vue: `/^[0-9]$/.test(ch)` — only ASCII digits roll.
pub fn rolling_number_is_rollable(character: &str) -> bool {
    let mut chars = character.chars();
    match (chars.next(), chars.next()) {
        (Some(digit), None) => digit.is_ascii_digit(),
        _ => false,
    }
}

/// Vue's `update(newStr)`: rebuild on a length change, otherwise flag every
/// changed position as rolling and keep its previous character.
pub fn rolling_number_update(
    chars: &mut Vec<RollingNumberChar>,
    next: &str,
) -> RollingNumberUpdate {
    let next_chars: Vec<String> = next.chars().map(|ch| ch.to_string()).collect();
    if next_chars.len() != chars.len() {
        *chars = next_chars
            .into_iter()
            .map(|character| RollingNumberChar {
                current: character.clone(),
                prev: character,
                animating: false,
            })
            .collect();
        return RollingNumberUpdate {
            rolling: Vec::new(),
            reset: true,
        };
    }

    let mut rolling = Vec::new();
    for (index, next_char) in next_chars.into_iter().enumerate() {
        let prev = chars[index].current.clone();
        if prev != next_char {
            chars[index] = RollingNumberChar {
                current: next_char,
                prev,
                animating: true,
            };
            rolling.push(index);
        }
    }
    RollingNumberUpdate {
        rolling,
        reset: false,
    }
}

/// The registry key for one instance: the caller's `instance_key`, or the
/// shared default slot (an empty key counts as absent).
pub fn rolling_number_slot_key(instance_key: Option<&str>) -> String {
    match instance_key {
        Some(key) if !key.is_empty() => key.to_string(),
        _ => ROLLING_NUMBER_DEFAULT_KEY.to_string(),
    }
}

/// One instance's cell list plus the pending commit timers (Vue holds the
/// fallbacks in a `Map<number, CronHandle>` keyed by cell index).
#[derive(Default)]
struct RollingNumberSlot {
    chars: Vec<RollingNumberChar>,
    timers: HashMap<usize, i32>,
}

thread_local! {
    static ROLLING_NUMBER_STATE: RefCell<HashMap<String, RollingNumberSlot>> =
        RefCell::new(HashMap::new());
}

/// Feed one rendered value through the Vue state machine and return the cells
/// to draw. Also (re)arms the per-cell commit timers.
fn apply_rolling_value(key: &str, next: &str) -> Vec<RollingNumberChar> {
    let update = ROLLING_NUMBER_STATE.with(|state| {
        let mut state = state.borrow_mut();
        let slot = state.entry(key.to_string()).or_default();
        rolling_number_update(&mut slot.chars, next)
    });
    if update.reset {
        // A rebuilt list cannot roll, and no stale cell exists to commit — Vue
        // leaves the old handles armed; releasing them is strictly tidier and
        // cannot change the rendered cells.
        cancel_all_roll_commits(key);
    }
    for index in &update.rolling {
        arm_roll_commit(key, *index);
    }
    ROLLING_NUMBER_STATE.with(|state| {
        state
            .borrow()
            .get(key)
            .map(|slot| slot.chars.clone())
            .unwrap_or_default()
    })
}

/// Vue's `armFallback(i)`: commit cell `index` after
/// [`ROLLING_NUMBER_COMMIT_MS`] unless `animationend` got there first.
fn arm_roll_commit(key: &str, index: usize) {
    cancel_roll_commit(key, index);
    let owned_key = key.to_string();
    let timer = set_timeout(
        Box::new(move || commit_roll(&owned_key, index)),
        ROLLING_NUMBER_COMMIT_MS as i32,
    );
    if timer != 0 {
        ROLLING_NUMBER_STATE.with(|state| {
            if let Some(slot) = state.borrow_mut().get_mut(key) {
                slot.timers.insert(index, timer);
            }
        });
    }
}

/// Vue's `onAnimEnd` / fallback body: stop the roll on cell `index` (no
/// re-render — see the header's COMMIT delta).
fn commit_roll(key: &str, index: usize) {
    let timer = ROLLING_NUMBER_STATE.with(|state| {
        let mut state = state.borrow_mut();
        let slot = state.get_mut(key)?;
        let timer = slot.timers.remove(&index);
        if let Some(cell) = slot.chars.get_mut(index) {
            cell.animating = false;
        }
        timer
    });
    if let Some(timer) = timer {
        clear_timeout(timer);
    }
}

/// Drop the pending commit timer of one cell.
fn cancel_roll_commit(key: &str, index: usize) {
    let timer = ROLLING_NUMBER_STATE.with(|state| {
        state
            .borrow_mut()
            .get_mut(key)
            .and_then(|slot| slot.timers.remove(&index))
    });
    if let Some(timer) = timer {
        clear_timeout(timer);
    }
}

/// Drop every pending commit timer of one instance.
fn cancel_all_roll_commits(key: &str) {
    let timers = ROLLING_NUMBER_STATE.with(|state| {
        state
            .borrow_mut()
            .get_mut(key)
            .map(|slot| std::mem::take(&mut slot.timers))
            .unwrap_or_default()
    });
    for timer in timers.into_values() {
        clear_timeout(timer);
    }
}

#[define_props]
pub struct RollingNumberProps {
    /// The rendered text (Vue: `value`, `number | string`, required there;
    /// `""` here because Rust props need a `Default`).
    #[default]
    pub value: String,

    /// Registry slot for the previous-character tracking (mirror-only; see the
    /// header's state note). Unset means the shared default slot.
    pub instance_key: Option<String>,

    /// Host class appended last (Vue attribute fallthrough).
    #[default]
    pub class: String,
}

#[component]
pub fn RollingNumber(props: RollingNumberProps) -> Element {
    let key = rolling_number_slot_key(props.instance_key.as_deref());
    let chars = apply_rolling_value(&key, &props.value);

    let cells: Vec<VNode> = chars
        .iter()
        .enumerate()
        .map(|(index, cell)| {
            if !rolling_number_is_rollable(&cell.current) || !cell.animating {
                let character = cell.current.clone();
                rsx! {
                    span {
                        "data-el": "char",
                        "{character}"
                    }
                }
            } else {
                let prev = cell.prev.clone();
                let current = cell.current.clone();
                let commit_key = key.clone();
                rsx! {
                    span {
                        "data-el": "slot",
                        span {
                            "data-el": "roll",
                            onanimationend: move |_event: AnimationEvent| {
                                commit_roll(&commit_key, index);
                            },
                            span {
                                "data-el": "digit",
                                "data-variant": "old",
                                "{prev}"
                            }
                            span {
                                "data-el": "digit",
                                "data-variant": "new",
                                "{current}"
                            }
                        }
                    }
                }
            }
        })
        .collect();

    let mut root_classes = String::from("hk-rolling-number");
    if !props.class.is_empty() {
        root_classes.push(' ');
        root_classes.push_str(&props.class);
    }

    rsx! {
        span {
            class: root_classes,
            {VNode::Fragment(cells)}
        }
    }
}

impl StyledComponent for RollingNumberComponent {
    fn styles() -> &'static str {
        // The canonical Vue sheet, compiled verbatim (no_hash keeps the
        // `.hk-rolling-number` / `[data-el=…]` hooks literal).
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkRollingNumber.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "rolling-number"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn cells(character: &str) -> Vec<RollingNumberChar> {
        character
            .chars()
            .map(|ch| RollingNumberChar {
                current: ch.to_string(),
                prev: ch.to_string(),
                animating: false,
            })
            .collect()
    }

    #[test]
    fn rolling_number_is_rollable_matches_the_vue_digit_test() {
        for digit in ["0", "5", "9"] {
            assert!(rolling_number_is_rollable(digit), "{digit} is a digit");
        }
        for other in [".", ",", "-", "+", " ", "e", ""] {
            assert!(
                !rolling_number_is_rollable(other),
                "{other:?} must not roll"
            );
        }
        // Only ONE ASCII digit: a multi-character cell never rolls.
        assert!(!rolling_number_is_rollable("12"));
        // Unicode digits are not `/^[0-9]$/`.
        assert!(!rolling_number_is_rollable("٣"));
    }

    #[test]
    fn rolling_number_update_rolls_only_the_changed_positions() {
        let mut chars = cells("12.5");
        let update = rolling_number_update(&mut chars, "13.5");
        assert!(!update.reset);
        assert_eq!(update.rolling, vec![1]);
        // The rolled cell carries prev + current and is animating.
        assert_eq!(chars[1].current, "3");
        assert_eq!(chars[1].prev, "2");
        assert!(chars[1].animating);
        // Untouched cells stay at rest with their own prev.
        assert_eq!(chars[0].current, "1");
        assert!(!chars[0].animating);
        assert_eq!(chars[3].current, "5");
        assert!(!chars[3].animating);

        // A value that does not change rolls nothing.
        let update = rolling_number_update(&mut chars, "13.5");
        assert!(update.rolling.is_empty());
        assert!(!update.reset);
        assert!(chars[1].animating, "an in-flight roll is not re-reset");

        // Several positions at once.
        let update = rolling_number_update(&mut chars, "24.6");
        assert_eq!(update.rolling, vec![0, 1, 3]);
    }

    #[test]
    fn rolling_number_update_rebuilds_on_a_length_change() {
        let mut chars = cells("99");
        let update = rolling_number_update(&mut chars, "100");
        assert!(update.reset);
        assert!(update.rolling.is_empty(), "a rebuilt list cannot roll");
        assert_eq!(chars.len(), 3);
        assert!(chars.iter().all(|cell| !cell.animating));
        assert_eq!(chars[2].current, "0");

        // Shrinking is a rebuild too.
        let update = rolling_number_update(&mut chars, "7");
        assert!(update.reset);
        assert_eq!(chars.len(), 1);

        // The very first render (empty list) is a rebuild, not a roll.
        let mut empty: Vec<RollingNumberChar> = Vec::new();
        let update = rolling_number_update(&mut empty, "42");
        assert!(update.reset);
        assert_eq!(empty.len(), 2);
    }

    #[test]
    fn rolling_number_slot_key_falls_back_to_the_shared_slot() {
        assert_eq!(
            rolling_number_slot_key(None),
            ROLLING_NUMBER_DEFAULT_KEY.to_string()
        );
        assert_eq!(
            rolling_number_slot_key(Some("")),
            ROLLING_NUMBER_DEFAULT_KEY.to_string()
        );
        assert_eq!(rolling_number_slot_key(Some("timer-1")), "timer-1");
    }

    #[test]
    fn rolling_number_defaults_match_the_vue_props() {
        let props = RollingNumberProps::default();
        assert_eq!(props.value, "");
        assert_eq!(props.instance_key, None);
        assert_eq!(props.class, "");
    }

    #[test]
    fn rolling_number_renders_char_cells_then_the_roll_slot() {
        // First render: every character is a plain char cell.
        let first = RollingNumber(RollingNumberProps {
            value: "12.5".to_string(),
            instance_key: Some("render-contract".to_string()),
            ..Default::default()
        })
        .render_to_html();
        assert!(first.contains("hk-rolling-number"), "{first}");
        assert_eq!(
            first.matches("data-el=\"char\"").count(),
            4,
            "one cell per character: {first}"
        );
        assert!(!first.contains("data-el=\"slot\""), "{first}");

        // A same-length change rolls exactly the changed digit.
        let second = RollingNumber(RollingNumberProps {
            value: "13.5".to_string(),
            instance_key: Some("render-contract".to_string()),
            ..Default::default()
        })
        .render_to_html();
        assert_eq!(second.matches("data-el=\"slot\"").count(), 1, "{second}");
        assert!(second.contains("data-el=\"roll\""), "{second}");
        assert!(
            second.contains("data-el=\"digit\" data-variant=\"old\""),
            "{second}"
        );
        assert!(
            second.contains("data-el=\"digit\" data-variant=\"new\""),
            "{second}"
        );
        // The outgoing and incoming digits are both mounted.
        assert!(second.contains(">2</span>"), "old digit: {second}");
        assert!(second.contains(">3</span>"), "new digit: {second}");
        assert_eq!(
            second.matches("data-el=\"char\"").count(),
            3,
            "the untouched cells stay chars: {second}"
        );
    }

    #[test]
    fn rolling_number_resets_instead_of_rolling_on_a_length_change() {
        let _ = RollingNumber(RollingNumberProps {
            value: "9".to_string(),
            instance_key: Some("length-change".to_string()),
            ..Default::default()
        })
        .render_to_html();
        let html = RollingNumber(RollingNumberProps {
            value: "10".to_string(),
            instance_key: Some("length-change".to_string()),
            ..Default::default()
        })
        .render_to_html();
        assert!(!html.contains("data-el=\"slot\""), "{html}");
        assert_eq!(html.matches("data-el=\"char\"").count(), 2, "{html}");
    }

    #[test]
    fn rolling_number_never_rolls_a_non_digit_cell() {
        let _ = RollingNumber(RollingNumberProps {
            value: "1.5".to_string(),
            instance_key: Some("separator".to_string()),
            ..Default::default()
        })
        .render_to_html();
        let html = RollingNumber(RollingNumberProps {
            value: "1,5".to_string(),
            instance_key: Some("separator".to_string()),
            ..Default::default()
        })
        .render_to_html();
        // The separator swapped in place: no slot, no roll.
        assert!(!html.contains("data-el=\"slot\""), "{html}");
        assert!(html.contains(">,"), "the new separator is rendered: {html}");
    }

    #[test]
    fn rolling_number_styles_come_from_the_canonical_vue_sheet() {
        let css = RollingNumberComponent::styles();
        for needle in [
            ".hk-rolling-number",
            // grass normalizes attribute selectors to the unquoted form.
            "[data-el=slot]",
            "[data-el=roll]",
            "[data-el=digit]",
            "hk-rolling-number-up",
            "prefers-reduced-motion",
        ] {
            assert!(
                css.contains(needle),
                "rolling number css must carry the vue hook {needle}"
            );
        }
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored rolling number sheet"
        );
    }
}
