// hi-components/src/feedback/tooltip.rs
// Tooltip — mirror of the canonical Vue `HkTooltip` (the lightweight hover /
// focus hint).
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkTooltip.scss`, vendored under
// `src/styles/vue-mirror/` and guarded by
// `tests/vue_mirror_drift_tests.rs`), compiled with `no_hash` so the
// `.hk-tooltip*` class names are literal and identical in both forms. The
// DOM contract below mirrors the Vue render output:
//
//   span.hk-tooltip-wrapper                 (data-position, aria-describedby,
//                                            data-hk-tooltip-anchor)
//     span.hk-tooltip-trigger               (children — the default slot)
//     div#<popupId>.hk-tooltip-popup.hk-tooltip-{placement}
//         [role=tooltip]                    (style: width / max-width)
//       div.hk-tooltip-content              (the `text` prop)
//
// Geometry is a PURE function ([`tooltip_position_declarations`] /
// [`tooltip_position_style`]) mirroring `runtime/tooltipPosition.ts`:
// `TOOLTIP_GAP_PX = 8`, `width: max-content`, the `maxWidth` override and the
// per-placement `translate(...)`. The runtime loop measures the trigger every
// frame while the bubble is up and writes those declarations straight onto the
// popup element (Vue: `applyTooltipPosition` — "the geometry is written
// straight onto the element … so a re-render can never clobber a clamp
// shift"), so positioning never involves a re-render.
//
// Behaviour taken from the Vue component: `mouseenter` / `mouseleave` plus
// `focusin` / `focusout` on the wrapper, a `delay` before the bubble appears
// (default 300 ms), a per-frame trigger-rect tracker while visible, and a
// touch toggle on `pointerdown` whose synthetic mouse events are suppressed
// for 600 ms.
//
// Adaptation deltas vs Vue (deliberate, listed instead of hidden):
//   * NO TELEPORT / NO POPUP MANAGER — the popup renders IN PLACE as the
//     wrapper's second child and `position: fixed` from the sheet lifts it out
//     of flow; the sheet's `--hk-overlay-z-tooltip` (300) is the whole stacking
//     story (Vue takes a band from `usePopupManager` and writes it as an inline
//     `z-index`). Hosts must keep triggers out of transformed or `contain`ed
//     ancestors, exactly like the `HkModal` mirror.
//   * GEOMETRY IS THE MINIMAL (no-zoom, no-clamp) VARIANT — the pure placement
//     math is Vue's, but this wave does NOT implement
//         - the `ancestorZoom(document.body)` division (`runtime/cssZoom.ts`):
//           the factor is 1.0 in every root that carries no CSS zoom,
//         - the measure-and-clamp pass of `applyTooltipPosition`
//           (`runtime/popupBounds.ts` flip + cap + shrink, `viewportGutter`
//           clamp / shift).
//     Consequence: a bubble that would spill past the viewport gutter is not
//     flipped to the opposite side nor capped / shrunk; it keeps its anchor
//     placement. In Vue the clamp pass is additive (it never feeds the base
//     math), so wiring it later changes nothing above this file.
//   * VISIBILITY CARRIER — the bubble is shown / hidden by writing the popup's
//     inline `opacity` (0 ↔ 1), i.e. the exact declaration the sheet's
//     `.hk-tooltip-popup.hk-tooltip-visible` rule carries. Reason (tairitsu
//     0.5.22): component-body hooks are render-scoped — `use_signal` allocates
//     a NEW `Signal` on every render and element refs are never populated by
//     the host — so a `visible` flag that only lives for one render would be
//     reset by any parent re-render (and flipping it would itself force a
//     re-render from inside a hover handler). The runtime handles below are
//     therefore plain `Rc<Cell<_>>` writes into the DOM, and the class stays in
//     the sheet for the Vue form and for hosts that set it themselves.
//   * ARIA — `aria-describedby` is rendered STATICALLY on the wrapper (the
//     popup node always exists here, so the link is always valid; Vue links it
//     only while its lazily mounted popup exists). Same reading behaviour for
//     AT: focusing the trigger announces the description.
//   * LAZY MOUNT (`everShown`) is not reproduced — the popup node is rendered
//     from the first paint (hidden by the sheet's `opacity: 0`) instead of
//     being mounted on the first engage, and nothing registers / unregisters
//     with the popup manager.
//   * TOUCH — `pointerdown` with `pointerType === "touch"` toggles the bubble
//     immediately (no delay) and suppresses the tap's synthetic mouse events
//     for 600 ms, like Vue. NOT reproduced: Vue's document-level `pointerdown`
//     listener that closes the bubble on the next tap anywhere else — tairitsu
//     exposes no `addEventListener` API, so a tap outside leaves the bubble up
//     until the trigger is tapped again.
//   * NO FOCUS TRAP / NO `afterLeave` — there is no leave transition driver, so
//     there is no "finished leaving" edge to report.
//   * The tag-id sequence (`hk-tooltip-{n}`) is Vue's format, but the id is
//     re-allocated per render instead of once per instance (see the state note
//     above); the measurement hook (`data-hk-tooltip-anchor`) carries the SAME
//     value, so a handler and its element can never disagree.
// Replaces the retired legacy `Tooltip` (portal `PortalEntry::Tooltip`, the
// `content` / `arrow` props, `delay: Option<u64>`, a trigger rect faked from the
// mouse coordinates, and the `.hk-tooltip-*` legacy sheet).

use std::cell::Cell;
use std::rc::Rc;
use std::sync::atomic::{AtomicU32, Ordering};

use tairitsu_vdom::{PointerEvent, PointerType};

use crate::platform;
use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct TooltipComponent;

/// Gap between the trigger box and the bubble, in root visual px
/// (Vue: `TOOLTIP_GAP_PX`).
pub const TOOLTIP_GAP_PX: f64 = 8.0;

/// Hover / focus delay before the bubble appears (Vue's `delay` default).
pub const TOOLTIP_DEFAULT_DELAY_MS: u32 = 300;

/// Window after a touch tap during which the tap's synthetic mouse events are
/// ignored (Vue: `performance.now() - lastTouchAt < 600`).
pub const TOOLTIP_TOUCH_SUPPRESS_MS: f64 = 600.0;

/// The trigger box the placement math consumes, in root visual px:
/// `(left, top, width, height)` — a `DOMRect`'s `x` / `y` / `width` / `height`.
pub type TooltipRect = (f64, f64, f64, f64);

/// Instance sequence for `hk-tooltip-{n}` (Vue: `popupSeq`).
static TOOLTIP_SEQ: AtomicU32 = AtomicU32::new(0);

/// The next popup id, exactly Vue's `hk-tooltip-${++popupSeq}` shape.
pub fn next_tooltip_id() -> String {
    format!(
        "hk-tooltip-{}",
        TOOLTIP_SEQ.fetch_add(1, Ordering::Relaxed) + 1
    )
}

/// The four sides a tooltip can be anchored to (Vue: `TooltipPlacement`).
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum TooltipPlacement {
    #[default]
    Top,
    Bottom,
    Left,
    Right,
}

impl TooltipPlacement {
    /// The `hk-tooltip-{placement}` modifier class exactly as Vue emits it.
    pub fn class_name(self) -> &'static str {
        match self {
            TooltipPlacement::Top => "hk-tooltip-top",
            TooltipPlacement::Bottom => "hk-tooltip-bottom",
            TooltipPlacement::Left => "hk-tooltip-left",
            TooltipPlacement::Right => "hk-tooltip-right",
        }
    }

    /// The bare placement string — the wrapper's `data-position` value and the
    /// `TooltipPlacement` member of `runtime/tooltipPosition.ts`.
    pub fn as_str(self) -> &'static str {
        match self {
            TooltipPlacement::Top => "top",
            TooltipPlacement::Bottom => "bottom",
            TooltipPlacement::Left => "left",
            TooltipPlacement::Right => "right",
        }
    }
}

#[define_props]
pub struct TooltipProps {
    /// The hint text (`hk-tooltip-content`). Required in Vue
    /// (`text: { type: String, required: true }`); the Rust default is the
    /// empty string, so an empty `text` renders an empty bubble.
    #[default]
    pub text: String,

    /// Which side of the trigger the bubble is anchored to.
    #[default]
    pub placement: TooltipPlacement,

    /// Milliseconds between the engage and the bubble (Vue default 300).
    #[default(TOOLTIP_DEFAULT_DELAY_MS)]
    pub delay: u32,

    /// Inline `max-width` override (Vue: `maxWidth`, default `undefined` —
    /// the sheet's own `max-width: 280px` then applies).
    pub max_width: Option<String>,

    /// The trigger (Vue: the default slot), rendered inside
    /// `span.hk-tooltip-trigger`.
    pub children: Element,

    /// Extra class appended to the wrapper (Vue: attribute fallthrough).
    #[default]
    pub class: String,
}

/// Render one CSS length the way the browser expects it. Integral values print
/// without a fractional part (`192px`, not `192.0px`), matching what Vue's
/// template-string `style.top = \`${…}px\`` produces.
fn px(value: f64) -> String {
    format!("{value}px")
}

/// The placement declarations for one trigger rect — the Rust twin of
/// `tooltipPositionStyle()` in `runtime/tooltipPosition.ts`, in the same
/// declaration order (`width`, optional `max-width`, `top`, `left`,
/// `transform`).
///
/// MINIMAL VARIANT (see the file header): the anchor math is Vue's, but the
/// `ancestorZoom(body)` division and the viewport clamp / flip pass of
/// `applyTooltipPosition` are not implemented in this wave. With a zoom-free
/// root (zoom == 1) and a bubble that fits the viewport this output is
/// identical to Vue's.
pub fn tooltip_position_declarations(
    rect: TooltipRect,
    placement: TooltipPlacement,
    max_width: Option<&str>,
) -> Vec<(&'static str, String)> {
    let (left, top, width, height) = rect;
    let right = left + width;
    let bottom = top + height;

    let mut declarations: Vec<(&'static str, String)> = Vec::with_capacity(5);
    // `width: max-content` is the position-independence contract (a fixed
    // element otherwise shrink-to-fits against `viewport - left`).
    declarations.push(("width", "max-content".to_string()));
    if let Some(max_width) = max_width
        && !max_width.is_empty()
    {
        declarations.push(("max-width", max_width.to_string()));
    }

    let (top_px, left_px, transform) = match placement {
        TooltipPlacement::Top => (
            px(top - TOOLTIP_GAP_PX),
            px(left + width / 2.0),
            "translate(-50%, -100%)",
        ),
        TooltipPlacement::Bottom => (
            px(bottom + TOOLTIP_GAP_PX),
            px(left + width / 2.0),
            "translate(-50%, 0)",
        ),
        TooltipPlacement::Left => (
            px(top + height / 2.0),
            px(left - TOOLTIP_GAP_PX),
            "translate(-100%, -50%)",
        ),
        TooltipPlacement::Right => (
            px(top + height / 2.0),
            px(right + TOOLTIP_GAP_PX),
            "translate(0, -50%)",
        ),
    };

    declarations.push(("top", top_px));
    declarations.push(("left", left_px));
    declarations.push(("transform", transform.to_string()));
    declarations
}

/// The same declarations as one inline style string
/// (`"width:max-content;top:192px;left:120px;transform:translate(-50%, -100%)"`).
pub fn tooltip_position_style(
    rect: TooltipRect,
    placement: TooltipPlacement,
    max_width: Option<&str>,
) -> String {
    tooltip_position_declarations(rect, placement, max_width)
        .into_iter()
        .map(|(name, value)| format!("{name}:{value}"))
        .collect::<Vec<_>>()
        .join(";")
}

/// The wrapper's measurement attribute + selector. The value is the popup id,
/// which is unique per render, so two wrappers can never claim the same hook.
fn anchor_selector(anchor: &str) -> String {
    format!("[data-hk-tooltip-anchor=\"{anchor}\"]")
}

/// Measure the wrapper element (`position: relative` inline-flex, i.e. exactly
/// the box Vue's `wrapperRef.getBoundingClientRect()` returns). `None` when the
/// element is not in the document or the platform has no layout (non-browser
/// builds, SSR, unit tests).
#[allow(clippy::let_unit_value)] // native stub element handles are `()`
fn measure_anchor_rect(anchor: &str) -> Option<TooltipRect> {
    let element = platform::query_selector(&anchor_selector(anchor))?;
    let rect = platform::get_bounding_client_rect(&element)?;
    Some((rect.x, rect.y, rect.width, rect.height))
}

/// Write one batch of inline declarations onto the popup element. Returns
/// whether the popup was found — the tracker stops itself when it is not (the
/// element left the document).
#[cfg(all(target_arch = "wasm32", target_os = "unknown"))]
fn write_popup_style(popup_id: &str, declarations: &[(&'static str, String)]) -> bool {
    let Some(element) = platform::get_element_by_id(popup_id) else {
        return false;
    };
    // The popup carries `.hk-tooltip-popup` itself; the class walk is the
    // crate's platform bridge from an `Element` to the stylable `HtmlElement`
    // (self-inclusive).
    let Some(html) = platform::get_element_by_class_upward("hk-tooltip-popup", &element) else {
        return false;
    };
    for (name, value) in declarations {
        platform::set_style_property(&html, name, value);
    }
    true
}

/// Non-browser builds have no inline-style writer (the stub platform exposes no
/// `set_style_property`); the tracker degrades to "popup not found" and stops on
/// its first tick.
#[cfg(not(all(target_arch = "wasm32", target_os = "unknown")))]
fn write_popup_style(_popup_id: &str, _declarations: &[(&'static str, String)]) -> bool {
    false
}

/// Show / hide the bubble by writing its inline `opacity` (see the header note
/// on the visibility carrier: this is the declaration `.hk-tooltip-visible`
/// carries, and it survives a re-render because the diff never re-writes the
/// popup's `style` attribute).
fn set_popup_visible(popup_id: &str, visible: bool) {
    let declarations: [(&'static str, String); 1] = [(
        "opacity",
        if visible {
            "1".to_string()
        } else {
            "0".to_string()
        },
    )];
    write_popup_style(popup_id, &declarations);
}

/// One visible bubble's per-frame tracker (one loop per visible tooltip, like
/// Vue's `trackPositionWhileVisible`).
#[derive(Clone)]
struct PositionLoop {
    popup_id: String,
    anchor: String,
    placement: TooltipPlacement,
    max_width: Option<String>,
    tracking: Rc<Cell<bool>>,
}

/// One animation frame of the tracker: re-measure the trigger, rewrite the
/// anchor declarations and re-arm. Stops on hide, on a lost popup, or on a lost
/// trigger.
fn position_loop_tick(state: PositionLoop) {
    if !state.tracking.get() {
        return;
    }
    let Some(rect) = measure_anchor_rect(&state.anchor) else {
        state.tracking.set(false);
        return;
    };
    let declarations =
        tooltip_position_declarations(rect, state.placement, state.max_width.as_deref());
    if !write_popup_style(&state.popup_id, &declarations) {
        state.tracking.set(false);
        return;
    }
    let next = state;
    platform::request_animation_frame_with_timestamp(move |_timestamp| position_loop_tick(next));
}

/// One rendered tooltip's imperative handles (Vue: the setup-level refs
/// `visible` / `showTimer` / `positionFrame` / `lastTouchAt`).
///
/// These are plain cells, not hooks: tairitsu 0.5.22 component-body hooks are
/// render-scoped (see the file header), so the tooltip keeps its runtime state
/// in the DOM and only holds what a handler must remember between two of its own
/// calls — the delay generation (timer cancellation), the visible flag (touch
/// toggle) and the tracker flag (loop cancellation).
#[derive(Clone)]
struct TooltipRuntime {
    popup_id: String,
    anchor: String,
    placement: TooltipPlacement,
    max_width: Option<String>,
    delay: u32,
    visible: Rc<Cell<bool>>,
    generation: Rc<Cell<u32>>,
    tracking: Rc<Cell<bool>>,
}

impl TooltipRuntime {
    /// Arm the delayed show (Vue: `show()` → `setTimeout(…, props.delay)`).
    /// `platform::set_timeout` has no cancel op in this crate, so a pending show
    /// is invalidated by bumping the generation counter instead.
    fn show(&self) {
        let generation = self.generation.get().wrapping_add(1);
        self.generation.set(generation);
        let this = self.clone();
        let delay = self.delay.min(i32::MAX as u32) as i32;
        platform::set_timeout(
            move || {
                if this.generation.get() != generation {
                    return;
                }
                this.reveal();
            },
            delay,
        );
    }

    /// Show without the delay (Vue: `showNow()`, the touch path).
    fn show_now(&self) {
        // Invalidate any pending delayed show first.
        self.generation.set(self.generation.get().wrapping_add(1));
        self.reveal();
    }

    /// Show the bubble now and start the per-frame tracker.
    fn reveal(&self) {
        self.visible.set(true);
        set_popup_visible(&self.popup_id, true);
        self.tracking.set(true);
        position_loop_tick(PositionLoop {
            popup_id: self.popup_id.clone(),
            anchor: self.anchor.clone(),
            placement: self.placement,
            max_width: self.max_width.clone(),
            tracking: self.tracking.clone(),
        });
    }

    /// Hide the bubble, cancel the pending show and stop the tracker
    /// (Vue: `hide()`).
    fn hide(&self) {
        self.generation.set(self.generation.get().wrapping_add(1));
        self.visible.set(false);
        self.tracking.set(false);
        set_popup_visible(&self.popup_id, false);
    }

    /// Touch toggle (Vue's `onPointerdown` touch branch).
    fn toggle(&self) {
        if self.visible.get() {
            self.hide();
        } else {
            self.show_now();
        }
    }
}

#[component]
pub fn Tooltip(props: TooltipProps) -> Element {
    let popup_id = next_tooltip_id();
    // The measurement hook shares the popup id, so the handler-side key and the
    // rendered attribute are the same string by construction.
    let anchor = popup_id.clone();

    let runtime = TooltipRuntime {
        popup_id: popup_id.clone(),
        anchor: anchor.clone(),
        placement: props.placement,
        max_width: props.max_width.clone(),
        delay: props.delay,
        visible: Rc::new(Cell::new(false)),
        generation: Rc::new(Cell::new(0)),
        tracking: Rc::new(Cell::new(false)),
    };
    // Vue's `lastTouchAt`, with the same `-Infinity` sentinel (a plain 0 would
    // suppress hover for the first 600 ms of page life).
    let last_touch_at = Rc::new(Cell::new(f64::NEG_INFINITY));

    let on_mouseenter = {
        let runtime = runtime.clone();
        let last_touch_at = last_touch_at.clone();
        move |_event: MouseEvent| {
            // Synthetic mouseenter right after a touch tap must not re-open the
            // bubble the tap just toggled.
            if platform::now_timestamp() - last_touch_at.get() < TOOLTIP_TOUCH_SUPPRESS_MS {
                return;
            }
            runtime.show();
        }
    };

    let on_mouseleave = {
        let runtime = runtime.clone();
        move |_event: MouseEvent| {
            runtime.hide();
        }
    };

    // `focusin` / `focusout` bubble out of the trigger (the wrapper itself is
    // not focusable), which is why Vue uses them instead of `focus` / `blur`.
    // They are not in the rsx macro's typed-event table, so the handler receives
    // the boxed event (`Box<dyn EventData>`) and ignores it.
    let on_focusin = {
        let runtime = runtime.clone();
        move |_event: Box<dyn EventData>| {
            runtime.show();
        }
    };

    let on_focusout = {
        let runtime = runtime.clone();
        move |_event: Box<dyn EventData>| {
            runtime.hide();
        }
    };

    let on_pointerdown = {
        let runtime = runtime.clone();
        let last_touch_at = last_touch_at.clone();
        move |event: PointerEvent| {
            if !matches!(event.pointer_type, PointerType::Touch) {
                return;
            }
            last_touch_at.set(platform::now_timestamp());
            runtime.toggle();
        }
    };

    let wrapper_classes = {
        let mut classes = String::from("hk-tooltip-wrapper");
        if !props.class.is_empty() {
            classes.push(' ');
            classes.push_str(&props.class);
        }
        classes
    };

    // Vue keeps only the popup-manager z on the vnode and leaves the geometry to
    // the element; here the vnode style is the position-independent box
    // (`width: max-content` + the `maxWidth` override) and the anchor
    // declarations are written per frame.
    let popup_style = match props.max_width.as_deref() {
        Some(max_width) if !max_width.is_empty() => {
            format!("width:max-content;max-width:{max_width}")
        }
        _ => "width:max-content".to_string(),
    };

    let popup_classes = format!("hk-tooltip-popup {}", props.placement.class_name());

    rsx! {
        span {
            class: wrapper_classes,
            "data-position": props.placement.as_str(),
            "data-hk-tooltip-anchor": anchor,
            "aria-describedby": popup_id.clone(),
            onmouseenter: on_mouseenter,
            onmouseleave: on_mouseleave,
            onfocusin: on_focusin,
            onfocusout: on_focusout,
            onpointerdown: on_pointerdown,
            span { class: "hk-tooltip-trigger",
                {props.children.clone()}
            }
            div {
                id: popup_id,
                class: popup_classes,
                style: popup_style,
                "role": "tooltip",
                div { class: "hk-tooltip-content",
                    "{props.text}"
                }
            }
        }
    }
}

impl StyledComponent for TooltipComponent {
    fn styles() -> &'static str {
        // The canonical Vue sheet, compiled verbatim (no_hash keeps the
        // `.hk-tooltip*` names literal so this CSS matches the Vue build).
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkTooltip.scss", no_hash }
            .0
    }

    fn name() -> &'static str {
        "tooltip"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The same trigger box the canonical Vue suite uses
    /// (`runtime/tooltipPosition.test.ts`: a 100x40 rect at (200, 100)), so the
    /// numbers below are drop-in comparable with the Vue assertions.
    const RECT: TooltipRect = (200.0, 100.0, 100.0, 40.0);

    #[test]
    fn tooltip_placement_class_names_match_the_vue_modifiers() {
        assert_eq!(TooltipPlacement::Top.class_name(), "hk-tooltip-top");
        assert_eq!(TooltipPlacement::Bottom.class_name(), "hk-tooltip-bottom");
        assert_eq!(TooltipPlacement::Left.class_name(), "hk-tooltip-left");
        assert_eq!(TooltipPlacement::Right.class_name(), "hk-tooltip-right");
        assert_eq!(TooltipPlacement::Top.as_str(), "top");
        assert_eq!(TooltipPlacement::Bottom.as_str(), "bottom");
        assert_eq!(TooltipPlacement::Left.as_str(), "left");
        assert_eq!(TooltipPlacement::Right.as_str(), "right");
    }

    #[test]
    fn tooltip_props_defaults_match_the_vue_props() {
        let props = TooltipProps::default();
        assert_eq!(props.text, "");
        assert_eq!(props.placement, TooltipPlacement::Top);
        assert_eq!(props.delay, 300);
        assert!(props.max_width.is_none());
        assert_eq!(props.class, "");
    }

    #[test]
    fn tooltip_gap_matches_the_vue_constant() {
        assert_eq!(TOOLTIP_GAP_PX, 8.0);
        assert_eq!(TOOLTIP_DEFAULT_DELAY_MS, 300);
        assert_eq!(TOOLTIP_TOUCH_SUPPRESS_MS, 600.0);
    }

    #[test]
    fn tooltip_top_placement_anchors_above_the_trigger() {
        // Vue: top.top === "92px" (100 - 8), top.left === "250px" (hcenter).
        let style = tooltip_position_style(RECT, TooltipPlacement::Top, None);
        assert_eq!(
            style,
            "width:max-content;top:92px;left:250px;transform:translate(-50%, -100%)"
        );
        assert!(style.contains("top:92px"), "top = rect.top - gap: {style}");
        assert!(
            style.contains("left:250px"),
            "left = rect.left + width / 2: {style}"
        );
        assert!(
            style.contains("transform:translate(-50%, -100%)"),
            "top placement translates up over the anchor: {style}"
        );
    }

    #[test]
    fn tooltip_bottom_placement_anchors_below_the_trigger() {
        // Vue: bottom.top === "148px" (140 + 8), transform translate(-50%, 0).
        let style = tooltip_position_style(RECT, TooltipPlacement::Bottom, None);
        assert!(
            style.contains("top:148px"),
            "top = rect.bottom + gap: {style}"
        );
        assert!(
            style.contains("left:250px"),
            "centered horizontally: {style}"
        );
        assert!(style.contains("transform:translate(-50%, 0)"), "{style}");
    }

    #[test]
    fn tooltip_left_placement_anchors_before_the_trigger() {
        // Vue: left.left === "192px" (200 - 8), left.top === "120px" (vcenter).
        let style = tooltip_position_style(RECT, TooltipPlacement::Left, None);
        assert!(style.contains("top:120px"), "centered vertically: {style}");
        assert!(
            style.contains("left:192px"),
            "left = rect.left - gap: {style}"
        );
        assert!(
            style.contains("transform:translate(-100%, -50%)"),
            "{style}"
        );
    }

    #[test]
    fn tooltip_right_placement_anchors_after_the_trigger() {
        // Vue: right.left === "308px" (300 + 8), transform translate(0, -50%).
        let style = tooltip_position_style(RECT, TooltipPlacement::Right, None);
        assert!(style.contains("top:120px"), "centered vertically: {style}");
        assert!(
            style.contains("left:308px"),
            "left = rect.right + gap: {style}"
        );
        assert!(style.contains("transform:translate(0, -50%)"), "{style}");
    }

    #[test]
    fn tooltip_max_width_overrides_the_sheet_cap() {
        let style = tooltip_position_style(RECT, TooltipPlacement::Top, Some("180px"));
        assert!(style.contains("max-width:180px"), "{style}");
        // Vue writes `width` first and `max-width` right after it.
        assert!(
            style.starts_with("width:max-content;max-width:180px;"),
            "declaration order: {style}"
        );
        // Unset (or empty) leaves the sheet's own 280px cap in charge.
        let unset = tooltip_position_style(RECT, TooltipPlacement::Top, None);
        assert!(!unset.contains("max-width"), "{unset}");
        let empty = tooltip_position_style(RECT, TooltipPlacement::Top, Some(""));
        assert!(!empty.contains("max-width"), "{empty}");
    }

    #[test]
    fn tooltip_declarations_keep_the_vue_property_order() {
        let declarations = tooltip_position_declarations(RECT, TooltipPlacement::Top, None);
        let names: Vec<&str> = declarations.iter().map(|(name, _)| *name).collect();
        assert_eq!(names, vec!["width", "top", "left", "transform"]);
    }

    #[test]
    fn tooltip_fractional_geometry_prints_without_a_trailing_zero() {
        use super::px;
        assert_eq!(px(192.0), "192px");
        assert_eq!(px(192.5), "192.5px");
        assert_eq!(px(-8.0), "-8px");
    }

    #[test]
    fn tooltip_ids_follow_the_vue_sequence_shape() {
        let first = next_tooltip_id();
        let second = next_tooltip_id();
        assert!(first.starts_with("hk-tooltip-"), "{first}");
        assert_ne!(first, second, "ids are unique");
        let selector = anchor_selector(&first);
        assert_eq!(
            selector,
            format!("[data-hk-tooltip-anchor=\"{first}\"]"),
            "the measurement hook carries the popup id verbatim"
        );
    }

    #[test]
    fn tooltip_styles_come_from_the_canonical_vue_sheet() {
        let css = TooltipComponent::styles();
        assert!(
            css.contains(".hk-tooltip-wrapper") && css.contains(".hk-tooltip-trigger"),
            "tooltip css must carry the vue wrapper/trigger classes"
        );
        assert!(
            css.contains(".hk-tooltip-popup") && css.contains(".hk-tooltip-visible"),
            "tooltip css must carry the popup + visibility classes"
        );
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored tooltip sheet"
        );
    }
}
