# تحديد الشاشة

تجيب عائلة تحديد الشاشة على السؤال الذي تطرحه كل تهيئة متعددة الشاشات: **أي شاشة هذه؟** التطبيق يقرر كيف تكتشف الشاشات بعضها وكيف تُرقّم، بينما تملك hikari الوميض: بطاقة كبيرة مرقّمة، ومدة بقاء قصيرة مع عدّاد تنازلي، والطبقة التي تُرسم عليها — فوق كل النوافذ المنبثقة، بما فيها حجاب النافذة المشروطة.

## الاستخدام الأساسي

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

| الخاصية | الوصف | النوع | الافتراضي |
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


## السلوك والحدود

- مدة البقاء الافتراضية **3000 مللي ثانية**؛ و`duration_ms: Some(0)` يُبقي البطاقة حتى `dismiss()`.
- إعادة `show` تعيد تشغيل الوميض دون تكديس البطاقات أو وراثة الموعد النهائي القديم.
- تطبع البطاقة ثواني كاملة (3 → 2 → 1) عبر الرقم الدوّار المشترك؛ مدة تتجاوز 9 ثوانٍ ستقصّ خانة العشرات، فأبقِ التحديد في ثوانٍ أحادية.
- لا يبلّغ tick إلا عن المتبقي؛ وtick الذي يتجاوز الموعد النهائي يُنهي الوميض — ولا يُرسم إطار بباقٍ صفري.
- البطاقة HUD: لا تعترض المؤشر (`pointer-events: none`) وتنعكس الزاويتان اليمنى/اليسرى عند RTL (تموضع منطقي).
- ركّب `ScreenIdentifyHost` مرة واحدة لكل نافذة، والباقي يستدعي `show_screen_identify()` (نمط الوحدة المفردة كما في Vue).

## العلاقة بصيغة Vue

تعكس هذه العائلة `useScreenIdentify` / `HkScreenIdentifyCard` / `HkScreenIdentifyHost` / `HkAmbientLayer` من Vue وتُصرّف **الملفات نفسها** المضمّنة (`HkScreenIdentifyCard.scss`, `HkAmbientLayer.scss`)، فتتطابق قواعد البطاقة وطبقة HUD. في صيغة Vue تحمل `#hk-hud-root` الطبقة؛ ولا يوجد Teleport في صيغة Rust، لذا يحمل غلاف `AmbientLayer` النطاق بنفسه (`calc(var(--hk-z-hud, 90050) + (zIndex - 1))`).
