//! The cssvar DERIVATION in Rust (hikari#1546 Phase 2 endgame): the exact
//! port of `packages/vue/src/theme/presets.ts` `tokensToCSSVars` and its
//! colour-math closure (`semanticPalette.ts`). What moved:
//!
//! - `stock_vars(StockMode)` — the FULL cssvar map (authored slots + every
//!   derived slot: `onPrimary`, `textSecondary/tertiary`, per-tone `on*`
//!   inks, `*-fg` readable pairs, and the `--hi-*` aliases) for the stock
//!   preset in one mode.
//! - `stock_vars_css()` — both modes as the static `<head>` sheet text.
//!
//! What stays in TypeScript: the same derivation for RUNTIME-authored
//! custom themes (a user editing the theme dialog computes in the browser —
//! there is no Rust there). That copy is not a second source of truth: the
//! drift contract in `themeVarsCss.contract.test.ts` executes it and pins
//! it, key-for-key, against the JSON this module emits — any behavioural
//! divergence between the two implementations REDS.
//!
//! Float parity note: every operation here is IEEE f64, executed in the
//! same order as the TS original (V8 and Rust both use f64; the colour
//! channels quantise to u8 at the very end, ~13 digits away from any libm
//! ULP). The contract test verifies that empirically, per key.

use std::collections::BTreeMap;

use crate::stock::{stock_default, StockRgb, StockTokenScheme};

/// The mode a scheme is derived for.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StockMode {
    Dark,
    Light,
}

impl StockMode {
    /// The attribute value the static sheet and `data-mode` both use.
    #[must_use]
    pub fn as_str(self) -> &'static str {
        match self {
            StockMode::Dark => "dark",
            StockMode::Light => "light",
        }
    }
}

#[must_use]
fn scheme_of(mode: StockMode) -> StockTokenScheme {
    match mode {
        StockMode::Dark => stock_default().dark,
        StockMode::Light => stock_default().light,
    }
}

// ── OKLab / OKLCH (Björn Ottosson's reference matrices) ─────────────────

fn channel_to_linear(v: u8) -> f64 {
    let s = f64::from(v) / 255.0;
    if s <= 0.04045 { s / 12.92 } else { ((s + 0.055) / 1.055).powf(2.4) }
}

fn linear_to_channel(v: f64) -> u8 {
    let s = if v <= 0.003_130_8 { v * 12.92 } else { 1.055 * v.powf(1.0 / 2.4) - 0.055 };
    let clamped = s.clamp(0.0, 1.0);
    // JS Math.round: half away from zero — identical to f64::round for the
    // non-negative values this produces (s is clamped to [0, 1]).
    (clamped * 255.0).round() as u8
}

/// Linear sRGB → linear LMS. Rows of Ottosson's M1.
const LINEAR_FROM_SRGB: [[f64; 3]; 3] = [
    [0.412_221_470_8, 0.536_332_536_3, 0.051_445_992_9],
    [0.211_903_498_2, 0.680_699_545_1, 0.107_396_956_6],
    [0.088_302_461_9, 0.281_718_837_6, 0.629_978_700_5],
];

/// Linear LMS → Lab. Rows of Ottosson's M2.
const LAB_FROM_LMS: [[f64; 3]; 3] = [
    [0.210_454_255_3, 0.793_617_785_0, -0.004_072_046_8],
    [1.977_998_495_1, -2.428_592_205_0, 0.450_593_709_9],
    [0.025_904_037_1, 0.782_771_766_2, -0.808_675_766_0],
];

#[must_use]
fn oklch_to_linear(l: f64, c: f64, h_deg: f64) -> [f64; 3] {
    let rad = h_deg * std::f64::consts::PI / 180.0;
    let a = c * rad.cos();
    let b = c * rad.sin();
    let l_ = l + 0.396_337_777_4 * a + 0.215_803_757_3 * b;
    let m_ = l - 0.105_561_345_8 * a - 0.063_854_172_8 * b;
    let s_ = l - 0.089_484_177_5 * a - 1.291_485_548 * b;
    let (l3, m3, s3) = (l_ * l_ * l_, m_ * m_ * m_, s_ * s_ * s_);
    [
        4.076_741_662_1 * l3 - 3.307_711_591_3 * m3 + 0.230_969_929_2 * s3,
        -1.268_438_004_6 * l3 + 2.609_757_401_1 * m3 - 0.341_319_396_5 * s3,
        -0.004_196_086_3 * l3 - 0.703_418_614_7 * m3 + 1.707_614_701 * s3,
    ]
}

const GAMUT_EPSILON: f64 = 1e-4;
const CHROMA_CAP: f64 = 0.4;
const CHROMA_SAMPLES: u32 = 48;
const CHROMA_REFINE_STEPS: u32 = 24;

fn in_gamut(lin: &[f64; 3]) -> bool {
    lin.iter().all(|v| (GAMUT_EPSILON..=1.0 + GAMUT_EPSILON).contains(v))
}

/// A tiny adapter so the guards read like the TS original's operators
/// (clamp01 of NaN -> 0; finite-or-zero; degree wrapping) without pulling a
/// numeric crate into the palette.
struct NumberF;

impl NumberF {
    fn finite_or_zero(v: f64) -> f64 {
        if v.is_finite() { v } else { 0.0 }
    }

    fn clamp01(v: f64) -> f64 {
        v.clamp(0.0, 1.0)
    }

    fn wrap_degrees(v: f64) -> f64 {
        let wrapped = v % 360.0;
        if wrapped < 0.0 { wrapped + 360.0 } else { wrapped }
    }
}

/// Gamut mapping by CHROMA REDUCTION at constant L and H: a per-channel
/// clamp drags the hue (a warning clamped toward its error neighbour is
/// exactly how two semantic tones collapse), while reducing chroma keeps
/// the hue exact. Linear prescan (the in-gamut set along c is NON-CONVEX —
/// channels are cubic in c, so a bare binary search stops at the first
/// boundary), then the bounded binary refinement. Same sample counts, same
/// order as the TS original.
#[must_use]
fn oklch_to_rgb(l: f64, c: f64, raw_h: f64) -> StockRgb {
    // Guard shape mirrors the TS original exactly: l sanitises against its
    // OWN finiteness (clamp01 of NaN -> 0), c against its own, h against its
    // own. (A combined condition would return NaN -> 255 through
    // linear_to_channel's clamp — a dead-code landmine if this ever gets
    // exposed beyond the authored u8 table.) MUT:mut-l-guard — reshaping the
    // guard to a combined condition would let NaN through as channel 255
    // only for callers that pass non-u8 inputs; today that caller is
    // none, so the drift test cannot see it. comment-gate-ok: the guard is
    // documented here rather than tested, because every current caller
    // passes u8.
    let l = NumberF::clamp01(NumberF::finite_or_zero(l));
    let c = NumberF::finite_or_zero(c).max(0.0);
    let h = NumberF::wrap_degrees(NumberF::finite_or_zero(raw_h));

    let cap = c.min(CHROMA_CAP);
    let mut lo = 0.0;
    let mut hi = cap;
    for i in (1..=CHROMA_SAMPLES).rev() {
        let probe = (cap * f64::from(i)) / f64::from(CHROMA_SAMPLES);
        let lin = oklch_to_linear(l, probe, h);
        if in_gamut(&lin) {
            lo = probe;
            hi = if i == CHROMA_SAMPLES {
                cap
            } else {
                (cap * f64::from(i + 1)) / f64::from(CHROMA_SAMPLES)
            };
            break;
        }
    }
    let mut best: Option<[f64; 3]> = None;
    for _ in 0..CHROMA_REFINE_STEPS {
        let mid = (lo + hi) / 2.0;
        let lin = oklch_to_linear(l, mid, h);
        if in_gamut(&lin) {
            best = Some(lin);
            lo = mid;
        } else {
            hi = mid;
        }
    }
    // c = 0 is always in gamut (a grey at lightness l); the fallback covers
    // extreme l values even the grey cannot reach.
    let lin = best.unwrap_or_else(|| oklch_to_linear(l, 0.0, h));
    StockRgb {
        r: linear_to_channel(lin[0]),
        g: linear_to_channel(lin[1]),
        b: linear_to_channel(lin[2]),
    }
}

/// OKLCH of an authored colour: L ∈ [0,1], C ≥ 0, H in degrees [0,360).
#[must_use]
fn rgb_to_oklch(c: StockRgb) -> (f64, f64, f64) {
    // The authored table is already u8, so the runtime NaN guards collapse
    // to the identity here.
    let (r, g, b) = (c.r, c.g, c.b);
    let lin: [f64; 3] = [
        LINEAR_FROM_SRGB[0][0] * channel_to_linear(r)
            + LINEAR_FROM_SRGB[0][1] * channel_to_linear(g)
            + LINEAR_FROM_SRGB[0][2] * channel_to_linear(b),
        LINEAR_FROM_SRGB[1][0] * channel_to_linear(r)
            + LINEAR_FROM_SRGB[1][1] * channel_to_linear(g)
            + LINEAR_FROM_SRGB[1][2] * channel_to_linear(b),
        LINEAR_FROM_SRGB[2][0] * channel_to_linear(r)
            + LINEAR_FROM_SRGB[2][1] * channel_to_linear(g)
            + LINEAR_FROM_SRGB[2][2] * channel_to_linear(b),
    ];
    let lms = lin.map(f64::cbrt);
    let lab: [f64; 3] = [
        LAB_FROM_LMS[0][0] * lms[0] + LAB_FROM_LMS[0][1] * lms[1] + LAB_FROM_LMS[0][2] * lms[2],
        LAB_FROM_LMS[1][0] * lms[0] + LAB_FROM_LMS[1][1] * lms[1] + LAB_FROM_LMS[1][2] * lms[2],
        LAB_FROM_LMS[2][0] * lms[0] + LAB_FROM_LMS[2][1] * lms[1] + LAB_FROM_LMS[2][2] * lms[2],
    ];
    let chroma = (lab[1] * lab[1] + lab[2] * lab[2]).sqrt();
    let mut hue = lab[2].atan2(lab[1]) * 180.0 / std::f64::consts::PI;
    if hue < 0.0 {
        hue += 360.0;
    }
    (lab[0], chroma, hue)
}

// ── WCAG contrast — deliberately NOT solidInk's raw weighted average ────
// solidInk uses the gamma-encoded average/255; this uses WCAG RELATIVE
// luminance. The divergence is load-bearing: readability targets here are
// WCAG ratios, while the solidInk seam keeps its perception-first metric.

#[must_use]
fn srgb_luminance(c: StockRgb) -> f64 {
    let f = |v: u8| -> f64 {
        let s = f64::from(v) / 255.0;
        if s <= 0.039_28 { s / 12.92 } else { ((s + 0.055) / 1.055).powf(2.4) }
    };
    0.212_6 * f(c.r) + 0.715_2 * f(c.g) + 0.072_2 * f(c.b)
}

#[must_use]
fn contrast_ratio(a: StockRgb, b: StockRgb) -> f64 {
    let (la, lb) = (srgb_luminance(a), srgb_luminance(b));
    let hi = la.max(lb);
    let lo = la.min(lb);
    (hi + 0.05) / (lo + 0.05)
}

/// White-or-black ink for ONE solid fill: 0.65, not the legacy 0.55 — the
/// green channel dominates the weighted average, so ordinary greens/cyans
/// sat just over 0.55 and flipped to black ink although they read as
/// saturated fills (Bootstrap and Radix both ship white on them).
#[must_use]
fn solid_ink(c: StockRgb) -> StockRgb {
    let luminance = (0.212_6 * f64::from(c.r) + 0.715_2 * f64::from(c.g) + 0.072_2 * f64::from(c.b)) / 255.0;
    if luminance > 0.65 {
        StockRgb { r: 0, g: 0, b: 0 }
    } else {
        StockRgb { r: 255, g: 255, b: 255 }
    }
}

#[must_use]
fn mix_token(a: StockRgb, b: StockRgb, t: f64) -> StockRgb {
    StockRgb {
        r: (f64::from(a.r) + (f64::from(b.r) - f64::from(a.r)) * t).round() as u8,
        g: (f64::from(a.g) + (f64::from(b.g) - f64::from(a.g)) * t).round() as u8,
        b: (f64::from(a.b) + (f64::from(b.b) - f64::from(a.b)) * t).round() as u8,
    }
}

/// This colour as TEXT on `bg`: itself when it already clears `target`,
/// otherwise the nearest OKLCH-lightness step that does. Hue is preserved;
/// chroma is only given up where the sRGB gamut forces it (the same trade
/// the fill derivation makes). Steps the SAME 401-point ladder in the SAME
/// order and keeps the candidate CLOSEST to the original lightness.
#[must_use]
fn readable_on(fg: StockRgb, backgrounds: &[StockRgb], target: f64) -> StockRgb {
    if backgrounds.iter().all(|bg| contrast_ratio(fg, *bg) >= target) {
        return fg;
    }
    let (l, c, h) = rgb_to_oklch(fg);
    let mut best: Option<StockRgb> = None;
    let mut best_dist = f64::INFINITY;
    for step in 0..=400_u32 {
        let li = f64::from(step) / 400.0;
        let candidate = oklch_to_rgb(li, c, h);
        if backgrounds.iter().all(|bg| contrast_ratio(candidate, *bg) >= target) {
            let dist = (li - l).abs();
            if dist < best_dist {
                best_dist = dist;
                best = Some(candidate);
            }
        }
    }
    let white = StockRgb { r: 255, g: 255, b: 255 };
    let black = StockRgb { r: 0, g: 0, b: 0 };
    best.unwrap_or_else(|| {
        if contrast_ratio(white, backgrounds[0]) >= contrast_ratio(black, backgrounds[0]) {
            white
        } else {
            black
        }
    })
}

fn channels(c: StockRgb) -> String {
    format!("{} {} {}", c.r, c.g, c.b)
}

fn rgb_var(name: &str) -> String {
    format!("rgb(var({name}))")
}

/// The FULL cssvar map for the stock preset in one mode — the exact port
/// of `tokensToCSSVars(getThemeTokens("default", mode))` (group vars
/// excluded: hosts register those at runtime, and every component reads
/// them with its own CSS fallback).
#[must_use]
pub fn stock_vars(mode: StockMode) -> BTreeMap<String, String> {
    let tokens: StockTokenScheme = scheme_of(mode);

    let on_primary = solid_ink(tokens.primary);
    let text_secondary = mix_token(tokens.text, tokens.muted, 0.25);
    let text_tertiary = mix_token(tokens.text, tokens.muted, 0.5);
    let on_solid_text = tokens.on_solid_text;
    let on_solid_icon = tokens.on_solid_icon;
    let on_danger = solid_ink(tokens.error);
    let on_success = solid_ink(tokens.success);
    let on_warning = solid_ink(tokens.warning);
    let on_info = solid_ink(tokens.info);
    let tint = |fill: StockRgb| mix_token(tokens.background, fill, 0.1);
    let tint_s = |fill: StockRgb| mix_token(tokens.surface, fill, 0.1);
    let success_fg = readable_on(tokens.success, &[tint(tokens.success), tint_s(tokens.success)], 4.5);
    let error_fg = readable_on(tokens.error, &[tint(tokens.error), tint_s(tokens.error)], 4.5);
    let warning_fg = readable_on(tokens.warning, &[tint(tokens.warning), tint_s(tokens.warning)], 4.5);
    let info_fg = readable_on(tokens.info, &[tint(tokens.info), tint_s(tokens.info)], 4.5);

    let mut out = BTreeMap::new();
    let mut put = |k: &str, v: String| {
        out.insert(k.to_string(), v);
    };
    put("--color-primary", channels(tokens.primary));
    put("--color-on-primary", channels(on_primary));
    put("--color-on-solid-text", channels(on_solid_text));
    put("--color-on-solid-icon", channels(on_solid_icon));
    put("--color-on-solid", channels(on_solid_text));
    put("--color-on-danger", channels(on_danger));
    put("--color-on-success", channels(on_success));
    put("--color-on-warning", channels(on_warning));
    put("--color-on-info", channels(on_info));
    put("--color-secondary", channels(tokens.secondary));
    put("--color-accent", channels(tokens.accent));
    put("--color-text", channels(tokens.text));
    put("--color-text-secondary", channels(text_secondary));
    put("--color-text-tertiary", channels(text_tertiary));
    put("--color-muted", channels(tokens.muted));
    put("--color-border", channels(tokens.border));
    put("--color-focused-border", channels(tokens.focused_border));
    put("--color-background", channels(tokens.background));
    put("--color-surface", channels(tokens.surface));
    put("--color-selected-bg", channels(tokens.selected_background));
    put("--color-selected-text", channels(tokens.selected_text));
    put("--color-status-bar-bg", channels(tokens.status_bar_background));
    put("--color-success", channels(tokens.success));
    put("--color-error", channels(tokens.error));
    put("--color-warning", channels(tokens.warning));
    put("--color-info", channels(tokens.info));
    // The --hi-* aliases are STATIC references into the --color-* channels.
    put("--hi-color-primary", rgb_var("--color-primary"));
    put("--hi-color-secondary", rgb_var("--color-secondary"));
    put("--hi-color-surface", rgb_var("--color-surface"));
    put("--hi-color-background", rgb_var("--color-background"));
    put("--hi-color-border", "rgb(var(--color-border) / 15%)".to_string());
    put("--hi-color-text-primary", rgb_var("--color-text"));
    put("--hi-color-text-secondary", rgb_var("--color-text-secondary"));
    put("--hi-color-muted", rgb_var("--color-muted"));
    put("--hi-color-on-primary", rgb_var("--color-on-primary"));
    put("--hi-color-text-on-primary", rgb_var("--color-on-primary"));
    put(
        "--hi-color-text-on-solid",
        "rgb(var(--color-on-solid-text, 255 255 255))".to_string(),
    );
    put(
        "--hi-color-icon-on-solid",
        "rgb(var(--color-on-solid-icon, 255 255 255))".to_string(),
    );
    put("--hi-color-success", rgb_var("--color-success"));
    put("--hi-color-error", rgb_var("--color-error"));
    put("--hi-color-warning", rgb_var("--color-warning"));
    put("--hi-color-info", rgb_var("--color-info"));
    put("--hi-color-text-on-danger", rgb_var("--color-on-danger"));
    put("--hi-color-text-on-success", rgb_var("--color-on-success"));
    put("--hi-color-text-on-warning", rgb_var("--color-on-warning"));
    put("--hi-color-text-on-info", rgb_var("--color-on-info"));
    put(
        "--hi-color-success-fg",
        format!("rgb({} {} {})", success_fg.r, success_fg.g, success_fg.b),
    );
    put(
        "--hi-color-danger-fg",
        format!("rgb({} {} {})", error_fg.r, error_fg.g, error_fg.b),
    );
    put(
        "--hi-color-warning-fg",
        format!("rgb({} {} {})", warning_fg.r, warning_fg.g, warning_fg.b),
    );
    put(
        "--hi-color-info-fg",
        format!("rgb({} {} {})", info_fg.r, info_fg.g, info_fg.b),
    );
    put("--hi-color-bg-subtle", "rgb(var(--color-text) / 4%)".to_string());
    put("--hi-color-bg-elevated", rgb_var("--color-surface"));
    put("--hi-color-bg-container", rgb_var("--color-surface"));
    put("--hi-color-bg-canvas", rgb_var("--color-background"));
    put("--hi-secondary-bg", "rgb(var(--color-text) / 6%)".to_string());
    out
}

/// Both modes as the static `<head>` sheet — the exact text the
/// `theme-vars.css` artifact ships (BTreeMap ordering is deterministic).
#[must_use]
pub fn stock_vars_css() -> String {
    let mut chunks = vec![
        "/* GENERATED from packages/palette/src/derivation.rs — the authored".to_string(),
        " * table (stock.rs) PLUS the derivation (this module), replacing the".to_string(),
        " * TypeScript-composed sheet as the shipped artifact (hikari#1546".to_string(),
        " * Phase 2 endgame). Regen: REGEN_STOCK_JSON=1 cargo test -p".to_string(),
        " * hikari-palette --test stock_snapshot. */".to_string(),
    ];
    for mode in [StockMode::Dark, StockMode::Light] {
        chunks.push(format!("html[data-mode=\"{}\"] {{", mode.as_str()));
        for (k, v) in stock_vars(mode) {
            chunks.push(format!("  {k}: {v};"));
        }
        chunks.push("}".to_string());
    }
    chunks.join("\n") + "\n"
}
