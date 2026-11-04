# Screen Identify

The screen-identify family answers one question every multi-screen setup has: **which screen is this?** The app decides how screens discover each other and which number each one carries; hikari owns the flash: a large numbered card, a short dwell with a countdown, and the layer it paints on — above every popup, the modal backdrop included.

## Basic usage

```rust
use hikari_components::overlay::{
    ScreenIdentifyHost, ScreenIdentifyRequest, show_screen_identify,
};
use hikari_components::prelude::*;

// Mount once per window: the host paints whatever the singleton holds.
rsx! {
    ScreenIdentifyHost {}
    // …the app
}

// from anywhere (a tray button, a board node, a shortcut):
show_screen_identify(
    ScreenIdentifyRequest::new("7").with_name("Wall B"),
);
```

`ScreenIdentifyCard` can also be mounted directly when the caller already
owns the state and the layer; `AmbientLayer` hosts any annotation above the
popups.


## API

| Property | Description | Type | Default |
|------|------|------|--------|
| `show_screen_identify(request)` | starts or restarts the flash | `ScreenIdentifyRequest` | — |
| `dismiss_screen_identify()` | hides the flash immediately | — | — |
| `use_screen_identify()` | returns `ScreenIdentifyContext` (`state`, `show`, `dismiss`) | `ScreenIdentifyContext` | — |
| `ScreenIdentifyRequest` / `number` | fleet number or any short label | `String` | — |
| `ScreenIdentifyRequest` / `name` | stable screen name line | `Option<String>` | `None` |
| `ScreenIdentifyRequest` / `duration_ms` | dwell; `Some(0)` holds open | `Option<u64>` | `None` → 3000 |
| `ScreenIdentifyHost` / `placement` | card corner | `ScreenIdentifyPlacement` | `BottomLeft` |
| `ScreenIdentifyHost` / `label` | accessible-name override | `Option<String>` | composed |
| `ScreenIdentifyCard` / `number` | the printed number | `String` | — |
| `ScreenIdentifyCard` / `name` | printed under the number | `Option<String>` | `None` |
| `ScreenIdentifyCard` / `seconds_left` | whole seconds; 0 hides the badge | `u32` | `0` |
| `ScreenIdentifyCard` / `placement` | card corner | `ScreenIdentifyPlacement` | `BottomLeft` |
| `ScreenIdentifyCard` / `label` | accessible-name override | `Option<String>` | composed |
| `AmbientLayer` / `pointer_events` | content pointer opt-in | `AmbientLayerPointerEvents` | `None` |
| `AmbientLayer` / `z_index` | order among ambient layers | `i32` | `1` |
| `AmbientLayer` / `label` | landmark name | `Option<String>` | `None` |
| `AmbientLayer` / `children` | the annotation | `Element` | — |
| `SCREEN_IDENTIFY_DEFAULT_MS` | default dwell | `u64` | `3000` |
| `SCREEN_IDENTIFY_TICK_MS` | countdown tick | `u32` | `100` |
| `AMBIENT_LAYER_DOCUMENT_Z` | HUD document band | `i32` | `90050` |


## Behaviour and boundaries

- The default dwell is **3000 ms**; `duration_ms: Some(0)` holds the card open until `dismiss()` is called.
- A second `show` restarts the flash instead of stacking cards or inheriting the old deadline.
- The card prints whole seconds (3 → 2 → 1) through the shared rolling countdown digit; a dwell above 9 s would clip the tens digit, so keep identify in single digits.
- A tick only reports the remainder; the tick that crosses the deadline ends the flash — the flash never paints a zero-remainder frame.
- The card is a HUD: it never intercepts pointer input (`pointer-events: none`), and the physical left/right corner mirrors under RTL (logical placement).
- Mount `ScreenIdentifyHost` once per window; everything else calls `show_screen_identify()` (a module singleton, like Vue's `showScreenIdentify`).

## Relationship to the Vue form

This family mirrors the canonical Vue `useScreenIdentify` / `HkScreenIdentifyCard` / `HkScreenIdentifyHost` / `HkAmbientLayer` and compiles the **same** vendored stylesheets (`HkScreenIdentifyCard.scss`, `HkAmbientLayer.scss`), so both forms render the same card grammar and the same HUD band. The Vue form owns the layer with `#hk-hud-root`; the Rust form has no Teleport, so `AmbientLayer`'s wrapper itself carries the band (`calc(var(--hk-z-hud, 90050) + (zIndex - 1))`).
