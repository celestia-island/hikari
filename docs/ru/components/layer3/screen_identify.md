# Идентификация экрана

Семейство идентификации экрана отвечает на вопрос, который возникает в любой многоэкранной конфигурации: **какой это экран?** Приложение решает, как экраны находят друг друга и какой номер несёт каждый; hikari владеет вспышкой: большая нумерованная карточка, короткая выдержка с обратным отсчётом и слой, на котором она рисуется — выше всех попапов, включая затемнение модального окна.

## Базовое использование

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

| Свойство | Описание | Тип | По умолчанию |
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


## Поведение и границы

- Выдержка по умолчанию — **3000 мс**; `duration_ms: Some(0)` держит карточку до `dismiss()`.
- Повторный `show` перезапускает вспышку, не наследуя прежний дедлайн и не стопоря карточки.
- Карточка печатает целые секунды (3 → 2 → 1) общим «катящимся» цифровым элементом; выдержка > 9 с обрежет десятки — держите идентификацию в однозначных секундах.
- Тик только сообщает остаток; тик, пересекающий дедлайн, завершает вспышку — кадр с нулевым остатком не рисуется.
- Карточка — это HUD: она не перехватывает указатель (`pointer-events: none`) левые/правые углы зеркалятся при RTL, а верхние/нижние края остаются на месте (логическое позиционирование).
- Смонтируйте `ScreenIdentifyHost` по одному разу на окно; всё остальное вызывает `show_screen_identify()` (модульный синглтон, как в Vue).

## Связь с формой Vue

Семейство зеркалит `useScreenIdentify` / `HkScreenIdentifyCard` / `HkScreenIdentifyHost` / `HkAmbientLayer` из Vue и компилирует **те же** vendored-листы (`HkScreenIdentifyCard.scss`, `HkAmbientLayer.scss`), поэтому грамматика карточки и полоса HUD совпадают. В форме Vue слой несёт `#hk-hud-root`; в форме Rust Teleport нет, поэтому полосу несёт сам wrapper `AmbientLayer` (`calc(var(--hk-z-hud, 90050) + (zIndex - 1))`).
