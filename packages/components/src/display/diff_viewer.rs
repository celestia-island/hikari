// hi-components/src/display/diff_viewer.rs
// DiffViewer — mirror of the canonical Vue `HkDiffViewer`.
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkDiffViewer.scss`, vendored under
// `src/styles/vue-mirror/` and guarded by
// `tests/vue_mirror_drift_tests.rs`), compiled with `no_hash` so the
// `.hk-diff-viewer*` class names are literal and identical in both forms.
// DOM contract (Vue's render output):
//
//   div.hk-diff-viewer [+class]
//     div.hk-diff-viewer__body
//       div.hk-diff-viewer__gap [data-state="static"]
//       button.hk-diff-viewer__gap [data-state="idle"]
//         <icon>  span.hk-diff-viewer__gap-label
//       div.hk-diff-viewer__line  data-kind="{context|add|del}"
//         span.hk-diff-viewer__no  (old)  span.hk-diff-viewer__no (new)
//         span.hk-diff-viewer__sign       span.hk-diff-viewer__code
//       div.hk-diff-viewer__hunk
//         button.hk-diff-viewer__hunk-head  aria-expanded="{true|false}"
//           <icon>  span.hk-diff-viewer__hunk-range
//           span.hk-diff-viewer__hunk-section?
//           span.hk-diff-viewer__hunk-stats
//             em[data-kind="add"]+n  em[data-kind="del"]−n
//         div.hk-diff-viewer__hunk-body
//     pre.hk-diff-viewer__raw                 (unparseable input fallback)
//
// The pure diff algebra is a straight port of the Vue `diffParse.ts`
// module ([`parse_unified_diff`], [`compute_gaps`]) — same hunk header
// grammar, same 1-based numbering, same zero-count anchor rule, same
// `endCovered` / gap arithmetic, same CRLF tolerance and same
// "end the hunk at an unknown line" degradation.
//
// Delta vs Vue (documented):
//
//   * No highlight.js: the mirror has no grammar engine, so `language`
//     (and per-line colouring) is not modelled. Line text is a plain text
//     node — escaped by tairitsu, and never innerHTML.
//   * The async `loadContext(start, count)` fetcher and `contextChunk` are
//     replaced by a controlled `revealed` list: the host fetches and hands
//     the lines back, the mirror only decides where they render. The gap
//     divider therefore has two states only — `idle` (interactive, an
//     `on_expand_gap` handler is present) and `static`; the `loading` /
//     `failed` states belonged to the fetch round-trip.
//   * The `scroll-map` emit is not reproduced: it is a MEASURED pixel map
//     (`offsetHeight` of the three row kinds) for HkScrollContainer, which
//     has no meaning without a layout engine.
//   * The fold state of a hunk is a controlled prop (`collapsed`) instead
//     of a `Set` in a ref: a toggle reports the hunk index through
//     `on_toggle_hunk`.
//   * [`diff_split_rows`] is a mirror-side extension (Vue ships the
//     unified view only): it maps one hunk onto side-by-side rows by
//     pairing each deletion run with the addition run that replaces it.

// The parser/mirror branches keep Vue's nesting for readability; clippy's
// collapsible-if rewrite makes the token loops harder to compare line by line.
#![allow(clippy::collapsible_if)]
use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct DiffViewerComponent;

/// Which side(s) a diff line exists on.
#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub enum DiffLineKind {
    #[default]
    Context,
    Add,
    Del,
}

impl DiffLineKind {
    /// The `data-kind` value the stylesheet keys its tints on.
    pub fn tag(self) -> &'static str {
        match self {
            DiffLineKind::Context => "context",
            DiffLineKind::Add => "add",
            DiffLineKind::Del => "del",
        }
    }

    /// The sign gutter glyph (Vue: `+`, `−` (U+2212), or nothing).
    pub fn sign(self) -> &'static str {
        match self {
            DiffLineKind::Add => "+",
            DiffLineKind::Del => "−",
            DiffLineKind::Context => "",
        }
    }
}

/// One diff row. Line numbers are 1-based; a deletion has no new-side
/// number and an addition no old-side one.
#[derive(Clone, PartialEq, Debug, Default)]
pub struct DiffLine {
    pub kind: DiffLineKind,
    pub old_no: Option<usize>,
    pub new_no: Option<usize>,
    pub text: String,
}

/// One `@@` hunk.
#[derive(Clone, PartialEq, Debug, Default)]
pub struct DiffHunk {
    /// The raw header line, section heading included.
    pub header: String,
    pub old_start: usize,
    pub old_count: usize,
    pub new_start: usize,
    pub new_count: usize,
    pub lines: Vec<DiffLine>,
}

/// A parsed diff plus the new-side extent the hunks cover.
#[derive(Clone, PartialEq, Debug, Default)]
pub struct ParsedDiff {
    pub hunks: Vec<DiffHunk>,
    /// Highest new-side line the last hunk covers (0 when there are none).
    pub end_covered: usize,
}

/// Expansion anchor of a collapsed region: the leading gap reveals the
/// lines nearest the first hunk first, every later gap top-down.
#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub enum GapAnchor {
    #[default]
    Start,
    End,
}

/// One collapsed stretch of unchanged lines, addressed on the new side.
#[derive(Clone, PartialEq, Debug, Default)]
pub struct UnchangedGap {
    /// 1-based new-side line number of the first hidden line.
    pub start: usize,
    /// Number of hidden lines.
    pub count: usize,
    /// Old-side = new-side − `shift`, so a revealed row carries both
    /// numbers.
    pub shift: isize,
    pub anchor: GapAnchor,
    /// Index of the hunk that follows (`hunks.len()` = the trailing gap).
    pub before_hunk: usize,
}

/// One side-by-side row: `old` on the left, `new` on the right.
#[derive(Clone, PartialEq, Debug, Default)]
pub struct DiffSplitRow {
    pub old: Option<DiffLine>,
    pub new: Option<DiffLine>,
}

/// A context line the host has already fetched for a gap.
#[derive(Clone, PartialEq, Debug, Default)]
pub struct DiffContextLine {
    /// 1-based new-side line number.
    pub new_no: usize,
    pub text: String,
}

fn diff_parse_range(part: &str) -> Option<(usize, usize)> {
    match part.split_once(',') {
        Some((start, count)) => Some((start.parse().ok()?, count.parse().ok()?)),
        None => Some((part.parse().ok()?, 1)),
    }
}

/// `@@ -oldStart[,oldCount] +newStart[,newCount] @@`
fn diff_parse_header(line: &str) -> Option<(usize, usize, usize, usize)> {
    let rest = line.strip_prefix("@@ -")?;
    let (old_part, rest) = rest.split_once(" +")?;
    let (new_part, _) = rest.split_once(" @@")?;
    let (old_start, old_count) = diff_parse_range(old_part)?;
    let (new_start, new_count) = diff_parse_range(new_part)?;
    Some((old_start, old_count, new_start, new_count))
}

fn diff_anchor(start: usize, count: usize) -> usize {
    start + usize::from(count == 0)
}

/// Parse unified-diff text. File headers (`---`/`+++`), `index` lines and
/// `\ No newline at end of file` are skipped; a line that is neither tagged
/// nor a hunk header ends the current hunk instead of corrupting numbering.
pub fn parse_unified_diff(diff: &str) -> ParsedDiff {
    let mut hunks: Vec<DiffHunk> = Vec::new();
    let mut current: Option<usize> = None;
    let mut old_no: usize = 0;
    let mut new_no: usize = 0;

    let text = diff.strip_suffix('\n').unwrap_or(diff);
    for raw_line in text.split('\n') {
        // Tolerate CRLF streams: a stray \r must not leak into line text.
        let raw = raw_line.strip_suffix('\r').unwrap_or(raw_line);

        if let Some((old_start, old_count, new_start, new_count)) = diff_parse_header(raw) {
            old_no = diff_anchor(old_start, old_count);
            new_no = diff_anchor(new_start, new_count);
            hunks.push(DiffHunk {
                header: raw.to_string(),
                old_start,
                old_count,
                new_start,
                new_count,
                lines: Vec::new(),
            });
            current = Some(hunks.len() - 1);
            continue;
        }

        let index = match current {
            Some(index) => index,
            None => continue,
        };

        let tag = match raw.chars().next() {
            Some(tag) => tag,
            None => {
                // A truly empty line is a context line whose trailing space
                // an eager serializer stripped.
                hunks[index].lines.push(DiffLine {
                    kind: DiffLineKind::Context,
                    old_no: Some(old_no),
                    new_no: Some(new_no),
                    text: String::new(),
                });
                old_no += 1;
                new_no += 1;
                continue;
            }
        };
        if tag == '\\' {
            continue;
        }
        let text: String = raw.chars().skip(1).collect();
        match tag {
            '+' => {
                hunks[index].lines.push(DiffLine {
                    kind: DiffLineKind::Add,
                    old_no: None,
                    new_no: Some(new_no),
                    text,
                });
                new_no += 1;
            }
            '-' => {
                hunks[index].lines.push(DiffLine {
                    kind: DiffLineKind::Del,
                    old_no: Some(old_no),
                    new_no: None,
                    text,
                });
                old_no += 1;
            }
            ' ' => {
                hunks[index].lines.push(DiffLine {
                    kind: DiffLineKind::Context,
                    old_no: Some(old_no),
                    new_no: Some(new_no),
                    text,
                });
                old_no += 1;
                new_no += 1;
            }
            // Unknown line: end the hunk rather than corrupt numbering.
            _ => current = None,
        }
    }

    let end_covered = match hunks.last() {
        Some(last) => {
            let anchor = diff_anchor(last.new_start, last.new_count);
            (anchor + last.new_count).saturating_sub(1)
        }
        None => 0,
    };
    ParsedDiff { hunks, end_covered }
}

/// The collapsed unchanged regions around the hunks, each tagged with the
/// hunk it precedes. `total_lines` is the current file's line count; pass
/// `None` when unknown and the trailing region is omitted (it cannot be
/// sized).
pub fn compute_gaps(parsed: &ParsedDiff, total_lines: Option<usize>) -> Vec<UnchangedGap> {
    let mut gaps: Vec<UnchangedGap> = Vec::new();
    let mut prev_end: usize = 0;
    for (index, hunk) in parsed.hunks.iter().enumerate() {
        let old_anchor = diff_anchor(hunk.old_start, hunk.old_count);
        let new_anchor = diff_anchor(hunk.new_start, hunk.new_count);
        let gap_start = prev_end + 1;
        let gap_end = new_anchor.saturating_sub(1);
        if gap_end >= gap_start {
            gaps.push(UnchangedGap {
                start: gap_start,
                count: gap_end - gap_start + 1,
                shift: new_anchor as isize - old_anchor as isize,
                anchor: if index == 0 && prev_end == 0 {
                    GapAnchor::End
                } else {
                    GapAnchor::Start
                },
                before_hunk: index,
            });
        }
        prev_end = (new_anchor + hunk.new_count).saturating_sub(1);
    }
    let covered = prev_end;
    if let Some(total) = total_lines {
        if total > covered {
            let shift = match parsed.hunks.last() {
                Some(last) => {
                    let old_anchor = diff_anchor(last.old_start, last.old_count);
                    let new_anchor = diff_anchor(last.new_start, last.new_count);
                    (new_anchor + last.new_count) as isize - (old_anchor + last.old_count) as isize
                }
                None => 0,
            };
            gaps.push(UnchangedGap {
                start: covered + 1,
                count: total - covered,
                shift,
                anchor: GapAnchor::Start,
                before_hunk: parsed.hunks.len(),
            });
        }
    }
    gaps
}

/// The `@@ … @@` range prefix of a hunk header.
pub fn diff_hunk_range(header: &str) -> String {
    if !header.starts_with("@@") {
        return "@@".to_string();
    }
    match header[2..].find("@@") {
        Some(offset) => header[..2 + offset + 2].to_string(),
        None => "@@".to_string(),
    }
}

/// The section heading after the second `@@` (Vue: a regex replace).
pub fn diff_hunk_section(header: &str) -> String {
    if !header.starts_with("@@") {
        return header.to_string();
    }
    match header[2..].find("@@") {
        Some(offset) => header[2 + offset + 2..].trim_start().to_string(),
        None => header.to_string(),
    }
}

/// `(additions, deletions)` for the hunk stats row.
pub fn diff_hunk_stats(hunk: &DiffHunk) -> (usize, usize) {
    let mut added = 0usize;
    let mut deleted = 0usize;
    for line in &hunk.lines {
        match line.kind {
            DiffLineKind::Add => added += 1,
            DiffLineKind::Del => deleted += 1,
            DiffLineKind::Context => {}
        }
    }
    (added, deleted)
}

/// A revealed context row (the old number comes from the gap shift).
pub fn diff_context_line(new_no: usize, text: &str, shift: isize) -> DiffLine {
    let old = new_no as isize - shift;
    DiffLine {
        kind: DiffLineKind::Context,
        old_no: if old >= 1 { Some(old as usize) } else { None },
        new_no: Some(new_no),
        text: text.to_string(),
    }
}

/// Side-by-side mapping: each deletion run pairs with the addition run that
/// replaces it, row by row; the longer run keeps its leftover on one side.
pub fn diff_split_rows(hunk: &DiffHunk) -> Vec<DiffSplitRow> {
    let mut rows: Vec<DiffSplitRow> = Vec::new();
    let mut index = 0usize;
    while index < hunk.lines.len() {
        match hunk.lines[index].kind {
            DiffLineKind::Context => {
                let line = hunk.lines[index].clone();
                rows.push(DiffSplitRow {
                    old: Some(line.clone()),
                    new: Some(line),
                });
                index += 1;
            }
            DiffLineKind::Del => {
                let mut deleted: Vec<DiffLine> = Vec::new();
                while index < hunk.lines.len() && hunk.lines[index].kind == DiffLineKind::Del {
                    deleted.push(hunk.lines[index].clone());
                    index += 1;
                }
                let mut added: Vec<DiffLine> = Vec::new();
                while index < hunk.lines.len() && hunk.lines[index].kind == DiffLineKind::Add {
                    added.push(hunk.lines[index].clone());
                    index += 1;
                }
                let pairs = deleted.len().max(added.len());
                for pair in 0..pairs {
                    rows.push(DiffSplitRow {
                        old: deleted.get(pair).cloned(),
                        new: added.get(pair).cloned(),
                    });
                }
            }
            DiffLineKind::Add => {
                rows.push(DiffSplitRow {
                    old: None,
                    new: Some(hunk.lines[index].clone()),
                });
                index += 1;
            }
        }
    }
    rows
}

#[define_props]
pub struct DiffViewerProps {
    /// Unified-diff text (file headers allowed; they are skipped).
    #[default]
    pub diff: String,

    /// Current (new-side) line count; enables the trailing collapsed region.
    pub total_lines: Option<usize>,

    /// Controlled collapsed hunk indexes (`None` = every hunk open).
    pub collapsed: Option<Vec<usize>>,

    /// Context lines the host has already revealed, grouped into a gap by
    /// their new-side line number.
    #[default]
    pub revealed: Vec<DiffContextLine>,

    /// A hunk head was clicked (its index).
    pub on_toggle_hunk: Option<EventHandler<usize>>,

    /// A gap divider was clicked (the gap's new-side start). Its presence
    /// is what makes the divider interactive (Vue: `loadContext` present).
    pub on_expand_gap: Option<EventHandler<usize>>,

    #[default]
    pub class: String,
}

fn diff_text_node(class: &str, text: &str) -> VNode {
    VNode::Element(Box::new(
        VElement::new("span")
            .class(class)
            .child(VNode::Text(VText::new(text))),
    ))
}

fn diff_line_node(line: &DiffLine) -> VNode {
    let old_no = line.old_no.map(|no| no.to_string()).unwrap_or_default();
    let new_no = line.new_no.map(|no| no.to_string()).unwrap_or_default();
    let children: Vec<VNode> = vec![
        diff_text_node("hk-diff-viewer__no", &old_no),
        diff_text_node("hk-diff-viewer__no", &new_no),
        diff_text_node("hk-diff-viewer__sign", line.kind.sign()),
        diff_text_node("hk-diff-viewer__code", &line.text),
    ];
    VNode::Element(Box::new(
        VElement::new("div")
            .class("hk-diff-viewer__line")
            .attr("data-kind", line.kind.tag())
            .children(children),
    ))
}

fn diff_gap_rows(
    gap: &UnchangedGap,
    revealed: &[DiffContextLine],
    interactive: bool,
    on_expand: &Option<EventHandler<usize>>,
) -> Vec<VNode> {
    // The host hands over whatever it fetched; the rows that belong to THIS
    // gap are the ones inside its new-side range, ascending.
    let mut mine: Vec<&DiffContextLine> = revealed
        .iter()
        .filter(|line| line.new_no >= gap.start && line.new_no < gap.start + gap.count)
        .collect();
    mine.sort_by_key(|line| line.new_no);
    let remaining = gap.count.saturating_sub(mine.len());

    let mut revealed_rows: Vec<VNode> = Vec::with_capacity(mine.len());
    for line in &mine {
        revealed_rows.push(diff_line_node(&diff_context_line(
            line.new_no,
            &line.text,
            gap.shift,
        )));
    }

    let divider: Option<VNode> = if remaining == 0 {
        None
    } else {
        let label = hikari_i18n::t(
            "components.hk.diff_viewer.unchangedLines",
            "{count} unchanged lines",
        )
        .replace("{count}", &remaining.to_string());
        let label_node = VNode::Element(Box::new(
            VElement::new("span")
                .class("hk-diff-viewer__gap-label")
                .child(VNode::Text(VText::new(&label))),
        ));
        if interactive {
            let start = gap.start;
            let handler = on_expand.clone();
            Some(VNode::Element(Box::new(
                VElement::new("button")
                    .class("hk-diff-viewer__gap")
                    .attr("type", "button")
                    .attr("data-state", "idle")
                    .child(rsx! { Icon { icon: MdiIcon::ChevronsUpDown, size: 13 } })
                    .child(label_node)
                    .on_click(move |_: MouseEvent| {
                        if let Some(handler) = &handler {
                            handler.call(start);
                        }
                    }),
            )))
        } else {
            Some(VNode::Element(Box::new(
                VElement::new("div")
                    .class("hk-diff-viewer__gap")
                    .attr("data-state", "static")
                    .child(rsx! { Icon { icon: MdiIcon::ChevronsUpDown, size: 13 } })
                    .child(label_node),
            )))
        }
    };

    // Vue's render order: anchor=end puts the divider ABOVE the revealed
    // rows, every other gap below them.
    let mut rows: Vec<VNode> = Vec::with_capacity(revealed_rows.len() + 1);
    if gap.anchor == GapAnchor::End {
        if let Some(divider) = divider {
            rows.push(divider);
        }
        rows.extend(revealed_rows);
    } else {
        rows.extend(revealed_rows);
        if let Some(divider) = divider {
            rows.push(divider);
        }
    }
    rows
}

fn diff_hunk_node(
    hunk: &DiffHunk,
    index: usize,
    collapsed: bool,
    on_toggle: &Option<EventHandler<usize>>,
) -> VNode {
    let (added, deleted) = diff_hunk_stats(hunk);
    let range = diff_hunk_range(&hunk.header);
    let section = diff_hunk_section(&hunk.header);
    let chevron = if collapsed {
        MdiIcon::ChevronRight
    } else {
        MdiIcon::ChevronDown
    };

    let mut head_children: Vec<VNode> = Vec::with_capacity(4);
    head_children.push(rsx! { Icon { icon: chevron, size: 13 } });
    head_children.push(diff_text_node("hk-diff-viewer__hunk-range", &range));
    if !section.is_empty() {
        head_children.push(diff_text_node("hk-diff-viewer__hunk-section", &section));
    }
    let mut stats_children: Vec<VNode> = Vec::with_capacity(2);
    if added > 0 {
        stats_children.push(VNode::Element(Box::new(
            VElement::new("em")
                .attr("data-kind", "add")
                .child(VNode::Text(VText::new(&format!("+{added}")))),
        )));
    }
    if deleted > 0 {
        stats_children.push(VNode::Element(Box::new(
            VElement::new("em")
                .attr("data-kind", "del")
                .child(VNode::Text(VText::new(&format!("−{deleted}")))),
        )));
    }
    head_children.push(VNode::Element(Box::new(
        VElement::new("span")
            .class("hk-diff-viewer__hunk-stats")
            .children(stats_children),
    )));

    let handler = on_toggle.clone();
    let head = VElement::new("button")
        .class("hk-diff-viewer__hunk-head")
        .attr("type", "button")
        .attr("aria-expanded", if collapsed { "false" } else { "true" })
        .children(head_children)
        .on_click(move |_: MouseEvent| {
            if let Some(handler) = &handler {
                handler.call(index);
            }
        });

    let mut element = VElement::new("div")
        .class("hk-diff-viewer__hunk")
        .child(VNode::Element(Box::new(head)));
    if !collapsed {
        let mut rows: Vec<VNode> = Vec::with_capacity(hunk.lines.len());
        for line in &hunk.lines {
            rows.push(diff_line_node(line));
        }
        element = element.child(VNode::Element(Box::new(
            VElement::new("div")
                .class("hk-diff-viewer__hunk-body")
                .children(rows),
        )));
    }
    VNode::Element(Box::new(element))
}

#[component]
pub fn DiffViewer(props: DiffViewerProps) -> Element {
    let parsed = parse_unified_diff(&props.diff);

    let mut root_classes = String::from("hk-diff-viewer");
    if !props.class.is_empty() {
        root_classes.push(' ');
        root_classes.push_str(&props.class);
    }

    if parsed.hunks.is_empty() {
        // Unparseable input: degrade to the honest raw text rather than
        // rendering nothing (escaped — the fallback is still caller text).
        let raw = VElement::new("pre")
            .class("hk-diff-viewer__raw")
            .child(VNode::Text(VText::new(&props.diff)));
        return VNode::Element(Box::new(
            VElement::new("div")
                .class(root_classes)
                .child(VNode::Element(Box::new(raw))),
        ));
    }

    let gaps = compute_gaps(&parsed, props.total_lines);
    let collapsed = props.collapsed.clone().unwrap_or_default();
    let interactive = props.on_expand_gap.is_some();

    let mut body_children: Vec<VNode> = Vec::new();
    for (index, hunk) in parsed.hunks.iter().enumerate() {
        for gap in gaps.iter().filter(|gap| gap.before_hunk == index) {
            body_children.extend(diff_gap_rows(
                gap,
                &props.revealed,
                interactive,
                &props.on_expand_gap,
            ));
        }
        body_children.push(diff_hunk_node(
            hunk,
            index,
            collapsed.contains(&index),
            &props.on_toggle_hunk,
        ));
    }
    for gap in gaps
        .iter()
        .filter(|gap| gap.before_hunk == parsed.hunks.len())
    {
        body_children.extend(diff_gap_rows(
            gap,
            &props.revealed,
            interactive,
            &props.on_expand_gap,
        ));
    }

    let body = VElement::new("div")
        .class("hk-diff-viewer__body")
        .children(body_children);
    VNode::Element(Box::new(
        VElement::new("div")
            .class(root_classes)
            .child(VNode::Element(Box::new(body))),
    ))
}

impl StyledComponent for DiffViewerComponent {
    fn styles() -> &'static str {
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkDiffViewer.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "diff-viewer"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const SIMPLE: &str =
        "--- a/f.rs\n+++ b/f.rs\n@@ -1,3 +1,4 @@ fn main()\n ctx\n-old\n+new\n+extra";

    const TWO_HUNKS: &str = "@@ -1,2 +1,2 @@\n a\n+b\n@@ -10,2 +11,2 @@\n c\n+d";

    fn handler<T: 'static>(_value: T) {}

    #[test]
    fn diff_viewer_defaults_match_the_vue_props() {
        let props = DiffViewerProps::default();
        assert_eq!(props.diff, "");
        assert!(props.total_lines.is_none());
        assert!(props.collapsed.is_none());
        assert!(props.revealed.is_empty());
        assert!(props.on_toggle_hunk.is_none());
        assert!(props.on_expand_gap.is_none());
        assert_eq!(props.class, "");
    }

    #[test]
    fn parse_numbers_lines_across_both_sides() {
        let parsed = parse_unified_diff(SIMPLE);
        assert_eq!(parsed.hunks.len(), 1);
        let hunk = &parsed.hunks[0];
        assert_eq!(hunk.header, "@@ -1,3 +1,4 @@ fn main()");
        assert_eq!(hunk.old_start, 1);
        assert_eq!(hunk.old_count, 3);
        assert_eq!(hunk.new_count, 4);
        assert_eq!(hunk.lines.len(), 4);
        assert_eq!(
            hunk.lines[0],
            DiffLine {
                kind: DiffLineKind::Context,
                old_no: Some(1),
                new_no: Some(1),
                text: "ctx".to_string()
            }
        );
        assert_eq!(
            hunk.lines[1],
            DiffLine {
                kind: DiffLineKind::Del,
                old_no: Some(2),
                new_no: None,
                text: "old".to_string()
            }
        );
        assert_eq!(
            hunk.lines[2],
            DiffLine {
                kind: DiffLineKind::Add,
                old_no: None,
                new_no: Some(2),
                text: "new".to_string()
            }
        );
        assert_eq!(hunk.lines[3].new_no, Some(3));
        assert_eq!(diff_hunk_stats(hunk), (2, 1));
    }

    #[test]
    fn parse_anchors_zero_count_ranges_one_line_earlier() {
        let parsed = parse_unified_diff("@@ -0,0 +1,2 @@\n+a\n+b");
        let hunk = &parsed.hunks[0];
        assert_eq!(hunk.lines[0].new_no, Some(1));
        assert_eq!(hunk.lines[1].new_no, Some(2));
        assert_eq!(parsed.end_covered, 2);

        let deletion = parse_unified_diff("@@ -5,2 +4,0 @@\n-a\n-b");
        assert_eq!(deletion.hunks[0].lines[0].old_no, Some(5));
        assert_eq!(deletion.end_covered, 4);
    }

    #[test]
    fn parse_tolerates_crlf_and_skips_markers() {
        let diff =
            "--- a\r\n+++ b\r\n@@ -1,1 +1,1 @@\r\n-x\r\n+y\r\n\\ No newline at end of file\r\n";
        let parsed = parse_unified_diff(diff);
        let hunk = &parsed.hunks[0];
        assert_eq!(hunk.lines.len(), 2);
        assert_eq!(hunk.lines[0].text, "x");
        assert_eq!(hunk.lines[1].text, "y");
    }

    #[test]
    fn parse_stops_the_hunk_at_an_unknown_line() {
        let parsed = parse_unified_diff("@@ -1,1 +1,1 @@\n a\nbogus\n+b");
        assert_eq!(parsed.hunks.len(), 1);
        assert_eq!(parsed.hunks[0].lines.len(), 1);
        assert_eq!(parse_unified_diff("plain text").hunks.len(), 0);
        assert_eq!(parse_unified_diff("").end_covered, 0);
    }

    #[test]
    fn gaps_mark_the_leading_region_as_bottom_anchored() {
        let parsed = parse_unified_diff("@@ -5,2 +7,2 @@\n a\n+b");
        let gaps = compute_gaps(&parsed, None);
        assert_eq!(gaps.len(), 1);
        assert_eq!(
            gaps[0],
            UnchangedGap {
                start: 1,
                count: 6,
                shift: 2,
                anchor: GapAnchor::End,
                before_hunk: 0
            }
        );
    }

    #[test]
    fn gaps_between_and_after_hunks_are_top_anchored() {
        let parsed = parse_unified_diff(TWO_HUNKS);
        let gaps = compute_gaps(&parsed, None);
        assert_eq!(gaps.len(), 1);
        assert_eq!(gaps[0].start, 3);
        assert_eq!(gaps[0].count, 8);
        assert_eq!(gaps[0].shift, 1);
        assert_eq!(gaps[0].anchor, GapAnchor::Start);
        assert_eq!(gaps[0].before_hunk, 1);

        let trailing = compute_gaps(&parsed, Some(20));
        assert_eq!(trailing.len(), 2);
        let tail = &trailing[1];
        assert_eq!(tail.start, 13);
        assert_eq!(tail.count, 8);
        assert_eq!(tail.before_hunk, 2);
    }

    #[test]
    fn split_rows_pair_replacements_row_by_row() {
        let parsed = parse_unified_diff("@@ -1,4 +1,3 @@\n ctx\n-a\n-b\n+x");
        let rows = diff_split_rows(&parsed.hunks[0]);
        assert_eq!(rows.len(), 3);
        assert_eq!(rows[0].old.as_ref().unwrap().text, "ctx");
        assert_eq!(rows[0].new.as_ref().unwrap().text, "ctx");
        assert_eq!(rows[1].old.as_ref().unwrap().text, "a");
        assert_eq!(rows[1].new.as_ref().unwrap().text, "x");
        assert_eq!(rows[2].old.as_ref().unwrap().text, "b");
        assert!(rows[2].new.is_none());
    }

    #[test]
    fn header_helpers_split_range_from_section() {
        let header = "@@ -1,2 +1,2 @@ fn main()";
        assert_eq!(diff_hunk_range(header), "@@ -1,2 +1,2 @@");
        assert_eq!(diff_hunk_section(header), "fn main()");
        assert_eq!(diff_hunk_section("@@ -1 +1 @@"), "");
        assert_eq!(diff_hunk_range("@@ -1 +1 @@"), "@@ -1 +1 @@");
        assert_eq!(diff_hunk_range("junk"), "@@");
        assert_eq!(diff_hunk_section("junk"), "junk");
    }

    #[test]
    fn kinds_map_to_the_dom_contract() {
        assert_eq!(DiffLineKind::Add.tag(), "add");
        assert_eq!(DiffLineKind::Del.tag(), "del");
        assert_eq!(DiffLineKind::Context.tag(), "context");
        assert_eq!(DiffLineKind::Add.sign(), "+");
        assert_eq!(DiffLineKind::Del.sign(), "−");
        assert_eq!(DiffLineKind::Context.sign(), "");
        assert_eq!(DiffLineKind::default(), DiffLineKind::Context);
        let line = diff_context_line(5, "x", 2);
        assert_eq!(line.old_no, Some(3));
        assert_eq!(line.new_no, Some(5));
        assert_eq!(diff_context_line(2, "x", 9).old_no, None);
    }

    #[test]
    fn diff_viewer_renders_the_vue_dom_contract() {
        let html = DiffViewer(DiffViewerProps {
            diff: SIMPLE.to_string(),
            class: "my-diff".to_string(),
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains("hk-diff-viewer"), "{html}");
        assert!(html.contains("hk-diff-viewer__body"), "{html}");
        assert!(html.contains("hk-diff-viewer__hunk"), "{html}");
        assert!(html.contains("hk-diff-viewer__hunk-head"), "{html}");
        assert!(html.contains("aria-expanded=\"true\""), "{html}");
        assert!(html.contains("@@ -1,3 +1,4 @@"), "{html}");
        assert!(html.contains("hk-diff-viewer__hunk-section"), "{html}");
        assert!(html.contains("fn main()"), "{html}");
        assert!(html.contains("hk-diff-viewer__hunk-stats"), "{html}");
        assert!(html.contains("+2"), "{html}");
        assert!(html.contains("−1"), "{html}");
        assert!(html.contains("data-kind=\"add\""), "{html}");
        assert!(html.contains("data-kind=\"del\""), "{html}");
        assert!(html.contains("data-kind=\"context\""), "{html}");
        assert!(html.contains("hk-diff-viewer__sign"), "{html}");
        assert!(html.contains("ctx"), "{html}");
        assert!(html.contains("my-diff"), "{html}");
        assert!(html.contains("hk-diff-viewer__hunk-body"), "{html}");
        // No collapsed regions: the diff starts at line 1 and the total is
        // unknown.
        assert!(!html.contains("hk-diff-viewer__gap"), "{html}");
    }

    #[test]
    fn diff_viewer_renders_static_gap_dividers() {
        let html = DiffViewer(DiffViewerProps {
            diff: TWO_HUNKS.to_string(),
            total_lines: Some(20),
            ..Default::default()
        })
        .render_to_html();
        assert_eq!(html.matches("hk-diff-viewer__gap").count(), 4, "{html}");
        assert!(html.contains("data-state=\"static\""), "{html}");
        assert!(html.contains("8 unchanged lines"), "{html}");
        // The i18n placeholder is substituted, never echoed.
        assert!(!html.contains("{count}"), "{html}");
    }

    #[test]
    fn diff_viewer_gap_becomes_interactive_with_a_handler() {
        let html = DiffViewer(DiffViewerProps {
            diff: TWO_HUNKS.to_string(),
            on_expand_gap: Some(EventHandler::new(handler::<usize>)),
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains("data-state=\"idle\""), "{html}");
        assert!(html.contains("<button"), "{html}");
    }

    #[test]
    fn diff_viewer_reveals_host_supplied_context() {
        let html = DiffViewer(DiffViewerProps {
            diff: TWO_HUNKS.to_string(),
            total_lines: Some(20),
            revealed: vec![
                DiffContextLine {
                    new_no: 3,
                    text: "revealed a".to_string(),
                },
                DiffContextLine {
                    new_no: 4,
                    text: "revealed b".to_string(),
                },
            ],
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains("revealed a"), "{html}");
        assert!(html.contains("revealed b"), "{html}");
        // The gap shrank: 8 hidden lines minus the two revealed.
        assert!(html.contains("6 unchanged lines"), "{html}");
    }

    #[test]
    fn diff_viewer_collapses_a_hunk() {
        let html = DiffViewer(DiffViewerProps {
            diff: SIMPLE.to_string(),
            collapsed: Some(vec![0]),
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains("aria-expanded=\"false\""), "{html}");
        assert!(!html.contains("hk-diff-viewer__hunk-body"), "{html}");
    }

    #[test]
    fn diff_viewer_falls_back_to_the_raw_text_and_escapes_it() {
        let html = DiffViewer(DiffViewerProps {
            diff: "<script>alert(1)</script>\nnot a diff".to_string(),
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains("hk-diff-viewer__raw"), "{html}");
        assert!(!html.contains("<script>"), "{html}");
        assert!(html.contains("&lt;script&gt;"), "{html}");
        assert!(html.contains("not a diff"), "{html}");
    }

    #[test]
    fn diff_viewer_escapes_line_text() {
        let html = DiffViewer(DiffViewerProps {
            diff: "@@ -1,1 +1,1 @@\n+<img src=x onerror=alert(1)>".to_string(),
            ..Default::default()
        })
        .render_to_html();
        assert!(!html.contains("<img"), "{html}");
        assert!(html.contains("&lt;img"), "{html}");
    }

    #[test]
    fn diff_viewer_styles_come_from_the_canonical_vue_sheet() {
        let css = DiffViewerComponent::styles();
        assert!(
            css.contains(".hk-diff-viewer") && css.contains(".hk-diff-viewer__line"),
            "diff viewer css must carry the vue classes"
        );
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored diff viewer sheet"
        );
    }
}
