# 画面の識別

画面識別ファミリーはマルチスクリーン環境で必ず出てくる問いに答えます：**この画面は何番か？** 画面の発見と番号付けはアプリの責務です。hikari はフラッシュそのもの——大きな番号カード、カウントダウン付きの短い表示、そしてすべてのポップアップ（モーダルのスクリムを含む）より上のレイヤー——を担当します。

## 基本的な使い方

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

| プロパティ | 説明 | 型 | 既定値 |
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


## 挙動と境界

- 既定の表示時間は **3000 ms**。`duration_ms: Some(0)` は `dismiss()` まで常時表示です。
- 再度 `show` すると、カードを重ねず古い期限も引き継がずにフラッシュを再起動します。
- カードは共有の回転数字で整数秒（3 → 2 → 1）を表示します。9 秒を超えると十の位が欠けるため、識別は一桁秒に保ってください。
- tick は残り時間を報告するだけです。期限を跨いだ tick がフラッシュを終了させるため、「残り 0」のフレームは描かれません。
- カードは HUD です。ポインター入力を遮らず（`pointer-events: none`）、RTL では左右の角が鏡像になります（論理角位）。
- `ScreenIdentifyHost` はウィンドウごとに 1 回だけマウントし、その他は `show_screen_identify()` で駆動します（Vue と同じモジュールシングルトン）。

## Vue 版との関係

本ファミリーは Vue の `useScreenIdentify` / `HkScreenIdentifyCard` / `HkScreenIdentifyHost` / `HkAmbientLayer` を鏡映し、**同じ** vendored スタイルシート（`HkScreenIdentifyCard.scss`、`HkAmbientLayer.scss`）をコンパイルします。Vue 版は `#hk-hud-root` がレイヤーを担い、Rust 版は Teleport を持たないため `AmbientLayer` の wrapper 自体が帯（`calc(var(--hk-z-hud, 90050) + (zIndex - 1))`）を運びます。
