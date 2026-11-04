# 辨識螢幕

辨識螢幕元件族回答多螢幕情境裡最常見的一個問題：**這塊螢幕是幾號？** 應用負責螢幕探索與編號；hikari 負責閃爍本身——大號數字卡、帶倒數的短暫駐留，以及它所在的階層（蓋過所有彈窗，含遮罩）。

## 基礎用法

```hikari
use hikari_components::overlay::{
    ScreenIdentifyHost, ScreenIdentifyProvider, ScreenIdentifyRequest, use_screen_identify,
};
use hikari_components::prelude::*;

// Mount once: the provider owns the dwell, the host paints the card.
rsx! {
    ScreenIdentifyProvider {
        ScreenIdentifyHost {}
        // …the app
    }
}

// anywhere below the provider (a tray button, a board node, a shortcut):
let identify = use_screen_identify();
identify.show.call(
    ScreenIdentifyRequest::new("7").with_name("Wall B"),
);
```

`ScreenIdentifyCard` can also be mounted directly when the caller already
owns the state and the layer; `AmbientLayer` hosts any annotation above the
popups.


## API

| 屬性 | 說明 | 型別 | 預設值 |
|------|------|------|--------|
| `ScreenIdentifyProvider` / `children` | mounts the context; once per window | `Element` | — |
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


## 行為與邊界

- 預設駐留 **3000 ms**；`duration_ms: Some(0)` 表示常駐，直到呼叫 `dismiss()`。
- 再次 `show` 會重啟閃爍，不會疊卡，也不會繼承舊截止時間。
- 卡片用共享的滾動數字列印整秒（3 → 2 → 1）；駐留超過 9 秒會裁掉十位，辨識是「一眼」動作，請保持個位數。
- tick 只回報剩餘時間；跨越截止時間的那次 tick 結束閃爍——永遠不會畫出「剩餘 0」的一幀。
- 卡片是 HUD：不攔截指標（`pointer-events: none`）；RTL 下用邏輯角位，卡片仍在玻璃的同一個角。
- 每個視窗只掛一次 `ScreenIdentifyProvider` 與 `ScreenIdentifyHost`；其他任何位置用 `use_screen_identify()` 驅動。

## 與 Vue 形態的關係

本族鏡像 Vue 的 `useScreenIdentify` / `HkScreenIdentifyCard` / `HkScreenIdentifyHost` / `HkAmbientLayer`，編譯**同一份** vendored 樣式表（`HkScreenIdentifyCard.scss`、`HkAmbientLayer.scss`），兩種形態的卡片語法與 HUD 帶完全一致。Vue 形態用 `#hk-hud-root` 承載階層；Rust 形態沒有 Teleport，由 `AmbientLayer` 的 wrapper 自己攜帶階層帶（`calc(var(--hk-z-hud, 90050) + order)`）。
