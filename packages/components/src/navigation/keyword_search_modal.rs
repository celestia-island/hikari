// hi-components/src/navigation/keyword_search_modal.rs
// KeywordSearchModal — mirror of the canonical Vue `HkKeywordSearchModal`:
// the modal keyword-search surface (a `40rem` HkModal carrying one search
// box and a result list; picks emit the record and close).
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkKeywordSearchModal.scss`, vendored under
// `src/styles/vue-mirror/` and listed in the mirror manifest), compiled with
// `no_hash` so the `.hk-kw-search*` class names are literal and identical in
// both forms. The frame is the mirrored `feedback::modal::Modal` (Vue mounts
// `HkModal` with `width="40rem"`; the ✕ / overlay-click / Esc close paths
// ride the modal's own `on_close`). DOM contract (mirrors the Vue render
// output):
//
//   Modal(width=40rem, title={title ?? i18n})
//     div.hk-kw-search
//       div.hk-kw-search-box
//         <svg .hk-kw-search-icon 15>            (raw SVG, see the deltas)
//         input.hk-kw-search-input type=text [value] [placeholder] autofocus
//         button.hk-kw-search-clear?             (query truthy)
//             type=button aria-label={i18n Clear}
//           <svg ✕ 14>
//       div.hk-kw-search-results                 (NO inner scroll region —
//                                               the modal window is THE
//                                               scroller, see below)
//         ── fuzzy arm ──
//         div.hk-kw-search-empty {hint}          (no rows)
//         | button.hk-kw-search-result ×n        (one per hit)
//             type=button > {result_row(record)?}
//         ── semantic arm (Vue: `semanticSearch` wired) ──
//         div.hk-kw-search-empty                 (loading-first / empty /
//                                               placeholder hint, see
//                                               `keyword_search_empty_hint`)
//         | button.hk-kw-search-result.hk-kw-search-result-semantic ×n
//             type=button > {semantic_result_row(item)?
//                            | span.hk-kw-search-semantic
//                                span.hk-kw-search-semantic-head
//                                  span.hk-kw-search-semantic-title?
//                                  span.hk-kw-search-semantic-score? {87%}
//                                span.hk-kw-search-semantic-snippet {snippet}
//                                span.hk-kw-search-semantic-source?}
//
// Vue prop mapping: `modelValue` → [`KeywordSearchModalProps::open`]
// (CONTROLLED), `records` + `fieldsOf` + `keyOf` → the typed
// [`KeywordSearchRecord`] list (the host precomputes key/fields — Vue's
// `unknown[]` plus two function props has no typed analogue; the Vue
// defaults `fieldsOf = () => []` / `keyOf = () => "0"` are an empty-fields
// record keyed `"0"`), `semanticSearch` → the CONTROLLED
// `semantic`/`semantic_results`/`semantic_loading` trio (see the deltas),
// `title`/`placeholder`/`emptyText`/`searchingText` → the like-named
// `Option`s (`??` is NULLISH in Vue: `Some("")` stays, only `None` falls
// back to the i18n string), the scoped `#result` / `#semanticResult` slots
// → the `result_row` / `semantic_result_row` render props. Emits:
// `update:modelValue` → `on_open_change`, `select` → `on_select` (the
// [`KeywordSearchPick`] carries whichever arm was picked).
//
// i18n: the five copy strings read `components.hk.keywordSearch.*` through
// `hikari_i18n::t` — the crate bundle's namespace (Vue resolves its own
// `hikari::keywordSearch.*`; the same literals, a different bundle — the
// `overlay/protocol_modal.rs` remap). All five keys already exist in the
// locale catalogs.
//
// The search engine is Vue's own, ported verbatim as the pure surface
// ([`keyword_search_fuzzy_score`], [`keyword_search_fuzzy_score_fields`],
// [`keyword_search_terms`], [`keyword_search_fuzzy`]): substring beats
// subsequence (1000 + length·10 + boundary 50), the subsequence walk scores
// runs (10 + run·4, +15 on a boundary char), fields take their best
// weight-multiplied match, every whitespace-separated term must match (AND),
// and hits sort by score descending with equal scores keeping record order
// (both engines' sort is stable).
//
// STATE CONTRACT (ledger L48): tairitsu 0.5.22 has no per-instance
// component state (`use_signal` allocates a fresh signal per render,
// `use_state` shares ONE slot per component type), so Vue's local `query` /
// `debouncedQuery` refs become the CONTROLLED `query` / `debounced_query`
// props with `on_query_change` / `on_debounced_query_change` writers. The
// fuzzy rows recompute from `debounced_query` every render (pure), so the
// host's debounce timer is the ONLY thing that moves the list.
//
// Behaviour deltas vs Vue (documented, not accidental):
//   * THE 120ms DEBOUNCE IS THE HOST'S: Vue schedules `debouncedQuery`
//     through `runtime/cronBus` (`scheduleCronAfter`); tairitsu 0.5.22 has
//     no render-scoped timer that survives a re-render (the same limit
//     `basic/search_input.rs` documents for its own `debounce`). The host
//     owns the window and writes `debounced_query` when it fires.
//   * THE SEMANTIC ENGINE IS THE HOST'S: Vue owns an async `runSemantic`
//     with a token guard against stale resolutions. No async runtime is
//     reachable from a render here, so the mirror takes the ARM (`semantic`
//     — Vue derives it from `typeof semanticSearch === "function"`), the
//     RESULTS and the LOADING flag as controlled props; `on_select` still
//     carries the whole [`SemanticSearchItem`] (Vue emits its `raw`).
//   * THE OPEN-EDGE RESET IS THE HOST'S: Vue's `watch(modelValue)` clears
//     `query` / `debouncedQuery` / the semantic state when the modal opens.
//     No watcher exists here — the host clears its own state on the opening
//     edge (it already owns all of it).
//   * the clear ✕ fires BOTH query writers with `""` (Vue also empties
//     `semanticResults` there; the host's semantic state follows the empty
//     `debounced_query` exactly like its own empty-query arm would).
//   * NO LIST SCROLL RESET: Vue scrolls `.hk-modal-body-scroll` to its top
//     when new results land (`resultsRef.closest(...)`); element handles are
//     never populated in this host stack, so the host scrolls its own
//     window. ONE SCROLLBAR PER WINDOW is preserved either way: the results
//     list owns no scroll region of its own (the 2026-09-08 audit), the
//     modal window is THE scroller.
//   * `oninput` forwards `InputEvent.data` (the crate-wide field convention,
//     `basic/input.rs`) instead of Vue's `target.value` re-read — the wasm
//     event payload carries no target value.
//   * the score chip reads [`keyword_search_semantic_score_percent`]:
//     Vue's `(score * 100).toFixed(0)`; Rust's `{:.0}` rounds exact `.5`
//     ties to even where JavaScript rounds away from zero — a float product
//     landing exactly on `.5` is the only divergence.
//   * the two glyphs are the Vue source's own SVG nodes, HTML-serialized
//     (self-closing `<circle/>` → `<circle></circle>`, the
//     `basic/search_input.rs` rule) and mounted through `dangerous_inner_html`
//     on a `display:contents` host: `rsx!`'s `svg {}` lands in the HTML
//     namespace in this host stack, so an SVG child can only ride innerHTML
//     (ledger L49).
//   * length math counts CHARS where JavaScript counts UTF-16 code units
//     (`q.length`, `value.length`) — identical for every BMP query.
//   * interactions bind the MOUSE family (`onclick`), per ledger L67: on
//     wasm32-wasip2 the browser glue dispatches only the mouse family as
//     typed events.

// These kernels are line-for-line ports of the upstream JS math: the negated
// comparisons, manual clamps and inline tuple types keep the port auditable
// against the source, so the idiomatic-rewrite lints are off here.
#![allow(clippy::neg_cmp_op_on_partial_ord)]
#![allow(clippy::collapsible_if)]
#![allow(clippy::type_complexity)]
#![allow(clippy::too_many_arguments)]
use std::rc::Rc;

use hikari_i18n::t;

use crate::feedback::{Modal, ModalProps};
use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct KeywordSearchModalComponent;

/// Vue's magnifier vnode (`.hk-kw-search-icon`, 15px), HTML-serialized.
const KEYWORD_SEARCH_ICON_SVG: &str = r#"<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="hk-kw-search-icon"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>"#;

/// Vue's ✕ vnode (14px, classless — the button owns the chrome),
/// HTML-serialized.
const KEYWORD_SEARCH_CLEAR_SVG: &str = r#"<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>"#;

// ── the search engine (Vue's own, ported verbatim) ───────────────────────

/// One searchable field of a record (Vue: `{ text, weight? }` — the weight
/// defaults to 1 and multiplies the field's best match score).
#[derive(Clone, PartialEq, Debug, Default)]
pub struct KeywordSearchField {
    pub text: String,
    /// Score multiplier (Vue: `weight = 1` when absent).
    pub weight: Option<f64>,
}

/// One searchable record (Vue: `records` + `keyOf` + `fieldsOf`, merged —
/// see the header prop mapping).
#[derive(Clone, PartialEq, Debug, Default)]
pub struct KeywordSearchRecord {
    /// The diff key (Vue: `keyOf(record)`).
    pub key: String,
    pub fields: Vec<KeywordSearchField>,
}

/// Vue's `FuzzyMatch`.
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub struct FuzzyMatch {
    pub matched: bool,
    pub score: f64,
}

/// One rendered hit (Vue's `results` computed entry).
#[derive(Clone, PartialEq, Debug, Default)]
pub struct KeywordSearchRow {
    /// The record's position in `records` (what `select` hands back).
    pub index: usize,
    /// The record's diff key.
    pub key: String,
    /// Sum of every term's best weighted field score (0 for an empty query).
    pub score: f64,
}

/// Vue's `fuzzyScore`: an empty query matches everything at 0; a substring
/// hit wins outright (`1000 + q.length·10 + 50` when it starts at 0 or
/// follows a boundary char); otherwise the subsequence walk scores runs
/// (`10 + run·4`, `+15` when a match follows a boundary char). Boundary
/// chars are Vue's two regex classes: `[\s_\-/.:]` for the substring edge
/// and `[\s_\-/.:,()]` for the walk (`\s` ported as Rust whitespace plus
/// the BOM, the one code point the two engines disagree on).
pub fn keyword_search_fuzzy_score(query: &str, haystack: &str) -> FuzzyMatch {
    if query.is_empty() {
        return FuzzyMatch {
            matched: true,
            score: 0.0,
        };
    }
    let q = query.to_lowercase();
    let h = haystack.to_lowercase();
    if h.is_empty() {
        return FuzzyMatch {
            matched: false,
            score: 0.0,
        };
    }

    // The substring arm (Vue: `h.indexOf(q)`).
    if let Some(sub_idx) = h.find(&q) {
        let boundary = sub_idx == 0
            || h[..sub_idx]
                .chars()
                .next_back()
                .is_some_and(is_substring_boundary);
        return FuzzyMatch {
            matched: true,
            score: 1000.0 + q.chars().count() as f64 * 10.0 + if boundary { 50.0 } else { 0.0 },
        };
    }

    // The subsequence walk.
    let q_chars: Vec<char> = q.chars().collect();
    let h_chars: Vec<char> = h.chars().collect();
    let mut qi = 0usize;
    let mut score = 0.0;
    let mut run: i64 = 0;
    let mut prev_matched_idx: isize = -2;
    for hi in 0..h_chars.len() {
        if qi >= q_chars.len() {
            break;
        }
        if h_chars[hi] == q_chars[qi] {
            run = if hi as isize == prev_matched_idx + 1 {
                run + 1
            } else {
                1
            };
            score += 10.0 + run as f64 * 4.0;
            let prev: char = if hi > 0 { h_chars[hi - 1] } else { ' ' };
            if is_subsequence_boundary(prev) {
                score += 15.0;
            }
            prev_matched_idx = hi as isize;
            qi += 1;
        }
    }
    FuzzyMatch {
        matched: qi == q_chars.len(),
        score: if qi == q_chars.len() { score } else { 0.0 },
    }
}

/// Vue's substring-edge class `[\s_\-/.:]` (`\s` ≈ Rust whitespace + BOM).
fn is_substring_boundary(c: char) -> bool {
    c.is_whitespace() || c == '\u{FEFF}' || matches!(c, '_' | '-' | '/' | '.' | ':')
}

/// Vue's walk class `[\s_\-/.:,()]`.
fn is_subsequence_boundary(c: char) -> bool {
    is_substring_boundary(c) || matches!(c, ',' | '(' | ')')
}

/// Vue's `fuzzyScoreFields`: the best weight-multiplied field match; a
/// strictly-greater score wins, so the FIRST field takes exact ties.
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub struct KeywordSearchFieldMatch {
    pub matched: bool,
    pub score: f64,
    /// The winning field's index (`-1` when nothing matched).
    pub field_index: i32,
}

pub fn keyword_search_fuzzy_score_fields(
    query: &str,
    fields: &[KeywordSearchField],
) -> KeywordSearchFieldMatch {
    let mut best = KeywordSearchFieldMatch {
        matched: false,
        score: 0.0,
        field_index: -1,
    };
    for (index, field) in fields.iter().enumerate() {
        let result = keyword_search_fuzzy_score(query, &field.text);
        if !result.matched {
            continue;
        }
        let weighted = result.score * field.weight.unwrap_or(1.0);
        if weighted > best.score {
            best = KeywordSearchFieldMatch {
                matched: true,
                score: weighted,
                field_index: index as i32,
            };
        }
    }
    best
}

/// Vue's term split: `query.trim().toLowerCase().split(/\s+/).filter(Boolean)`
/// — an empty or all-whitespace query has no terms.
pub fn keyword_search_terms(query: &str) -> Vec<String> {
    query
        .trim()
        .to_lowercase()
        .split_whitespace()
        .filter(|term| !term.is_empty())
        .map(str::to_string)
        .collect()
}

/// Vue's `fuzzySearch`, over the typed record list: an empty term list
/// returns every record at score 0 in host order; otherwise a record
/// survives only when EVERY term matches some field (AND), scored by the
/// sum of the terms' best weighted matches, sorted score-descending with
/// equal scores keeping record order (both engines' sort is stable).
pub fn keyword_search_fuzzy(query: &str, records: &[KeywordSearchRecord]) -> Vec<KeywordSearchRow> {
    let terms = keyword_search_terms(query);
    if terms.is_empty() {
        return records
            .iter()
            .enumerate()
            .map(|(index, record)| KeywordSearchRow {
                index,
                key: record.key.clone(),
                score: 0.0,
            })
            .collect();
    }
    let mut out: Vec<KeywordSearchRow> = Vec::new();
    for (index, record) in records.iter().enumerate() {
        let mut total = 0.0;
        let mut all_matched = true;
        for term in &terms {
            let result = keyword_search_fuzzy_score_fields(term, &record.fields);
            if !result.matched {
                all_matched = false;
                break;
            }
            total += result.score;
        }
        if all_matched {
            out.push(KeywordSearchRow {
                index,
                key: record.key.clone(),
                score: total,
            });
        }
    }
    // Stable, descending — `partial_cmp` with an `Equal` fallback keeps a
    // (never-produced) NaN from panicking while preserving order.
    out.sort_by(|a, b| {
        b.score
            .partial_cmp(&a.score)
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    out
}

// ── the semantic arm ─────────────────────────────────────────────────────

/// Vue's `SemanticSearchItem`. `raw` is Vue's `unknown` — the host hands
/// back whatever it threaded in (here a string payload), and `on_select`
/// carries the whole item so nothing is lost.
#[derive(Clone, PartialEq, Debug, Default)]
pub struct SemanticSearchItem {
    pub key: String,
    pub title: Option<String>,
    pub snippet: String,
    pub score: Option<f64>,
    pub source: Option<String>,
    pub raw: Option<String>,
}

/// What a pick hands the host (Vue's `select` emit: the record, or the
/// semantic item's `raw`).
#[derive(Clone, PartialEq, Debug)]
pub enum KeywordSearchPick {
    Record(KeywordSearchRecord),
    Semantic(SemanticSearchItem),
}

/// Vue's score chip: `(r.score * 100).toFixed(0)` — rendered only when the
/// score is a number (Rust: `Some`), rounding differences noted in the
/// header deltas.
pub fn keyword_search_semantic_score_percent(score: f64) -> String {
    format!("{:.0}", score * 100.0)
}

/// The results band's state machine (Vue's nested ternary, resolved here so
/// the render stays a mapping): `Some(text)` renders the
/// `.hk-kw-search-empty` hint, `None` renders rows. The fuzzy arm shows the
/// empty hint regardless of the query; the semantic arm shows the
/// placeholder hint while the debounced query is EMPTY (Vue:
/// `debouncedQuery.value ? emptyText : placeholder`), the searching hint
/// only while loading with nothing resolved yet.
pub fn keyword_search_empty_hint(
    semantic: bool,
    semantic_loading: bool,
    semantic_results_len: usize,
    fuzzy_rows_len: usize,
    debounced_query_empty: bool,
    empty_text: Option<&str>,
    searching_text: Option<&str>,
    placeholder: Option<&str>,
) -> Option<String> {
    if semantic {
        if semantic_loading && semantic_results_len == 0 {
            return Some(
                searching_text
                    .unwrap_or(&t("components.hk.keywordSearch.searching", "Searching…"))
                    .to_string(),
            );
        }
        if semantic_results_len == 0 {
            return Some(if !debounced_query_empty {
                empty_text
                    .unwrap_or(&t("components.hk.keywordSearch.noMatches", "No matches"))
                    .to_string()
            } else {
                placeholder
                    .unwrap_or(&t("components.hk.keywordSearch.placeholder", "Search…"))
                    .to_string()
            });
        }
        None
    } else if fuzzy_rows_len == 0 {
        Some(
            empty_text
                .unwrap_or(&t("components.hk.keywordSearch.noMatches", "No matches"))
                .to_string(),
        )
    } else {
        None
    }
}

// ── the component ────────────────────────────────────────────────────────

// Raw `#[derive(Props)]` (the `entry/template_field.rs` / `data/cell.rs`
// render-prop precedent), NOT `#[define_props]`: the DSL macro force-derives
// `Debug`/`PartialEq`, which no `Rc<dyn Fn>` field has — so `Default` and
// `PartialEq` are hand-written below exactly as the DSL would have generated
// them.
#[derive(Clone, Props)]
pub struct KeywordSearchModalProps {
    /// Controlled open state (Vue: `modelValue`, required).
    #[props(default)]
    pub open: bool,

    /// Modal heading (Vue: `title ?? t("hikari::keywordSearch.title")` —
    /// `??` is nullish, `Some("")` stays an empty heading).
    #[props(default)]
    pub title: Option<String>,

    /// Search-field placeholder (Vue: `placeholder ?? t(…placeholder)`).
    #[props(default)]
    pub placeholder: Option<String>,

    /// The searchable records (Vue: `records` + `keyOf` + `fieldsOf`).
    #[props(default)]
    pub records: Vec<KeywordSearchRecord>,

    /// Empty-state text (Vue: `emptyText ?? t(…noMatches)`).
    #[props(default)]
    pub empty_text: Option<String>,

    /// Semantic loading text (Vue: `searchingText ?? t(…searching)`).
    #[props(default)]
    pub searching_text: Option<String>,

    /// The semantic arm is live (Vue derives it from
    /// `typeof semanticSearch === "function"`; the host owns the engine).
    #[props(default)]
    pub semantic: bool,

    /// The resolved semantic hits (the host's async engine writes them).
    #[props(default)]
    pub semantic_results: Vec<SemanticSearchItem>,

    /// The semantic engine's loading flag.
    #[props(default)]
    pub semantic_loading: bool,

    /// The LIVE field text (Vue's local `query` ref, CONTROLLED per L48).
    #[props(default)]
    pub query: String,

    /// The debounced text the list searches on (Vue's local `debouncedQuery`
    /// ref — the host's timer writes it).
    #[props(default)]
    pub debounced_query: String,

    /// Per-row content for a fuzzy hit (Vue: the scoped `#result` slot).
    /// Absent renders the empty button Vue renders for a slot-less host.
    #[props(default)]
    pub result_row: Option<Rc<dyn Fn(&KeywordSearchRecord) -> Element>>,

    /// Per-row content for a semantic hit (Vue: the scoped `#semanticResult`
    /// slot). Absent renders Vue's default title/score/snippet/source tree.
    #[props(default)]
    pub semantic_result_row: Option<Rc<dyn Fn(&SemanticSearchItem) -> Element>>,

    /// Fires with the desired open state (Vue: `update:modelValue`).
    #[props(default)]
    pub on_open_change: Option<EventHandler<bool>>,

    /// Fires with the field's new text (Vue: the `query` ref writer).
    #[props(default)]
    pub on_query_change: Option<EventHandler<String>>,

    /// Fires when the debounce window should commit (the host's timer edge).
    #[props(default)]
    pub on_debounced_query_change: Option<EventHandler<String>>,

    /// Fires with the picked record/item, then the modal asks to close
    /// (Vue: `select` + `update:modelValue(false)`).
    #[props(default)]
    pub on_select: Option<EventHandler<KeywordSearchPick>>,
}

// The explicit field list documents the default surface next to the
// `#[props(default)]` attributes above.
#[allow(clippy::derivable_impls)]
impl Default for KeywordSearchModalProps {
    fn default() -> Self {
        Self {
            open: false,
            title: None,
            placeholder: None,
            records: Vec::new(),
            empty_text: None,
            searching_text: None,
            semantic: false,
            semantic_results: Vec::new(),
            semantic_loading: false,
            query: String::new(),
            debounced_query: String::new(),
            result_row: None,
            semantic_result_row: None,
            on_open_change: None,
            on_query_change: None,
            on_debounced_query_change: None,
            on_select: None,
        }
    }
}

impl PartialEq for KeywordSearchModalProps {
    /// Field-wise equality; the two render props compare by `Rc` identity —
    /// an `Rc<dyn Fn>` has no value equality (the `entry/template_field.rs`
    /// function-prop precedent).
    fn eq(&self, other: &Self) -> bool {
        self.open == other.open
            && self.title == other.title
            && self.placeholder == other.placeholder
            && self.records == other.records
            && self.empty_text == other.empty_text
            && self.searching_text == other.searching_text
            && self.semantic == other.semantic
            && self.semantic_results == other.semantic_results
            && self.semantic_loading == other.semantic_loading
            && self.query == other.query
            && self.debounced_query == other.debounced_query
            && match (&self.result_row, &other.result_row) {
                (None, None) => true,
                (Some(a), Some(b)) => Rc::ptr_eq(a, b),
                _ => false,
            }
            && match (&self.semantic_result_row, &other.semantic_result_row) {
                (None, None) => true,
                (Some(a), Some(b)) => Rc::ptr_eq(a, b),
                _ => false,
            }
            && self.on_open_change == other.on_open_change
            && self.on_query_change == other.on_query_change
            && self.on_debounced_query_change == other.on_debounced_query_change
            && self.on_select == other.on_select
    }
}

#[component]
pub fn KeywordSearchModal(props: KeywordSearchModalProps) -> Element {
    // The modal frame (Vue: HkModal, width 40rem, defaulted title).
    let title = props
        .title
        .clone()
        .unwrap_or_else(|| t("components.hk.keywordSearch.title", "Search"));
    let placeholder = props
        .placeholder
        .clone()
        .unwrap_or_else(|| t("components.hk.keywordSearch.placeholder", "Search…"));

    let rows = keyword_search_fuzzy(&props.debounced_query, &props.records);
    let hint = keyword_search_empty_hint(
        props.semantic,
        props.semantic_loading,
        props.semantic_results.len(),
        rows.len(),
        props.debounced_query.is_empty(),
        props.empty_text.as_deref(),
        props.searching_text.as_deref(),
        props.placeholder.as_deref(),
    );

    let query_text = props.query.clone();
    let shows_clear = !query_text.is_empty();

    // Vue's `pick`: emit the record, then close.
    let pick_open_writer = props.on_open_change.clone();
    let pick_select_writer = props.on_select.clone();
    let request_pick = move |pick: KeywordSearchPick| {
        if let Some(handler) = pick_select_writer.as_ref() {
            handler.call(pick);
        }
        if let Some(handler) = pick_open_writer.as_ref() {
            handler.call(false);
        }
    };

    // The field's input edge: the live query writer.
    let query_writer = props.on_query_change.clone();
    let on_query_input = move |event: InputEvent| {
        if let Some(handler) = query_writer.as_ref() {
            handler.call(event.data);
        }
    };

    // The clear ✕: both writers go empty (the semantic state follows the
    // empty debounced query — the host owns it, see the header deltas).
    let clear_query_writer = props.on_query_change.clone();
    let clear_debounce_writer = props.on_debounced_query_change.clone();
    let on_clear = move |_event: MouseEvent| {
        if let Some(handler) = clear_query_writer.as_ref() {
            handler.call(String::new());
        }
        if let Some(handler) = clear_debounce_writer.as_ref() {
            handler.call(String::new());
        }
    };

    // The results band: one branch per Vue's nested ternary.
    let mut band: Vec<VNode> = Vec::new();
    if let Some(hint_text) = hint {
        band.push(rsx! {
            div { class: "hk-kw-search-empty", {hint_text} }
        });
    } else if props.semantic {
        for item in &props.semantic_results {
            let pick = request_pick.clone();
            let pick_value = KeywordSearchPick::Semantic(item.clone());
            let content: Element = match props.semantic_result_row.as_ref() {
                Some(render) => render(item),
                None => {
                    let title = item.title.clone().filter(|title| !title.is_empty());
                    let score_text = item.score.map(keyword_search_semantic_score_percent);
                    let snippet = item.snippet.clone();
                    let source = item.source.clone().filter(|source| !source.is_empty());
                    rsx! {
                        span { class: "hk-kw-search-semantic",
                            span { class: "hk-kw-search-semantic-head",
                                if let Some(title) = title {
                                    span { class: "hk-kw-search-semantic-title", {title} }
                                }
                                if let Some(score) = score_text {
                                    span { class: "hk-kw-search-semantic-score", {score} }
                                }
                            }
                            span { class: "hk-kw-search-semantic-snippet", {snippet} }
                            if let Some(source) = source {
                                span { class: "hk-kw-search-semantic-source", {source} }
                            }
                        }
                    }
                }
            };
            band.push(rsx! {
                button {
                    class: "hk-kw-search-result hk-kw-search-result-semantic",
                    "type": "button",
                    onclick: move |_event: MouseEvent| pick(pick_value.clone()),
                    {content}
                }
            });
        }
    } else {
        for row in &rows {
            let pick = request_pick.clone();
            let pick_value = KeywordSearchPick::Record(props.records[row.index].clone());
            let content: Element = match props.result_row.as_ref() {
                Some(render) => render(&props.records[row.index]),
                // Vue renders `{slots.result?.({record})}` — a slot-less
                // host gets an empty (sheet-padded) button.
                None => empty_vnode(),
            };
            band.push(rsx! {
                button {
                    class: "hk-kw-search-result",
                    "type": "button",
                    onclick: move |_event: MouseEvent| pick(pick_value.clone()),
                    {content}
                }
            });
        }
    }
    let band = VNode::Fragment(band);

    // The modal's close paths (✕ / overlay click / Esc) all mean
    // `update:modelValue(false)` in Vue.
    let close_writer = props.on_open_change.clone();
    Modal(ModalProps {
        open: props.open,
        title: Some(title),
        width: "40rem".to_string(),
        on_close: Some(EventHandler::new(move |_event: MouseEvent| {
            if let Some(handler) = close_writer.as_ref() {
                handler.call(false);
            }
        })),
        children: rsx! {
            div { class: "hk-kw-search",
                div { class: "hk-kw-search-box",
                    div {
                        style: "display:contents",
                        dangerous_inner_html: KEYWORD_SEARCH_ICON_SVG,
                    }
                    input {
                        class: "hk-kw-search-input",
                        "type": "text",
                        value: query_text,
                        placeholder: placeholder,
                        autofocus: true,
                        oninput: on_query_input,
                    }
                    if shows_clear {
                        button {
                            class: "hk-kw-search-clear",
                            "type": "button",
                            "aria-label": t("components.hk.keywordSearch.clear", "Clear"),
                            onclick: on_clear,
                            div {
                                style: "display:contents",
                                dangerous_inner_html: KEYWORD_SEARCH_CLEAR_SVG,
                            }
                        }
                    }
                }
                div { class: "hk-kw-search-results",
                    {band}
                }
            }
        },
        ..Default::default()
    })
}

impl StyledComponent for KeywordSearchModalComponent {
    fn styles() -> &'static str {
        // The canonical Vue sheet, compiled verbatim (no_hash keeps the
        // `.hk-kw-search*` names literal so this CSS matches the Vue build).
        // The frame's own rules ride the mirrored HkModal sheet
        // (`feedback/modal.rs`).
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkKeywordSearchModal.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "keyword-search-modal"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn record(key: &str, texts: &[(&str, Option<f64>)]) -> KeywordSearchRecord {
        KeywordSearchRecord {
            key: key.to_string(),
            fields: texts
                .iter()
                .map(|(text, weight)| KeywordSearchField {
                    text: text.to_string(),
                    weight: *weight,
                })
                .collect(),
        }
    }

    #[test]
    fn keyword_search_fuzzy_score_ports_the_vue_arms() {
        // Empty query: everything matches at 0.
        assert_eq!(
            keyword_search_fuzzy_score("", "anything"),
            FuzzyMatch {
                matched: true,
                score: 0.0
            }
        );
        // Empty haystack with a query: never a match.
        assert_eq!(
            keyword_search_fuzzy_score("a", ""),
            FuzzyMatch {
                matched: false,
                score: 0.0
            }
        );
        // Substring, non-boundary: 1000 + 3·10.
        assert_eq!(
            keyword_search_fuzzy_score("set", "offset"),
            FuzzyMatch {
                matched: true,
                score: 1030.0
            }
        );
        // Substring at a boundary (`-`): the length term rides too —
        // 1000 + 3·10 + 50 = 1080.
        assert_eq!(
            keyword_search_fuzzy_score("set", "my-set"),
            FuzzyMatch {
                matched: true,
                score: 1080.0
            }
        );
        // Substring at index 0 is a boundary too (same 1080).
        assert_eq!(keyword_search_fuzzy_score("set", "settings").score, 1080.0);
        // Subsequence walks (no substring hit). "ab" in "a b": each match
        // follows a boundary char (index 0's implicit space, then the real
        // one) → 2 × (10 + 4 + 15) = 58.
        assert_eq!(
            keyword_search_fuzzy_score("ab", "a b"),
            FuzzyMatch {
                matched: true,
                score: 58.0
            }
        );
        // "ab" in "axb": a gets the boundary bonus (29), b follows 'x' with
        // no bonus and no run (14) → 43.
        assert_eq!(
            keyword_search_fuzzy_score("ab", "axb"),
            FuzzyMatch {
                matched: true,
                score: 43.0
            }
        );
        // "abc" in "abxc": no substring hit (a 2-char run case is
        // impossible — adjacent matches ARE the substring), so the walk
        // scores the a→b run continuation: (10+4+15) + (10+2·4) + a
        // fresh 14 for c = 61.
        assert_eq!(
            keyword_search_fuzzy_score("abc", "abxc"),
            FuzzyMatch {
                matched: true,
                score: 61.0
            }
        );
        // Incomplete subsequence: no match, score 0.
        assert_eq!(
            keyword_search_fuzzy_score("abc", "axb"),
            FuzzyMatch {
                matched: false,
                score: 0.0
            }
        );
        // Case-insensitive both sides.
        assert!(keyword_search_fuzzy_score("SET", "OffSet").matched);
    }

    #[test]
    fn keyword_search_fuzzy_score_fields_applies_weights_and_ties() {
        let fields = [
            KeywordSearchField {
                text: "alpha".to_string(),
                weight: Some(2.0),
            },
            KeywordSearchField {
                text: "beta".to_string(),
                weight: None,
            },
        ];
        // Both match "a" as a substring-at-0 (1010 + the 50 index-0
        // boundary bonus = 1060); the weight doubles the first field.
        let best = keyword_search_fuzzy_score_fields("a", &fields);
        assert!(best.matched);
        assert_eq!(best.score, 2120.0);
        assert_eq!(best.field_index, 0);
        // A query only the second field matches: weight defaults to 1.
        let second = keyword_search_fuzzy_score_fields("b", &fields);
        assert!(second.matched);
        assert_eq!(second.score, 1060.0);
        assert_eq!(second.field_index, 1);
        // Nothing matches: the -1 sentinel.
        let none = keyword_search_fuzzy_score_fields("z", &fields);
        assert!(!none.matched);
        assert_eq!(none.field_index, -1);
        // Exact ties keep the FIRST field (Vue's strict `>`).
        let twins = [
            KeywordSearchField {
                text: "same".to_string(),
                weight: None,
            },
            KeywordSearchField {
                text: "same".to_string(),
                weight: None,
            },
        ];
        assert_eq!(
            keyword_search_fuzzy_score_fields("s", &twins).field_index,
            0
        );
    }

    #[test]
    fn keyword_search_terms_split_like_vue() {
        assert!(keyword_search_terms("").is_empty());
        assert!(keyword_search_terms("   ").is_empty());
        assert_eq!(
            keyword_search_terms("  Foo  bar "),
            vec!["foo".to_string(), "bar".to_string()]
        );
        assert_eq!(keyword_search_terms("One"), vec!["one".to_string()]);
    }

    #[test]
    fn keyword_search_fuzzy_ands_terms_and_sorts_desc() {
        let records = vec![
            record("workspace", &[("Temporary workspace", None)]),
            record("settings", &[("Workspace settings", None)]),
            record("unrelated", &[("Network panel", None)]),
        ];
        // Both terms must match: "workspace settings" matches both;
        // "temporary workspace" misses "settings".
        let hits = keyword_search_fuzzy("workspace settings", &records);
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].key, "settings");
        assert_eq!(hits[0].index, 1);
        assert!(hits[0].score > 0.0);

        // Empty query: every record, score 0, host order.
        let all = keyword_search_fuzzy("", &records);
        assert_eq!(
            all.iter().map(|row| row.key.clone()).collect::<Vec<_>>(),
            vec!["workspace", "settings", "unrelated"]
        );
        assert!(all.iter().all(|row| row.score == 0.0));

        // Sort: a boundary-backed substring outranks a plain one — "a" in
        // "s a" starts after a space (1060), in "sa" after 's' (1010).
        let ranked_records = vec![
            record("sa-key", &[("sa", None)]),
            record("s-a-key", &[("s a", None)]),
        ];
        let ranked = keyword_search_fuzzy("a", &ranked_records);
        assert_eq!(ranked.len(), 2);
        assert_eq!(ranked[0].key, "s-a-key");
        assert_eq!(ranked[1].key, "sa-key");
        assert!(ranked[0].score > ranked[1].score);
    }

    #[test]
    fn keyword_search_empty_hint_covers_every_vue_arm() {
        // Fuzzy arm: empty list shows the no-matches hint, rows show none.
        assert_eq!(
            keyword_search_empty_hint(false, false, 0, 0, true, None, None, None),
            Some("No matches".to_string())
        );
        assert_eq!(
            keyword_search_empty_hint(false, false, 0, 2, false, None, None, None),
            None
        );
        // Fuzzy empty hint ignores the query (unlike the semantic arm).
        assert_eq!(
            keyword_search_empty_hint(false, false, 0, 0, false, None, None, None),
            Some("No matches".to_string())
        );
        // Custom texts win over the i18n defaults (Vue's `??`).
        assert_eq!(
            keyword_search_empty_hint(false, false, 0, 0, true, Some("Empty!"), None, None),
            Some("Empty!".to_string())
        );
        // Semantic loading-first: searching hint.
        assert_eq!(
            keyword_search_empty_hint(true, true, 0, 0, false, None, None, None),
            Some("Searching…".to_string())
        );
        assert_eq!(
            keyword_search_empty_hint(true, true, 0, 0, false, None, Some("Loading…"), None),
            Some("Loading…".to_string())
        );
        // Semantic idle with an empty query: the placeholder hint.
        assert_eq!(
            keyword_search_empty_hint(true, false, 0, 0, true, None, None, None),
            Some("Search…".to_string())
        );
        // Semantic idle with a query: no matches.
        assert_eq!(
            keyword_search_empty_hint(true, false, 0, 0, false, None, None, None),
            Some("No matches".to_string())
        );
        // Semantic results resolved: rows, no hint (loading or not).
        assert_eq!(
            keyword_search_empty_hint(true, true, 1, 0, false, None, None, None),
            None
        );
        assert_eq!(
            keyword_search_empty_hint(true, false, 2, 0, false, None, None, None),
            None
        );
    }

    #[test]
    fn keyword_search_score_percent_formats_like_to_fixed() {
        assert_eq!(keyword_search_semantic_score_percent(0.873), "87");
        assert_eq!(keyword_search_semantic_score_percent(1.0), "100");
        assert_eq!(keyword_search_semantic_score_percent(0.0), "0");
        assert_eq!(keyword_search_semantic_score_percent(0.999), "100");
    }

    #[test]
    fn keyword_search_defaults_match_the_vue_props() {
        let props = KeywordSearchModalProps::default();
        assert!(!props.open);
        assert_eq!(props.title, None);
        assert_eq!(props.placeholder, None);
        assert!(props.records.is_empty());
        assert_eq!(props.empty_text, None);
        assert_eq!(props.searching_text, None);
        assert!(!props.semantic);
        assert!(props.semantic_results.is_empty());
        assert!(!props.semantic_loading);
        assert_eq!(props.query, "");
        assert_eq!(props.debounced_query, "");
        assert!(props.result_row.is_none());
        assert!(props.semantic_result_row.is_none());
        assert!(props.on_open_change.is_none());
        assert!(props.on_query_change.is_none());
        assert!(props.on_debounced_query_change.is_none());
        assert!(props.on_select.is_none());
    }

    #[test]
    fn keyword_search_closed_renders_nothing() {
        let html = KeywordSearchModal(KeywordSearchModalProps {
            ..Default::default()
        })
        .render_to_html();
        assert!(html.is_empty(), "a closed modal mounts no surface: {html}");
    }

    #[test]
    fn keyword_search_renders_the_vue_fuzzy_contract() {
        let html = KeywordSearchModal(KeywordSearchModalProps {
            open: true,
            title: Some("Find a space".to_string()),
            placeholder: Some("Type a name…".to_string()),
            query: "work".to_string(),
            debounced_query: "work".to_string(),
            records: vec![
                record("workspace", &[("Temporary workspace", None)]),
                // NB: "Network panel" would MATCH "work" (netWORK) — the
                // filtered-out record must not carry the query at all.
                record("other", &[("Region panel", None)]),
            ],
            result_row: Some(Rc::new(|rec: &KeywordSearchRecord| {
                rsx! {
                    span { {rec.key.clone()} }
                }
            })),
            ..Default::default()
        })
        .render_to_html();

        for needle in [
            // The 40rem modal frame with the (explicit) title.
            r#"class="hk-modal-content""#,
            r#"class="hk-modal-title">Find a space<"#,
            // The search box + glyphs + field.
            r#"class="hk-kw-search""#,
            r#"class="hk-kw-search-box""#,
            r#"class="hk-kw-search-icon""#,
            r#"class="hk-kw-search-input""#,
            r#"placeholder="Type a name…""#,
            r#"value="work""#,
            "autofocus",
            // The live query shows the clear ✕.
            r#"class="hk-kw-search-clear""#,
            r#"aria-label="Clear""#,
            // The filtered row, carrying the slot's markup.
            r#"class="hk-kw-search-result""#,
            ">workspace<",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        // Only the matching record rendered, and no semantic arm.
        assert!(!html.contains(">other<"), "{html}");
        assert!(!html.contains("hk-kw-search-result-semantic"), "{html}");
        assert!(!html.contains("hk-kw-search-empty"), "{html}");
    }

    #[test]
    fn keyword_search_fuzzy_empty_renders_the_hint() {
        let html = KeywordSearchModal(KeywordSearchModalProps {
            open: true,
            empty_text: Some("Nothing here".to_string()),
            records: vec![record("workspace", &[("Temporary workspace", None)])],
            // A query that matches nothing — an EMPTY query returns every
            // record (Vue's no-terms arm), which is rows, not the hint.
            debounced_query: "zzz".to_string(),
            ..Default::default()
        })
        .render_to_html();
        assert!(
            html.contains(r#"class="hk-kw-search-empty">Nothing here<"#),
            "{html}"
        );
        // No result ROWS — but the `hk-kw-search-results` container
        // stays in the DOM: Vue renders it around the empty hint too.
        assert!(!html.contains(r#"class="hk-kw-search-result""#), "{html}");
        // The LIVE query is empty: no clear button (it follows `query`,
        // not `debounced_query`).
        assert!(!html.contains("hk-kw-search-clear"), "{html}");
    }

    #[test]
    fn keyword_search_renders_the_vue_semantic_contract() {
        let html = KeywordSearchModal(KeywordSearchModalProps {
            open: true,
            semantic: true,
            semantic_results: vec![SemanticSearchItem {
                key: "hit-1".to_string(),
                title: Some("Q3 report".to_string()),
                snippet: "…revenue by region…".to_string(),
                score: Some(0.873),
                source: Some("drive".to_string()),
                raw: Some("doc://q3".to_string()),
            }],
            ..Default::default()
        })
        .render_to_html();

        for needle in [
            r#"class="hk-kw-search-result hk-kw-search-result-semantic""#,
            r#"class="hk-kw-search-semantic""#,
            r#"class="hk-kw-search-semantic-head""#,
            r#"class="hk-kw-search-semantic-title">Q3 report<"#,
            r#"class="hk-kw-search-semantic-score">87<"#,
            r#"class="hk-kw-search-semantic-snippet">…revenue by region…<"#,
            r#"class="hk-kw-search-semantic-source">drive<"#,
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        // A title-less, score-less, source-less item drops its optional
        // spans (Vue's `&&` guards).
        let bare = KeywordSearchModal(KeywordSearchModalProps {
            open: true,
            semantic: true,
            semantic_results: vec![SemanticSearchItem {
                key: "bare".to_string(),
                snippet: "only text".to_string(),
                ..Default::default()
            }],
            ..Default::default()
        })
        .render_to_html();
        assert!(bare.contains("hk-kw-search-semantic-snippet"), "{bare}");
        assert!(!bare.contains("hk-kw-search-semantic-title"), "{bare}");
        assert!(!bare.contains("hk-kw-search-semantic-score"), "{bare}");
        assert!(!bare.contains("hk-kw-search-semantic-source"), "{bare}");
    }

    #[test]
    fn keyword_search_semantic_idle_renders_the_placeholder_hint() {
        let html = KeywordSearchModal(KeywordSearchModalProps {
            open: true,
            semantic: true,
            ..Default::default()
        })
        .render_to_html();
        // No query yet: the placeholder hint, not "no matches".
        assert!(html.contains(r#">Search…<"#), "{html}");
    }

    #[test]
    fn keyword_search_picking_a_row_emits_and_closes() {
        let picks = std::rc::Rc::new(std::cell::Cell::new(0usize));
        let closes = std::rc::Rc::new(std::cell::Cell::new(0usize));
        let pick_counter = std::rc::Rc::clone(&picks);
        let close_counter = std::rc::Rc::clone(&closes);

        let node = KeywordSearchModal(KeywordSearchModalProps {
            open: true,
            debounced_query: "work".to_string(),
            records: vec![record("workspace", &[("Temporary workspace", None)])],
            on_select: Some(EventHandler::new(move |pick: KeywordSearchPick| {
                pick_counter.set(pick_counter.get() + 1);
                assert!(matches!(
                    pick,
                    KeywordSearchPick::Record(ref record) if record.key == "workspace"
                ));
            })),
            on_open_change: Some(EventHandler::new(move |open: bool| {
                assert!(!open);
                close_counter.set(close_counter.get() + 1);
            })),
            ..Default::default()
        });

        // Serialization drops handlers, so walk the tree and INVOKE the
        // row's click listener (the `feedback/modal.rs` test pattern):
        // deleting the wiring leaves it a no-op.
        fn click_first_result(node: &Element) -> bool {
            match node {
                VNode::Element(el) => {
                    if el.class.to_string().contains("hk-kw-search-result")
                        && let Some(handler) = el.event_handlers.get("click")
                    {
                        handler.borrow_mut()(
                            Box::new(MouseEvent::default()) as Box<dyn tairitsu_vdom::EventData>
                        );
                        return true;
                    }
                    el.children.iter().any(click_first_result)
                }
                VNode::Fragment(children) => children.iter().any(click_first_result),
                _ => false,
            }
        }
        assert!(click_first_result(&node), "no result row found");
        assert_eq!(picks.get(), 1, "the wired select handler must run");
        assert_eq!(closes.get(), 1, "the pick must also close the modal");
    }

    #[test]
    fn keyword_search_styles_come_from_the_canonical_vue_sheet() {
        let css = KeywordSearchModalComponent::styles();
        for class in [
            ".hk-kw-search",
            ".hk-kw-search-box",
            ".hk-kw-search-icon",
            ".hk-kw-search-input",
            ".hk-kw-search-clear",
            ".hk-kw-search-results",
            ".hk-kw-search-result",
            ".hk-kw-search-empty",
            ".hk-kw-search-semantic",
            ".hk-kw-search-semantic-score",
        ] {
            assert!(
                css.contains(class),
                "keyword-search-modal css must carry the vue class {class:?}"
            );
        }
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored keyword-search-modal sheet"
        );
        assert_eq!(KeywordSearchModalComponent::name(), "keyword-search-modal");
    }
}
