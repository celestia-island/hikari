# 识别屏幕

识别屏幕组件族回答多屏场景里最常见的一个问题：**这块屏幕是几号？** 应用负责屏幕发现与编号；hikari 负责闪烁本身——大号数字卡、带倒计时的短暂驻留，以及它所在的层级（盖过所有弹窗，含遮罩）。

## 基础用法

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

| 属性 | 说明 | 类型 | 默认值 |
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


## 行为与边界

- 默认驻留 **3000 ms**；`duration_ms: Some(0)` 表示常驻，直到调用 `dismiss()`。
- 再次 `show` 会重启闪烁，不会叠卡，也不会继承旧截止时间。
- 卡片用共享的滚动数字打印整秒（3 → 2 → 1）；驻留超过 9 秒会让十位被裁掉，识别是「一眼」动作，请保持个位数。
- tick 只报告剩余时间；跨过截止时间的那次 tick 结束闪烁——永远不会画出「剩余 0」的一帧。
- 卡片是 HUD：不拦截指针（`pointer-events: none`）；RTL 下左右角位镜像（逻辑角位），上下角位保持物理边。
- 每个窗口只挂一次 `ScreenIdentifyHost`；其他任何位置用 `show_screen_identify()` 驱动（模块单例，与 Vue 相同）。

## 与 Vue 形态的关系

本族镜像 Vue 的 `useScreenIdentify` / `HkScreenIdentifyCard` / `HkScreenIdentifyHost` / `HkAmbientLayer`，编译**同一份** vendored 样式表（`HkScreenIdentifyCard.scss`、`HkAmbientLayer.scss`），两种形态的卡片语法与 HUD 带完全一致。Vue 形态用 `#hk-hud-root` 承载层级；Rust 形态没有 Teleport，由 `AmbientLayer` 的 wrapper 自己携带层级带（`calc(var(--hk-z-hud, 90050) + (zIndex - 1))`）。
