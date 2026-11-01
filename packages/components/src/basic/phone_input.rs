// hi-components/src/basic/phone_input.rs
// PhoneInput — mirror of the canonical Vue `HkPhoneInput`: the national number
// field with a country dial-code chip riding its left edge.
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkPhoneInput.scss`, vendored under
// `src/styles/vue-mirror/` and guarded by `tests/vue_mirror_drift_tests.rs`),
// compiled with `no_hash` so the `.hk-phone-*` class names are literal and
// identical in both forms. The field itself is the mirrored
// [`crate::basic::input::Input`] — Vue nests `HkInput` the same way — so the
// whole `.hk-input-*` shell (label, box, affixes, message line) comes from
// that mirror. DOM contract:
//
//   div.hk-phone-input [class] [style]              (Vue: the root wrapper)
//     div.hk-input-wrapper                          (the nested HkInput mirror)
//       label.hk-input-label …                     (label; no `for` —
//                                                    the mirror generates no id)
//       div.hk-input-box.hk-input-box-{sm|md|lg} …
//         span.hk-input-affix.hk-input-prefix
//           button.hk-phone-chip                    (Vue: HkAffixPicker chip)
//               type="button" aria-haspopup="listbox"
//               aria-expanded="true|false" aria-label title [disabled]
//             span.hk-phone-chip-dial  "+86"
//             span.hk-phone-chip-caret aria-hidden="true"
//                 div[style="display:contents"] > inline chevron SVG
//         input.hk-input-element value autocomplete="tel-national" …
//     div.hk-phone-input-countries                  (only while `open`)
//         role="listbox" aria-label + inline geometry (see the header delta)
//       button.hk-phone-input-country  (xN, one per catalog row)
//           type="button" role="option" aria-selected data-iso title
//         span.hk-phone-input-country-name  {localized name}
//         span.hk-phone-input-country-dial  "+86"
//
// Vue prop mapping: `modelValue` → [`PhoneInputProps::model_value`] (the
// NATIONAL number only), `dialCode` → [`PhoneInputProps::dial_code`] (any
// shape: `"+86"`, `"86"`, `"0086"` — canonicalized only for matching, so a
// `v-model` round-trip keeps the caller's spelling), `countries` →
// [`PhoneInputProps::countries`] (`None` = the bundled [`DIAL_CODES`]),
// `update:modelValue` → [`PhoneInputProps::on_input`], `blur`/`change` →
// `on_blur`/`on_change`, `submitOnEnter` → `submit_on_enter`.
//
// The dial-code math is Vue's `data/dialCodes.ts`, helper by helper:
// `normalizeDial`, `normalizeNational`, the `onInput` sanitizer, `formatE164`,
// `resolveDial`, `entryByIso` and `dialCodeName` all live in the free
// functions below, so they are testable without a DOM.
//
// Behaviour deltas vs Vue (documented):
//   * **the country picker is an inline listbox, not `HkAffixPicker`.** That
//     picker (a searchable single-select popover) has no Rust mirror in this
//     wave and its sheet (`HkAffixPicker.scss`) is not vendored, so the chip is
//     a plain `button` and the rows render in an inline ABSOLUTE panel anchored
//     to the root (`position:relative` is written inline while `open`). The
//     panel and row hooks (`hk-phone-input-countries` /
//     `hk-phone-input-country*`) have no rule in the canonical sheet — the
//     inline geometry below is their only styling and a host may layer its own
//     — and the affix picker's live search, keyboard roving and popup-manager
//     z band are not mirrored. `open` is CONTROLLED (`open` +
//     `on_open_change`) because tairitsu 0.5.22 has no per-instance component
//     state; a host that ignores the pair keeps its own picker and the chip
//     still reports the click.
//   * **one dial emit instead of two.** Vue emits `update:dialCode` and
//     `dialchange` back to back with the identical canonical `"+86"` payload;
//     the mirror collapses them into [`PhoneInputProps::on_dial_change`] (the
//     ISO code is available on the row as `data-iso` for a host that wants it).
//   * **no refocus after a pick.** Vue `nextTick`s a `focus()` on the number
//     field so pick-then-type needs no second tap; tairitsu 0.5.22 exposes no
//     focus API, so the host does it (the same reason `otp_input.rs` reports a
//     cursor instead of moving one).
//   * **the fixed field attributes are fixed.** Vue spreads `inputmode="tel"`,
//     `maxlength="18"` and any caller attrs onto the inner `HkInput`, whose
//     mirrored props are a closed struct with no attribute bag: the mirror sets
//     `autocomplete="tel-national"` (a real `InputProps` field) and leaves
//     those three to the sheet/host. The alphabet sanitizer is unchanged, so
//     only the soft-keyboard hint and the length fence differ.
//   * `focus` is wired. Vue declares the `focus` emit but only ever emits
//     `blur` (the focus handler rides `$attrs` into the inner field); the
//     mirror wires [`PhoneInputProps::on_focus`] to the inner field's own
//     `focus`, which is what that declared emit was for.
//   * the i18n lookups (`chooseCountry`, and the country names) go through
//     `hikari_i18n::t` with the English fallback; the Rust locale tables ship
//     no `components.hk.phoneInput.*` keys yet, so the fallback is what renders
//     today (Vue reads `hikari::phoneInput.*`).

use hikari_i18n::{Language, use_i18n};

use crate::basic::input::{Input, InputProps, InputSize};
use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct PhoneInputComponent;

/// One row of the dial-code catalog (Vue: `DialCodeEntry` in
/// `data/dialCodes.ts`). The fields are `'static` because the catalog is
/// compile-time data — a host that scopes the list passes its own
/// `Vec<DialCodeEntry>`, which is Vue's `countries` escape hatch.
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub struct DialCodeEntry {
    /// ISO 3166-1 alpha-2 code, lowercase (`"cn"`).
    pub iso: &'static str,
    /// National dial code WITHOUT the leading `+` (`"86"`).
    pub dial: &'static str,
    /// English country name.
    pub en: &'static str,
    /// Simplified Chinese country name.
    pub zh: &'static str,
}

impl DialCodeEntry {
    /// Positional constructor for the catalog table (one row per line, so the
    /// Rust table stays comparable row-for-row with the canonical TypeScript
    /// one).
    pub const fn new(
        iso: &'static str,
        dial: &'static str,
        en: &'static str,
        zh: &'static str,
    ) -> Self {
        Self { iso, dial, en, zh }
    }
}

/// The ordered catalog: China first, then Asia-Pacific neighbors, then the
/// rest of the world — the order of `packages/vue/src/data/dialCodes.ts`,
/// which also drives the "first match wins" rule for shared dial prefixes
/// (`+1` → United States before Canada, `+7` → Russia before Kazakhstan).
pub const DIAL_CODES: &[DialCodeEntry] = &[
    DialCodeEntry::new("cn", "86", "China", "中华人民共和国"),
    DialCodeEntry::new("hk", "852", "Hong Kong (China)", "中国香港"),
    DialCodeEntry::new("mo", "853", "Macau (China)", "中国澳门"),
    DialCodeEntry::new("tw", "886", "Taiwan (China)", "中国台湾"),
    DialCodeEntry::new("jp", "81", "Japan", "日本"),
    DialCodeEntry::new("kr", "82", "South Korea", "韩国"),
    DialCodeEntry::new("sg", "65", "Singapore", "新加坡"),
    DialCodeEntry::new("my", "60", "Malaysia", "马来西亚"),
    DialCodeEntry::new("th", "66", "Thailand", "泰国"),
    DialCodeEntry::new("vn", "84", "Vietnam", "越南"),
    DialCodeEntry::new("ph", "63", "Philippines", "菲律宾"),
    DialCodeEntry::new("id", "62", "Indonesia", "印度尼西亚"),
    DialCodeEntry::new("in", "91", "India", "印度"),
    DialCodeEntry::new("pk", "92", "Pakistan", "巴基斯坦"),
    DialCodeEntry::new("bd", "880", "Bangladesh", "孟加拉国"),
    DialCodeEntry::new("lk", "94", "Sri Lanka", "斯里兰卡"),
    DialCodeEntry::new("np", "977", "Nepal", "尼泊尔"),
    DialCodeEntry::new("kh", "855", "Cambodia", "柬埔寨"),
    DialCodeEntry::new("la", "856", "Laos", "老挝"),
    DialCodeEntry::new("mm", "95", "Myanmar", "缅甸"),
    DialCodeEntry::new("bn", "673", "Brunei", "文莱"),
    DialCodeEntry::new("mn", "976", "Mongolia", "蒙古"),
    DialCodeEntry::new("us", "1", "United States", "美国"),
    DialCodeEntry::new("ca", "1", "Canada", "加拿大"),
    DialCodeEntry::new("gb", "44", "United Kingdom", "英国"),
    DialCodeEntry::new("de", "49", "Germany", "德国"),
    DialCodeEntry::new("fr", "33", "France", "法国"),
    DialCodeEntry::new("it", "39", "Italy", "意大利"),
    DialCodeEntry::new("es", "34", "Spain", "西班牙"),
    DialCodeEntry::new("pt", "351", "Portugal", "葡萄牙"),
    DialCodeEntry::new("nl", "31", "Netherlands", "荷兰"),
    DialCodeEntry::new("be", "32", "Belgium", "比利时"),
    DialCodeEntry::new("ch", "41", "Switzerland", "瑞士"),
    DialCodeEntry::new("at", "43", "Austria", "奥地利"),
    DialCodeEntry::new("ie", "353", "Ireland", "爱尔兰"),
    DialCodeEntry::new("se", "46", "Sweden", "瑞典"),
    DialCodeEntry::new("no", "47", "Norway", "挪威"),
    DialCodeEntry::new("dk", "45", "Denmark", "丹麦"),
    DialCodeEntry::new("fi", "358", "Finland", "芬兰"),
    DialCodeEntry::new("is", "354", "Iceland", "冰岛"),
    DialCodeEntry::new("pl", "48", "Poland", "波兰"),
    DialCodeEntry::new("cz", "420", "Czechia", "捷克"),
    DialCodeEntry::new("sk", "421", "Slovakia", "斯洛伐克"),
    DialCodeEntry::new("hu", "36", "Hungary", "匈牙利"),
    DialCodeEntry::new("ro", "40", "Romania", "罗马尼亚"),
    DialCodeEntry::new("bg", "359", "Bulgaria", "保加利亚"),
    DialCodeEntry::new("gr", "30", "Greece", "希腊"),
    DialCodeEntry::new("hr", "385", "Croatia", "克罗地亚"),
    DialCodeEntry::new("rs", "381", "Serbia", "塞尔维亚"),
    DialCodeEntry::new("ua", "380", "Ukraine", "乌克兰"),
    DialCodeEntry::new("ru", "7", "Russia", "俄罗斯"),
    DialCodeEntry::new("kz", "7", "Kazakhstan", "哈萨克斯坦"),
    DialCodeEntry::new("tr", "90", "Türkiye", "土耳其"),
    DialCodeEntry::new("il", "972", "Israel", "以色列"),
    DialCodeEntry::new("ae", "971", "United Arab Emirates", "阿联酋"),
    DialCodeEntry::new("sa", "966", "Saudi Arabia", "沙特阿拉伯"),
    DialCodeEntry::new("qa", "974", "Qatar", "卡塔尔"),
    DialCodeEntry::new("kw", "965", "Kuwait", "科威特"),
    DialCodeEntry::new("bh", "973", "Bahrain", "巴林"),
    DialCodeEntry::new("om", "968", "Oman", "阿曼"),
    DialCodeEntry::new("jo", "962", "Jordan", "约旦"),
    DialCodeEntry::new("lb", "961", "Lebanon", "黎巴嫩"),
    DialCodeEntry::new("iq", "964", "Iraq", "伊拉克"),
    DialCodeEntry::new("ir", "98", "Iran", "伊朗"),
    DialCodeEntry::new("af", "93", "Afghanistan", "阿富汗"),
    DialCodeEntry::new("ge", "995", "Georgia", "格鲁吉亚"),
    DialCodeEntry::new("am", "374", "Armenia", "亚美尼亚"),
    DialCodeEntry::new("az", "994", "Azerbaijan", "阿塞拜疆"),
    DialCodeEntry::new("uz", "998", "Uzbekistan", "乌兹别克斯坦"),
    DialCodeEntry::new("eg", "20", "Egypt", "埃及"),
    DialCodeEntry::new("ma", "212", "Morocco", "摩洛哥"),
    DialCodeEntry::new("dz", "213", "Algeria", "阿尔及利亚"),
    DialCodeEntry::new("tn", "216", "Tunisia", "突尼斯"),
    DialCodeEntry::new("ng", "234", "Nigeria", "尼日利亚"),
    DialCodeEntry::new("ke", "254", "Kenya", "肯尼亚"),
    DialCodeEntry::new("et", "251", "Ethiopia", "埃塞俄比亚"),
    DialCodeEntry::new("tz", "255", "Tanzania", "坦桑尼亚"),
    DialCodeEntry::new("za", "27", "South Africa", "南非"),
    DialCodeEntry::new("gh", "233", "Ghana", "加纳"),
    DialCodeEntry::new("br", "55", "Brazil", "巴西"),
    DialCodeEntry::new("mx", "52", "Mexico", "墨西哥"),
    DialCodeEntry::new("ar", "54", "Argentina", "阿根廷"),
    DialCodeEntry::new("cl", "56", "Chile", "智利"),
    DialCodeEntry::new("co", "57", "Colombia", "哥伦比亚"),
    DialCodeEntry::new("pe", "51", "Peru", "秘鲁"),
    DialCodeEntry::new("ve", "58", "Venezuela", "委内瑞拉"),
    DialCodeEntry::new("uy", "598", "Uruguay", "乌拉圭"),
    DialCodeEntry::new("ec", "593", "Ecuador", "厄瓜多尔"),
    DialCodeEntry::new("au", "61", "Australia", "澳大利亚"),
    DialCodeEntry::new("nz", "64", "New Zealand", "新西兰"),
    DialCodeEntry::new("fj", "679", "Fiji", "斐济"),
];

/// The chevron the phone sheet rotates through
/// `.hk-phone-chip[aria-expanded="true"] .hk-phone-chip-caret` (Vue draws
/// lucide's `ChevronDown`; the mirror inlines it, per the crate's SVG rule).
const CHEVRON_DOWN_SVG: &str = r#"<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>"#;

/// Inline geometry for the mirror's country panel — the canonical sheet has no
/// rule for it (see the header delta), so the box is declared here.
const COUNTRY_PANEL_STYLE: &str = "position:absolute;top:calc(100% + 4px);left:0;right:0;z-index:30;max-height:15rem;overflow-y:auto;display:flex;flex-direction:column;gap:2px;padding:4px;background:rgb(var(--color-surface));border:1px solid rgb(var(--color-text) / 14%);border-radius:var(--radius-md, 8px);box-shadow:var(--shadow-modal, none)";

/// Inline geometry for one country row (same reason as the panel).
const COUNTRY_ROW_STYLE: &str = "display:flex;align-items:center;justify-content:space-between;gap:0.5rem;padding:0.375rem 0.5rem;border:none;border-radius:var(--radius-sm, 6px);background:none;color:rgb(var(--color-text));font:inherit;cursor:pointer;text-align:start;white-space:nowrap";

/// Vue's `normalizeDial`: drop one leading `+`, then one leading `00`, then
/// every non-digit (`"+86"` / `"86"` / `"0086"` all become `"86"`).
pub fn phone_normalize_dial(dial: &str) -> String {
    let stripped = dial.strip_prefix('+').unwrap_or(dial);
    let stripped = stripped.strip_prefix("00").unwrap_or(stripped);
    stripped
        .chars()
        .filter(char::is_ascii_digit)
        .collect::<String>()
}

/// Vue's `normalizeNational`: digits only, leading zeros preserved (a country
/// that genuinely needs a trunk zero, e.g. Italy, keeps it).
pub fn phone_normalize_national(national: &str) -> String {
    national
        .chars()
        .filter(char::is_ascii_digit)
        .collect::<String>()
}

/// Vue's `onInput` sanitizer: digits, whitespace and dashes survive;
/// everything else (plus signs, parentheses, letters from a paste) drops out —
/// a pasted `"+86 138-1234-5678"` becomes `"86 138-1234-5678"` (the dial digits
/// are NOT stripped here; the field's value is the national number, so a paste
/// that still carries the country code is the caller's to trim).
pub fn phone_sanitize_number(value: &str) -> String {
    value
        .chars()
        .filter(|ch| ch.is_ascii_digit() || ch.is_whitespace() || *ch == '-')
        .collect()
}

/// Vue's `canonicalDial`: the `"+86"` shape whatever the caller spelled, or
/// `""` when nothing parses.
pub fn phone_canonical_dial(dial: &str) -> String {
    let bare = phone_normalize_dial(dial);
    if bare.is_empty() {
        String::new()
    } else {
        format!("+{bare}")
    }
}

/// The chip's dial text: the canonical code, or Vue's `"+…"` placeholder when
/// the prop carries no digits.
pub fn phone_chip_label(dial: &str) -> String {
    let canonical = phone_canonical_dial(dial);
    if canonical.is_empty() {
        "+…".to_string()
    } else {
        canonical
    }
}

/// Vue's `formatE164`: the national digits behind the dial code, `""` when
/// either side is empty. Vue's doc comment claims a leading trunk `0` is
/// dropped, but the implementation only strips non-digits — the mirror follows
/// the implementation (trunk prefixes stay caller territory).
pub fn phone_format_e164(dial: &str, national: &str) -> String {
    let bare = phone_normalize_dial(dial);
    if bare.is_empty() {
        return String::new();
    }
    let digits = phone_normalize_national(national);
    if digits.is_empty() {
        return String::new();
    }
    format!("+{bare}{digits}")
}

/// E.164 plausibility: a leading `+`, a non-zero first digit and at most 15
/// digits. This is the mirror's only validation helper — Vue leaves validity
/// to the host, which is why it is exported instead of wired into an emit.
pub fn phone_is_e164(value: &str) -> bool {
    let Some(rest) = value.strip_prefix('+') else {
        return false;
    };
    let digits: Vec<char> = rest.chars().collect();
    !digits.is_empty()
        && digits.len() <= 15
        && digits[0] != '0'
        && digits.iter().all(|ch| ch.is_ascii_digit())
}

/// Index of the first catalog row whose dial matches (Vue: `resolveDial` with
/// no ISO hint — the catalog order breaks shared prefixes).
pub fn phone_resolve_dial(dial: &str, countries: &[DialCodeEntry]) -> Option<usize> {
    let bare = phone_normalize_dial(dial);
    if bare.is_empty() {
        return None;
    }
    countries.iter().position(|entry| entry.dial == bare)
}

/// Index of the catalog row carrying this ISO code (Vue: `entryByIso`,
/// case-insensitive).
pub fn phone_iso_index(iso: &str, countries: &[DialCodeEntry]) -> Option<usize> {
    countries
        .iter()
        .position(|entry| entry.iso.eq_ignore_ascii_case(iso))
}

/// Localized country name: zh locales read the `zh` field, everything else
/// falls back to English (Vue: `dialCodeName`, which ships en + zh only).
pub fn phone_country_name(entry: &DialCodeEntry, language: Language) -> &'static str {
    match language {
        Language::ChineseSimplified | Language::ChineseTraditional => entry.zh,
        _ => entry.en,
    }
}

#[define_props]
pub struct PhoneInputProps {
    /// The national number only — never the dial code (Vue: `modelValue`).
    #[default]
    pub model_value: String,

    /// Dial code in any shape; kept as given, canonicalized only for matching
    /// (Vue: `dialCode`, default `"+86"`).
    #[default("+86".to_string())]
    pub dial_code: String,

    /// Country catalog; `None` uses the bundled [`DIAL_CODES`] (Vue:
    /// `countries`, defaulting to the same table).
    pub countries: Option<Vec<DialCodeEntry>>,

    /// Native placeholder for the number field.
    pub placeholder: Option<String>,

    #[default]
    pub disabled: bool,

    #[default]
    pub readonly: bool,

    /// Field size step, carried into the nested `HkInput`.
    #[default]
    pub size: InputSize,

    /// Caption above the box.
    pub label: Option<String>,

    /// Error ink + message line.
    pub error: Option<String>,

    /// Secondary message line, shown only when there is no error.
    pub hint: Option<String>,

    #[default]
    pub required: bool,

    /// Native `name` for the number field.
    pub name: Option<String>,

    /// Submit intent for Enter inside the number field.
    pub submit_on_enter: Option<EventHandler<()>>,

    /// The picker's disclosure state (Vue owns this internally; the mirror is
    /// controlled — see the header delta). The country list renders only while
    /// this is `true`.
    #[default]
    pub open: bool,

    /// Fired with the requested disclosure state when the chip is pressed.
    pub on_open_change: Option<EventHandler<bool>>,

    /// Vue's `update:modelValue`: the sanitized national number.
    pub on_input: Option<EventHandler<String>>,

    /// Vue's `update:dialCode` + `dialchange` (same payload, collapsed): the
    /// canonical `"+86"` shape.
    pub on_dial_change: Option<EventHandler<String>>,

    /// Vue's `change`: the composed E.164 on blur (`""` when the number is
    /// empty) — validate or submit without recomputing [`phone_format_e164`].
    pub on_change: Option<EventHandler<String>>,

    /// Vue's `focus` emit.
    pub on_focus: Option<EventHandler<FocusEvent>>,

    /// Vue's `blur` emit.
    pub on_blur: Option<EventHandler<FocusEvent>>,

    /// Host classes, appended to the root wrapper.
    #[default]
    pub class: String,

    /// Host style, applied to the root wrapper.
    #[default]
    pub style: String,
}

#[component]
pub fn PhoneInput(props: PhoneInputProps) -> Element {
    let i18n = use_i18n();
    let countries: &[DialCodeEntry] = props.countries.as_deref().unwrap_or(DIAL_CODES);
    let chip_label = phone_chip_label(&props.dial_code);
    let active =
        phone_resolve_dial(&props.dial_code, countries).and_then(|index| countries.get(index));
    let choose_country = hikari_i18n::t(
        "components.hk.phoneInput.chooseCountry",
        "Choose country code",
    );

    // The chip's accessible name follows Vue: "{country} {dial} — {purpose}"
    // when the dial resolves, the purpose alone when it does not.
    let chip_aria = match active {
        Some(entry) => format!(
            "{} {} — {}",
            phone_country_name(entry, i18n.language),
            chip_label,
            choose_country
        ),
        None => choose_country.clone(),
    };

    let open = props.open;
    let chip_disabled = props.disabled || props.readonly;
    let on_open_change = props.on_open_change.clone();
    let chip_click = move |_event: MouseEvent| {
        if let Some(handler) = on_open_change.as_ref() {
            handler.call(!open);
        }
    };

    let mut chip = VElement::new("button")
        .attr("type", "button")
        .class("hk-phone-chip")
        .attr("aria-haspopup", "listbox")
        .attr("aria-expanded", if open { "true" } else { "false" })
        .attr("aria-label", chip_aria)
        .attr("title", choose_country.clone())
        .on_click(chip_click);
    if chip_disabled {
        chip = chip.attr("disabled", "disabled");
    }
    chip = chip.child(VNode::Element(Box::new(
        VElement::new("span")
            .class("hk-phone-chip-dial")
            .child(VNode::Text(VText::new(&chip_label))),
    )));
    // SVG rides innerHTML on a dedicated `display:contents` host (inner_html
    // suppresses children, so the glyph cannot share an element with the text).
    chip = chip.child(VNode::Element(Box::new(
        VElement::new("span")
            .class("hk-phone-chip-caret")
            .attr("aria-hidden", "true")
            .child(VNode::Element(Box::new(
                VElement::new("div")
                    .style("display:contents")
                    .dangerous_inner_html(CHEVRON_DOWN_SVG),
            ))),
    )));
    let chip = VNode::Element(Box::new(chip));

    // The number field's own events, forwarded through the nested HkInput.
    let on_input = props.on_input.clone();
    let input_handler = move |value: String| {
        if let Some(handler) = on_input.as_ref() {
            handler.call(phone_sanitize_number(&value));
        }
    };
    let on_focus = props.on_focus.clone();
    let focus_handler = move |event: FocusEvent| {
        if let Some(handler) = on_focus.as_ref() {
            handler.call(event);
        }
    };
    let on_blur = props.on_blur.clone();
    let on_change = props.on_change.clone();
    let blur_dial = phone_canonical_dial(&props.dial_code);
    let blur_national = props.model_value.clone();
    let blur_handler = move |event: FocusEvent| {
        if let Some(handler) = on_blur.as_ref() {
            handler.call(event);
        }
        if let Some(handler) = on_change.as_ref() {
            handler.call(phone_format_e164(&blur_dial, &blur_national));
        }
    };

    let field = Input(InputProps {
        model_value: props.model_value.clone(),
        placeholder: props.placeholder.clone(),
        label: props.label.clone(),
        error: props.error.clone(),
        hint: props.hint.clone(),
        disabled: props.disabled,
        readonly: props.readonly,
        required: props.required,
        name: props.name.clone(),
        size: props.size,
        autocomplete: Some("tel-national".to_string()),
        prefix: Some(chip),
        oninput: Some(EventHandler::new(input_handler)),
        onfocus: Some(EventHandler::new(focus_handler)),
        onblur: Some(EventHandler::new(blur_handler)),
        submit_on_enter: props.submit_on_enter.clone(),
        ..Default::default()
    });

    // The inline country listbox — Vue's `HkAffixPicker` rows, minus search
    // and popup manager (see the header delta).
    let countries_panel = if open {
        let mut rows: Vec<VNode> = Vec::with_capacity(countries.len());
        for entry in countries {
            let selected = active.is_some_and(|active| active.iso == entry.iso);
            let name = phone_country_name(entry, i18n.language);
            let dial = format!("+{}", entry.dial);
            let iso = entry.iso;
            let on_dial_change = props.on_dial_change.clone();
            let on_open_change = props.on_open_change.clone();
            let row_click = move |_event: MouseEvent| {
                if let Some(handler) = on_dial_change.as_ref() {
                    handler.call(dial.clone());
                }
                if let Some(handler) = on_open_change.as_ref() {
                    handler.call(false);
                }
            };
            let row = VElement::new("button")
                .attr("type", "button")
                .class("hk-phone-input-country")
                .attr("role", "option")
                .attr("aria-selected", if selected { "true" } else { "false" })
                .attr("data-iso", iso)
                .attr("title", name)
                .style(COUNTRY_ROW_STYLE)
                .on_click(row_click)
                .child(VNode::Element(Box::new(
                    VElement::new("span")
                        .class("hk-phone-input-country-name")
                        .child(VNode::Text(VText::new(name))),
                )))
                .child(VNode::Element(Box::new(
                    VElement::new("span")
                        .class("hk-phone-input-country-dial")
                        .child(VNode::Text(VText::new(&format!("+{}", entry.dial)))),
                )));
            rows.push(VNode::Element(Box::new(row)));
        }
        rsx! {
            div {
                class: "hk-phone-input-countries",
                style: COUNTRY_PANEL_STYLE,
                "role": "listbox",
                "aria-label": choose_country,
                {VNode::Fragment(rows)}
            }
        }
    } else {
        empty_vnode()
    };

    let mut root_classes = String::from("hk-phone-input");
    if !props.class.is_empty() {
        root_classes.push(' ');
        root_classes.push_str(&props.class);
    }
    // The panel is absolutely positioned inside the root, so the root becomes
    // its containing block only while the list is showing.
    let mut root_style = String::new();
    if open {
        root_style.push_str("position:relative;");
    }
    if !props.style.is_empty() {
        root_style.push_str(&props.style);
    }

    rsx! {
        div {
            class: root_classes,
            style: root_style,
            {field}
            {countries_panel}
        }
    }
}

impl StyledComponent for PhoneInputComponent {
    fn styles() -> &'static str {
        // The canonical Vue sheet, compiled verbatim (no_hash keeps the
        // `.hk-phone-*` names literal so this CSS matches the Vue build).
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkPhoneInput.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "phone-input"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn phone_normalize_dial_accepts_every_shape() {
        assert_eq!(phone_normalize_dial("+86"), "86");
        assert_eq!(phone_normalize_dial("86"), "86");
        assert_eq!(phone_normalize_dial("0086"), "86");
        assert_eq!(phone_normalize_dial("+1"), "1");
        // Non-digits never survive, and one prefix pass only (Vue's two
        // anchored replaces).
        assert_eq!(phone_normalize_dial(" +86 "), "86");
        assert_eq!(phone_normalize_dial("+ 8 6"), "86");
        assert_eq!(phone_normalize_dial(""), "");
        assert_eq!(phone_normalize_dial("abc"), "");
        assert_eq!(phone_canonical_dial("0086"), "+86");
        assert_eq!(phone_canonical_dial(""), "");
        // The chip keeps Vue's `"+…"` placeholder when nothing parses.
        assert_eq!(phone_chip_label("+86"), "+86");
        assert_eq!(phone_chip_label("x"), "+…");
    }

    #[test]
    fn phone_sanitize_number_keeps_digits_spaces_dashes() {
        // A pasted E.164 loses only the plus — every digit survives, so the
        // country code is still in the value (Vue's `[^\d\s-]` filter).
        assert_eq!(
            phone_sanitize_number("+86 138-1234-5678"),
            "86 138-1234-5678"
        );
        assert_eq!(phone_sanitize_number("(020) 1234 5678"), "020 1234 5678");
        assert_eq!(phone_sanitize_number("13812345678"), "13812345678");
        assert_eq!(phone_sanitize_number("abc"), "");
        assert_eq!(phone_sanitize_number("1\t2"), "1\t2");
        assert_eq!(phone_normalize_national("138 1234-5678"), "13812345678");
    }

    #[test]
    fn phone_format_e164_composes_and_empties_like_vue() {
        assert_eq!(phone_format_e164("+86", "13812345678"), "+8613812345678");
        assert_eq!(phone_format_e164("0086", "138 1234 5678"), "+8613812345678");
        // Either side empty → "" (Vue's two early returns).
        assert_eq!(phone_format_e164("+86", ""), "");
        assert_eq!(phone_format_e164("+86", "abc"), "");
        assert_eq!(phone_format_e164("", "13812345678"), "");
        // The trunk zero is NOT stripped (Vue's implementation never does).
        assert_eq!(phone_format_e164("+39", "0212345678"), "+390212345678");
    }

    #[test]
    fn phone_validate_e164_checks_the_shape() {
        assert!(phone_is_e164("+8613812345678"));
        assert!(phone_is_e164("+1"));
        // 15 digits is the E.164 ceiling; 16 is not a number.
        assert!(phone_is_e164("+123456789012345"));
        assert!(!phone_is_e164("+1234567890123456"));
        // Missing sign, leading zero, stray characters and empty input.
        assert!(!phone_is_e164("8613812345678"));
        assert!(!phone_is_e164("+08613812345678"));
        assert!(!phone_is_e164("+86 138"));
        assert!(!phone_is_e164("+"));
        assert!(!phone_is_e164(""));
    }

    #[test]
    fn phone_catalog_resolves_the_first_match() {
        // Shared dial prefixes resolve by catalog order (+1 → us, +7 → ru).
        let us = phone_resolve_dial("+1", DIAL_CODES).expect("+1 resolves");
        assert_eq!(DIAL_CODES[us].iso, "us");
        let ru = phone_resolve_dial("7", DIAL_CODES).expect("+7 resolves");
        assert_eq!(DIAL_CODES[ru].iso, "ru");
        let cn = phone_resolve_dial("0086", DIAL_CODES).expect("+86 resolves");
        assert_eq!(DIAL_CODES[cn].iso, "cn");
        assert_eq!(phone_resolve_dial("+999", DIAL_CODES), None);
        assert_eq!(phone_resolve_dial("", DIAL_CODES), None);
        // China leads the catalog, like Vue's table.
        assert_eq!(DIAL_CODES[0].iso, "cn");
        assert_eq!(DIAL_CODES[0].dial, "86");
        // Every row must be addressable and carry both names.
        for entry in DIAL_CODES {
            assert!(!entry.iso.is_empty() && !entry.dial.is_empty());
            assert!(!entry.en.is_empty() && !entry.zh.is_empty());
            assert!(entry.dial.chars().all(|ch| ch.is_ascii_digit()));
            assert!(
                phone_iso_index(entry.iso, DIAL_CODES).is_some(),
                "{} must be addressable",
                entry.iso
            );
        }
    }

    #[test]
    fn phone_country_name_follows_the_locale() {
        let cn = &DIAL_CODES[0];
        assert_eq!(phone_country_name(cn, Language::English), "China");
        assert_eq!(
            phone_country_name(cn, Language::ChineseSimplified),
            "中华人民共和国"
        );
        assert_eq!(
            phone_country_name(cn, Language::ChineseTraditional),
            "中华人民共和国"
        );
        // Every other language falls back to English (the table ships en+zh).
        assert_eq!(phone_country_name(cn, Language::Japanese), "China");
        assert_eq!(phone_iso_index("CN", DIAL_CODES), Some(0));
        assert_eq!(phone_iso_index("zz", DIAL_CODES), None);
    }

    #[test]
    fn phone_props_default_matches_the_vue_props() {
        let props = PhoneInputProps::default();
        assert_eq!(props.model_value, "");
        // Vue's dialCode default is "+86".
        assert_eq!(props.dial_code, "+86");
        assert_eq!(props.countries, None);
        assert_eq!(props.placeholder, None);
        assert!(!props.disabled);
        assert!(!props.readonly);
        assert_eq!(props.size, InputSize::Medium);
        assert_eq!(props.label, None);
        assert_eq!(props.error, None);
        assert_eq!(props.hint, None);
        assert!(!props.required);
        assert_eq!(props.name, None);
        assert!(!props.open);
        assert!(props.on_open_change.is_none());
        assert!(props.on_input.is_none());
        assert!(props.on_dial_change.is_none());
        assert!(props.on_change.is_none());
        assert!(props.on_focus.is_none());
        assert!(props.on_blur.is_none());
        assert!(props.submit_on_enter.is_none());
        assert_eq!(props.class, "");
        assert_eq!(props.style, "");
    }

    #[test]
    fn phone_class_mapping_follows_the_vue_sheet() {
        // The size step rides into the nested HkInput mirror instead of a
        // phone-local class (Vue passes `size` straight through), and the chip
        // hooks are the ones HkPhoneInput.scss actually styles.
        let html = PhoneInput(PhoneInputProps {
            size: InputSize::Large,
            ..Default::default()
        })
        .render_to_html();
        for needle in [
            "hk-phone-input",
            "hk-phone-chip",
            "hk-phone-chip-dial",
            "hk-phone-chip-caret",
            "hk-input-affix hk-input-prefix",
            "hk-input-box-lg",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        assert_eq!(InputSize::Large.class_name(), "hk-input-box-lg");
        assert_eq!(InputSize::Small.class_name(), "hk-input-box-sm");
        assert_eq!(InputSize::Medium.class_name(), "hk-input-box-md");
    }

    #[test]
    fn phone_renders_the_chip_inside_the_nested_field() {
        let html = PhoneInput(PhoneInputProps {
            model_value: "13812345678".to_string(),
            label: Some("Phone".to_string()),
            ..Default::default()
        })
        .render_to_html();
        for needle in [
            "hk-phone-input",
            "hk-input-wrapper",
            "hk-input-box",
            "hk-input-prefix",
            "hk-phone-chip",
            "hk-phone-chip-dial",
            "+86",
            "hk-phone-chip-caret",
            "aria-haspopup=\"listbox\"",
            "aria-expanded=\"false\"",
            "autocomplete=\"tel-national\"",
            "value=\"13812345678\"",
            "hk-input-label",
            "Phone",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        // The list only exists while the disclosure is open.
        assert!(!html.contains("hk-phone-input-countries"), "{html}");
        assert!(!html.contains("role=\"listbox\""), "{html}");
    }

    #[test]
    fn phone_renders_the_country_list_when_open() {
        let html = PhoneInput(PhoneInputProps {
            open: true,
            dial_code: "1".to_string(),
            ..Default::default()
        })
        .render_to_html();
        for needle in [
            "hk-phone-input-countries",
            "role=\"listbox\"",
            "aria-expanded=\"true\"",
            "hk-phone-input-country",
            "hk-phone-input-country-name",
            "hk-phone-input-country-dial",
            "role=\"option\"",
            "data-iso=\"us\"",
            "data-iso=\"ca\"",
            "position:relative",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        // The resolved row is the selected one — first match wins for +1.
        assert!(
            html.contains("aria-selected=\"true\" data-iso=\"us\"")
                || html.contains("data-iso=\"us\" title=\"United States\""),
            "{html}"
        );
        assert_eq!(
            html.matches("role=\"option\"").count(),
            DIAL_CODES.len(),
            "one row per catalog entry: {html}"
        );
    }

    #[test]
    fn phone_honours_a_scoped_country_list() {
        let scoped = vec![DialCodeEntry {
            iso: "xa",
            dial: "999",
            en: "Example Land",
            zh: "示例国",
        }];
        let html = PhoneInput(PhoneInputProps {
            countries: Some(scoped),
            dial_code: "+999".to_string(),
            open: true,
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains("data-iso=\"xa\""), "{html}");
        assert!(html.contains("+999"), "{html}");
        assert!(!html.contains("data-iso=\"cn\""), "{html}");
        assert_eq!(html.matches("role=\"option\"").count(), 1, "{html}");
    }

    #[test]
    fn phone_styles_come_from_the_canonical_vue_sheet() {
        let css = PhoneInputComponent::styles();
        for needle in [
            ".hk-phone-input",
            ".hk-phone-chip-dial",
            ".hk-phone-chip-caret",
            // The open-state caret flip lives on an attribute selector; assert
            // the attribute name only (a compiler may re-quote it).
            "aria-expanded",
        ] {
            assert!(
                css.contains(needle),
                "phone css must carry the vue hook {needle}"
            );
        }
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored phone sheet"
        );
    }
}
