import { computed, defineComponent, ref, watch } from "vue";
import { AlertTriangle, ChevronDown, ChevronRight, UnfoldVertical } from "lucide-vue-next";
import HkSpinner from "./HkSpinner";
import { useI18n } from "../i18n/context";
import { highlight } from "../composables/useHighlight";
import { computeGaps, parseUnifiedDiff, type DiffLine, type UnchangedGap } from "./diffParse";
import "./HkDiffViewer.scss";

/**
 * HkDiffViewer — unified-diff rendering as grouped, collapsible hunks.
 *
 * Born from the shittim-chest node-insight modal (2026-10-12 user
 * direction): the previous renderer was a flat <pre> with tinted lines —
 * no grouping, no way to see the unchanged neighbourhood of a change.
 * This component parses the diff into hunks (the groups), renders every
 * hunk as a collapsible card, and collapses the UNCHANGED regions
 * between hunks into expander rows.
 *
 * Unchanged content is not part of a diff, so expansion is asynchronous:
 * pass `loadContext(start, count)` (1-based, new-side numbering) and the
 * component fetches the hidden lines on demand — over whatever transport
 * the host app rides (chest: a WS RPC that the server relays into the
 * container). Without `loadContext` the expander rows render as static
 * dividers. Failures render inline and the next click retries.
 *
 * Line highlighting reuses the lazy highlight.js infrastructure
 * (useHighlight): grammars load on demand and rows re-color once the
 * grammar lands, exactly like the markdown code blocks.
 */

interface GapState {
  /** Lines already revealed. */
  revealed: number;
  loading: boolean;
  failed: boolean;
  /** Fetched context lines, keyed by new-side line number. */
  lines: Map<number, string>;
}

export default defineComponent({
  name: "HkDiffViewer",
  props: {
    /** Unified-diff text (file headers allowed; they are skipped). */
    diff: { type: String, required: true },
    /** highlight.js language id for line highlighting (e.g. "rust"). */
    language: { type: String, default: "" },
    /**
     * Current (new-side) total line count. Enables the trailing collapsed
     * region after the last hunk; omit when unknown.
     */
    totalLines: { type: Number, default: null },
    /** Lines revealed per expand click. */
    contextChunk: { type: Number, default: 40 },
    /**
     * Async fetcher for unchanged lines: `(start, count) => lines | null`,
     * 1-based new-side numbering. Null/throw = failure (inline + retry).
     */
    loadContext: { type: Function, default: null },
  },
  setup(props) {
    const { t } = useI18n();

    const parsed = computed(() => parseUnifiedDiff(props.diff));
    const gaps = computed(() => computeGaps(parsed.value, props.totalLines ?? null));
    const collapsedHunks = ref<Set<number>>(new Set());
    /** Gap states keyed by the gap's new-side start line (stable identity). */
    const gapStates = ref<Map<number, GapState>>(new Map());

    // A fresh diff invalidates every cached context line and fold state.
    watch(
      () => [props.diff, props.totalLines],
      () => {
        collapsedHunks.value = new Set();
        gapStates.value = new Map();
      },
    );

    function gapState(gap: UnchangedGap): GapState {
      let st = gapStates.value.get(gap.start);
      if (!st) {
        st = { revealed: 0, loading: false, failed: false, lines: new Map() };
        gapStates.value.set(gap.start, st);
      }
      return st;
    }

    function toggleHunk(idx: number) {
      const next = new Set(collapsedHunks.value);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      collapsedHunks.value = next;
    }

    async function expandGap(gap: UnchangedGap) {
      const load = props.loadContext as
        | ((start: number, count: number) => Promise<string[] | null>)
        | null;
      if (!load) return;
      const st = gapState(gap);
      if (st.loading) return;
      const remaining = gap.count - st.revealed;
      if (remaining <= 0) return;
      const take = Math.min(Math.max(1, props.contextChunk), remaining);
      // Anchor policy: the leading gap reveals bottom-up (lines nearest
      // the first hunk first); every later gap reveals top-down.
      const fetchStart =
        gap.anchor === "end" ? gap.start + remaining - take : gap.start + st.revealed;
      st.loading = true;
      st.failed = false;
      try {
        const lines = await load(fetchStart, take);
        // The diff may have changed mid-flight; this gap state is then
        // already discarded and writing into it is harmless.
        if (!lines) {
          st.failed = true;
          return;
        }
        // A host may answer a SHORT window (clipped at EOF). For
        // anchor="end" the render window is bottom-anchored, so the
        // arrived lines must bottom-align too — treating them as the
        // lines nearest the hunk (R1 finding: top-aligning them here
        // permanently hides the lines closest to the first hunk).
        const firstLine =
          gap.anchor === "end" ? fetchStart + (take - lines.length) : fetchStart;
        lines.forEach((text, i) => st.lines.set(firstLine + i, text));
        st.revealed += lines.length;
        if (lines.length === 0) st.revealed = gap.count; // nothing there — done
      } catch {
        st.failed = true;
      } finally {
        st.loading = false;
      }
    }

    function renderLine(line: DiffLine, key: string) {
      const sign = line.kind === "add" ? "+" : line.kind === "del" ? "−" : "";
      const html = props.language ? highlight(line.text, props.language) : null;
      return (
        <div class="hk-diff-viewer__line" data-kind={line.kind} key={key}>
          <span class="hk-diff-viewer__no">{line.oldNo ?? ""}</span>
          <span class="hk-diff-viewer__no">{line.newNo ?? ""}</span>
          <span class="hk-diff-viewer__sign">{sign}</span>
          {html !== null ? (
            <span class="hk-diff-viewer__code" v-html={html} />
          ) : (
            <span class="hk-diff-viewer__code">{line.text}</span>
          )}
        </div>
      );
    }

    function renderContextLine(newNo: number, text: string, gap: UnchangedGap, key: string) {
      return renderLine(
        { kind: "context", oldNo: newNo - gap.shift, newNo, text },
        key,
      );
    }

    function renderGap(gap: UnchangedGap) {
      const st = gapState(gap);
      const remaining = gap.count - st.revealed;
      const rows = [];

      // Revealed context lines, in file order.
      const revealedRows = [];
      const first =
        gap.anchor === "end" ? gap.start + gap.count - st.revealed : gap.start;
      for (let no = first; no < first + st.revealed; no++) {
        const text = st.lines.get(no);
        if (text !== undefined) {
          revealedRows.push(renderContextLine(no, text, gap, `g${gap.start}:${no}`));
        }
      }

      const interactive = !!props.loadContext && remaining > 0;
      const label = st.failed
        ? t("hikari::diff.loadFailed", "Load failed, click to retry")
        : t("hikari::diff.unchangedLines", "{count} unchanged lines").replace(
            "{count}",
            String(remaining),
          );
      const divider = interactive ? (
        <button
          type="button"
          key={`gap-${gap.start}`}
          class="hk-diff-viewer__gap"
          data-state={st.loading ? "loading" : st.failed ? "failed" : "idle"}
          disabled={st.loading}
          onClick={() => void expandGap(gap)}
        >
          {st.loading ? (
            <HkSpinner size="xs" />
          ) : st.failed ? (
            <AlertTriangle size={13} />
          ) : (
            <UnfoldVertical size={13} />
          )}
          <span class="hk-diff-viewer__gap-label">{label}</span>
        </button>
      ) : remaining > 0 ? (
        <div class="hk-diff-viewer__gap" data-state="static" key={`gap-${gap.start}`}>
          <UnfoldVertical size={13} />
          <span class="hk-diff-viewer__gap-label">{label}</span>
        </div>
      ) : null;

      // anchor=end: the remaining (button) part sits above the revealed
      // lines; anchor=start: revealed lines first.
      if (gap.anchor === "end") rows.push(divider, ...revealedRows);
      else rows.push(...revealedRows, divider);
      return rows;
    }

    function renderHunk(idx: number) {
      const hunk = parsed.value.hunks[idx];
      const collapsed = collapsedHunks.value.has(idx);
      const adds = hunk.lines.filter((l) => l.kind === "add").length;
      const dels = hunk.lines.filter((l) => l.kind === "del").length;
      // The section heading after the second @@ (e.g. the enclosing fn).
      const section = hunk.header.replace(/^@@\s+.*?@@\s*/, "");
      return (
        <div class="hk-diff-viewer__hunk" key={`h${idx}`}>
          <button
            type="button"
            class="hk-diff-viewer__hunk-head"
            aria-expanded={!collapsed}
            onClick={() => toggleHunk(idx)}
          >
            {collapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
            <span class="hk-diff-viewer__hunk-range">{hunk.header.match(/^@@\s+.*?@@/)?.[0] ?? "@@"}</span>
            {section && <span class="hk-diff-viewer__hunk-section">{section}</span>}
            <span class="hk-diff-viewer__hunk-stats">
              {adds > 0 && <em data-kind="add">+{adds}</em>}
              {dels > 0 && <em data-kind="del">−{dels}</em>}
            </span>
          </button>
          {!collapsed && (
            <div class="hk-diff-viewer__hunk-body">
              {hunk.lines.map((line, li) => renderLine(line, `h${idx}:${li}`))}
            </div>
          )}
        </div>
      );
    }

    return () => {
      const { hunks } = parsed.value;
      if (hunks.length === 0) {
        // Unparseable input: degrade to the honest raw text rather than
        // rendering nothing.
        return (
          <div class="hk-diff-viewer">
            <pre class="hk-diff-viewer__raw">{props.diff}</pre>
          </div>
        );
      }
      // Interleave: gaps are tagged with the hunk they precede
      // (beforeHunk === hunks.length marks the trailing gap).
      const gapsByHunk = new Map<number, UnchangedGap>();
      for (const gap of gaps.value) gapsByHunk.set(gap.beforeHunk, gap);
      const blocks = [];
      for (let i = 0; i < hunks.length; i++) {
        const gap = gapsByHunk.get(i);
        if (gap) blocks.push(renderGap(gap));
        blocks.push(renderHunk(i));
      }
      const trailing = gapsByHunk.get(hunks.length);
      if (trailing) blocks.push(renderGap(trailing));
      return (
        <div class="hk-diff-viewer">
          <div class="hk-diff-viewer__body">{blocks}</div>
        </div>
      );
    };
  },
});
