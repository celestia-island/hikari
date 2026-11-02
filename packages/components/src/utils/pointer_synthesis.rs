// hi-components/src/utils/pointer_synthesis.rs
// The mouse → pointer seam for the wasm32-wasip2 host (ledger L88).
//
// The tairitsu browser glue type-dispatches only the mouse family
// (`mouseenter` / `mouseleave` / `mousemove` / `mousedown` / `mouseup` / `click` /
// `dblclick` / `mouseover` / `mouseout` / `contextmenu` / `wheel`) plus keyboard,
// focus and `input`/`change`; every `pointer*` event rides `onGenericEvent`,
// whose payload is the type string and a live handle with NO data. A component
// that binds `pointerdown` therefore never runs, and the pointer-typed public
// props of the mirrors (`display/image_viewer.rs`, `scene/board.rs`) would never
// fire at all.
//
// They keep the DURABLE public shape instead — `EventHandler<PointerEvent>`,
// matching the Vue canonical and the eventual wire — and feed it from the mouse
// channel through [`pointer_from_mouse`]. This is TEMPORARY scaffolding, not a
// design: the WIT interface already declares the `pointer-event` /
// `wheel-event` / `mouse-event` data getters and the host imports them without
// implementing them. Once the upstream glue fills those in, the props receive
// REAL `PointerEvent`s and every `pointer_from_mouse` call site (plus this
// module) can be deleted.
//
// ── what the synthesis carries ────────────────────────────────────────────
// The mouse event's own coordinates (`client` / `screen` / `page` / `offset` /
// `movement`), `button` / `buttons`, the four modifier keys, the `target` /
// `current_target` handles, and the LIVE WIT handle — so `prevent_default` and
// `stop_propagation` called on the delivered payload still reach the browser.
//
// ── what it CANNOT carry (declared, not silently wrong) ───────────────────
//   * `pointer_type` is always [`PointerType::Mouse`]: the mouse channel cannot
//     observe a pen or a touch pointer, so pointer-type-driven behaviour (pen
//     hover, stylus pressure) cannot fire on this wire.
//   * `pointer_id` is always [`MOUSE_POINTER_ID`]. A mouse is ONE device, so
//     per-pointer identity is unavailable and every multi-pointer gesture
//     (two-finger pinch, per-pointer capture bookkeeping) is unreachable from
//     these props. The exact number is not spec-mandated: the Pointer Events
//     spec lets a user agent RESERVE `0` or `1` for the primary mouse pointer,
//     so neither value may be hard-coded by a consumer — see the constant.
//   * `is_primary` is always `true` (a mouse is always the primary pointer).
//   * `width` / `height` / `pressure` / `tangential_pressure` / `tilt_x` /
//     `tilt_y` / `twist` keep their `PointerEvent` defaults: a `MouseEvent`
//     carries no contact geometry. They are UNKNOWN, not measured zero; a host
//     that needs them must drive its own pointer source.

use tairitsu_vdom::{EventWitHandle, MouseEvent, PointerEvent, PointerType};

/// The `pointer_id` a synthesised mouse pointer reports: `1`.
///
/// NOT a spec constant. The Pointer Events spec permits a user agent to RESERVE
/// `0` **or** `1` for the primary mouse pointer, and browsers in practice report
/// `1`; the mirror picks the observed value so a host that keys its press
/// bookkeeping by `pointer_id` sees what it would see through a typed pointer
/// channel. A consumer must not treat either number as a guaranteed identity —
/// a mouse is one pointer here regardless, and `is_primary` is what says so.
pub const MOUSE_POINTER_ID: i32 = 1;

/// Convert a [`MouseEvent`] into the [`PointerEvent`] it stands for.
///
/// See the module doc for exactly what survives the conversion and what is
/// declared unknown. Kept as one shared helper so `display/image_viewer.rs` and
/// `scene/board.rs` cannot drift, and so the whole seam disappears from one
/// place when the upstream glue learns to type the pointer family.
pub fn pointer_from_mouse(event: &MouseEvent) -> PointerEvent {
    let pointer = PointerEvent::new()
        .pointer_type(PointerType::Mouse)
        .pointer_id(MOUSE_POINTER_ID)
        .is_primary(true)
        .client_x(event.client_x)
        .client_y(event.client_y)
        .screen_x(event.screen_x)
        .screen_y(event.screen_y)
        .offset_x(event.offset_x)
        .offset_y(event.offset_y)
        .page_x(event.page_x)
        .page_y(event.page_y)
        .movement_x(event.movement_x)
        .movement_y(event.movement_y)
        .button(event.button)
        .buttons(event.buttons)
        .ctrl_key(event.ctrl_key)
        .shift_key(event.shift_key)
        .alt_key(event.alt_key)
        .meta_key(event.meta_key)
        // The wit dispatcher's own convention: a missing handle reads as 0.
        .target(event.target.unwrap_or(0))
        .current_target(event.current_target.unwrap_or(0));
    match event.wit_handle() {
        Some(handle) => pointer.event_handle(EventWitHandle::from_wit(handle)),
        None => pointer,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn mouse() -> MouseEvent {
        MouseEvent::new()
            .client_x(12)
            .client_y(-4)
            .screen_x(200)
            .screen_y(300)
            .offset_x(5)
            .offset_y(6)
            .page_x(7)
            .page_y(8)
            .movement_x(1)
            .movement_y(-1)
            .button(0)
            .buttons(1)
            .ctrl_key(true)
            .shift_key(false)
            .alt_key(true)
            .meta_key(false)
            .target(42)
            .current_target(43)
    }

    #[test]
    fn coordinates_buttons_and_modifiers_survive_the_conversion() {
        let pointer = pointer_from_mouse(&mouse());
        assert_eq!(pointer.client_x, 12);
        assert_eq!(pointer.client_y, -4);
        assert_eq!(pointer.screen_x, 200);
        assert_eq!(pointer.screen_y, 300);
        assert_eq!(pointer.offset_x, 5);
        assert_eq!(pointer.offset_y, 6);
        assert_eq!(pointer.page_x, 7);
        assert_eq!(pointer.page_y, 8);
        assert_eq!(pointer.movement_x, 1);
        assert_eq!(pointer.movement_y, -1);
        assert_eq!(pointer.button, 0);
        assert_eq!(pointer.buttons, 1);
        assert!(pointer.ctrl_key);
        assert!(!pointer.shift_key);
        assert!(pointer.alt_key);
        assert!(!pointer.meta_key);
        assert_eq!(pointer.target, Some(42));
        assert_eq!(pointer.current_target, Some(43));
    }

    #[test]
    fn identity_reads_as_the_primary_mouse_pointer() {
        let pointer = pointer_from_mouse(&mouse());
        assert_eq!(pointer.pointer_type, PointerType::Mouse);
        // The value browsers report for the primary mouse pointer. The spec only
        // permits RESERVING 0 or 1, so this pins OUR choice, not a guarantee.
        assert_eq!(pointer.pointer_id, 1);
        assert_eq!(MOUSE_POINTER_ID, 1);
        assert!(pointer.is_primary);
    }

    #[test]
    fn contact_geometry_stays_unknown_rather_than_invented() {
        let pointer = pointer_from_mouse(&mouse());
        // A MouseEvent carries no contact area / pressure / tilt / twist, so the
        // conversion must not fabricate them.
        assert_eq!(pointer.width, 0.0);
        assert_eq!(pointer.height, 0.0);
        assert_eq!(pointer.pressure, 0.0);
        assert_eq!(pointer.tangential_pressure, 0.0);
        assert_eq!(pointer.tilt_x, 0);
        assert_eq!(pointer.tilt_y, 0);
        assert_eq!(pointer.twist, 0);
    }
}
