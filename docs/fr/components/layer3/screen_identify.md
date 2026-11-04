# Identification d'écran

La famille d'identification d'écran répond à la question que tout environnement multi-écrans pose : **quel écran est-ce ?** L'application décide de la découverte et du numéro ; hikari possède le flash : une grande carte numérotée, un court maintien avec compte à rebours, et la couche sur laquelle elle se peint — au-dessus de toutes les popups, le voile des modales compris.

## Utilisation de base

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

| Propriété | Description | Type | Défaut |
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


## Comportement et limites

- Le maintien par défaut est de **3000 ms** ; `duration_ms: Some(0)` garde la carte jusqu'à `dismiss()`.
- Un second `show` redémarre le flash sans empiler les cartes ni hériter de l'ancienne échéance.
- La carte imprime des secondes entières (3 → 2 → 1) via le chiffre roulant partagé ; un maintien > 9 s rognerait la dizaine — gardez l'identification en secondes simples.
- Un tick ne fait que rapporter le reste ; le tick qui franchit l'échéance termine le flash — aucune image à reste nul n'est peinte.
- La carte est un HUD : elle n'intercepte jamais le pointeur (`pointer-events: none`) et le coin gauche/droite s'inverse en RTL (placement logique).
- Montez `ScreenIdentifyHost` une fois par fenêtre ; le reste appelle `show_screen_identify()` (singleton de module, comme Vue).

## Rapport avec la forme Vue

Cette famille reflète `useScreenIdentify` / `HkScreenIdentifyCard` / `HkScreenIdentifyHost` / `HkAmbientLayer` de Vue et compile les **mêmes** feuilles vendorisées (`HkScreenIdentifyCard.scss`, `HkAmbientLayer.scss`) : même grammaire de carte, même bande HUD. La forme Vue porte la couche avec `#hk-hud-root` ; la forme Rust n'ayant pas de Teleport, le wrapper d'`AmbientLayer` porte lui-même la bande (`calc(var(--hk-z-hud, 90050) + (zIndex - 1))`).
