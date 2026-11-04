# Identificación de pantalla

La familia de identificación de pantalla responde a la pregunta que todo montaje multiusuario plantea: **¿qué pantalla es esta?** La app decide el descubrimiento y el número; hikari posee el destello: una tarjeta grande numerada, una breve permanencia con cuenta atrás y la capa sobre la que se pinta — por encima de todas las ventanas emergentes, incluido el velo del modal.

## Uso básico

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

| Propiedad | Descripción | Tipo | Defecto |
|------|------|------|--------|
| `show_screen_identify(request)` | starts or restarts the flash | `ScreenIdentifyRequest` | — |
| `dismiss_screen_identify()` | hides the flash immediately | — | — |
| `use_screen_identify()` | returns `ScreenIdentifyContext` (read-only `state()`, `show`, `dismiss`) | `ScreenIdentifyContext` | — |
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


## Comportamiento y límites

- La permanencia por defecto es **3000 ms**; `duration_ms: Some(0)` mantiene la tarjeta hasta `dismiss()`.
- Un segundo `show` reinicia el destello sin apilar tarjetas ni heredar la fecha límite anterior.
- La tarjeta imprime segundos enteros (3 → 2 → 1) con el dígito rodante compartido; una permanencia > 9 s recortaría la decena, mantén la identificación en segundos de una cifra.
- Un tick solo informa del resto; el tick que cruza la fecha límite termina el destello — nunca se pinta un fotograma con resto cero.
- La tarjeta es un HUD: nunca intercepta el puntero (`pointer-events: none`) y la esquina izquierda/derecha se refleja en RTL (posición lógica).
- Monta `ScreenIdentifyHost` una vez por ventana; el resto llama a `show_screen_identify()` (singleton de módulo, como en Vue).

## Relación con la forma Vue

Esta familia refleja `useScreenIdentify` / `HkScreenIdentifyCard` / `HkScreenIdentifyHost` / `HkAmbientLayer` de Vue y compila las **mismas** hojas vendorizadas (`HkScreenIdentifyCard.scss`, `HkAmbientLayer.scss`): misma gramática de tarjeta, misma banda HUD. La forma Vue lleva la capa con `#hk-hud-root`; la forma Rust no tiene Teleport, así que el wrapper de `AmbientLayer` porta la banda (`calc(var(--hk-z-hud, 90050) + (zIndex - 1))`).
