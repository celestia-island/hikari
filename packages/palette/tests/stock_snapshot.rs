//! The two-sided lock for the stock token table (hikari#1546 Phase 2).
//!
//! `packages/vue/src/theme/stock-preset.json` is the artifact TypeScript
//! imports to build `themePresets.default`; THIS crate is where the values
//! live. Two failure modes, mirroring the date-vocabulary golden pair:
//!
//! 1. **A value edit in Rust without a regen.** [`serialized_matches_the_web_artifact`]
//!    goes red: the JSON no longer says what this crate says.
//! 2. **A hand edit of the JSON.** Same test, same red — a palette the
//!    crate cannot reproduce would ship to every web page.
//!
//! Both are resolved the same way: change [`hikari_palette::stock::stock_default`]
//! (or accept a JSON diff after review) and regenerate with
//! `REGEN_STOCK_JSON=1 cargo test -p hikari-palette --test stock_snapshot`.
//!
//! The cross-family pin: the semantic quartet (and only it) must equal the
//! `Hikari`/`Tairitsu` components-side palettes — the one value family the
//! web preset and those palettes share by design. Everything else is
//! expected to differ (the web default is pink/paper + Nord-black-blue;
//! the components palettes are the chinese-constant aesthetic).

use hikari_palette::stock::{stock_default, StockRgb};
use hikari_palette::themes::{Hikari, Tairitsu};

/// The artifact TypeScript imports — reached through the source tree (both
/// packages live in this repository; the path is compile-time and
/// git-tracked, so the coupling is visible in any grep for the file).
const ARTIFACT: &str = include_str!("../../vue/src/theme/stock-preset.json");

fn channels(c: &hikari_palette::colors::Color) -> StockRgb {
    let (r, g, b) = c.rgb;
    StockRgb { r, g, b }
}

fn semantic_of(palette: &hikari_palette::themes::Palette) -> [StockRgb; 4] {
    [
        channels(&palette.success),
        channels(&palette.danger),
        channels(&palette.warning),
        channels(&palette.info),
    ]
}

#[test]
fn serialized_matches_the_web_artifact() {
    let json = serde_json::to_string(&stock_default()).expect("stock theme serializes");
    if std::env::var("REGEN_STOCK_JSON").as_deref() == Ok("1") {
        std::fs::write(
            concat!(
                env!("CARGO_MANIFEST_DIR"),
                "/../vue/src/theme/stock-preset.json"
            ),
            &json,
        )
        .expect("write the stock json artifact");
        let rewritten = std::fs::read_to_string(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../vue/src/theme/stock-preset.json"
        ))
        .expect("re-read the artifact");
        assert_eq!(rewritten, json, "regen wrote the composition");
        println!("REGEN: rewrote packages/vue/src/theme/stock-preset.json ({} bytes)", json.len());
        return;
    }
    assert_eq!(
        json, ARTIFACT,
        "the checked-in stock JSON must equal serde_json::to_string(stock_default()) — \
         regen with REGEN_STOCK_JSON=1 cargo test -p hikari-palette --test stock_snapshot"
    );
    // The artifact is what the WEB LANE ships: if a value edited here never
    // reaches it, every page paints the stale palette (hikari#1546 Phase 2
    // regression). comment-gate-ok: this test IS the verification — the
    // byte comparison IS the mutation oracle for a hand edit of the JSON
    // (edit a value -> RED), and stock.rs-vs-artifact transfer is pinned by
    // the byte comparison itself.
    assert!(!json.is_empty(), "the artifact is never empty");
    assert!(
        json.contains("\"primary\":{\"r\":136,\"g\":192,\"b\":208}"),
        "the dark Nord primary must survive any regen"
    );
}

#[test]
fn semantic_quartet_is_the_shared_family_with_the_components_palettes() {
    let stock = stock_default();
    let stock_dark = [
        stock.dark.success, stock.dark.error, stock.dark.warning, stock.dark.info,
    ];
    let stock_light = [
        stock.light.success, stock.light.error, stock.light.warning, stock.light.info,
    ];
    let hikari = semantic_of(&Hikari::palette());
    let tairitsu = semantic_of(&Tairitsu::palette());
    assert_eq!(stock_dark, hikari, "dark quartet == Hikari's canonical quartet");
    assert_eq!(stock_dark, tairitsu, "dark quartet == Tairitsu's canonical quartet");
    assert_eq!(stock_light, hikari, "light quartet == Hikari's canonical quartet");
    assert_eq!(stock_light, tairitsu, "light quartet == Tairitsu's canonical quartet");
}

#[test]
fn modes_are_keyed_exactly_as_the_web_lane_reads_them() {
    // The TS side reads `preset.dark` / `preset.light` — the serde field
    // names must stay lowercase (NOT renamed by the camelCase attribute,
    // which applies to the scheme slots only). A rename here would hand the
    // web lane `undefined` schemes and paint nothing.
    let json = serde_json::to_string(&stock_default()).expect("serializes");
    assert!(json.contains(r#""dark":"#), "dark key present");
    assert!(json.contains(r#""light":"#), "light key present");
}
