// hi-components/src/scene/blank_canvas.rs
// BlankCanvas — mirror of the canonical Vue `HkBlankCanvas`.
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkBlankCanvas.scss`, vendored under
// `src/styles/vue-mirror/` and guarded by `tests/vue_mirror_drift_tests.rs`),
// compiled with `no_hash` so the `.hk-blank-canvas*` class names are literal
// and identical in both forms. DOM contract (mirrors the Vue render output
// one-to-one):
//
//   div.hk-blank-canvas [aria-label] [data-ready]
//     div.hk-blank-canvas-mount          (the full-bleed mount element)
//       {the default slot}
//     div.hk-blank-canvas-overlay        (DOM drawn ABOVE the mount)
//       {the overlay slot}
//
// The component draws NOTHING of its own: no background, no grid, no empty
// state, no call to action — the sheet sizes the mount to `inset: 0` so a
// host renderer can measure the box it paints on, and the overlay is the
// only chrome layer (`pointer-events: none` on the layer, re-enabled per
// child). A host that wants an empty state renders it in the default slot
// (`display/empty_state.rs` is the mirrored panel for that job).
//
// The `ready` gate is Vue's `ready` ref: a 0 x 0 mount must never initialise
// a renderer (that is the "first frame is wrong, then it settles" flicker),
// so the gate — not the mount — is what the component publishes, through
// `data-ready`. The gate STATE MACHINE is mirrored as the pure functions
// [`blank_canvas_measure`], [`blank_canvas_publish`] and
// [`blank_canvas_size_after`]: they are Vue's `measure()` / `publish()` /
// size bookkeeping exactly, so a host that forwards its own ResizeObserver
// readings through them reaches byte-identical calls.
//
// Deltas vs Vue (documented, not accidental):
//   * Vue owns the lifecycle: `onMounted` schedules `requestAnimationFrame`
//     + a `ResizeObserver`, `publish()` fires the `onMount` / `onResize`
//     callbacks, `onBeforeUnmount` disconnects and fires `onUnmount`. A
//     tairitsu component cannot hold that state (ledger L48: no
//     `use_signal` / `use_state`), and the vnode stack owns no observer, so
//     the host runs the observer and passes `ready` down; the three pure
//     functions above are the whole decision table the host needs, including
//     the "wait for a non-zero box" rule and the "only report a CHANGED box"
//     rule. Nothing else of Vue's behaviour lives outside them.
//   * `expose({ size, ready, measure })` has no Rust equivalent (a mirror is
//     a pure function of its props); the exposed state IS the `ready` prop
//     plus the [`BlankCanvasSize`] values the host measured.
//   * Vue rounds with `Math.round` (half toward +Infinity); the pure functions
//     mirror that with [`blank_canvas_round_px`], so a 10.5px box reads 11 in
//     both forms instead of Rust's default half-away-from-zero 10.
//   * The props are named `aria_label` / `overlay` / `ready`: Vue's
//     `ariaLabel` / `overlay` slot / `ready` ref. `onMount`, `onResize` and
//     `onUnmount` are NOT mirrored as props — the host owns the observer that
//     fires them (see the delta above), and a prop that can never fire would
//     be a dead channel.
//
// No literal UI text is rendered (every string reaches the mirror through a
// slot or prop), so this component introduces NO `hikari_i18n::t` key.

use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct BlankCanvasComponent;

/// The root layer: a 100% x 100% relative box (see the sheet).
pub const BLANK_CANVAS_CLASS: &str = "hk-blank-canvas";

/// The mount layer the host's renderer draws into (`position: absolute;
/// inset: 0`, so the renderer's own measurement agrees with its surface).
pub const BLANK_CANVAS_MOUNT_CLASS: &str = "hk-blank-canvas-mount";

/// The overlay layer drawn above the mount (device cards, leader lines, HUD).
pub const BLANK_CANVAS_OVERLAY_CLASS: &str = "hk-blank-canvas-overlay";

/// The size a host renderer is told about, in WHOLE CSS pixels — Vue's
/// `BlankCanvasSize` (`Math.round(rect.width)` / `Math.round(rect.height)`).
#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub struct BlankCanvasSize {
    pub width: u32,
    pub height: u32,
}

impl BlankCanvasSize {
    /// The 0 x 0 box Vue starts from (`ref({ width: 0, height: 0 })`) and the
    /// one it reports when the mount element is not attached yet.
    pub const ZERO: BlankCanvasSize = BlankCanvasSize {
        width: 0,
        height: 0,
    };

    pub fn new(width: u32, height: u32) -> Self {
        Self { width, height }
    }
}

/// What the gate decided on one reading — the observable half of Vue's
/// `publish()` (which reports by calling `props.onMount` / `props.onResize`
/// or by returning silently).
#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub enum BlankCanvasEvent {
    /// Nothing to report: a still-0 box, or a later reading with no size
    /// change (Vue returns before any callback).
    #[default]
    None,
    /// The first non-zero box: the host may initialise its renderer now
    /// (Vue: `props.onMount(el, size)`).
    Mount,
    /// A LATER reading that changed the box (Vue: `props.onResize(size)`).
    Resize,
}

/// Vue's `Math.round` semantics for the measured box: half toward +Infinity,
/// so 10.5 -> 11 and -0.5 -> 0 (`f64::round` would give 11 and -1). A
/// non-finite or negative reading clamps to 0 — a box cannot be negative, and
/// a `NaN` reading must never disarm the gate that the whole component exists
/// to enforce.
pub fn blank_canvas_round_px(value: f64) -> u32 {
    if !value.is_finite() || value <= 0.0 {
        return 0;
    }
    let rounded = (value + 0.5).floor();
    if rounded >= u32::MAX as f64 {
        u32::MAX
    } else {
        rounded as u32
    }
}

/// Vue's `measure()`: `getBoundingClientRect()` reduced to whole pixels. The
/// bounding rect is passed in (the vnode layer has no DOM node), which is the
/// only difference from the Vue function body.
pub fn blank_canvas_measure(width: f64, height: f64) -> BlankCanvasSize {
    BlankCanvasSize {
        width: blank_canvas_round_px(width),
        height: blank_canvas_round_px(height),
    }
}

/// Vue's readiness test: BOTH dimensions must be non-zero before the mount
/// callback may fire (`if (next.width === 0 || next.height === 0) return;`).
pub fn blank_canvas_has_size(size: BlankCanvasSize) -> bool {
    size.width != 0 && size.height != 0
}

/// Whether a reading changed the stored box — Vue's
/// `next.width !== size.value.width || next.height !== size.value.height`.
pub fn blank_canvas_size_changed(previous: BlankCanvasSize, next: BlankCanvasSize) -> bool {
    previous.width != next.width || previous.height != next.height
}

/// Vue's `publish()` decision table, without the side effects:
///
/// ```text
///   !ready && box is 0 x 0      -> None      (stay gated, report nothing)
///   !ready && box has a size    -> Mount     (ready := true, onMount(next))
///   ready  && changed           -> Resize    (onResize(next))
///   ready  && unchanged         -> None      (Vue returns untouched)
/// ```
///
/// The stored box is `next` whenever the reading changed (see
/// [`blank_canvas_size_after`]), so the gate never re-fires `Mount` for a
/// later resize — that is exactly Vue's one-shot `ready` flag.
pub fn blank_canvas_publish(
    ready: bool,
    previous: BlankCanvasSize,
    next: BlankCanvasSize,
) -> BlankCanvasEvent {
    let changed = blank_canvas_size_changed(previous, next);
    if !ready {
        if !blank_canvas_has_size(next) {
            return BlankCanvasEvent::None;
        }
        return BlankCanvasEvent::Mount;
    }
    if changed {
        BlankCanvasEvent::Resize
    } else {
        BlankCanvasEvent::None
    }
}

/// Vue's size bookkeeping (`if (changed) size.value = next`): the stored box
/// follows a changed reading and keeps the previous one otherwise.
pub fn blank_canvas_size_after(
    previous: BlankCanvasSize,
    next: BlankCanvasSize,
) -> BlankCanvasSize {
    if blank_canvas_size_changed(previous, next) {
        next
    } else {
        previous
    }
}

/// The `data-ready` presence attribute: Vue emits `data-ready=""` once the
/// gate opened (`data-ready={ready.value ? "" : undefined}`) and omits it
/// entirely before that, so a `[data-ready]` selector can tell the two states
/// apart.
pub fn blank_canvas_data_ready(ready: bool) -> Option<&'static str> {
    if ready { Some("") } else { None }
}

/// The three layer class names in render order (root, mount, overlay),
/// pinned so a sheet rename cannot drift the mirror silently.
pub fn blank_canvas_class_names() -> [&'static str; 3] {
    [
        BLANK_CANVAS_CLASS,
        BLANK_CANVAS_MOUNT_CLASS,
        BLANK_CANVAS_OVERLAY_CLASS,
    ]
}

#[define_props]
pub struct BlankCanvasProps {
    /// The gate state (Vue's `ready` ref): true once the mount element has
    /// been measured at a non-zero size. Driven by the host through
    /// [`blank_canvas_publish`].
    #[default]
    pub ready: bool,

    /// Accessible name for the mount region (Vue `ariaLabel`; omitted when
    /// unset).
    pub aria_label: Option<String>,

    /// The mount content (Vue: the default slot) — what the host renders on
    /// the surface, or the element its renderer takes over.
    pub children: Element,

    /// The overlay content (Vue: the `overlay` slot): DOM drawn ABOVE the
    /// mount. The layer renders even when empty, exactly like Vue.
    pub overlay: Option<Element>,
}

#[component]
pub fn BlankCanvas(props: BlankCanvasProps) -> Element {
    let mount = props.children.clone();
    let overlay = props.overlay.clone().unwrap_or_else(empty_vnode);

    let mount_layer = VElement::new("div")
        .class(BLANK_CANVAS_MOUNT_CLASS)
        .child(mount);
    let overlay_layer = VElement::new("div")
        .class(BLANK_CANVAS_OVERLAY_CLASS)
        .child(overlay);

    let root = VElement::new("div")
        .class(BLANK_CANVAS_CLASS)
        .attr_opt("aria-label", props.aria_label.clone())
        .attr_opt("data-ready", blank_canvas_data_ready(props.ready))
        .child(VNode::Element(Box::new(mount_layer)))
        .child(VNode::Element(Box::new(overlay_layer)));

    VNode::Element(Box::new(root))
}

impl StyledComponent for BlankCanvasComponent {
    fn styles() -> &'static str {
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkBlankCanvas.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "blank-canvas"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn blank_canvas_defaults_match_the_vue_props() {
        let props = BlankCanvasProps::default();
        // Vue starts gated: `const ready = ref(false)`.
        assert!(!props.ready);
        assert!(props.aria_label.is_none());
        assert!(props.overlay.is_none());
        // The default slot is absent until the host fills it.
        assert_eq!(props.children.render_to_html(), "");
    }

    #[test]
    fn blank_canvas_class_names_match_the_vue_sheet() {
        assert_eq!(
            blank_canvas_class_names(),
            [
                "hk-blank-canvas",
                "hk-blank-canvas-mount",
                "hk-blank-canvas-overlay"
            ]
        );
    }

    #[test]
    fn blank_canvas_measure_rounds_half_up_and_clamps_junk() {
        // Math.round: half toward +Infinity (`f64::round` would differ).
        assert_eq!(blank_canvas_round_px(10.5), 11);
        assert_eq!(blank_canvas_round_px(-0.5), 0);
        assert_eq!(blank_canvas_round_px(10.4), 10);
        assert_eq!(blank_canvas_round_px(10.6), 11);
        // A detached element / unmeasurable box reads 0, never NaN.
        assert_eq!(blank_canvas_round_px(f64::NAN), 0);
        assert_eq!(blank_canvas_round_px(f64::INFINITY), 0);
        assert_eq!(blank_canvas_round_px(-12.0), 0);
        assert_eq!(
            blank_canvas_measure(640.4, 480.6),
            BlankCanvasSize::new(640, 481)
        );
        assert_eq!(blank_canvas_measure(0.0, 0.0), BlankCanvasSize::ZERO);
    }

    #[test]
    fn blank_canvas_publish_is_the_vue_gate() {
        let zero = BlankCanvasSize::ZERO;
        let sized = BlankCanvasSize::new(800, 600);
        // Still 0 x 0: the gate stays shut and reports nothing.
        assert_eq!(
            blank_canvas_publish(false, zero, zero),
            BlankCanvasEvent::None
        );
        // Any zero dimension keeps it shut (Vue tests both dimensions).
        assert_eq!(
            blank_canvas_publish(false, zero, BlankCanvasSize::new(800, 0)),
            BlankCanvasEvent::None
        );
        // First non-zero box: the one-shot mount.
        assert_eq!(
            blank_canvas_publish(false, zero, sized),
            BlankCanvasEvent::Mount
        );
        // A resize after the mount is reported once, and only when it changed.
        assert_eq!(
            blank_canvas_publish(true, sized, BlankCanvasSize::new(1024, 768)),
            BlankCanvasEvent::Resize
        );
        assert_eq!(
            blank_canvas_publish(true, sized, sized),
            BlankCanvasEvent::None
        );
        // The gate never re-fires `Mount`, even for a brand-new box.
        assert_eq!(
            blank_canvas_publish(true, sized, BlankCanvasSize::new(1, 1)),
            BlankCanvasEvent::Resize
        );
    }

    #[test]
    fn blank_canvas_size_after_keeps_the_stored_box() {
        let sized = BlankCanvasSize::new(800, 600);
        // A changed reading is stored ...
        assert_eq!(
            blank_canvas_size_after(sized, BlankCanvasSize::new(801, 600)),
            BlankCanvasSize::new(801, 600)
        );
        // ... an unchanged one keeps the previous value.
        assert_eq!(blank_canvas_size_after(sized, sized), sized);
        assert!(blank_canvas_has_size(sized));
        assert!(!blank_canvas_has_size(BlankCanvasSize::new(0, 600)));
    }

    #[test]
    fn blank_canvas_renders_the_three_layers() {
        let html = BlankCanvas(BlankCanvasProps {
            ready: true,
            aria_label: Some("scene surface".to_string()),
            children: rsx! {
                div { class: "host-canvas", "surface" }
            },
            overlay: Some(rsx! {
                button { class: "hud", "hud" }
            }),
        })
        .render_to_html();

        for needle in [
            r#"class="hk-blank-canvas""#,
            r#"class="hk-blank-canvas-mount""#,
            r#"class="hk-blank-canvas-overlay""#,
            r#"aria-label="scene surface""#,
            r#"data-ready=""#,
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        // The mount slot renders INSIDE the mount layer and the overlay slot
        // inside the overlay layer; the mount layer comes first.
        let mount_at = html.find("hk-blank-canvas-mount").expect("mount layer");
        let slot_at = html.find("host-canvas").expect("default slot");
        let overlay_at = html.find("hk-blank-canvas-overlay").expect("overlay layer");
        let hud_at = html.find(r#"class="hud""#).expect("overlay slot");
        assert!(mount_at < slot_at && slot_at < overlay_at, "{html}");
        assert!(overlay_at < hud_at, "{html}");
    }

    #[test]
    fn blank_canvas_gated_render_omits_the_ready_marker() {
        let html = BlankCanvas(BlankCanvasProps {
            ready: false,
            children: rsx! {
                span { "pending" }
            },
            ..Default::default()
        })
        .render_to_html();
        assert!(!html.contains("data-ready"), "{html}");
        assert!(!html.contains("aria-label"), "{html}");
        // The layers still render: the gate only marks the box, it never
        // unmounts the surface (Vue renders the mount unconditionally).
        assert!(html.contains("hk-blank-canvas-mount"), "{html}");
        assert!(html.contains("hk-blank-canvas-overlay"), "{html}");
        assert!(html.contains("pending"), "{html}");
        assert_eq!(blank_canvas_data_ready(false), None);
        assert_eq!(blank_canvas_data_ready(true), Some(""));
    }

    #[test]
    fn blank_canvas_styles_come_from_the_canonical_vue_sheet() {
        let css = BlankCanvasComponent::styles();
        for class in [
            ".hk-blank-canvas",
            ".hk-blank-canvas-mount",
            ".hk-blank-canvas-overlay",
        ] {
            assert!(
                css.contains(class),
                "blank canvas css must carry the vue class {class:?}"
            );
        }
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored blank canvas sheet"
        );
        assert_eq!(BlankCanvasComponent::name(), "blank-canvas");
    }
}
