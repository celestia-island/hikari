import { computed, defineComponent, ref, Transition, watch } from "vue";
import { ChevronRight } from "lucide-vue-next";
import { useClipboard } from "@celestia-island/hikari";

import { useReportedTransition } from "../composables/useReportedTransition";

import "./HkJsonTree.scss";

/**
 * Parse a JSON text into a container value (object or array). Returns null
 * for primitives, unparseable text, and empty input — mirroring the tool
 * block's semantics where only containers get the tree treatment.
 * (Shared with HkToolBlock, which uses it for its exec/write_to_var paths.)
 */
export function tryParseJson(text: string): unknown | null {
  try {
    const v = JSON.parse(text);
    if (typeof v === "object" && v !== null) return v;
    return null;
  } catch {
    return null;
  }
}

const STR_PREVIEW_LEN = 72;
const JT_TOGGLE = 14;
const JT_INDENT = JT_TOGGLE;
const JT_GUIDE_OFFSET = Math.floor(JT_TOGGLE / 2);

/** Fold duration when the host defines neither `--jt-fold-duration` nor the
 *  token it falls back to (mirrors `--duration-fast` / `--hi-duration-fast`). */
const JT_FOLD_FALLBACK_MS = 150;
/** Transition report window handed to the animation bus — the fold itself is
 *  at most `--jt-fold-duration`; the slack keeps a pending report alive until
 *  the browser has actually settled the last frame. */
const JT_FOLD_REPORT_MS = 320;
/** Easing used when the host does not expose `--jt-fold-ease`. */
const JT_FOLD_FALLBACK_EASE = "cubic-bezier(0.4, 0, 0.2, 1)";

/** One node of the interactive JSON result tree. */
export interface HJsonNode {
  id: number;
  key: string | null;
  value: unknown;
  depth: number;
  isContainer: boolean;
  isLongString: boolean;
  stringValue: string;
  childCount: number;
  children: HJsonNode[];
  preview: string;
}

function truncateStr(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + "…";
}

function buildObjectPreview(val: unknown, isArr: boolean): string {
  if (isArr) {
    const arr = val as unknown[];
    const parts = arr.slice(0, 3).map(v => jsonInlineValue(v));
    const suffix = arr.length > 3 ? ", …" : "";
    return `[${parts.join(", ")}${suffix}]`;
  }
  const entries = Object.entries(val as Record<string, unknown>);
  const parts = entries.slice(0, 3).map(([k, v]) => `${k}: ${jsonInlineValue(v)}`);
  const suffix = entries.length > 3 ? ", …" : "";
  return `{${parts.join(", ")}${suffix}}`;
}

function jsonInlineValue(v: unknown): string {
  if (v === null) return "null";
  if (v === undefined) return "undefined";
  if (typeof v === "boolean" || typeof v === "number") return String(v);
  if (typeof v === "string") return `"${truncateStr(v, 20)}"`;
  if (Array.isArray(v)) return `Array(${v.length})`;
  return `{${Object.keys(v as object).length}}`;
}

function buildJsonNode(
  value: unknown,
  key: string | null,
  depth: number,
  maxDepth: number,
  idSeq: { n: number },
): HJsonNode {
  const isContainer = value !== null && typeof value === "object";
  const isLongString = typeof value === "string" && (value as string).length > STR_PREVIEW_LEN;
  let childCount = 0;
  const children: HJsonNode[] = [];
  let preview = "";

  if (isContainer) {
    const entries = Array.isArray(value)
      ? (value as unknown[]).map((v, i) => [String(i), v] as [string, unknown])
      : Object.entries(value as Record<string, unknown>);
    childCount = entries.length;
    preview = buildObjectPreview(value, Array.isArray(value));
    if (depth < maxDepth) {
      for (const [k, v] of entries) {
        children.push(buildJsonNode(v, k, depth + 1, maxDepth, idSeq));
      }
    }
  }

  const nid = idSeq.n;
  idSeq.n += 1;
  return {
    id: nid,
    key,
    value,
    depth,
    isContainer,
    isLongString: !!isLongString,
    stringValue: typeof value === "string" ? value : "",
    childCount,
    children,
    preview,
  };
}

/**
 * Build the interactive JSON tree for a parsed value. Returns null when the
 * value is not a container (no tree needed). Node ids are unique within the
 * returned tree.
 */
export function buildJsonTree(value: unknown, maxDepth = 8): HJsonNode | null {
  if (value === null || typeof value !== "object") return null;
  return buildJsonNode(value, null, 0, maxDepth, { n: 0 });
}

function initialExpandedSet(root: HJsonNode): Set<number> {
  const set = new Set<number>();
  set.add(root.id);
  for (const child of root.children) {
    set.add(child.id);
  }
  return set;
}

/* ── Fold motion (expand/collapse) ─────────────────────────────────────
 *
 * The fold is JS-driven (height measured, then transitioned) because the
 * subtree is conditionally rendered: a CSS-only grid-track technique would
 * force every collapsed node to keep its whole subtree mounted, which is
 * exactly what a JSON payload viewport cannot afford.
 *
 * "Animation context" participation (same contract as HkListTransition):
 *   · the duration/easing come from the host's motion tokens
 *     (`--jt-fold-duration` / `--jt-fold-ease`, seeded from
 *     `--hi-duration-fast` / `--ease-standard`) so a theme override moves
 *     this fold with everything else;
 *   · OS reduced motion and hikari's global animation switch
 *     (`html[data-css-animations="0"]`, parked by setReducedMotion) snap the
 *     fold to its end state instead of animating;
 *   · while a fold is in flight the transition is reported to the shared
 *     animation bus (`useReportedTransition` → reportTransition), so other
 *     JS choreography is not cut short and the bus knows motion is running.
 */

/** Parse a CSS time token ("150ms" / "0.15s") into milliseconds. */
export function parseCssTimeMs(raw: string): number | null {
  const text = raw.trim();
  if (!text) return null;
  const match = /^(-?(?:\d+|\d*\.\d+))(ms|s)$/i.exec(text);
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value)) return null;
  const ms = match[2].toLowerCase() === "s" ? value * 1000 : value;
  return Math.round(ms);
}

/** The narrow slice of `window` the motion gate needs — structural so a
 *  test can pass a plain object without a double cast. */
export interface FoldMotionWindow {
  matchMedia?: (query: string) => { matches: boolean };
}

/** The narrow slice of `document` the motion gate needs. */
export interface FoldMotionDocument {
  documentElement?: { dataset?: { cssAnimations?: string } } | null;
}

/**
 * Whether the animation context currently asks for no motion: the OS
 * `prefers-reduced-motion` preference or the host's global CSS-animation
 * switch (parked by `setReducedMotion`).
 */
export function prefersNoFoldMotion(
  win: FoldMotionWindow | null = typeof window !== "undefined" ? window : null,
  doc: FoldMotionDocument | null = typeof document !== "undefined" ? document : null,
): boolean {
  if (win && typeof win.matchMedia === "function") {
    try {
      if (win.matchMedia("(prefers-reduced-motion: reduce)").matches) return true;
    } catch {
      /* a host shim without a usable matchMedia falls through to the switch */
    }
  }
  return doc?.documentElement?.dataset?.cssAnimations === "0";
}

export interface FoldMotion {
  durationMs: number;
  easing: string;
}

/** Resolve the fold motion a node should use, honouring the host tokens and
 *  the animation context's stop switches. `durationMs: 0` means "snap". */
export function resolveFoldMotion(el: HTMLElement | null): FoldMotion {
  if (prefersNoFoldMotion()) return { durationMs: 0, easing: JT_FOLD_FALLBACK_EASE };
  let durationMs = JT_FOLD_FALLBACK_MS;
  let easing = JT_FOLD_FALLBACK_EASE;
  if (el && typeof getComputedStyle === "function") {
    const style = getComputedStyle(el);
    const parsed = parseCssTimeMs(style.getPropertyValue("--jt-fold-duration"));
    if (parsed !== null) durationMs = Math.min(Math.max(parsed, 0), 2000);
    const rawEase = style.getPropertyValue("--jt-fold-ease").trim();
    if (rawEase) easing = rawEase;
  }
  return { durationMs, easing };
}

interface FoldCallbacks {
  /** The motion actually started (no-op when it snaps); receives the
   *  resolved duration so the bus report can cover the real window. */
  onStart?: (durationMs: number) => void;
  /** The motion finished or was abandoned; pairs one-for-one with onStart. */
  onEnd?: () => void;
}

interface FoldRun {
  timer: ReturnType<typeof setTimeout> | null;
  end: ((event: TransitionEvent) => void) | null;
  callbacks: FoldCallbacks;
}

const foldRuns = new WeakMap<HTMLElement, FoldRun>();

function resetFoldStyles(el: HTMLElement): void {
  el.style.transition = "";
  el.style.height = "";
  el.style.overflow = "";
}

/** Drop the in-flight run for `el` (if any) and settle its report. */
function abandonFold(el: HTMLElement): boolean {
  const run = foldRuns.get(el);
  if (!run) return false;
  foldRuns.delete(el);
  if (run.timer !== null) clearTimeout(run.timer);
  if (run.end) el.removeEventListener("transitionend", run.end);
  resetFoldStyles(el);
  run.callbacks.onEnd?.();
  return true;
}

/**
 * Drive one fold on a conditionally rendered children block. `done` is Vue's
 * transition resolver: it must be called exactly once on the animated path
 * and never on the abandoned path (Vue already resolved a cancellation).
 *
 * Exported (module-internal, not re-exported from the package index) so the
 * height choreography can be unit-tested without a layout engine.
 */
export function runFold(
  el: HTMLElement,
  opening: boolean,
  done: () => void,
  callbacks: FoldCallbacks = {},
): void {
  abandonFold(el);
  const { durationMs, easing } = resolveFoldMotion(el);
  if (durationMs <= 0) {
    resetFoldStyles(el);
    done();
    return;
  }

  // Natural height first: at this point the block is freshly inserted (open)
  // or still at its resting height (close), so the read is not contaminated
  // by a previous fold's inline height.
  const natural = Math.max(0, opening ? el.scrollHeight : el.offsetHeight);
  el.style.overflow = "hidden";
  el.style.height = `${opening ? 0 : natural}px`;
  // Commit the start height before replacing it: a same-frame flip is read as
  // "no change" and the transition never starts.
  void el.offsetHeight;
  el.style.transition = `height ${durationMs}ms ${easing}`;
  el.style.height = `${opening ? natural : 0}px`;
  callbacks.onStart?.(durationMs);

  const finish = () => {
    const run = foldRuns.get(el);
    if (!run) return;
    foldRuns.delete(el);
    if (run.timer !== null) clearTimeout(run.timer);
    if (run.end) el.removeEventListener("transitionend", run.end);
    resetFoldStyles(el);
    run.callbacks.onEnd?.();
    done();
  };

  const onTransitionEnd = (event: TransitionEvent) => {
    if (event.target === el && event.propertyName === "height") finish();
  };
  el.addEventListener("transitionend", onTransitionEnd);
  foldRuns.set(el, {
    end: onTransitionEnd,
    callbacks,
    // The transitionend listener is the fast path; the timer is the
    // guaranteed exit (detached panes, interrupted frames, engines that
    // never deliver the event).
    timer: setTimeout(finish, durationMs + 60),
  });
}

/** Cancel a fold because Vue interrupted it (re-opened / re-closed mid-flight). */
export function cancelFold(el: HTMLElement): void {
  abandonFold(el);
}

/** Whether a live text selection intersects `el` — used to keep an explicit
 *  text-selection drag from toggling or copying the row it started on. */
function selectionTouches(el: HTMLElement): boolean {
  if (typeof window === "undefined" || typeof window.getSelection !== "function") return false;
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return false;
  if (typeof selection.containsNode === "function") {
    try {
      return selection.containsNode(el, true);
    } catch {
      /* fall through to the anchor probe */
    }
  }
  const anchor = selection.anchorNode;
  return !!anchor && el.contains(anchor);
}

/**
 * HkJsonTree — the interactive expandable JSON tree.
 *
 * A first-class family component (same tier as the rich-text surfaces):
 * the chat tool blocks, the chest error landing's raw-details pane and
 * any host pane render through THIS component — HkToolBlock consumes it
 * directly, and the `s-jt-*` stylesheet single-sources the visual
 * language, so the two can never drift. Feed it either pre-parsed
 * `value` or a raw JSON `text`; non-container input renders nothing.
 *
 * The root keeps the legacy `s-tool-json-tree` class: hosts (including
 * HkToolBlock's deferred scrollbar pass) target it, and the pane chrome
 * (mono font, capped height, hidden native scrollbars) lives there.
 *
 * Spacing contract (pinned by HkJsonTree.contract.test.ts): the toggle
 * box is 14px and sits ONE `--space-4` from the row text — identical for
 * leaf dots, collapsed previews and expanded parents — and is centered
 * on the first text line by formula, so collapsed and expanded states
 * align with the same left rhythm; `key:` gaps are one unit, type hints
 * two; the depth step is one toggle width (JT_INDENT = JT_TOGGLE,
 * pinned alongside the stylesheet contract).
 *
 * Collapse contract (same pin): a collapsed summary is ONE line — the
 * container preview and the collapsed long-string value carry the
 * one-line clip (`.s-jt-clamp` / `.s-jt-preview`) and ellipsize past the
 * row edge instead of wrapping.
 *
 * Selection contract (2026-11-05 user direction): the tree is a
 * read-only viewer, not a document — nothing inside it is selectable by
 * default, so a click or drag that was meant to toggle/copy can never
 * leave behind a half-selected payload. `selectable` opts a host into
 * row text selection deliberately; when it is on, a selection drag that
 * started inside the tree is preserved instead of firing the row's
 * toggle/copy handler.
 *
 * Motion contract: expanding/collapsing animates the children block's
 * height (see the fold-motion block above), reported to the animation
 * bus and snapping under reduced motion / the global animation switch.
 * The chevron rotates with the same tokens instead of swapping glyphs.
 */
export const HkJsonTree = defineComponent({
  name: "HkJsonTree",
  props: {
    /** Raw JSON text; parsed internally (containers only). */
    text: { type: String, default: "" },
    /** Pre-parsed value; takes precedence over `text` when provided. */
    value: { type: null, default: undefined },
    maxDepth: { type: Number, default: 8 },
    ariaLabel: { type: String, default: "" },
    /** Deliberate opt-in to row text selection (default: none — see the
     *  selection contract above). */
    selectable: { type: Boolean, default: false },
  },
  setup(props) {
    const clipboard = useClipboard();
    const expanded = ref(new Set<number>());
    const treeEl = ref<HTMLElement | null>(null);

    // The report window follows the resolved fold duration (a host may
    // retime `--jt-fold-duration` up to seconds), with the base window as
    // the floor for the default fast fold.
    let foldReportWindow = JT_FOLD_REPORT_MS;
    const foldReport = useReportedTransition(() => foldReportWindow);
    let foldReportDepth = 0;
    const foldCallbacks: FoldCallbacks = {
      onStart: (durationMs: number) => {
        foldReportWindow = Math.max(JT_FOLD_REPORT_MS, durationMs + 40);
        foldReportDepth += 1;
        foldReport.run();
      },
      onEnd: () => {
        foldReportDepth = Math.max(0, foldReportDepth - 1);
        if (foldReportDepth === 0) foldReport.cancel();
      },
    };

    const root = computed<HJsonNode | null>(() => {
      if (props.value !== undefined) {
        return buildJsonTree(props.value, props.maxDepth);
      }
      if (props.text) {
        const parsed = tryParseJson(props.text);
        return parsed ? buildJsonTree(parsed, props.maxDepth) : null;
      }
      return null;
    });

    // Reset expansion whenever the tree is rebuilt (fresh node ids).
    watch(root, (r) => {
      expanded.value = r ? initialExpandedSet(r) : new Set<number>();
    }, { immediate: true });

    function toggleJsonNode(id: number) {
      const next = new Set(expanded.value);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      expanded.value = next;
    }

    function copyTree() {
      const raw = props.value !== undefined
        ? JSON.stringify(props.value, null, 2)
        : props.text;
      if (raw) void clipboard.copy(raw);
    }

    /** True when the click ends a deliberate text-selection drag inside the
     *  opt-in selection surface — it must not toggle or copy. */
    function preserveSelection(): boolean {
      if (!props.selectable || !treeEl.value) return false;
      return selectionTouches(treeEl.value);
    }

    /* ── JSON tree renderers (verbatim from HkToolBlock) ─────────── */
    function renderJsonValue(value: unknown) {
      if (value === null) return <><span class="s-jv-null">null</span><span class="s-jt-type">null</span></>;
      if (value === undefined) return <><span class="s-jv-null">undefined</span><span class="s-jt-type">undefined</span></>;
      if (typeof value === "boolean") return <><span class="s-jv-bool">{String(value)}</span><span class="s-jt-type">boolean</span></>;
      if (typeof value === "number") return <><span class="s-jv-num">{String(value)}</span><span class="s-jt-type">number</span></>;
      if (typeof value === "string") return <><span class="s-jv-str">{JSON.stringify(value)}</span><span class="s-jt-type">string</span></>;
      return null;
    }

    function foldHooks() {
      return {
        css: false,
        onEnter: (el: Element, done: () => void) => runFold(el as HTMLElement, true, done, foldCallbacks),
        onLeave: (el: Element, done: () => void) => runFold(el as HTMLElement, false, done, foldCallbacks),
        onEnterCancelled: (el: Element) => cancelFold(el as HTMLElement),
        onLeaveCancelled: (el: Element) => cancelFold(el as HTMLElement),
      };
    }

    function onParentRowClick(node: HJsonNode) {
      if (preserveSelection()) return;
      // Deliberately does NOT stop propagation: the root handler already
      // skips parent rows for the copy path, and hosts that wrapped the
      // tree in their own click target keep receiving the event exactly as
      // before the fold work.
      toggleJsonNode(node.id);
    }

    function renderJsonNode(node: HJsonNode) {
      const indent = node.depth * JT_INDENT;

      if (node.isLongString && !node.isContainer) {
        return renderLongString(node, indent);
      }

      if (!node.isContainer) {
        return (
          <div class="s-jt-row" style={{ paddingLeft: `${indent}px` }}>
            <span class="s-jt-toggle">
              <span class="s-jt-leaf" />
            </span>
            {node.key !== null && <span class="s-jt-key">{node.key}</span>}
            {node.key !== null && <span class="s-jt-colon">: </span>}
            {renderJsonValue(node.value)}
          </div>
        );
      }

      const isOpen = expanded.value.has(node.id);
      const isArr = Array.isArray(node.value);

      // The group wrapper stays mounted in BOTH states: it is the stable
      // home the children <Transition> needs, and the summary row simply
      // swaps its trailing content (preview ↔ badge). A collapsed node that
      // dropped the wrapper would remove its children as part of the parent
      // unmount, so the leave animation could never run.
      return (
        <div class="s-jt-group" data-open={isOpen || undefined}>
          <div
            class="s-jt-row"
            data-parent
            style={{ paddingLeft: `${indent}px` }}
            onClick={() => onParentRowClick(node)}
          >
            <span class="s-jt-toggle" data-parent>
              <ChevronRight size={10} class="s-jt-chevron" />
            </span>
            {node.key !== null && <span class="s-jt-key">{node.key}</span>}
            {node.key !== null && <span class="s-jt-colon">: </span>}
            {isOpen
              ? <span class="s-jt-badge is-open">{isArr ? `Array(${node.childCount})` : `{${node.childCount}}`}</span>
              : <><span class="s-jt-indent" /><span class="s-jt-preview">{node.preview}</span></>}
          </div>
          <Transition {...foldHooks()}>
            {isOpen && (
              <div class="s-jt-children" style={{ "--guide-left": `${indent + JT_GUIDE_OFFSET}px` }}>
                {node.children.map(child => renderJsonNode(child))}
              </div>
            )}
          </Transition>
        </div>
      );
    }

    function renderLongString(node: HJsonNode, indent: number) {
      const isOpen = expanded.value.has(node.id);

      return (
        <div class="s-jt-group" data-open={isOpen || undefined}>
          <div
            class="s-jt-row"
            data-parent
            style={{ paddingLeft: `${indent}px` }}
            onClick={() => onParentRowClick(node)}
          >
            <span class="s-jt-toggle" data-parent>
              <ChevronRight size={10} class="s-jt-chevron" />
            </span>
            {node.key !== null && <span class="s-jt-key">{node.key}</span>}
            {node.key !== null && <span class="s-jt-colon">: </span>}
            {isOpen
              ? <span class="s-jt-badge is-open">string ({node.stringValue.length})</span>
              : <>
                  <span class="s-jt-indent" />
                  <span class="s-jv-str s-jt-clamp">"{truncateStr(node.stringValue, STR_PREVIEW_LEN)}"</span>
                  <span class="s-jt-type">string ({node.stringValue.length})</span>
                </>}
          </div>
          <Transition {...foldHooks()}>
            {isOpen && (
              <div class="s-jt-children" style={{ "--guide-left": `${indent + JT_GUIDE_OFFSET}px` }}>
                {node.stringValue.split("\n").map((line, li) => (
                  <div key={li} class="s-jt-row" style={{ paddingLeft: `${(node.depth + 1) * JT_INDENT}px` }}>
                    <span class="s-jt-toggle">
                      <span class="s-jt-leaf" />
                    </span>
                    <span class="s-jv-str-raw">{line || " "}</span>
                  </div>
                ))}
              </div>
            )}
          </Transition>
        </div>
      );
    }

    return () => {
      if (!root.value) return null;
      return (
        <div
          ref={treeEl}
          class={props.selectable ? "s-tool-json-tree s-jt-selectable" : "s-tool-json-tree"}
          aria-label={props.ariaLabel || undefined}
          role="tree"
          onClick={(e) => {
            if (preserveSelection()) return;
            const target = e.target as HTMLElement;
            if (target.closest(".s-jt-row[data-parent]")) return;
            e.stopPropagation();
            copyTree();
          }}
        >
          {renderJsonNode(root.value)}
        </div>
      );
    };
  },
});
