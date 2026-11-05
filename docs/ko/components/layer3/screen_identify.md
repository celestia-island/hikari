# 화면 식별

화면 식별 패밀리는 다중 화면 환경의 가장 흔한 질문에 답합니다: **이 화면은 몇 번인가?** 화면 발견과 번호 부여는 앱의 몫이고, hikari는 플래시 자체—큰 번호 카드, 카운트다운이 있는 짧은 표시, 모든 팝업(모달 스크림 포함) 위의 레이어—를 담당합니다.

## 기본 사용법

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

| 속성 | 설명 | 타입 | 기본값 |
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


## 동작과 경계

- 기본 표시 시간은 **3000 ms**이며, `duration_ms: Some(0)`은 `dismiss()`까지 유지합니다.
- 다시 `show`하면 카드를 쌓지 않고 이전 마감 시간도 물려받지 않고 플래시를 재시작합니다.
- 카드는 공유 롤링 숫자로 정수 초(3 → 2 → 1)를 표시합니다. 9초를 넘으면 십의 자리가 잘리므로 식별은 한 자리 초로 유지하세요.
- tick은 남은 시간만 보고하며, 마감을 넘긴 tick이 플래시를 끝냅니다—'남은 0' 프레임은 그려지지 않습니다.
- 카드는 HUD입니다: 포인터 입력을 가로채지 않으며(`pointer-events: none`), RTL에서는 좌우 모서리가 거울처럼 바뀌고 위/아래 변은 그대로입니다(논리 모서리).
- `ScreenIdentifyHost`는 창당 한 번만 마운트하고, 나머지는 `show_screen_identify()`로 구동합니다(Vue와 같은 모듈 싱글턴).

## Vue 형태와의 관계

이 패밀리는 Vue의 `useScreenIdentify` / `HkScreenIdentifyCard` / `HkScreenIdentifyHost` / `HkAmbientLayer`를 미러링하고 **같은** vendored 스타일시트(`HkScreenIdentifyCard.scss`, `HkAmbientLayer.scss`)를 컴파일합니다. Vue 형태는 `#hk-hud-root`가 레이어를 담당하고, Rust 형태는 Teleport가 없어 `AmbientLayer` wrapper가 대역(`calc(var(--hk-z-hud, 90050) + (zIndex - 1))`)을 직접 실습니다.
