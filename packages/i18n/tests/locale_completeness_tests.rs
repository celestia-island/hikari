//! Completeness guard for the shipped component locale catalogues.
//!
//! `src/locales/en/components.toml` is the source of truth for the `hk.*`
//! component strings. Every other locale must cover exactly the same key set
//! with exactly the same placeholders; a missing key falls back to the English
//! literal at runtime, so a half-translated catalogue would otherwise ship
//! silently. A locale also must not invent keys English does not carry — the
//! extra key would be dead weight that no component ever reads.
//!
//! The completeness tests walk the `src/locales` directories (not
//! `Language::ALL`) so a catalogue stays guarded even before its variant is
//! wired into the language enum. The reachability test at the bottom covers
//! the other direction end to end: a `Language` variant whose bundle does not
//! resolve, or a shipped catalogue that maps back to English, fails there.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

use hikari_i18n::{I18nKeys, Language, lookup, provide_i18n, use_i18n};

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
    assert_eq!(
        codes.len(),
        10,
        "expected ten non-English component catalogues, found {codes:?}"
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

/// German and Portuguese are selectable and resolve to their own catalogues.
///
/// This is the end-to-end reachability guard: `from_code` must produce the
/// variant, and the bundle `provide_i18n` installs must carry the translated
/// text (not the English fallback). Asserting a distinctive translated value
/// — not merely "different from English" — keeps a future copy-paste of the
/// English bundle from passing.
#[test]
fn german_and_portuguese_catalogues_are_reachable() {
    let cases = [
        ("de", "components.hk.statusBar.connected", "Verbunden"),
        ("pt", "components.hk.statusBar.connected", "Conectado"),
    ];
    for (code, key, expected) in cases {
        let language = Language::from_code(code)
            .unwrap_or_else(|| panic!("Language::from_code({code:?}) returned None"));
        assert_eq!(
            language.code(),
            code,
            "Language::from_code({code:?}) round-trips through code()"
        );
        provide_i18n(language, I18nKeys::new());
        let context = use_i18n();
        assert_eq!(
            context.language, language,
            "{code}: provide_i18n did not install the language"
        );
        assert_eq!(
            lookup(&context.keys, key),
            Some(expected),
            "{code}: {key} did not resolve to the translated value"
        );
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
