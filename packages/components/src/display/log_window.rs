// hi-components/src/display/log_window.rs
// LogWindow — mirror of the canonical Vue `HkLogWindow`.
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkLogWindow.scss`, vendored under
// `src/styles/vue-mirror/` and guarded by
// `tests/vue_mirror_drift_tests.rs`), compiled with `no_hash` so the
// `.s-log-*` class names are literal and identical in both forms. DOM
// contract (Vue's render output, minus the modal shell):
//
//   div.s-log-viewer [+class]                     (style: height)
//     div.s-log-toolbar
//       div.s-log-tabs
//         button.s-log-tab [data-active]          (one per tab)
//       div.s-log-controls
//         button.s-log-btn [data-active]          (pause / resume)
//         button.s-log-btn [data-active]          (autoscroll)
//         button.s-log-btn [disabled]             (copy)
//         button.s-log-btn [disabled]             (clear)
//     div.s-log-viewer-scroll data-follow         (style: overflow-y:auto)
//       div.s-log-empty                           (no visible lines)
//       div.s-log-entry.s-log-entry-{level}       (one per visible line)
//
// Delta vs Vue (documented):
//
//   * The Vue component IS a modal (`HModal` around the body, with the
//     `title` / `width` props). The mirror renders the BODY and leaves the
//     window chrome to the host; `model_value` still gates it — closed
//     renders an empty node, matching "the window is not on screen".
//   * `paused` is a controlled prop. Vue keeps an internal ref that a
//     watcher re-syncs from the prop; a mirror has no reactive state, so
//     the toggle reports the next value through `on_pause_toggle` and the
//     caller owns the flip.
//   * Autoscroll: Vue hands `autoFollow` to `HScrollContainer`, whose
//     scrollbar engine pins the viewport in the DOM. The mirror computes
//     the same arming rule ([`log_follow_active`]) and exposes it as
//     `data-follow`; when `max_lines` bounds the list it also paints only
//     the tail window, so a following viewer still shows the newest lines
//     without a scroll effect. `max_lines == 0` leaves the pin to the host
//     scroll region.
//   * The clipboard is a browser API with no wasm32-wasip2 equivalent, so
//     the copy control emits the joined text through `on_copy` instead of
//     writing it (Vue: `useClipboard().copy(lines.join("\n"))`).
//   * `levels` is a mirror-side extension: Vue only CLASSIFIES a line
//     ([`log_level_of`] → `s-log-entry-{level}`), the mirror can also
//     filter by the same classification.
//   * Icons: lucide's Pause / Play / ScrollText / Copy / Eraser map to
//     `MdiIcon::{Pause, Play, List, ContentCopy, Close}` (the minimal icon
//     set ships no scroll-text or eraser glyph).

// The parser/mirror branches keep Vue's nesting for readability; clippy's
// collapsible-if rewrite makes the token loops harder to compare line by line.
#![allow(clippy::collapsible_if)]
use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct LogWindowComponent;

/// Vue props `height` default.
pub const LOG_WINDOW_DEFAULT_HEIGHT: &str = "55vh";

/// One line's severity as Vue's `levelOf` derives it.
#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub enum LogLevel {
    Error,
    Warn,
    Debug,
    #[default]
    Info,
}

impl LogLevel {
    /// The `s-log-entry-{suffix}` class suffix (Vue's template literal).
    pub fn suffix(self) -> &'static str {
        match self {
            LogLevel::Error => "error",
            LogLevel::Warn => "warn",
            LogLevel::Debug => "debug",
            LogLevel::Info => "info",
        }
    }

    /// The full entry modifier class.
    pub fn class_name(self) -> String {
        format!("s-log-entry-{}", self.suffix())
    }

    pub fn label(self) -> &'static str {
        self.suffix()
    }
}

/// One tab of the viewer (Vue: `HLogTab`). Line arrays are props: the
/// caller keeps appending, and `on_clear` tells it to reset the buffer.
#[derive(Clone, PartialEq, Debug, Default)]
pub struct LogTab {
    pub key: String,
    pub title: String,
    pub lines: Vec<String>,
}

/// Classify one log line (Vue: `levelOf`, first match wins).
pub fn log_level_of(line: &str) -> LogLevel {
    let upper = line.to_uppercase();
    if upper.contains("ERROR") {
        LogLevel::Error
    } else if upper.contains("WARN") {
        LogLevel::Warn
    } else if upper.contains("DEBUG") || upper.contains("TRACE") {
        LogLevel::Debug
    } else {
        LogLevel::Info
    }
}

/// Whether a level survives the filter (no filter = keep everything; an
/// empty filter list means the same, so a cleared selector never blanks the
/// window by accident).
pub fn log_level_matches(level: LogLevel, filter: Option<&[LogLevel]>) -> bool {
    match filter {
        None => true,
        Some(levels) => levels.is_empty() || levels.contains(&level),
    }
}

/// The lines a level filter keeps, in order.
pub fn log_filter_lines<'a>(lines: &'a [String], filter: Option<&[LogLevel]>) -> Vec<&'a String> {
    lines
        .iter()
        .filter(|line| log_level_matches(log_level_of(line), filter))
        .collect()
}

/// The tab Vue would activate: the requested key while it still exists,
/// else the first tab, else none (Vue's `watch(props.tabs, …)` reset).
pub fn log_resolve_active_tab(tabs: &[LogTab], requested: Option<&str>) -> Option<String> {
    if tabs.is_empty() {
        return None;
    }
    if let Some(key) = requested {
        if tabs.iter().any(|tab| tab.key == key) {
            return Some(key.to_string());
        }
    }
    Some(tabs[0].key.clone())
}

/// The active tab's lines (empty when no tab resolves).
pub fn log_active_lines<'a>(tabs: &'a [LogTab], key: Option<&str>) -> &'a [String] {
    match key {
        Some(key) => tabs
            .iter()
            .find(|tab| tab.key == key)
            .map(|tab| tab.lines.as_slice())
            .unwrap_or(&[]),
        None => &[],
    }
}

/// Vue: `autoFollow={autoscroll && !paused}`.
pub fn log_follow_active(autoscroll: bool, paused: bool) -> bool {
    autoscroll && !paused
}

/// Vue: `currentLines.join("\n")` — the copy payload.
pub fn log_copy_text(lines: &[String]) -> String {
    lines.join("\n")
}

/// The `[start, end)` tail window when the follow pin is armed and
/// `max_lines` bounds the list (`0` = unbounded).
pub fn log_tail_window(total: usize, max_lines: usize) -> (usize, usize) {
    if max_lines == 0 || total <= max_lines {
        return (0, total);
    }
    (total - max_lines, total)
}

#[define_props]
pub struct LogWindowProps {
    /// Window open state (Vue `modelValue`); closed renders nothing.
    #[default]
    pub model_value: bool,

    /// The tabs, each an ordered list of log lines (Vue: required).
    #[default]
    pub tabs: Vec<LogTab>,

    /// Controlled active tab key; unknown keys fall back to the first tab.
    pub active_tab: Option<String>,

    /// Controlled pause state (suppresses follow while armed).
    #[default]
    pub paused: bool,

    /// Autoscroll toggle (Vue's internal `autoscroll` ref, default true).
    #[default(true)]
    pub autoscroll: bool,

    /// Level allow-list; `None` (or an empty list) keeps every line.
    pub levels: Option<Vec<LogLevel>>,

    /// Tail-window bound while following; `0` paints every line.
    #[default]
    pub max_lines: usize,

    /// Body height as a CSS length (Vue default `55vh`).
    #[default(String::from(LOG_WINDOW_DEFAULT_HEIGHT))]
    pub height: String,

    /// A tab was clicked (next active key).
    pub on_tab_select: Option<EventHandler<String>>,

    /// The pause control was toggled (next `paused` value).
    pub on_pause_toggle: Option<EventHandler<bool>>,

    /// The autoscroll control was toggled (next `autoscroll` value).
    pub on_autoscroll_toggle: Option<EventHandler<bool>>,

    /// The clear control was pressed (the active tab key).
    pub on_clear: Option<EventHandler<String>>,

    /// The copy control was pressed (the joined lines).
    pub on_copy: Option<EventHandler<String>>,

    #[default]
    pub class: String,
}

#[component]
pub fn LogWindow(props: LogWindowProps) -> Element {
    // Vue opens with the modal closed, so a closed window paints nothing.
    if !props.model_value {
        return empty_vnode();
    }

    let active_key = log_resolve_active_tab(&props.tabs, props.active_tab.as_deref());
    let active_lines = log_active_lines(&props.tabs, active_key.as_deref());
    let visible = log_filter_lines(active_lines, props.levels.as_deref());
    let follow = log_follow_active(props.autoscroll, props.paused);
    let (start, end) = log_tail_window(visible.len(), props.max_lines);
    let window: Vec<String> = visible[start..end]
        .iter()
        .map(|line| line.to_string())
        .collect();
    let copy_text = log_copy_text(active_lines);
    let has_lines = !active_lines.is_empty();

    let paused_now = props.paused;
    let autoscroll_now = props.autoscroll;
    let on_tab = props.on_tab_select.clone();
    let on_pause = props.on_pause_toggle.clone();
    let on_autoscroll = props.on_autoscroll_toggle.clone();
    let on_clear = props.on_clear.clone();
    let on_copy = props.on_copy.clone();
    let clear_key = active_key.clone().unwrap_or_default();

    // ── tabs ────────────────────────────────────────────────────────────
    let mut tab_nodes: Vec<VNode> = Vec::with_capacity(props.tabs.len());
    for tab in &props.tabs {
        let key = tab.key.clone();
        let handler = on_tab.clone();
        let mut button = VElement::new("button")
            .class("s-log-tab")
            .attr("type", "button")
            .child(VNode::Text(VText::new(&tab.title)))
            .on_click(move |_: MouseEvent| {
                if let Some(handler) = &handler {
                    handler.call(key.clone());
                }
            });
        if active_key.as_deref() == Some(tab.key.as_str()) {
            button = button.attr("data-active", "");
        }
        tab_nodes.push(VNode::Element(Box::new(button)));
    }

    // ── controls ────────────────────────────────────────────────────────
    let pause_icon = if paused_now {
        MdiIcon::Play
    } else {
        MdiIcon::Pause
    };
    let pause_title = if paused_now {
        hikari_i18n::t("components.hk.log_window.resume", "Resume")
    } else {
        hikari_i18n::t("components.hk.log_window.pause", "Pause")
    };
    let mut pause_button = VElement::new("button")
        .class("s-log-btn")
        .attr("type", "button")
        .attr("title", pause_title)
        .child(rsx! { Icon { icon: pause_icon, size: 12 } })
        .on_click(move |_: MouseEvent| {
            if let Some(handler) = &on_pause {
                handler.call(!paused_now);
            }
        });
    if paused_now {
        pause_button = pause_button.attr("data-active", "");
    }

    let mut autoscroll_button = VElement::new("button")
        .class("s-log-btn")
        .attr("type", "button")
        .attr(
            "title",
            hikari_i18n::t("components.hk.log_window.autoscroll", "Autoscroll"),
        )
        .child(rsx! { Icon { icon: MdiIcon::List, size: 12 } })
        .on_click(move |_: MouseEvent| {
            if let Some(handler) = &on_autoscroll {
                handler.call(!autoscroll_now);
            }
        });
    if autoscroll_now {
        autoscroll_button = autoscroll_button.attr("data-active", "");
    }

    let mut copy_button = VElement::new("button")
        .class("s-log-btn")
        .attr("type", "button")
        .attr(
            "title",
            hikari_i18n::t("components.hk.log_window.copy", "Copy"),
        )
        .child(rsx! { Icon { icon: MdiIcon::ContentCopy, size: 12 } })
        .on_click(move |_: MouseEvent| {
            if let Some(handler) = &on_copy {
                handler.call(copy_text.clone());
            }
        });
    if !has_lines {
        copy_button = copy_button.attr("disabled", "");
    }

    let mut clear_button = VElement::new("button")
        .class("s-log-btn")
        .attr("type", "button")
        .attr(
            "title",
            hikari_i18n::t("components.hk.log_window.clear", "Clear"),
        )
        .child(rsx! { Icon { icon: MdiIcon::Close, size: 12 } })
        .on_click(move |_: MouseEvent| {
            if let Some(handler) = &on_clear {
                handler.call(clear_key.clone());
            }
        });
    if !has_lines {
        clear_button = clear_button.attr("disabled", "");
    }

    let controls = VElement::new("div").class("s-log-controls").children(vec![
        VNode::Element(Box::new(pause_button)),
        VNode::Element(Box::new(autoscroll_button)),
        VNode::Element(Box::new(copy_button)),
        VNode::Element(Box::new(clear_button)),
    ]);
    let tabs = VElement::new("div").class("s-log-tabs").children(tab_nodes);
    let toolbar = VElement::new("div").class("s-log-toolbar").children(vec![
        VNode::Element(Box::new(tabs)),
        VNode::Element(Box::new(controls)),
    ]);

    // ── scroll region ───────────────────────────────────────────────────
    let mut scroll = VElement::new("div")
        .class("s-log-viewer-scroll")
        .attr("data-follow", if follow { "true" } else { "false" })
        .style("overflow-y:auto;min-height:0");
    if window.is_empty() {
        scroll = scroll.child(rsx! {
            div {
                class: "s-log-empty",
                {hikari_i18n::t("components.hk.log_window.empty", "No log lines yet")}
            }
        });
    } else {
        let mut entries: Vec<VNode> = Vec::with_capacity(window.len());
        for text in &window {
            let level = log_level_of(text);
            entries.push(VNode::Element(Box::new(
                VElement::new("div")
                    .class(format!("s-log-entry {}", level.class_name()))
                    .child(VNode::Text(VText::new(text))),
            )));
        }
        scroll = scroll.children(entries);
    }

    let mut root_classes = String::from("s-log-viewer");
    if !props.class.is_empty() {
        root_classes.push(' ');
        root_classes.push_str(&props.class);
    }
    let root = VElement::new("div")
        .class(root_classes)
        .style(format!("height:{}", props.height))
        .child(VNode::Element(Box::new(toolbar)))
        .child(VNode::Element(Box::new(scroll)));
    VNode::Element(Box::new(root))
}

impl StyledComponent for LogWindowComponent {
    fn styles() -> &'static str {
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkLogWindow.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "log-window"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn line(text: &str) -> String {
        text.to_string()
    }

    fn tab(key: &str, title: &str, lines: Vec<String>) -> LogTab {
        LogTab {
            key: key.to_string(),
            title: title.to_string(),
            lines,
        }
    }

    fn sample_tabs() -> Vec<LogTab> {
        vec![
            tab("api", "API", vec![line("boot ok"), line("WARN: slow")]),
            tab("worker", "Worker", vec![line("ERROR: boom")]),
        ]
    }

    #[test]
    fn log_window_defaults_match_the_vue_props() {
        let props = LogWindowProps::default();
        assert!(!props.model_value);
        assert!(props.tabs.is_empty());
        assert!(props.active_tab.is_none());
        assert!(!props.paused);
        assert!(props.autoscroll);
        assert!(props.levels.is_none());
        assert_eq!(props.max_lines, 0);
        assert_eq!(props.height, "55vh");
        assert!(props.on_tab_select.is_none());
        assert!(props.on_pause_toggle.is_none());
        assert!(props.on_autoscroll_toggle.is_none());
        assert!(props.on_clear.is_none());
        assert!(props.on_copy.is_none());
        assert_eq!(props.class, "");
    }

    #[test]
    fn level_of_matches_the_vue_precedence() {
        assert_eq!(log_level_of("ERROR: boom"), LogLevel::Error);
        assert_eq!(log_level_of("error and warn"), LogLevel::Error);
        assert_eq!(log_level_of("warning: careful"), LogLevel::Warn);
        assert_eq!(log_level_of("Debug: detail"), LogLevel::Debug);
        assert_eq!(log_level_of("trace: detail"), LogLevel::Debug);
        assert_eq!(log_level_of("hello there"), LogLevel::Info);
        assert_eq!(LogLevel::default(), LogLevel::Info);
    }

    #[test]
    fn level_classes_map_to_the_stylesheet() {
        assert_eq!(LogLevel::Error.class_name(), "s-log-entry-error");
        assert_eq!(LogLevel::Warn.class_name(), "s-log-entry-warn");
        assert_eq!(LogLevel::Debug.class_name(), "s-log-entry-debug");
        assert_eq!(LogLevel::Info.class_name(), "s-log-entry-info");
        assert_eq!(LogLevel::Info.suffix(), "info");
        assert_eq!(LogLevel::Warn.label(), "warn");
    }

    #[test]
    fn level_filter_keeps_matching_lines_in_order() {
        let lines = vec![line("boot ok"), line("WARN: disk"), line("ERROR: nope")];
        assert_eq!(log_filter_lines(&lines, None).len(), 3);
        let errors = log_filter_lines(&lines, Some(&[LogLevel::Error]));
        assert_eq!(errors.len(), 1);
        assert_eq!(errors[0], "ERROR: nope");
        // An empty allow-list keeps everything.
        assert_eq!(log_filter_lines(&lines, Some(&[])).len(), 3);
        assert!(!log_level_matches(LogLevel::Info, Some(&[LogLevel::Warn])));
        assert!(log_level_matches(LogLevel::Warn, Some(&[LogLevel::Warn])));
    }

    #[test]
    fn active_tab_resolution_falls_back_to_the_first() {
        let tabs = sample_tabs();
        assert_eq!(
            log_resolve_active_tab(&tabs, Some("worker")),
            Some("worker".to_string())
        );
        assert_eq!(
            log_resolve_active_tab(&tabs, Some("gone")),
            Some("api".to_string())
        );
        assert_eq!(log_resolve_active_tab(&tabs, None), Some("api".to_string()));
        assert_eq!(log_resolve_active_tab(&[], None), None);
    }

    #[test]
    fn active_lines_read_the_resolved_tab() {
        let tabs = sample_tabs();
        assert_eq!(log_active_lines(&tabs, Some("worker")).len(), 1);
        assert!(log_active_lines(&tabs, Some("gone")).is_empty());
        assert!(log_active_lines(&tabs, None).is_empty());
    }

    #[test]
    fn follow_is_armed_only_when_autoscroll_and_not_paused() {
        assert!(log_follow_active(true, false));
        assert!(!log_follow_active(true, true));
        assert!(!log_follow_active(false, false));
    }

    #[test]
    fn copy_text_joins_with_newlines() {
        assert_eq!(log_copy_text(&[line("a"), line("b")]), "a\nb");
        assert_eq!(log_copy_text(&[]), "");
    }

    #[test]
    fn tail_window_bounds_only_when_armed() {
        assert_eq!(log_tail_window(10, 4), (6, 10));
        assert_eq!(log_tail_window(10, 0), (0, 10));
        assert_eq!(log_tail_window(3, 9), (0, 3));
    }

    #[test]
    fn closed_log_window_renders_nothing() {
        let html = LogWindow(LogWindowProps {
            tabs: sample_tabs(),
            ..Default::default()
        })
        .render_to_html();
        assert!(html.is_empty(), "closed window must paint nothing: {html}");
    }

    #[test]
    fn open_log_window_renders_the_vue_dom_contract() {
        let html = LogWindow(LogWindowProps {
            model_value: true,
            tabs: sample_tabs(),
            class: "my-logs".to_string(),
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains("s-log-viewer"), "{html}");
        assert!(html.contains("s-log-toolbar"), "{html}");
        assert!(html.contains("s-log-tab"), "{html}");
        assert!(html.contains("s-log-controls"), "{html}");
        assert!(html.contains("s-log-viewer-scroll"), "{html}");
        assert!(html.contains("data-follow=\"true\""), "{html}");
        assert!(html.contains("my-logs"), "{html}");
        assert!(html.contains("height:55vh"), "{html}");
        // Vue marks the first tab active when nothing else is requested.
        assert_eq!(html.matches("data-active").count(), 2, "{html}");
        // The active tab's lines carry their level class.
        assert!(html.contains("s-log-entry s-log-entry-info"), "{html}");
        assert!(html.contains("s-log-entry s-log-entry-warn"), "{html}");
        assert!(html.contains("boot ok"), "{html}");
        // The copy/clear controls are enabled while lines exist.
        assert!(!html.contains("disabled"), "{html}");
    }

    #[test]
    fn log_window_empty_state_and_filters() {
        let html = LogWindow(LogWindowProps {
            model_value: true,
            tabs: vec![tab("api", "API", vec![])],
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains("s-log-empty"), "{html}");
        assert!(html.contains("No log lines yet"), "{html}");
        assert!(html.contains("disabled"), "{html}");

        let filtered = LogWindow(LogWindowProps {
            model_value: true,
            tabs: sample_tabs(),
            levels: Some(vec![LogLevel::Error]),
            ..Default::default()
        })
        .render_to_html();
        assert!(!filtered.contains("boot ok"), "{filtered}");
        // The worker tab holds the only error line, so the api tab paints none.
        assert!(!filtered.contains("s-log-entry-info"), "{filtered}");
        assert!(filtered.contains("s-log-empty"), "{filtered}");
    }

    #[test]
    fn log_window_escapes_caller_lines() {
        let html = LogWindow(LogWindowProps {
            model_value: true,
            tabs: vec![tab("api", "API", vec![line("<script>alert(1)</script>")])],
            ..Default::default()
        })
        .render_to_html();
        assert!(!html.contains("<script>"), "{html}");
        assert!(html.contains("&lt;script&gt;"), "{html}");
    }

    #[test]
    fn log_window_styles_come_from_the_canonical_vue_sheet() {
        let css = LogWindowComponent::styles();
        assert!(
            css.contains(".s-log-viewer") && css.contains(".s-log-entry"),
            "log window css must carry the vue classes"
        );
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored log window sheet"
        );
    }
}
