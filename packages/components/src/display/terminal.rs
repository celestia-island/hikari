// hi-components/src/display/terminal.rs
// Terminal — mirror of the canonical Vue `HkTerminal`.
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkTerminal.scss`, vendored under
// `src/styles/vue-mirror/` and guarded by
// `tests/vue_mirror_drift_tests.rs`), compiled with `no_hash` so the
// `.hk-terminal*` class names are literal and identical in both forms.
// DOM contract:
//
//   div.hk-terminal [+class]
//       role="log"  data-cols data-rows data-follow data-cursor-blink
//       (style: --hk-terminal-{bg,fg,cursor,selection} + font-size)
//     div.terminal                      (the screen scroll region)
//       div.hk-terminal-line            (one per painted line)
//       span.hk-terminal-cursor         (caret on the last line)
//
// Delta vs Vue (documented, and the reason this file is a line surface
// rather than an emulator): the Vue component owns an xterm.js instance —
// canvas/VT emulation, a fit addon, kitty/SIXEL/iTerm2 image decoding, a
// `.xterm-viewport` overlay scrollbar and an imperative
// `write`/`writeln`/`clear`/`reset`/`fit`/`focus` handle. None of that
// exists for wasm32-wasip2: there is no xterm.js, no canvas and no
// ResizeObserver, so the mirror renders the SCREEN as a line-oriented
// host-driven surface instead:
//
//   * the caller feeds committed `lines` (the counterpart of Vue's
//     imperative `write`) and the mirror paints them;
//   * [`terminal_split_chunk`] is the pure equivalent of `write` for a
//     host holding raw PTY chunks (CR overwrite, BS, TAB, LF, ANSI strip);
//   * [`terminal_trim_scrollback`] is the `scrollback` option,
//     [`terminal_wrap_line`] the autowrap at `cols`, and
//     [`terminal_tail_window`] the `autoFit`-plus-follow viewport. All four
//     are pure functions covered by the tests below.
//   * `autoFit` / `enableImages` are mount-only DOM behaviours with no
//     mirror equivalent and are therefore NOT modelled as props (a prop
//     that changes nothing is worse than an absent one).
//
// Theming: Vue derives the xterm theme from the hikari channels by reading
// `getComputedStyle` at mount. The mirror cannot read computed styles, so
// the same four channels arrive as props and are resolved through
// [`terminal_channel_to_hex`] (Vue's `channelToHex`: an `r g b` triplet
// becomes `#rrggbb`, an already-full color passes through, anything else
// falls back). They leave as `.hk-terminal` custom properties; only the
// caret is painted from them, because the xterm canvas no longer exists.

// The parser/mirror branches keep Vue's nesting for readability; clippy's
// collapsible-if rewrite makes the token loops harder to compare line by line.
#![allow(clippy::collapsible_if)]
use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct TerminalComponent;

/// Vue props `cols` default.
pub const TERMINAL_DEFAULT_COLS: usize = 80;
/// Vue props `rows` default.
pub const TERMINAL_DEFAULT_ROWS: usize = 24;
/// Vue props `scrollback` default.
pub const TERMINAL_DEFAULT_SCROLLBACK: usize = 2000;
/// Vue props `fontSize` default.
pub const TERMINAL_DEFAULT_FONT_SIZE: f64 = 13.0;
/// Vue's `FAMILY_FALLBACK`.
pub const TERMINAL_FONT_FAMILY_FALLBACK: &str =
    "ui-monospace, 'SF Mono', Menlo, Consolas, 'DejaVu Sans Mono', monospace";
/// Vue's `deriveXtermTheme` fallbacks.
pub const TERMINAL_BACKGROUND_FALLBACK: &str = "#14161a";
pub const TERMINAL_FOREGROUND_FALLBACK: &str = "#e6e6e6";
pub const TERMINAL_CURSOR_FALLBACK: &str = "#7aa2f7";
pub const TERMINAL_SELECTION_FALLBACK: &str = "#3b4356";
/// Column step for a TAB byte (the VT default).
pub const TERMINAL_TAB_WIDTH: usize = 8;

fn terminal_push_at(buffer: &mut Vec<char>, index: usize, ch: char) {
    while buffer.len() < index {
        buffer.push(' ');
    }
    if index < buffer.len() {
        buffer[index] = ch;
    } else {
        buffer.push(ch);
    }
}

/// Drop ANSI/VT escape sequences from one line: CSI (`ESC [ … final`),
/// OSC (`ESC ] … BEL` / `ESC \`) and any other two-byte escape. Vue never
/// sees these as text (xterm consumes them); the mirror has no
/// interpreter, so it strips them instead of painting control garbage.
pub fn terminal_strip_ansi(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    let mut chars = input.chars().peekable();
    while let Some(ch) = chars.next() {
        if ch != '\u{1b}' {
            out.push(ch);
            continue;
        }
        match chars.next() {
            // CSI: ESC '[' <params> <final 0x40..=0x7e>
            Some('[') => {
                while let Some(&c) = chars.peek() {
                    chars.next();
                    if ('\u{40}'..='\u{7e}').contains(&c) {
                        break;
                    }
                }
            }
            // OSC: ESC ']' <payload> terminated by BEL or ESC '\'
            Some(']') => {
                while let Some(c) = chars.next() {
                    if c == '\u{7}' {
                        break;
                    }
                    if c == '\u{1b}' && chars.peek() == Some(&'\\') {
                        chars.next();
                        break;
                    }
                }
            }
            // Any other escape is a two-byte unit: drop both halves.
            Some(_) => {}
            None => {}
        }
    }
    out
}

/// Resolve one theme channel to `#rrggbb` (Vue: `channelToHex`).
///
/// An `r g b` triplet whose parts are all finite and within 0..=255 becomes
/// `#rrggbb`; an already-full color (`#hex`, `rgb(…)`, `var(…)`) passes
/// through verbatim; everything else takes `fallback`.
pub fn terminal_channel_to_hex(raw: &str, fallback: &str) -> String {
    let parts: Vec<&str> = raw.split_whitespace().collect();
    if parts.len() == 3 {
        let mut hex = String::from("#");
        let mut ok = true;
        for part in &parts {
            match part.parse::<f64>() {
                Ok(number) if number.is_finite() && (0.0..=255.0).contains(&number) => {
                    hex.push_str(&format!("{:02x}", number.round() as i64));
                }
                _ => {
                    ok = false;
                    break;
                }
            }
        }
        if ok {
            return hex;
        }
    }
    let trimmed = raw.trim();
    if !trimmed.is_empty() && !trimmed.contains(' ') {
        return trimmed.to_string();
    }
    fallback.to_string()
}

/// Feed one raw chunk into a line buffer — the pure counterpart of Vue's
/// imperative `write`.
///
/// Returns the completed lines plus the new unterminated tail. Semantics:
/// `\n` commits a line, `\r` returns to column 0 (so a progress bar
/// rewriting itself collapses to its last frame, exactly as on screen),
/// TAB advances to the next multiple of [`TERMINAL_TAB_WIDTH`], BS steps
/// back one column, every other C0 control byte is dropped, and ANSI
/// sequences are stripped first.
///
/// Delta: an escape sequence split across two chunks is not reassembled
/// (xterm buffers it); a host feeding raw PTY output should hand over whole
/// sequences or strip them before splitting.
pub fn terminal_split_chunk(pending: &str, chunk: &str) -> (Vec<String>, String) {
    let clean = terminal_strip_ansi(chunk);
    let mut lines: Vec<String> = Vec::new();
    let mut current: Vec<char> = pending.chars().collect();
    let mut column: usize = current.len();
    for ch in clean.chars() {
        match ch {
            '\n' => {
                lines.push(current.iter().collect());
                current.clear();
                column = 0;
            }
            '\r' => column = 0,
            '\u{8}' => column = column.saturating_sub(1),
            '\t' => {
                let next = ((column / TERMINAL_TAB_WIDTH) + 1) * TERMINAL_TAB_WIDTH;
                while column < next {
                    terminal_push_at(&mut current, column, ' ');
                    column += 1;
                }
            }
            c if (c as u32) < 0x20 || c == '\u{7f}' => {}
            c => {
                terminal_push_at(&mut current, column, c);
                column += 1;
            }
        }
    }
    (lines, current.iter().collect())
}

/// Apply the `scrollback` option: keep at most `scrollback` committed
/// lines. `0` disables the cap (Vue passes 0 straight to xterm, which reads
/// it as "no scrollback"; the mirror has no live screen to keep, so a
/// zero cap would render an empty terminal — the cap lifting is the
/// documented reading here).
pub fn terminal_trim_scrollback(lines: Vec<String>, scrollback: usize) -> Vec<String> {
    if scrollback == 0 || lines.len() <= scrollback {
        return lines;
    }
    let start = lines.len() - scrollback;
    lines.into_iter().skip(start).collect()
}

/// Hard-wrap one line at `cols` columns (xterm's autowrap), splitting on
/// character boundaries so a multi-byte codepoint is never cut. `cols == 0`
/// disables wrapping.
pub fn terminal_wrap_line(line: &str, cols: usize) -> Vec<String> {
    if cols == 0 {
        return vec![line.to_string()];
    }
    let chars: Vec<char> = line.chars().collect();
    if chars.len() <= cols {
        return vec![line.to_string()];
    }
    chars.chunks(cols).map(|run| run.iter().collect()).collect()
}

/// [`terminal_wrap_line`] over a whole buffer.
pub fn terminal_wrap_lines(lines: &[String], cols: usize) -> Vec<String> {
    let mut out = Vec::with_capacity(lines.len());
    for line in lines {
        out.extend(terminal_wrap_line(line, cols));
    }
    out
}

/// The `[start, end)` slice a `rows`-tall viewport paints.
///
/// With follow armed the viewport is pinned to the newest `rows` lines (the
/// `autoFit` + follow convention of a live terminal); without it every line
/// is painted and the host scroll region owns the position, so nothing is
/// unreachable.
pub fn terminal_tail_window(total: usize, rows: usize, follow: bool) -> (usize, usize) {
    if rows == 0 || total <= rows || !follow {
        return (0, total);
    }
    (total - rows, total)
}

#[define_props]
pub struct TerminalProps {
    /// Committed screen lines (the counterpart of Vue's `write`; feed raw
    /// chunks through [`terminal_split_chunk`] first when needed).
    #[default]
    pub lines: Vec<String>,

    /// Grid columns; hard-wraps the painted lines (Vue default 80).
    #[default(TERMINAL_DEFAULT_COLS)]
    pub cols: usize,

    /// Grid rows; sizes the follow window (Vue default 24).
    #[default(TERMINAL_DEFAULT_ROWS)]
    pub rows: usize,

    /// Scrollback cap in lines; `0` lifts the cap (Vue default 2000).
    #[default(TERMINAL_DEFAULT_SCROLLBACK)]
    pub scrollback: usize,

    /// Pin the viewport to the newest lines (Vue: the fitted grid).
    #[default(true)]
    pub follow: bool,

    /// Blinking caret (Vue default true). The mirror exposes the flag as
    /// `data-cursor-blink` so host CSS can animate the caret — a keyframe
    /// animation is the one thing inline styles cannot express.
    #[default(true)]
    pub cursor_blink: bool,

    /// Terminal font size in px (Vue default 13).
    #[default(TERMINAL_DEFAULT_FONT_SIZE)]
    pub font_size: f64,

    /// Terminal font family (defaults to the hikari mono stack).
    pub font_family: Option<String>,

    /// `--color-background` channel (`r g b` triplet or a full color).
    pub background: Option<String>,

    /// `--color-text` channel.
    pub foreground: Option<String>,

    /// `--color-primary` channel.
    pub cursor: Option<String>,

    /// `--color-selected-bg` channel.
    pub selection: Option<String>,

    /// Accessible name for the log region (Vue has no prop; xterm's
    /// screen is a labelled region).
    pub aria_label: Option<String>,

    #[default]
    pub class: String,
}

#[component]
pub fn Terminal(props: TerminalProps) -> Element {
    let background = terminal_channel_to_hex(
        props.background.as_deref().unwrap_or(""),
        TERMINAL_BACKGROUND_FALLBACK,
    );
    let foreground = terminal_channel_to_hex(
        props.foreground.as_deref().unwrap_or(""),
        TERMINAL_FOREGROUND_FALLBACK,
    );
    let cursor = terminal_channel_to_hex(
        props.cursor.as_deref().unwrap_or(""),
        TERMINAL_CURSOR_FALLBACK,
    );
    let selection = terminal_channel_to_hex(
        props.selection.as_deref().unwrap_or(""),
        TERMINAL_SELECTION_FALLBACK,
    );
    let font_family = props
        .font_family
        .clone()
        .filter(|family| !family.trim().is_empty())
        .unwrap_or_else(|| TERMINAL_FONT_FAMILY_FALLBACK.to_string());

    // The buffer pipeline, in the order a real screen applies it: strip the
    // control stream, cap the scrollback, wrap to the grid, then paint the
    // window the viewport is showing.
    let stripped: Vec<String> = props
        .lines
        .iter()
        .map(|line| terminal_strip_ansi(line))
        .collect();
    let trimmed = terminal_trim_scrollback(stripped, props.scrollback);
    let wrapped = terminal_wrap_lines(&trimmed, props.cols);
    let (start, end) = terminal_tail_window(wrapped.len(), props.rows, props.follow);
    let window: Vec<String> = wrapped[start..end].to_vec();

    let mut rows: Vec<VNode> = Vec::with_capacity(window.len().max(1));
    if window.is_empty() {
        rows.push(rsx! {
            div {
                class: "hk-terminal-line",
                span { class: "hk-terminal-cursor" }
            }
        });
    } else {
        for (index, text) in window.iter().enumerate() {
            if index + 1 == window.len() {
                rows.push(rsx! {
                    div {
                        class: "hk-terminal-line",
                        {text},
                        span { class: "hk-terminal-cursor" }
                    }
                });
            } else {
                rows.push(rsx! {
                    div { class: "hk-terminal-line", {text} }
                });
            }
        }
    }

    let theme_style = format!(
        "--hk-terminal-bg:{background};--hk-terminal-fg:{foreground};\
         --hk-terminal-cursor:{cursor};--hk-terminal-selection:{selection};\
         font-size:{}px",
        props.font_size
    );
    let screen_style = format!(
        "overflow:auto;height:100%;white-space:pre;line-height:1.35;\
         font-family:{font_family};color:var(--hk-terminal-fg)"
    );

    let mut root_classes = String::from("hk-terminal");
    if !props.class.is_empty() {
        root_classes.push(' ');
        root_classes.push_str(&props.class);
    }

    let screen = VElement::new("div")
        .class("terminal")
        .style(screen_style)
        .children(rows);

    let mut root = VElement::new("div")
        .class(root_classes)
        .style(theme_style)
        .attr("role", "log")
        .attr("data-cols", props.cols)
        .attr("data-rows", props.rows)
        .attr("data-follow", if props.follow { "true" } else { "false" })
        .attr(
            "data-cursor-blink",
            if props.cursor_blink { "true" } else { "false" },
        )
        .child(VNode::Element(Box::new(screen)));
    if let Some(label) = props.aria_label.clone() {
        if !label.is_empty() {
            root = root.attr("aria-label", label);
        }
    }
    VNode::Element(Box::new(root))
}

impl StyledComponent for TerminalComponent {
    fn styles() -> &'static str {
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkTerminal.scss", no_hash }
            .0
    }

    fn name() -> &'static str {
        "terminal"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn lines(items: &[&str]) -> Vec<String> {
        items.iter().map(|item| item.to_string()).collect()
    }

    #[test]
    fn terminal_defaults_match_the_vue_props() {
        let props = TerminalProps::default();
        assert_eq!(props.cols, 80);
        assert_eq!(props.rows, 24);
        assert_eq!(props.scrollback, 2000);
        assert!(props.follow);
        assert!(props.cursor_blink);
        assert_eq!(props.font_size, 13.0);
        assert!(props.font_family.is_none());
        assert!(props.background.is_none());
        assert!(props.foreground.is_none());
        assert!(props.cursor.is_none());
        assert!(props.selection.is_none());
        assert!(props.aria_label.is_none());
        assert!(props.lines.is_empty());
        assert_eq!(props.class, "");
    }

    #[test]
    fn strip_ansi_drops_sgr_and_keeps_text() {
        assert_eq!(terminal_strip_ansi("a\u{1b}[31mred\u{1b}[0m!"), "ared!");
        assert_eq!(terminal_strip_ansi("plain"), "plain");
    }

    #[test]
    fn strip_ansi_drops_osc_titles() {
        assert_eq!(terminal_strip_ansi("\u{1b}]0;title\u{7}x"), "x");
        assert_eq!(
            terminal_strip_ansi("\u{1b}]8;;http://e\u{1b}\\link"),
            "link"
        );
    }

    #[test]
    fn channel_to_hex_accepts_triplets_passthrough_and_fallback() {
        assert_eq!(terminal_channel_to_hex("20 22 26", "#000000"), "#14161a");
        assert_eq!(terminal_channel_to_hex("255 128 0", "#000000"), "#ff8000");
        assert_eq!(terminal_channel_to_hex("#abcdef", "#000000"), "#abcdef");
        assert_eq!(terminal_channel_to_hex("300 0 0", "#14161a"), "#14161a");
        assert_eq!(terminal_channel_to_hex("", "#14161a"), "#14161a");
        // The vue fallbacks resolve to themselves when the channel is absent.
        assert_eq!(
            terminal_channel_to_hex("", TERMINAL_CURSOR_FALLBACK),
            "#7aa2f7"
        );
    }

    #[test]
    fn split_chunk_commits_only_terminated_lines() {
        let (committed, pending) = terminal_split_chunk("", "one\ntwo\n");
        assert_eq!(committed, lines(&["one", "two"]));
        assert_eq!(pending, "");

        let (committed, pending) = terminal_split_chunk("", "one\ntw");
        assert_eq!(committed, lines(&["one"]));
        assert_eq!(pending, "tw");
        // The tail continues across calls.
        let (committed, pending) = terminal_split_chunk(&pending, "o\n");
        assert_eq!(committed, lines(&["two"]));
        assert_eq!(pending, "");
    }

    #[test]
    fn split_chunk_carriage_return_overwrites_the_line() {
        let (committed, pending) = terminal_split_chunk("", "10%\r50%\n");
        assert_eq!(committed, lines(&["50%"]));
        assert_eq!(pending, "");
        let (committed, _) = terminal_split_chunk("", "abcdef\rXY\n");
        assert_eq!(committed, lines(&["XYcdef"]));
    }

    #[test]
    fn split_chunk_expands_tabs_and_honours_backspace() {
        let (_, pending) = terminal_split_chunk("", "a\tb");
        assert_eq!(pending, "a       b");
        let (_, pending) = terminal_split_chunk("", "abc\u{8}X");
        assert_eq!(pending, "abX");
        // A stray control byte never reaches the text.
        let (_, pending) = terminal_split_chunk("", "a\u{7}b");
        assert_eq!(pending, "ab");
    }

    #[test]
    fn split_chunk_strips_ansi_before_filling() {
        let (committed, pending) = terminal_split_chunk("", "\u{1b}[1mbold\u{1b}[0m\n");
        assert_eq!(committed, lines(&["bold"]));
        assert_eq!(pending, "");
    }

    #[test]
    fn trim_scrollback_keeps_the_newest_lines() {
        let buffer = lines(&["a", "b", "c"]);
        assert_eq!(
            terminal_trim_scrollback(buffer.clone(), 2),
            lines(&["b", "c"])
        );
        assert_eq!(terminal_trim_scrollback(buffer.clone(), 0), buffer);
        assert_eq!(terminal_trim_scrollback(buffer.clone(), 5), buffer);
    }

    #[test]
    fn wrap_line_splits_on_char_boundaries() {
        assert_eq!(terminal_wrap_line("abcdef", 2), lines(&["ab", "cd", "ef"]));
        assert_eq!(terminal_wrap_line("ab", 2), lines(&["ab"]));
        assert_eq!(terminal_wrap_line("abcdef", 0), lines(&["abcdef"]));
        // Multi-byte characters are never split.
        assert_eq!(terminal_wrap_line("日本語", 1), lines(&["日", "本", "語"]));
        assert_eq!(terminal_wrap_lines(&lines(&["abc"]), 1).len(), 3);
    }

    #[test]
    fn tail_window_follows_only_when_armed() {
        assert_eq!(terminal_tail_window(100, 24, true), (76, 100));
        assert_eq!(terminal_tail_window(100, 24, false), (0, 100));
        assert_eq!(terminal_tail_window(10, 24, true), (0, 10));
        assert_eq!(terminal_tail_window(100, 0, true), (0, 100));
    }

    #[test]
    fn terminal_renders_the_screen_contract() {
        let html = Terminal(TerminalProps {
            lines: lines(&["hello", "world"]),
            cols: 40,
            rows: 2,
            class: "my-term".to_string(),
            aria_label: Some("build log".to_string()),
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains("hk-terminal"), "{html}");
        assert!(html.contains("class=\"terminal\""), "{html}");
        assert!(html.contains("hk-terminal-line"), "{html}");
        assert!(html.contains("hello"), "{html}");
        assert!(html.contains("world"), "{html}");
        // The caret rides the last painted line only.
        // `--hk-terminal-cursor` is a style variable; count the ELEMENT class.
        assert_eq!(
            html.matches("class=\"hk-terminal-cursor\"").count(),
            1,
            "{html}"
        );
        assert!(html.contains("data-cols=\"40\""), "{html}");
        assert!(html.contains("data-follow=\"true\""), "{html}");
        assert!(html.contains("aria-label=\"build log\""), "{html}");
        assert!(html.contains("my-term"), "{html}");
        assert!(html.contains("--hk-terminal-bg:#14161a"), "{html}");
    }

    #[test]
    fn terminal_paints_the_tail_window_and_drops_escapes() {
        let html = Terminal(TerminalProps {
            lines: lines(&["\u{1b}[31mone\u{1b}[0m", "two", "three"]),
            rows: 1,
            follow: true,
            ..Default::default()
        })
        .render_to_html();
        // Only the newest line of the follow window renders.
        assert!(!html.contains("one"), "{html}");
        assert!(html.contains("three"), "{html}");
        // Without follow the whole buffer is reachable.
        let all = Terminal(TerminalProps {
            lines: lines(&["\u{1b}[31mone\u{1b}[0m", "two", "three"]),
            rows: 1,
            follow: false,
            ..Default::default()
        })
        .render_to_html();
        assert!(all.contains("one"), "{all}");
        assert!(all.contains("three"), "{all}");
        assert!(!html.contains("[31m"), "ansi must be stripped: {html}");
    }

    #[test]
    fn terminal_escapes_caller_text() {
        let html = Terminal(TerminalProps {
            lines: lines(&["<script>alert(1)</script>"]),
            ..Default::default()
        })
        .render_to_html();
        assert!(!html.contains("<script>"), "{html}");
        assert!(html.contains("&lt;script&gt;"), "{html}");
    }

    #[test]
    fn terminal_styles_come_from_the_canonical_vue_sheet() {
        let css = TerminalComponent::styles();
        assert!(
            css.contains(".hk-terminal"),
            "terminal css must carry the vue classes"
        );
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored terminal sheet"
        );
    }
}
