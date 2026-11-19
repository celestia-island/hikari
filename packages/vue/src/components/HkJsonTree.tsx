import { computed, defineComponent, nextTick, ref, Transition, watch } from "vue";
import { ChevronRight, KeyRound, Pencil, Plus, Trash2 } from "lucide-vue-next";
import { useClipboard } from "@celestia-island/hikari";

import { useI18n } from "../i18n/context";
import {
  useContextMenu,
  useContextMenuTrigger,
  type ContextMenuRequest,
  type ContextTriggerPoint,
} from "../composables/useContextMenu";
import type { HkMenuItem } from "./HkMenu";
import {
  jsonInsertChildAt,
  jsonIsArrayAt,
  jsonPathKey,
  jsonRemoveAtPath,
  jsonSetAtPath,
  jsonValueAtPath,
  type JsonPath,
} from "./jsonTreeEdit";

import { useReportedTransition } from "../composables/useReportedTransition";

import "./HkJsonTree.scss";
// Editing chrome rides its own sheet: HkJsonTree.scss is compiled into
// the boot error landing's checked-in CSS, and the editing styles must
// never re-bloat that boot-critical payload.
import "./HkJsonTree.edit.scss";

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

/** One node of the interactive JSON result tree.
 *
 *  `path` (and its precomputed `pathKey`) locate the node inside the root
 *  value — object members carry their key, array elements their index as
 *  a string (matching `key`). The editable mode uses them for the row
 *  menu target, the inline editor and the path-keyed expansion set;
 *  read-only trees simply carry the extra fields. */
export interface HJsonNode {
  id: number;
  path: JsonPath;
  pathKey: string;
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
  path: JsonPath,
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
        children.push(buildJsonNode(v, k, depth + 1, maxDepth, idSeq, [...path, k]));
      }
    }
  }

  const nid = idSeq.n;
  idSeq.n += 1;
  return {
    id: nid,
    path,
    pathKey: jsonPathKey(path),
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
 * returned tree; node paths locate each node inside the root value.
 */
export function buildJsonTree(value: unknown, maxDepth = 8): HJsonNode | null {
  if (value === null || typeof value !== "object") return null;
  return buildJsonNode(value, null, 0, maxDepth, { n: 0 }, []);
}

function initialExpandedSet(root: HJsonNode): Set<number> {
  const set = new Set<number>();
  set.add(root.id);
  for (const child of root.children) {
    set.add(child.id);
  }
  return set;
}

/** Editable-mode twin of `initialExpandedSet`: the root and its direct
 *  children, keyed by PATH (see the expansion contract in HkJsonTree's
 *  header docs). */
function initialExpandedPathSet(root: HJsonNode): Set<string> {
  const set = new Set<string>([root.pathKey]);
  for (const child of root.children) {
    set.add(child.pathKey);
  }
  return set;
}

/* ── Editable mode: leaf types, insert defaults, labels ─────────────── */

/** Scalar types the inline editor's type chips switch between. */
type JsonLeafType = "string" | "number" | "boolean" | "null";
/** The six child types the "New child" submenu offers. */
type JsonInsertType = JsonLeafType | "object" | "array";

const LEAF_TYPES: JsonLeafType[] = ["string", "number", "boolean", "null"];
const INSERT_TYPES: JsonInsertType[] = ["string", "number", "boolean", "null", "object", "array"];

/** Landing values for "New child" (spec: `""` / `0` / `false` / `null` /
 *  `{}` / `[]`) — committed immediately, then refined inline. */
const INSERT_DEFAULTS: Record<JsonInsertType, unknown> = {
  string: "",
  number: 0,
  boolean: false,
  null: null,
  object: {},
  array: [],
};

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
 *
 * Editing contract (opt-in `editable` prop, 2026-11-19): the tree stays a
 * viewer by default — nothing changes until a host opts in. Editing is
 * then MENU-DRIVEN: right-click / long-press / menu-key on any row (via
 * the shared `useContextMenuTrigger`, so desktop gets the pointer-anchored
 * popout, phones the bottom sheet and hosts without an
 * `HkContextMenuProvider` the documented no-op — the menu simply never
 * opens, never throws) offers edit-value / rename-key / new-child ▸
 * (six-type submenu) / delete per node; the root only grows children.
 * Picking edit or rename flips that row into an inline editor (key input
 * for object members, value input with string/number/boolean/null chips,
 * invalid numbers block submission and show an invalid state); Enter or
 * a blur outside the editor commits, Escape cancels. A rename is the
 * three-op composite insert(newKey, value) + remove(oldKey), which moves
 * the member to the END of its object — content survives, key order in
 * that object does not. New children land
 * their default value (`""`/`0`/`false`/`null`/`{}`/`[]`) immediately and
 * the fresh row opens inline so the default is refined, not imagined.
 * Every commit flows through the pure `jsonTreeEdit` operations
 * (`jsonSetAtPath` / `jsonInsertChildAt` / `jsonRemoveAtPath` — immutable,
 * exported from the package index) and is handed to the host via
 * `update:value` with the NEW root: the tree is a controlled component,
 * editing pairs with the `value` prop (a `text`-only tree has no root to
 * mutate and stays read-only even when `editable` is on). Empty open
 * containers render an inline "New child" affordance — the only way an
 * empty `{}` can ever grow a first child.
 *
 * Editable expansion contract: while `editable` is on, the expanded set is
 * keyed by node PATH (not the rebuilt tree's node ids), so a commit's
 * rebuild keeps the user's folds exactly where they left them — keying by
 * id would collapse the whole tree after every edit and make editing
 * unusable on any payload deeper than one level. Non-editable trees keep
 * the id-keyed set and its reset-on-rebuild behavior untouched.
 *
 * Copy contract note: the tree-wide copy-on-click stays; clicks inside the
 * editor row and the empty-container affordance are excluded so typing and
 * menu buttons never dump the payload into the clipboard.
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
    /** Opt-in to menu-driven editing (default: false — see the editing
     *  contract above). Pairs with the `value` prop: the host owns the
     *  root and receives every commit through `update:value`. */
    editable: { type: Boolean, default: false },
  },
  emits: { "update:value": null },
  setup(props, { emit }) {
    const clipboard = useClipboard();
    const { t } = useI18n();
    const expanded = ref(new Set<number>());
    /** Editable-mode expansion: keyed by node path (see the editable
     *  expansion contract in the header docs), so commits survive rebuilds. */
    const expandedPaths = ref(new Set<string>());
    const treeEl = ref<HTMLElement | null>(null);

    // The report window follows the resolved fold duration (a host may
    // retime `--jt-fold-duration` up to seconds), with the base window as
    // the floor for the default fast fold.
    let foldReportWindow = JT_FOLD_REPORT_MS;
    const foldReport = useReportedTransition(() => foldReportWindow);
    let foldReportDepth = 0;
    const foldCallbacks: FoldCallbacks = {
      onStart: (durationMs: number) => {
        foldReportWindow = Math.max(JT_FOLD_REPORT_MS, durationMs + 80);
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

    /** Editing pairs with the `value` prop: a `text`-only tree has no
     *  controlled root to mutate and stays read-only (menu never opens). */
    const canEdit = computed(() => props.editable === true && props.value !== undefined);

    /** Every built node by its path key — the row menu's target lookup and
     *  the stale-editor guard both read this. */
    const nodeIndex = computed(() => {
      const map = new Map<string, HJsonNode>();
      const walk = (n: HJsonNode) => {
        map.set(n.pathKey, n);
        for (const child of n.children) walk(child);
      };
      if (root.value) walk(root.value);
      return map;
    });

    // Reset expansion whenever the tree is rebuilt (fresh node ids).
    // Editable mode deliberately does NOT reset: its path-keyed set rides
    // rebuilds so folds survive every commit (header contract). It seeds
    // once per root APPEARANCE (mount, or a host filling in a previously
    // absent value) and keeps the user's word after that. Registered BELOW,
    // after the editor state it reaches into (the immediate run is
    // synchronous and must not touch a not-yet-initialized ref).
    function isOpenState(node: HJsonNode): boolean {
      return props.editable
        ? expandedPaths.value.has(node.pathKey)
        : expanded.value.has(node.id);
    }

    function toggleJsonNode(node: HJsonNode) {
      if (props.editable) {
        const next = new Set(expandedPaths.value);
        if (next.has(node.pathKey)) next.delete(node.pathKey);
        else next.add(node.pathKey);
        expandedPaths.value = next;
        return;
      }
      const next = new Set(expanded.value);
      if (next.has(node.id)) next.delete(node.id);
      else next.add(node.id);
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

    /* ── Editable mode: menu, inline editor, pure-op commits ──────────
     *
     * Labels ride the house i18n convention (useI18n + the 11-locale
     * bundles, English inline fallbacks): that is what ~every hikari
     * component does (HkMenuPanel, HkEditableTable, HkConfirmDialog, …);
     * a host-passed labels prop would be the odd one out, and the
     * flat-key parity test keeps the bundles complete for all locales.
     */

    /** The row the inline editor is attached to, if any. The editor always
     *  targets a node that EXISTS in the rebuilt tree (inserts commit the
     *  default first, then aim the editor at the fresh path). */
    const editing = ref<{ path: JsonPath } | null>(null);
    /** The editor's working state, snapshotted when the editor opens and
     *  mutated by the inputs; committed on Enter / outside blur. */
    const draft = ref<JsonEditDraft | null>(null);
    const editKeyEl = ref<HTMLInputElement | null>(null);
    const editValueEl = ref<HTMLInputElement | null>(null);
    /** Focus requested for the editor ("key" for rename / object inserts,
     *  "value" for value edits and array-leaf inserts). Cleared once it
     *  lands; retried after a rebuild when the row mounts late. */
    let editFocusWanted: "key" | "value" | null = null;

    interface JsonEditDraft {
      keyText: string;
      type: JsonLeafType;
      /** The string text (also carries the number text while typing). */
      text: string;
      bool: boolean;
    }

    function draftForValue(key: string | null, value: unknown): JsonEditDraft {
      return {
        keyText: key ?? "",
        type:
          typeof value === "number"
            ? "number"
            : typeof value === "boolean"
              ? "boolean"
              : value === null
                ? "null"
                : "string",
        text: typeof value === "string" ? value : typeof value === "number" ? String(value) : "",
        bool: value === true,
      };
    }

    /** Number-field validity: empty and non-finite texts are invalid —
     *  `Number("")` is 0 and would otherwise smuggle empties in as zeros. */
    function isNumberText(text: string): boolean {
      return text.trim() !== "" && Number.isFinite(Number(text));
    }

    function draftValue(d: JsonEditDraft): unknown {
      if (d.type === "null") return null;
      if (d.type === "boolean") return d.bool;
      if (d.type === "number") return Number(d.text);
      return d.text;
    }

    function typeLabel(type: JsonInsertType): string {
      switch (type) {
        case "string": return t("hikari::jsonTree.typeString", "String");
        case "number": return t("hikari::jsonTree.typeNumber", "Number");
        case "boolean": return t("hikari::jsonTree.typeBoolean", "Boolean");
        case "null": return t("hikari::jsonTree.typeNull", "Null");
        case "object": return t("hikari::jsonTree.typeObject", "Object");
        case "array": return t("hikari::jsonTree.typeArray", "Array");
      }
    }

    /** Whether `node` is a named member of an OBJECT (rename applies) —
     *  array elements carry string index keys that are NOT names. */
    function isObjectMember(node: HJsonNode): boolean {
      return node.path.length > 0
        && node.key !== null
        && !jsonIsArrayAt(props.value, node.path.slice(0, -1));
    }

    function focusEditorSoon(which: "key" | "value") {
      editFocusWanted = which;
      void nextTick(() => focusEditorNow());
    }

    function focusEditorNow() {
      if (!editing.value) {
        editFocusWanted = null;
        return;
      }
      const el = editFocusWanted === "key" ? editKeyEl.value : editValueEl.value;
      if (el) {
        el.focus();
        // Preselect: the common edit replaces the whole current value/key.
        el.select?.();
        editFocusWanted = null;
      }
    }

    function beginEdit(node: HJsonNode, focus: "key" | "value") {
      if (!canEdit.value) return;
      editing.value = { path: node.path };
      draft.value = draftForValue(node.key, node.value);
      focusEditorSoon(focus);
    }

    function closeEditor() {
      editing.value = null;
      draft.value = null;
      editFocusWanted = null;
    }

    function cancelEdit() {
      // Synchronous tear-down: `editing` is null BEFORE the row unmounts,
      // so the trailing focusout is a no-op — no flag dance needed.
      if (!editing.value) return;
      closeEditor();
    }

    function onEditorKeydown(event: KeyboardEvent) {
      if (event.key === "Enter") {
        event.preventDefault();
        commitEdit();
      } else if (event.key === "Escape") {
        event.preventDefault();
        cancelEdit();
      }
    }

    /** Focus leaving the editor row (relatedTarget outside it) commits —
     *  chip/button hops INSIDE the row never do, and a cancelled editor
     *  never commits (its row is already gone when the focusout lands). */
    function maybeBlurCommit(event: FocusEvent) {
      if (!editing.value || !draft.value) return;
      const row = event.currentTarget as HTMLElement | null;
      const to = event.relatedTarget as Node | null;
      if (row && to && row.contains(to)) return;
      commitEdit();
    }

    /** First non-colliding `key`/`key2`/… for a new object member. */
    function nextChildKey(obj: Record<string, unknown>): string {
      let n = 1;
      let key = "key";
      // Own keys only — same prototype hygiene as the edit ops.
      while (Object.prototype.hasOwnProperty.call(obj, key)) {
        n += 1;
        key = `key${n}`;
      }
      return key;
    }

    /** Whether a sibling already claims `key` among the object members at
     *  `parentPath` (own keys only — the prototype chain never answers).
     *  The rename composite's insert is overwrite semantics, so a collision
     *  would silently EAT the sibling — commits must refuse instead. */
    function siblingHasKey(parentPath: JsonPath, key: string): boolean {
      const parent = jsonValueAtPath(props.value, parentPath);
      return parent !== null
        && typeof parent === "object"
        && !Array.isArray(parent)
        && Object.prototype.hasOwnProperty.call(parent, key);
    }

    /** The editor's rename collides with an existing sibling key — the
     *  invalid state the key input shows until the text is unique again. */
    function renameCollision(node: HJsonNode, keyText: string): boolean {
      return isObjectMember(node)
        && keyText !== node.key
        && siblingHasKey(node.path.slice(0, -1), keyText);
    }

    /** Commit the open editor through the pure ops and hand the new root
     *  to the host. A rename is the composite insert(newKey, value) +
     *  remove(oldKey) — the exported op set stays exactly the three
     *  primitives. Order caveat (see jsonTreeEdit's header): the composite
     *  MOVES the renamed member to the end of its object; content is
     *  preserved, key order inside that object is not. Renaming ONTO an
     *  existing sibling key is REFUSED (the insert overwrite would delete
     *  the sibling with no undo): the key input shows the invalid state
     *  and the editor stays open, exactly like a bad number. */
    function commitEdit() {
      const target = editing.value;
      const d = draft.value;
      if (!target || !d) return;
      const node = nodeIndex.value.get(jsonPathKey(target.path));
      if (!node) {
        closeEditor();
        return;
      }
      const numberBad = d.type === "number" && !isNumberText(d.text);
      const keyCollides = renameCollision(node, d.keyText);
      if (numberBad || keyCollides) return; // blocked; invalid state shows
      let next = props.value;
      let finalPath = node.path;
      if (isObjectMember(node) && d.keyText !== node.key) {
        next = jsonInsertChildAt(next, node.path.slice(0, -1), d.keyText, node.value);
        next = jsonRemoveAtPath(next, node.path);
        finalPath = [...node.path.slice(0, -1), d.keyText];
        migrateExpansion(node.path, d.keyText);
      }
      if (!node.isContainer) {
        next = jsonSetAtPath(next, finalPath, draftValue(d));
      }
      closeEditor();
      // The ops return the input untouched when a guard fired — no point
      // emitting a no-op.
      if (next !== props.value) emit("update:value", next);
    }

    /** Rewrite the path-keyed expansion set for a rename: the renamed node
     *  AND its whole subtree moved to the new key; structural parse (not a
     *  string prefix — JSON keys would collide on `["a"]` vs `["ab"]`). */
    function migrateExpansion(oldPath: JsonPath, newTail: string | number) {
      const next = new Set<string>();
      for (const k of expandedPaths.value) {
        try {
          const p = JSON.parse(k) as JsonPath;
          if (p.length >= oldPath.length
            && oldPath.every((seg, i) => seg === p[i])) {
            next.add(jsonPathKey([...p.slice(0, oldPath.length - 1), newTail, ...p.slice(oldPath.length)]));
            continue;
          }
        } catch {
          /* not one of ours — keep as-is */
        }
        next.add(k);
      }
      expandedPaths.value = next;
    }

    /** Drop expansion keys under a deleted node (and the node itself).
     *  Object members are exact. ARRAY members are approximate by index:
     *  a splice shifts later siblings down while their stored path keys
     *  stay put, so a fold intended for a shifted element can land on its
     *  new neighbor (the expansion of old [2] decorates new [2], which is
     *  the element formerly at [3]) — wrong-fold drift confined to the
     *  edited array's subtree, never lost data. A faithful fix needs a
     *  parallel old→new index migration through every commit; not worth
     *  the machinery for a fold state. */
    function pruneExpansion(deletedPath: JsonPath) {
      const next = new Set<string>();
      for (const k of expandedPaths.value) {
        try {
          const p = JSON.parse(k) as JsonPath;
          if (p.length >= deletedPath.length
            && deletedPath.every((seg, i) => seg === p[i])) {
            continue;
          }
        } catch {
          /* not one of ours — keep as-is */
        }
        next.add(k);
      }
      expandedPaths.value = next;
    }

    /** "New child": commit the default value immediately (so the child is
     *  real, visible and deletable even if the user walks away), then aim
     *  the inline editor at the fresh row. */
    function insertChild(node: HJsonNode, type: JsonInsertType) {
      if (!canEdit.value || !node.isContainer) return;
      const value = INSERT_DEFAULTS[type];
      let next = props.value;
      let childPath: JsonPath;
      let childKey: string | null = null;
      if (Array.isArray(node.value)) {
        const idx = node.childCount; // spec: array insert = append
        next = jsonInsertChildAt(next, node.path, idx, value);
        childPath = [...node.path, String(idx)];
      } else {
        const key = nextChildKey(node.value as Record<string, unknown>);
        next = jsonInsertChildAt(next, node.path, key, value);
        childPath = [...node.path, key];
        childKey = key;
      }
      if (!expandedPaths.value.has(node.pathKey)) {
        expandedPaths.value = new Set([...expandedPaths.value, node.pathKey]);
      }
      // Same guard as commitEdit: a guard-fired op returns the input
      // untouched, and re-emitting that is a no-op for the host.
      if (next !== props.value) emit("update:value", next);
      // Inline-refine the fresh child: name it (object member) or fix the
      // value (leaf inside an array). A container inside an array has
      // nothing to type — no editor.
      const isLeaf = type !== "object" && type !== "array";
      if (childKey !== null || isLeaf) {
        editing.value = { path: childPath };
        draft.value = draftForValue(childKey, value);
        focusEditorSoon(childKey !== null ? "key" : "value");
      }
    }

    /* ── Editable mode: the row context menu ────────────────────────── */

    const ctxMenuApi = useContextMenu();

    function menuItemsFor(node: HJsonNode): HkMenuItem[] {
      const items: HkMenuItem[] = [];
      if (!node.isContainer) {
        items.push({ key: "jt:edit", label: t("hikari::jsonTree.editValue", "Edit value"), icon: Pencil });
      }
      if (isObjectMember(node)) {
        items.push({ key: "jt:rename", label: t("hikari::jsonTree.renameKey", "Rename key"), icon: KeyRound });
      }
      if (node.isContainer) {
        items.push({
          key: "jt:add",
          label: t("hikari::jsonTree.addChild", "New child"),
          icon: Plus,
          children: INSERT_TYPES.map((type) => ({ key: `jt:add:${type}`, label: typeLabel(type) })),
        });
      }
      if (node.path.length > 0) {
        items.push({ key: "jt:delete", label: t("hikari::jsonTree.delete", "Delete"), icon: Trash2, danger: true });
      }
      return items;
    }

    function runMenuAction(rawKey: string, node: HJsonNode) {
      if (!canEdit.value) return;
      if (rawKey === "jt:edit") {
        beginEdit(node, "value");
        return;
      }
      if (rawKey === "jt:rename") {
        beginEdit(node, "key");
        return;
      }
      if (rawKey === "jt:delete") {
        const next = jsonRemoveAtPath(props.value, node.path);
        if (next !== props.value) {
          pruneExpansion(node.path);
          const target = editing.value;
          if (target
            && target.path.length >= node.path.length
            && node.path.every((seg, i) => seg === target.path[i])) {
            closeEditor();
          }
          emit("update:value", next);
        }
        return;
      }
      if (rawKey.startsWith("jt:add:")) {
        const type = rawKey.slice("jt:add:".length) as JsonInsertType;
        if (INSERT_TYPES.includes(type)) insertChild(node, type);
      }
    }

    function buildMenu(point: ContextTriggerPoint): ContextMenuRequest | null {
      if (!canEdit.value) return null;
      const rawTarget = point.target;
      const el = rawTarget instanceof Element ? rawTarget.closest("[data-jt-node]") : null;
      if (!el) return null;
      const pk = el.getAttribute("data-jt-node");
      const node = pk ? nodeIndex.value.get(pk) : undefined;
      if (!node) return null;
      return {
        x: point.x,
        y: point.y,
        title: node.key ?? t("hikari::jsonTree.rootTitle", "Root"),
        items: menuItemsFor(node),
        onSelect: (key) => runMenuAction(key, node),
        onClose: () => {},
      };
    }

    /** The empty-container affordance opens the SAME six-type picker, as a
     *  flat menu anchored to the affordance itself. */
    function openAddMenuFor(node: HJsonNode, at: HTMLElement) {
      if (!canEdit.value) return;
      const rect = at.getBoundingClientRect();
      ctxMenuApi.open({
        x: rect.left,
        y: rect.bottom,
        title: t("hikari::jsonTree.addChild", "New child"),
        items: INSERT_TYPES.map((type) => ({ key: `jt:add:${type}`, label: typeLabel(type) })),
        onSelect: (key) => runMenuAction(key, node),
        onClose: () => {},
      });
    }

    // Bound only when the host opted in: a non-editable tree must not so
    // much as carry the trigger listeners. The binding is setup-static —
    // `editable` does not flap at runtime.
    if (props.editable) {
      useContextMenuTrigger(treeEl, buildMenu);
    }

    // ── expansion + editor rebuild watch (see note above the helper) ──
    watch(root, (r, prev) => {
      if (!props.editable) {
        expanded.value = r ? initialExpandedSet(r) : new Set<number>();
        return;
      }
      if (!prev) {
        expandedPaths.value = r ? initialExpandedPathSet(r) : new Set<string>();
      }
      // A rebuild may have removed the node under the open editor (the
      // host replaced the value externally) — drop the editor instead of
      // stranding it on a dead path.
      if (editing.value && (!r || !nodeIndex.value.has(jsonPathKey(editing.value.path)))) {
        closeEditor();
        return;
      }
      // The insert flow opens the editor before the host's commit lands;
      // finish the deferred focus once the fresh row has mounted.
      if (editFocusWanted) focusEditorNow();
    }, { immediate: true });

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

    function onParentRowClick(node: HJsonNode, event: MouseEvent) {
      if (preserveSelection()) return;
      // Clicks inside the open inline editor (container rename) must not
      // toggle the row under the user's caret.
      if (props.editable && (event.target as HTMLElement | null)?.closest?.(".s-jt-edit")) return;
      // Deliberately does NOT stop propagation: the root handler already
      // skips parent rows for the copy path, and hosts that wrapped the
      // tree in their own click target keep receiving the event exactly as
      // before the fold work.
      toggleJsonNode(node);
    }

    /** The inline editor row for `node` (leaf value edit / rename / fresh
     *  insert). Commits: Enter, or focus leaving the row. Cancels: Escape.
     *  Carries the node's path stamp so a right-click on the editor row
     *  still resolves the row menu to the node being edited. */
    function renderEditorRow(node: HJsonNode, indent: number) {
      const d = draft.value;
      if (!d) return null;
      const numBad = d.type === "number" && !isNumberText(d.text);
      const named = isObjectMember(node);
      const keyBad = renameCollision(node, d.keyText);
      return (
        <div
          class="s-jt-row s-jt-edit"
          data-editing
          data-jt-node={canEdit.value ? node.pathKey : undefined}
          style={{ paddingLeft: `${indent}px` }}
          onFocusout={maybeBlurCommit}
        >
          <span class="s-jt-toggle">
            <span class="s-jt-leaf" />
          </span>
          {named && (
            <>
              <input
                ref={editKeyEl}
                class="s-jt-input"
                data-invalid={keyBad || undefined}
                aria-invalid={keyBad || undefined}
                value={d.keyText}
                aria-label={t("hikari::jsonTree.keyLabel", "Key")}
                spellcheck={false}
                onInput={(e) => { d.keyText = (e.target as HTMLInputElement).value; }}
                onKeydown={onEditorKeydown}
              />
              {keyBad && <span class="s-jt-invalid">{t("hikari::jsonTree.duplicateKey", "Key already in use")}</span>}
              <span class="s-jt-colon">: </span>
            </>
          )}
          {!node.isContainer && (
            <span class="s-jt-edit-value">
              <span class="s-jt-chips" role="group">
                {LEAF_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    class="s-jt-chip"
                    data-on={d.type === type || undefined}
                    aria-pressed={d.type === type}
                    onClick={() => { d.type = type; }}
                  >
                    {typeLabel(type)}
                  </button>
                ))}
              </span>
              {d.type === "string" && (
                <input
                  ref={editValueEl}
                  class="s-jt-input"
                  value={d.text}
                  aria-label={t("hikari::jsonTree.valueLabel", "Value")}
                  spellcheck={false}
                  onInput={(e) => { d.text = (e.target as HTMLInputElement).value; }}
                  onKeydown={onEditorKeydown}
                />
              )}
              {d.type === "number" && (
                <>
                  <input
                    ref={editValueEl}
                    class="s-jt-input"
                    data-invalid={numBad || undefined}
                    value={d.text}
                    aria-label={t("hikari::jsonTree.valueLabel", "Value")}
                    aria-invalid={numBad || undefined}
                    spellcheck={false}
                    inputmode="decimal"
                    onInput={(e) => { d.text = (e.target as HTMLInputElement).value; }}
                    onKeydown={onEditorKeydown}
                  />
                  {numBad && <span class="s-jt-invalid">{t("hikari::jsonTree.invalidNumber", "Invalid number")}</span>}
                </>
              )}
              {d.type === "boolean" && (
                <span class="s-jt-chips" role="group">
                  <button
                    type="button"
                    class="s-jt-chip"
                    data-on={d.bool || undefined}
                    aria-pressed={d.bool}
                    onClick={() => { d.bool = true; }}
                  >
                    true
                  </button>
                  <button
                    type="button"
                    class="s-jt-chip"
                    data-on={!d.bool || undefined}
                    aria-pressed={!d.bool}
                    onClick={() => { d.bool = false; }}
                  >
                    false
                  </button>
                </span>
              )}
              {d.type === "null" && <span class="s-jv-null">null</span>}
            </span>
          )}
        </div>
      );
    }

    /** The open-empty container's inline "New child" affordance — without
     *  it an empty `{}` could never grow its first child. Clicking opens
     *  the six-type picker anchored here; right-clicking the row falls
     *  through to the container's row menu. */
    function renderEmptyAdd(node: HJsonNode) {
      return (
        <div class="s-jt-row s-jt-empty-row" data-jt-node={node.pathKey}>
          <span class="s-jt-toggle">
            <span class="s-jt-leaf" />
          </span>
          <button
            type="button"
            class="s-jt-empty-add"
            onClick={(e) => openAddMenuFor(node, e.currentTarget as HTMLElement)}
          >
            <Plus size={10} class="s-jt-add-glyph" />
            {t("hikari::jsonTree.addChild", "New child")}
          </button>
        </div>
      );
    }

    function renderJsonNode(node: HJsonNode) {
      const indent = node.depth * JT_INDENT;
      const editingThis = canEdit.value
        && editing.value !== null
        && jsonPathKey(editing.value.path) === node.pathKey;
      // Editable-only: the row → node address the delegated menu resolves
      // through. Absent in read-only trees (DOM stays byte-identical) and
      // in text-driven trees (nothing to mutate — no false affordances).
      const nodeAttr = canEdit.value ? node.pathKey : undefined;

      if (node.isLongString && !node.isContainer) {
        if (editingThis) return renderEditorRow(node, indent);
        return renderLongString(node, indent, nodeAttr);
      }

      if (!node.isContainer) {
        if (editingThis) return renderEditorRow(node, indent);
        return (
          <div class="s-jt-row" data-jt-node={nodeAttr} style={{ paddingLeft: `${indent}px` }}>
            <span class="s-jt-toggle">
              <span class="s-jt-leaf" />
            </span>
            {node.key !== null && <span class="s-jt-key">{node.key}</span>}
            {node.key !== null && <span class="s-jt-colon">: </span>}
            {renderJsonValue(node.value)}
          </div>
        );
      }

      const isOpen = isOpenState(node);
      const isArr = Array.isArray(node.value);

      // The group wrapper stays mounted in BOTH states: it is the stable
      // home the children <Transition> needs, and the summary row simply
      // swaps its trailing content (preview ↔ badge). A collapsed node that
      // dropped the wrapper would remove its children as part of the parent
      // unmount, so the leave animation could never run.
      return (
        <div class="s-jt-group" data-open={isOpen || undefined}>
          <div
            class={editingThis ? "s-jt-row s-jt-edit" : "s-jt-row"}
            data-parent
            data-editing={editingThis || undefined}
            data-jt-node={nodeAttr}
            style={{ paddingLeft: `${indent}px` }}
            onClick={(e) => onParentRowClick(node, e)}
            onFocusout={editingThis ? maybeBlurCommit : undefined}
          >
            <span class="s-jt-toggle" data-parent>
              <ChevronRight size={10} class="s-jt-chevron" />
            </span>
            {editingThis && isObjectMember(node)
              ? (
                  <>
                    <input
                      ref={editKeyEl}
                      class="s-jt-input"
                      data-invalid={renameCollision(node, draft.value?.keyText ?? "") || undefined}
                      aria-invalid={renameCollision(node, draft.value?.keyText ?? "") || undefined}
                      value={draft.value?.keyText ?? ""}
                      aria-label={t("hikari::jsonTree.keyLabel", "Key")}
                      spellcheck={false}
                      onInput={(e) => { if (draft.value) draft.value.keyText = (e.target as HTMLInputElement).value; }}
                      onKeydown={onEditorKeydown}
                    />
                    {renameCollision(node, draft.value?.keyText ?? "")
                      && <span class="s-jt-invalid">{t("hikari::jsonTree.duplicateKey", "Key already in use")}</span>}
                    <span class="s-jt-colon">: </span>
                  </>
                )
              : (
                  <>
                    {node.key !== null && <span class="s-jt-key">{node.key}</span>}
                    {node.key !== null && <span class="s-jt-colon">: </span>}
                  </>
                )}
            {isOpen
              ? <span class="s-jt-badge is-open">{isArr ? `Array(${node.childCount})` : `{${node.childCount}}`}</span>
              : <><span class="s-jt-indent" /><span class="s-jt-preview">{node.preview}</span></>}
          </div>
          <Transition {...foldHooks()}>
            {isOpen && (
              <div class="s-jt-children" style={{ "--guide-left": `${indent + JT_GUIDE_OFFSET}px` }}>
                {node.children.map(child => renderJsonNode(child))}
                {canEdit.value && node.childCount === 0 && renderEmptyAdd(node)}
              </div>
            )}
          </Transition>
        </div>
      );
    }

    function renderLongString(node: HJsonNode, indent: number, nodeAttr: string | undefined) {
      const isOpen = isOpenState(node);

      return (
        <div class="s-jt-group" data-open={isOpen || undefined}>
          <div
            class="s-jt-row"
            data-parent
            data-jt-node={nodeAttr}
            style={{ paddingLeft: `${indent}px` }}
            onClick={(e) => onParentRowClick(node, e)}
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
                  <div
                    key={li}
                    class="s-jt-row"
                    data-jt-node={nodeAttr}
                    style={{ paddingLeft: `${(node.depth + 1) * JT_INDENT}px` }}
                  >
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
          class={["s-tool-json-tree", props.selectable && "s-jt-selectable", canEdit.value && "s-jt-editable"]}
          aria-label={props.ariaLabel || undefined}
          role="tree"
          onClick={(e) => {
            if (preserveSelection()) return;
            const target = e.target as HTMLElement;
            if (target.closest(".s-jt-row[data-parent]")) return;
            // Editor rows and the empty-container affordance are editing
            // UI, not copy targets (editable-only; read-only trees never
            // contain either).
            if (props.editable && target.closest(".s-jt-edit, .s-jt-empty-row")) return;
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
