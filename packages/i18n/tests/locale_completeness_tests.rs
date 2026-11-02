//! Completeness guard for the shipped component locale catalogues.
//!
//! `src/locales/en/components.toml` is the source of truth for the `hk.*`
//! component strings. Every other locale must cover exactly the same key set
//! with exactly the same placeholders; a missing key falls back to the English
//! literal at runtime, so a half-translated catalogue would otherwise ship
//! silently. A locale also must not invent keys English does not carry — the
//! extra key would be dead weight that no component ever reads.
//!
//! The key-set and placeholder tests walk the `src/locales` directories rather
//! than `Language::ALL`, because those are file-level facts. The walk carries
//! an explicit tripwire: the expected catalogue count is pinned, so a NEW
//! locale directory fails until it is registered with `Language` and added to
//! the sentinel table below. Existing catalogues are therefore guarded whether
//! or not their variant is wired; adding one without wiring it is a deliberate
//! red, not a silent pass.
//!
//! Two tests cover the direction a key-set check cannot see. A wholesale
//! revert to English would leave every key present and every placeholder
//! intact, so `every_locale_catalogue_is_actually_translated` requires each
//! locale to differ from English in at least [`MIN_DIVERGENT_VALUES`] values
//! and to carry its own sentinel string. `every_locale_variant_resolves_its_own_bundle`
//! then proves the public API selects that catalogue: `from_code` must produce
//! the variant and `provide_i18n` must install a bundle carrying the sentinel.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

use hikari_i18n::{I18nKeys, Language, lookup, provide_i18n, use_i18n};

/// A locale whose values are byte-identical to English in fewer places than
/// this is not a translation. The most cognate-heavy catalogue currently sits
/// well above it (fr, 262 divergent); a wholesale English revert scores 0.
const MIN_DIVERGENT_VALUES: usize = 250;

/// One distinctive translated value per catalogue, used both as a
/// "not the English copy" sentinel and as the reachability probe. Keep this in
/// sync with the catalogue count tripwire: a new locale must add its row here.
const SENTINELS: [(&str, &str, &str); 10] = [
    ("ar", "components.hk.statusBar.connected", "متصل"),
    ("de", "components.hk.statusBar.connected", "Verbunden"),
    ("es", "components.hk.statusBar.connected", "Conectado"),
    ("fr", "components.hk.statusBar.connected", "Connecté"),
    ("ja", "components.hk.statusBar.connected", "接続済み"),
    ("ko", "components.hk.statusBar.connected", "연결됨"),
    ("pt", "components.hk.statusBar.connected", "Conectado"),
    ("ru", "components.hk.statusBar.connected", "Подключено"),
    ("zh-Hans", "components.hk.statusBar.connected", "已连接"),
    ("zh-Hant", "components.hk.statusBar.connected", "已連線"),
];

fn locales_dir() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("src")
        .join("locales")
}

/// Every locale directory that ships a component catalogue, except English.
fn locale_codes() -> Vec<String> {
    let mut codes: Vec<String> = std::fs::read_dir(locales_dir())
        .expect("read src/locales")
        .map(|entry| entry.expect("read locales entry"))
        .filter(|entry| entry.file_type().expect("locale file type").is_dir())
        .map(|entry| entry.file_name().to_string_lossy().into_owned())
        .filter(|code| code != "en")
        .collect();
    codes.sort();
    codes
}

fn sentinel_for(code: &str) -> (&'static str, &'static str) {
    SENTINELS
        .iter()
        .find(|(sentinel_code, _, _)| *sentinel_code == code)
        .map(|(_, key, value)| (*key, *value))
        .unwrap_or_else(|| {
            panic!("no sentinel registered for locale {code:?} — add a row to SENTINELS")
        })
}

fn read_bundle_at(code: &str) -> BTreeMap<String, String> {
    let path = locales_dir().join(code).join("components.toml");
    let source =
        std::fs::read_to_string(&path).unwrap_or_else(|e| panic!("read {}: {e}", path.display()));
    let table: I18nKeys =
        toml::from_str(&source).unwrap_or_else(|e| panic!("parse {}: {e}", path.display()));
    let mut values = BTreeMap::new();
    flatten("", &table, &mut values);
    values
}

fn flatten(prefix: &str, table: &I18nKeys, out: &mut BTreeMap<String, String>) {
    for (key, value) in table {
        let dotted = if prefix.is_empty() {
            key.clone()
        } else {
            format!("{prefix}.{key}")
        };
        match value {
            toml::Value::Table(child) => flatten(&dotted, child, out),
            toml::Value::String(text) => {
                out.insert(dotted, text.clone());
            }
            other => panic!("{dotted}: expected a string, got {}", other.type_str()),
        }
    }
}

/// The `{name}` tokens in a value, in order.
fn placeholders(text: &str) -> Vec<String> {
    let mut tokens = Vec::new();
    let mut rest = text;
    while let Some(open) = rest.find('{') {
        let after = &rest[open + 1..];
        let Some(close) = after.find('}') else {
            break;
        };
        let inner = &after[..close];
        if !inner.is_empty() && inner.chars().all(|c| c.is_alphanumeric() || c == '_') {
            tokens.push(inner.to_string());
        }
        rest = &after[close + 1..];
    }
    tokens
}

fn english() -> BTreeMap<String, String> {
    read_bundle_at("en")
}

/// Every English `hk.*` key must exist in every shipped locale, and no locale
/// may carry a key English does not have.
#[test]
fn every_locale_catalogue_covers_the_english_component_bundle() {
    let en = english();
    assert!(
        en.len() > 200,
        "the English bundle unexpectedly shrank to {} keys — did a merge drop the component strings?",
        en.len()
    );
    let codes = locale_codes();
    // Deliberate tripwire: a new catalogue must be registered with `Language`
    // and given a SENTINELS row, so this file cannot silently claim a locale
    // the runtime cannot select. Update the count (and SENTINELS) together.
    assert_eq!(
        codes.len(),
        10,
        "expected ten non-English component catalogues, found {codes:?} — \
         register a new locale in Language and SENTINELS, then bump this count"
    );

    let mut failures = Vec::new();
    for code in &codes {
        let locale = read_bundle_at(code);
        for key in en.keys() {
            if !locale.contains_key(key) {
                failures.push(format!("{code}: missing {key}"));
            }
        }
        for key in locale.keys() {
            if !en.contains_key(key) {
                failures.push(format!("{code}: extra {key}"));
            }
        }
        for (key, value) in &locale {
            if value.trim().is_empty() {
                failures.push(format!("{code}: {key} is empty"));
            }
        }
    }
    assert!(
        failures.is_empty(),
        "component catalogues are out of sync with English:\n{}",
        failures.join("\n")
    );
}

/// Every locale value must carry the same placeholder multiset as English.
///
/// A dropped or renamed placeholder renders a literal `{count}` in the UI, so
/// this compares both the token names and their multiplicity per key.
#[test]
fn every_locale_value_keeps_the_english_placeholders() {
    let en = english();
    let mut failures = Vec::new();
    for code in locale_codes() {
        let locale = read_bundle_at(&code);
        for (key, source) in &en {
            let Some(translated) = locale.get(key) else {
                // Reported by the completeness test; skip here.
                continue;
            };
            let mut expected = placeholders(source);
            let mut actual = placeholders(translated);
            expected.sort();
            actual.sort();
            if expected != actual {
                failures.push(format!(
                    "{code}: {key} has {actual:?}, English has {expected:?}"
                ));
            }
        }
    }
    assert!(
        failures.is_empty(),
        "placeholder drift between English and the locale catalogues:\n{}",
        failures.join("\n")
    );
}

/// A catalogue that is merely key-complete can still be English.
///
/// This is the guard for the regression the key-set checks cannot see: the
/// reviewer reverted all 283 `ru` values to English and every test stayed
/// green. Each locale must now (a) differ from English in at least
/// [`MIN_DIVERGENT_VALUES`] values and (b) carry its own sentinel string, so a
/// wholesale revert — full or 282/283 behind one pinned value — fails.
#[test]
fn every_locale_catalogue_is_actually_translated() {
    let en = english();
    let mut failures = Vec::new();
    for code in locale_codes() {
        let locale = read_bundle_at(&code);
        let identical = locale
            .iter()
            .filter(|(key, value)| en.get(*key) == Some(*value))
            .count();
        let divergent = locale.len().saturating_sub(identical);
        if divergent < MIN_DIVERGENT_VALUES {
            failures.push(format!(
                "{code}: only {divergent} of {} values differ from English \
                 (need {MIN_DIVERGENT_VALUES}) — is this a copy of the English bundle?",
                locale.len()
            ));
        }
        let (key, expected) = sentinel_for(&code);
        match locale.get(key) {
            Some(actual) if actual == expected => {}
            Some(actual) => failures.push(format!(
                "{code}: sentinel {key} is {actual:?}, expected {expected:?}"
            )),
            None => failures.push(format!("{code}: sentinel {key} is missing")),
        }
        if en.get(key) == Some(&expected.to_string()) {
            failures.push(format!(
                "{code}: sentinel {key} equals the English value — pick a distinctive one"
            ));
        }
    }
    assert!(
        failures.is_empty(),
        "catalogues look untranslated:\n{}",
        failures.join("\n")
    );
}

/// Every language the crate advertises must ship its component catalogue.
#[test]
fn every_supported_language_ships_its_component_catalogue() {
    let mut missing = Vec::new();
    for &language in Language::ALL {
        let path = locales_dir().join(language.code()).join("components.toml");
        if !path.is_file() {
            missing.push(format!("{}: no {}", language.code(), path.display()));
        }
    }
    assert!(
        missing.is_empty(),
        "supported languages without a catalogue: {missing:?}"
    );
}

/// Every `Language` variant must select its OWN catalogue end to end.
///
/// `from_code` must produce the variant (the German/Portuguese gap shipped
/// because the variant never existed), and the bundle `provide_i18n` installs
/// must carry that locale's sentinel — not the English fallback. Asserting a
/// distinctive translated value, not merely "different from English", keeps a
/// copy-paste of the English bundle from passing.
#[test]
fn every_locale_variant_resolves_its_own_bundle() {
    let mut failures = Vec::new();
    for &language in Language::ALL {
        if language == Language::English {
            continue;
        }
        let code = language.code();
        if let Err(err) = check_variant_resolves(language) {
            failures.push(format!("{code}: {err}"));
        }
    }
    assert!(
        failures.is_empty(),
        "languages whose catalogue does not resolve:\n{}",
        failures.join("\n")
    );
}

fn check_variant_resolves(language: Language) -> Result<(), String> {
    let code = language.code();
    let parsed = Language::from_code(code)
        .ok_or_else(|| format!("Language::from_code({code:?}) returned None"))?;
    if parsed != language {
        return Err(format!(
            "Language::from_code({code:?}) returned {parsed:?}, not {language:?}"
        ));
    }
    let (key, expected) = sentinel_for(code);
    provide_i18n(language, I18nKeys::new());
    let context = use_i18n();
    if context.language != language {
        return Err("provide_i18n did not install the language".to_string());
    }
    match lookup(&context.keys, key) {
        Some(actual) if actual == expected => Ok(()),
        Some(actual) => Err(format!(
            "{key} resolved to {actual:?}, expected the translated {expected:?}"
        )),
        None => Err(format!("{key} is not embedded")),
    }
}

/// Every shipped catalogue must resolve through the public API, not merely
/// exist on disk: `provide_i18n` merges the language's embedded defaults, and
/// each English key must then be found in that merged table. This catches a
/// `Language::code` / `include_dir!` mismatch that files alone cannot.
#[test]
fn the_embedded_bundles_resolve_through_the_public_api() {
    let en = english();
    for &language in Language::ALL {
        provide_i18n(language, I18nKeys::new());
        let context = use_i18n();
        assert_eq!(
            context.language,
            language,
            "{}: provide_i18n did not install the language",
            language.code()
        );
        for key in en.keys() {
            assert!(
                lookup(&context.keys, key).is_some(),
                "{}: {key} is not embedded (check Language::code and the locales dir)",
                language.code()
            );
        }
    }
}
