import {
  computed,
  defineComponent,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  useId,
  watch,
  type PropType,
} from "vue";
import { Trash2 } from "lucide-vue-next";

import HButton from "./HkButton";
import HkInput from "./HkInput";
import { attachOverlayScrollbars, type OverlayScrollbarHandle } from "../composables/useOverlayScrollbar";
import { useBreakpoint } from "../runtime/useBreakpoint";
import HkMenu from "./HkMenu";
import HPopover from "./HkPopover";
import { useI18n } from "../i18n/context";
import {
  formatTokenDisplay,
  parseTemplate,
  serializeTemplate,
  templateTokenIndex,
  type HkTemplateSegment,
  type HkTemplateTokenDef,
} from "./templateGrammar";
import "./HkTemplateField.scss";

/** What renderGroupedRows hands its row callback. */
interface HkTemplateFieldRow {
  def: HkTemplateTokenDef;
  index: number;
}

/** Matches an UNFINISHED `{{ query` the caret is typing inside — the
 * autocomplete trigger. Identifiers only; anything else (a filter pipe,
 * a space) drops out of trigger state and closes the panel. */
const OPEN_TRIGGER_RE = /\{\{\s*([A-Za-z0-9_]*)$/;

/** True when every character of `query` appears in `text` in the same
 * order — gaps allowed. The HkAffixPicker fuzzy-pass convention. */
function isSubsequence(query: string, text: string): boolean {
  let i = 0;
  for (const ch of text) {
    if (ch === query[i]) i++;
    if (i === query.length) return true;
  }
  return false;
}

/**
 * HkTemplateField — the editing half of the fill-template surfaces.
 *
 * A single-line rich input for values that mix literal text with
 * `{{ token }}` placeholders (URL fill templates and friends). Typing a
 * placeholder converts it, the moment it closes, into an inline chip —
 * the styled form of the exact template it serializes to — Gutenberg
 * style, without any block chrome:
 *
 * - typing `{{` opens the vocabulary panel (desktop: anchored DIRECTLY
 *   BELOW the field — below-first by user direction 2026-10-10, the
 *   viewport clamp absorbs a short viewport instead of a flip; phone:
 *   the standard bottom sheet) and picking a row inserts the chip;
 *   typing a full `{{ name }}` by hand converts it just the same;
 * - clicking a chip opens the chip editor (desktop: a popover directly
 *   below the chip, same below-first rule; phone: a bottom sheet) whose
 *   form owns the concrete
 *   editing — swap the placeholder for another vocabulary entry, read
 *   what it fills from, or remove it — and FOCUS MOVES INTO the form so
 *   the next keystroke lands there;
 * - the model is and stays the plain `{{ token }}` string: chips are a
 *   rendering of the value, never a second data format. Serialization
 *   is byte-exact (see templateGrammar), so a round-trip through this
 *   field never rewrites stored values.
 *
 * Zero field semantics beyond the value: vocabulary comes in via
 * `tokens`, persistence stays with the parent (`update:modelValue`).
 */
export const HkTemplateField = defineComponent({
  name: "HkTemplateField",
  props: {
    modelValue: { type: String, default: "" },
    /** Vocabulary offered by the panel + chip editor. */
    tokens: {
      type: Array as PropType<readonly HkTemplateTokenDef[]>,
      default: () => [],
    },
    label: { type: String, default: undefined },
    hint: { type: String, default: undefined },
    error: { type: String, default: undefined },
    placeholder: { type: String, default: "" },
    disabled: { type: Boolean, default: false },
    /** Submit intent on Enter (when no suggestion row is active) —
     * same contract as HkInput. */
    submitOnEnter: { type: Function, default: undefined },
    /** Maps a token's `group` to the heading label shown over its run
     *  of rows (both the vocabulary panel and the chip editor). Passed
     *  through verbatim when omitted — groups are consumer-defined
     *  technical keys, so the library has no opinion on their wording.
     *
     *  Partially-grouped vocabularies: a token WITHOUT a `group` is not
     *  a section of its own — it renders under the previous heading's
     *  band (the heading marks where a group STARTS, not where it ends).
     *  Give every token a group when the sections must be airtight. */
    groupLabel: { type: Function as PropType<(group: string) => string>, default: undefined },
  },
  emits: {
    "update:modelValue": (_v: string) => true,
  },
  setup(props, { emit }) {
    const { t } = useI18n();

    // Field identity: the rendered label points at the editable (same
    // association HkInput gives a bare `label` prop — label clicks
    // focus, screen readers announce the field by name).
    const fieldId = useId();
    /** Stable id for the panel rows container + its row ids (combobox
     *  aria-owns/activedescendant targets). */
    const panelRowsId = `hk-tpl-panel-${fieldId}`;

    const editRef = ref<HTMLElement | null>(null);
    /** The value the DOM currently represents. Authoritative while the
     * field holds the edit: external modelValue writes re-render only
     * when they differ from `lastEmitted`, so parent echoes of our own
     * emissions never rebuild the DOM under the caret. */
    const lastEmitted = ref(props.modelValue);
    const composing = ref(false);

    // ── DOM ↔ string ────────────────────────────────────────────────
    // The editable holds a FLAT sequence: text nodes and whole-token
    // chips (`span.hk-tpl-chip[contenteditable=false]`, carrying the
    // byte-exact `data-raw`). Chips display the canonical spelling but
    // serialize from data-raw, so rendering never rewrites the value.

    function chipEls(): HTMLElement[] {
      const root = editRef.value;
      if (!root) return [];
      return Array.from(root.querySelectorAll<HTMLElement>(".hk-tpl-chip"));
    }

    function serializeDom(): string {
      const root = editRef.value;
      if (!root) return lastEmitted.value;
      let out = "";
      for (const node of Array.from(root.childNodes)) {
        if (node.nodeType === Node.TEXT_NODE) {
          out += node.nodeValue ?? "";
        } else if (
          node.nodeType === Node.ELEMENT_NODE &&
          (node as HTMLElement).classList?.contains("hk-tpl-chip")
        ) {
          out += (node as HTMLElement).dataset.raw ?? "";
        } else {
          // Defensive: anything else (a stray <br>, sanitized paste
          // leftovers) contributes its text so serialization never
          // silently drops what the user sees.
          out += (node as HTMLElement).textContent ?? "";
        }
      }
      return out;
    }

    function makeChip(token: string, raw: string): HTMLElement {
      const el = document.createElement("span");
      el.className = "hk-tpl-chip";
      el.contentEditable = "false";
      el.dataset.token = token;
      el.dataset.raw = raw;
      el.textContent = formatTokenDisplay(token);
      return el;
    }

    function renderValue(value: string): void {
      const root = editRef.value;
      if (!root) return;
      root.textContent = "";
      for (const seg of parseTemplate(value)) {
        if (seg.kind === "text") {
          root.append(document.createTextNode(seg.text));
        } else {
          root.append(makeChip(seg.token, seg.raw));
          // Zero-width text node after every chip: editing engines
          // refuse to accept typing at a caret parked directly against
          // (or between) contenteditable=false elements — the caret
          // silently snaps to the last text position BEFORE the chip
          // and the next keystroke lands on the wrong side (real-browser
          // R1 finding). An empty text node is a legal caret home, costs
          // nothing in serialization ("" contributes nothing) and keeps
          // the caret mapping byte-stable. Never a ZWSP — that would
          // pollute the serialized value.
          root.append(document.createTextNode(""));
        }
      }
    }

    // ── Caret mapping over the byte-exact serialization ─────────────

    function childLength(node: ChildNode): number {
      if (node.nodeType === Node.TEXT_NODE) return (node.nodeValue ?? "").length;
      if ((node as HTMLElement).classList?.contains("hk-tpl-chip")) {
        return ((node as HTMLElement).dataset.raw ?? "").length;
      }
      return (node.textContent ?? "").length;
    }

    function currentCaretOffset(): number {
      const root = editRef.value;
      const sel = window.getSelection();
      if (!root || !sel || sel.rangeCount === 0) return serializeDom().length;
      const range = sel.getRangeAt(0);
      // Points outside this field keep their value only when they are
      // at the boundary; interior foreign points clamp to the end.
      if (!root.contains(range.startContainer)) return serializeDom().length;
      if (range.startContainer === root) {
        // Child-indexed point: sum lengths of children before it.
        let base = 0;
        const children = Array.from(root.childNodes);
        for (let i = 0; i < Math.min(range.startOffset, children.length); i++) {
          base += childLength(children[i]!);
        }
        return base;
      }
      // Point inside a child (text node, or inside a chip's own subtree
      // — the chip is atomic, so such points clamp onto its edges).
      let base = 0;
      for (const child of Array.from(root.childNodes)) {
        if (child === range.startContainer || child.contains(range.startContainer)) {
          if (child.nodeType === Node.TEXT_NODE) {
            return base + Math.min(range.startOffset, childLength(child));
          }
          // Inside a chip: before its midpoint reads as "before the
          // chip", after reads past it (browsers already keep the caret
          // on chip edges; this only needs to be stable, not clever).
          return range.startOffset === 0 ? base : base + childLength(child);
        }
        base += childLength(child);
      }
      return base;
    }

    /** Portable caret placement: Range + addRange (setBaseAndExtent is
     * not universally available — happy-dom among others). */
    function placeRange(startContainer: Node, startOffset: number, endContainer: Node, endOffset: number): void {
      const sel = window.getSelection();
      if (!sel) return;
      const range = document.createRange();
      try {
        range.setStart(startContainer, startOffset);
        range.setEnd(endContainer, endOffset);
      } catch {
        return;
      }
      sel.removeAllRanges();
      sel.addRange(range);
    }

    function applyCaretOffset(offset: number): void {
      const root = editRef.value;
      if (!root) return;
      let rest = offset;
      const children = Array.from(root.childNodes);
      for (let i = 0; i < children.length; i++) {
        const child = children[i]!;
        const len = childLength(child);
        if (rest < len) {
          if (child.nodeType === Node.TEXT_NODE) {
            const at = Math.max(0, Math.min(rest, len));
            placeRange(child, at, child, at);
            return;
          }
          if (rest === 0) {
            // Before the chip: end of the preceding text node when
            // there is one (a parent-level position the engine would
            // only normalize anyway), else the parent slot.
            const prev = children[i - 1];
            if (prev && prev.nodeType === Node.TEXT_NODE) {
              const at = (prev.nodeValue ?? "").length;
              placeRange(prev, at, prev, at);
            } else {
              placeRange(root, i, root, i);
            }
            return;
          }
          // Inside/after the chip: home the caret in the text node
          // renderValue parks after EVERY chip. A parent-level
          // boundary right after a contenteditable=false element is a
          // position Chromium's editing engine refuses — it silently
          // snaps the caret to the last text position BEFORE the chip,
          // and the next keystroke lands on the wrong side (the
          // real-browser P0: `Z` after a trailing chip became
          // `aZ{{ uid }}`).
          const next = children[i + 1];
          if (next && next.nodeType === Node.TEXT_NODE) {
            placeRange(next, 0, next, 0);
          } else {
            placeRange(root, i + 1, root, i + 1);
          }
          return;
        }
        if (rest === len && child.nodeType !== Node.TEXT_NODE) {
          // Exactly at the chip's end boundary — same rule as above.
          const next = children[i + 1];
          if (next && next.nodeType === Node.TEXT_NODE) {
            placeRange(next, 0, next, 0);
            return;
          }
        }
        rest -= len;
      }
      // End of the value: prefer a trailing text-node home over the
      // parent-level boundary (same engine rule).
      const last = children[children.length - 1];
      if (last && last.nodeType === Node.TEXT_NODE) {
        const at = (last.nodeValue ?? "").length;
        placeRange(last, at, last, at);
        return;
      }
      placeRange(root, children.length, root, children.length);
    }

    // ── Value pipeline ──────────────────────────────────────────────

    function setValue(value: string, caretOffset: number | null): void {
      lastEmitted.value = value;
      renderValue(value);
      if (caretOffset !== null) nextTick(() => applyCaretOffset(caretOffset));
      emit("update:modelValue", value);
    }

    /** Normalize after every input: emit the serialized DOM, and when
     * the parse now sees tokens the DOM doesn't chip yet (a hand-typed
     * `{{ name }}` just closed), re-render with the caret preserved
     * through the byte-exact mapping. */
    function normalizeFromDom(): void {
      const text = serializeDom();
      // Browsers leave a stray <br> behind when the last content goes
      // away — drop it so the :empty placeholder shows again.
      const root = editRef.value;
      if (root && text === "" && root.childNodes.length === 1 && root.firstChild?.nodeName === "BR") {
        root.textContent = "";
      }
      const segments = parseTemplate(text);
      const domRaw = chipEls().map((el) => el.dataset.raw ?? "");
      const segRaw = segments
        .filter((s): s is Extract<HkTemplateSegment, { kind: "token" }> => s.kind === "token")
        .map((s) => s.raw);
      const structureChanged =
        domRaw.length !== segRaw.length || domRaw.some((r, i) => r !== segRaw[i]);
      if (structureChanged) {
        const caret = currentCaretOffset();
        setValue(text, caret);
      } else {
        lastEmitted.value = text;
        emit("update:modelValue", text);
      }
    }

    // ── Vocabulary panel (typing `{{ …`) ────────────────────────────

    const suggestOpen = ref(false);
    const suggestQuery = ref("");
    const suggestActive = ref(0);
    /** Serialized-offset span of the live `{{ query` trigger — what a
     * pick replaces with the chip. */
    const triggerRange = ref<{ start: number; end: number } | null>(null);

    const tokenIndex = computed(() => templateTokenIndex(props.tokens));

    /** Two-pass vocabulary filter, the HkAffixPicker convention: exact
     * substring first (precision), in-order character subsequence as
     * the fallback (gaps allowed — "md5e" still finds md5_email). */
    function filterTokens(
      defs: readonly HkTemplateTokenDef[],
      query: string,
    ): readonly HkTemplateTokenDef[] {
      const q = query.trim().toLowerCase();
      if (!q) return defs;
      const fields = (d: HkTemplateTokenDef) =>
        [d.name, d.label ?? "", d.description ?? ""].map((f) => f.toLowerCase());
      const substring = defs.filter((d) => fields(d).some((f) => f.includes(q)));
      if (substring.length > 0) return substring;
      return defs.filter((d) => fields(d).some((f) => isSubsequence(q, f)));
    }

    const filteredTokens = computed(() => filterTokens(props.tokens, suggestQuery.value));

    function syncSuggestState(caretOverride?: number): void {
      const root = editRef.value;
      if (!root || props.disabled) {
        suggestOpen.value = false;
        triggerRange.value = null;
        return;
      }
      const text = serializeDom();
      // The intercepted edit path re-renders on every keystroke, which
      // detaches/resets the live selection before the scheduled caret
      // placement lands — callers that KNOW the caret they just wrote
      // pass it explicitly; the native path reads the live selection.
      const caret = caretOverride ?? currentCaretOffset();
      const before = text.slice(0, caret);
      const m = OPEN_TRIGGER_RE.exec(before);
      if (m) {
        const start = before.length - m[0].length;
        suggestQuery.value = m[1] ?? "";
        if (!suggestOpen.value) suggestActive.value = 0;
        triggerRange.value = { start, end: before.length };
        suggestOpen.value = true;
      } else {
        suggestOpen.value = false;
        triggerRange.value = null;
      }
    }

    function closeSuggestions(): void {
      suggestOpen.value = false;
      triggerRange.value = null;
    }

    function pickSuggestion(def: HkTemplateTokenDef): void {
      const range = triggerRange.value;
      const text = serializeDom();
      const raw = formatTokenDisplay(def.name);
      const next =
        range !== null
          ? text.slice(0, range.start) + raw + text.slice(range.end)
          : text + raw;
      closeSuggestions();
      setValue(next, (range?.start ?? text.length) + raw.length);
      editRef.value?.focus();
    }

    // ── Chip editor popover (click a chip) ──────────────────────────

    const editorOpen = ref(false);
    const editorChip = ref<HTMLElement | null>(null);
    const editorToken = ref("");
    const editorQuery = ref("");
    const editorSearchWrap = ref<HTMLElement | null>(null);
    /** Focus returns to the field after an editor-driven close. */
    const editorHoldsFocus = ref(false);

    const editorRows = computed(() => filterTokens(props.tokens, editorQuery.value));

    // The rows list scrolls through the SHARED overlay scrollbar
    // (house chrome — a native overflow bar inside a hikari popup is
    // the family violation this replaces). The scroll host wraps
    // EXACTLY the scrolling rows (rails must not span the form's other
    // bands); sheet mode attaches nothing — the docked panel owns the
    // window's one scrollbar there.
    const { isMobile } = useBreakpoint();
    const editorRowsHostRef = ref<HTMLElement | null>(null);
    const editorRowsRef = ref<HTMLElement | null>(null);
    let editorRowsScrollbar: OverlayScrollbarHandle | null = null;

    function syncEditorRowsScrollbar(): void {
      editorRowsScrollbar?.update();
    }

    // The shared scrollbar observes the VIEWPORT box; a vocabulary edit
    // that changes the rows' content height without resizing the viewport
    // would leave the thumb stale until the next scroll — refresh it when
    // the (filtered) rows change.
    watch(editorRows, () => { nextTick(syncEditorRowsScrollbar); });

    function detachEditorRowsScrollbar(): void {
      editorRowsScrollbar?.detach();
      editorRowsScrollbar = null;
    }

    function attachEditorRowsScrollbar(): void {
      detachEditorRowsScrollbar();
      if (isMobile.value) return; // sheet: the panel owns the scrollbar
      const viewport = editorRowsRef.value;
      const host = editorRowsHostRef.value;
      if (!viewport || !host) return;
      editorRowsScrollbar = attachOverlayScrollbars(viewport, { axis: "vertical", host });
    }

    const editorDef = computed(() => tokenIndex.value.get(editorToken.value));

    function openChipEditor(chip: HTMLElement): void {
      if (props.disabled) return;
      // Only one popup surface at a time: a chip click with the
      // vocabulary panel open (its anchor is this same field, so the
      // panel's outside-click shield does not fire) trades it for the
      // editor instead of stacking both.
      closeSuggestions();
      // A reopen cancels any reclaim still owed by the previous close's
      // leave window — firing it now would steal focus from the freshly
      // opened editor's search input.
      pendingEditorReclaim.value = false;
      editorChip.value = chip;
      editorToken.value = chip.dataset.token ?? "";
      editorQuery.value = "";
      editorOpen.value = true;
      // Focus MOVES INTO the form (the point of the popover): the
      // search field takes it once mounted, in both the desktop
      // popover and the mobile sheet.
      nextTick(() => {
        editorSearchWrap.value?.querySelector("input")?.focus();
        // Re-arm the focus latch explicitly: a reopen INSIDE the previous
        // close's leave window focuses an input that (in programmatic
        // flows) never blurred, so no focusin fires and the latch would
        // stay false — the next close would then skip its reclaim and
        // orphan focus on <body> (R1 S2 finding).
        editorHoldsFocus.value = true;
        attachEditorRowsScrollbar();
      });
    }

    /** Caret position (in serialized offsets) right AFTER the chip
     * being edited — where editing resumes when the editor closes. */
    function offsetAfterChip(chip: HTMLElement): number {
      const root = editRef.value;
      if (!root) return 0;
      let base = 0;
      for (const child of Array.from(root.childNodes)) {
        if (child === chip) return base + childLength(child);
        base += childLength(child);
      }
      return base;
    }

    /** Replace the chip's token with `name`, keeping its position —
     * the raw becomes the canonical spelling of the new token. */
    function applyChipToken(name: string): void {
      const chip = editorChip.value;
      if (!chip) return;
      const segments = parseTemplate(serializeDom());
      const target = chipEls().indexOf(chip);
      let seen = -1;
      let caret = 0;
      let caretAfterChip: number | null = null;
      const next = segments.map((seg) => {
        if (seg.kind === "text") {
          caret += seg.text.length;
          return seg;
        }
        seen += 1;
        if (seen === target) {
          const raw = formatTokenDisplay(name);
          caret += raw.length;
          // Editing resumes right AFTER the swapped chip — the running
          // total keeps growing past this point, so freeze the target
          // here (the R3 finding: a caret accumulated over the whole
          // value put the next typed char at the end).
          caretAfterChip = caret;
          return { kind: "token" as const, token: name, raw };
        }
        caret += seg.raw.length;
        return seg;
      });
      const value = serializeTemplate(next);
      // The apply path re-renders (which detaches the chip the reclaim
      // closure would consult) and places the caret itself — suppress
      // the whole reclaim machinery or it fights the setValue caret
      // with a stale-chip offset (real-browser R3 finding).
      editorHoldsFocus.value = false;
      closeChipEditor();
      setValue(value, caretAfterChip ?? caret);
      editRef.value?.focus();
    }

    function removeChip(): void {
      const chip = editorChip.value;
      if (!chip) return;
      const segments = parseTemplate(serializeDom());
      const target = chipEls().indexOf(chip);
      let seen = -1;
      let caret = 0;
      let caretAtChip: number | null = null;
      const next: HkTemplateSegment[] = [];
      for (const seg of segments) {
        if (seg.kind === "token") {
          seen += 1;
          if (seen === target) {
            // Editing resumes WHERE the chip was — freeze the offset
            // before the dropped raw (see applyChipToken's note).
            caretAtChip = caret;
            continue; // dropped
          }
          caret += seg.raw.length;
          next.push(seg);
        } else {
          caret += seg.text.length;
          next.push(seg);
        }
      }
      const value = serializeTemplate(next);
      // Same as applyChipToken: the remove path owns its caret; the
      // reclaim machinery must not run against the removed chip.
      editorHoldsFocus.value = false;
      closeChipEditor();
      setValue(value, caretAtChip ?? caret);
      editRef.value?.focus();
    }

    /** True when focus is unowned (body/nowhere) or already back on
     * this field — the only states the editor close may reclaim it
     * from. An outside-click close that focused another control must
     * not have focus yanked back 3ms later (real-browser R1 finding). */
    function editorFocusReclaimable(): boolean {
      const active = document.activeElement;
      return (
        !active ||
        active === document.body ||
        (editRef.value ? active === editRef.value || editRef.value.contains(active) : false)
      );
    }

    function reclaimEditorFocus(): void {
      if (!editorFocusReclaimable()) return;
      editRef.value?.focus();
      // The chip may have been re-rendered away by the time this runs
      // (a late reclaim) — a detached reference must not steer the
      // caret (offsetAfterChip would return the full length).
      if (editorChip.value?.isConnected) {
        applyCaretOffset(offsetAfterChip(editorChip.value));
      }
    }

    /** Set when a closing chip editor may still owe the field its
     * focus back (through the leave window); cleared by the popover's
     * settled `closed` edge or the next open. */
    const pendingEditorReclaim = ref(false);

    function closeChipEditor(): void {
      if (!editorOpen.value) return;
      editorOpen.value = false;
      detachEditorRowsScrollbar();
      if (editorHoldsFocus.value) {
        editorHoldsFocus.value = false;
        nextTick(reclaimEditorFocus);
        // An Escape close keeps the search input holding focus THROUGH
        // the closing animation, so the probe above correctly declines;
        // when the panel finishes unmounting, focus falls to <body>
        // with nobody to reclaim it. The popover's `closed` event (the
        // settled leave edge) re-runs the same ownership probe exactly
        // then — no timer race with a long or short leave animation.
        pendingEditorReclaim.value = true;
      }
    }

    watch(
      () => props.modelValue,
      (v) => {
        if (v !== lastEmitted.value) {
          lastEmitted.value = v;
          renderValue(v);
        }
      },
    );

    onMounted(() => {
      renderValue(props.modelValue);
    });

    onBeforeUnmount(() => {
      detachEditorRowsScrollbar();
    });

    // ── Editable event wiring ───────────────────────────────────────

    function onInput(): void {
      if (composing.value) return;
      normalizeFromDom();
      syncSuggestState();
    }

    function onCompositionStart(): void {
      composing.value = true;
    }

    function onCompositionEnd(): void {
      composing.value = false;
      normalizeFromDom();
      syncSuggestState();
    }

    function onPaste(e: ClipboardEvent): void {
      e.preventDefault();
      const text = e.clipboardData?.getData("text/plain") ?? "";
      if (!text) return;
      const sel = window.getSelection();
      const root = editRef.value;
      if (!sel || !root) return;
      // Plain-text insert through the Selection API (never markup). A
      // stale/foreign selection (range pointing outside this field —
      // detached DOM, another control) must not swallow the insert:
      // only a selection INSIDE the field pastes at the caret, every
      // other state appends at the end.
      const range = sel.rangeCount > 0 ? sel.getRangeAt(0) : null;
      // BOTH ends must sit inside the field: a selection straddling
      // the field boundary would delete content past it.
      const inside =
        !!range && root.contains(range.startContainer) && root.contains(range.endContainer);
      if (inside && typeof sel.deleteFromDocument === "function") {
        sel.deleteFromDocument();
      } else if (inside && range) {
        range.deleteContents();
      }
      const node = document.createTextNode(text);
      if (inside && range) {
        range.insertNode(node);
      } else {
        root.append(node);
      }
      placeRange(node, text.length, node, text.length);
      normalizeFromDom();
      syncSuggestState();
    }

    // ── Deterministic editing (beforeinput interception) ────────────
    // Chromium's editing engine REFUSES a caret parked after a
    // contenteditable=false chip: even with the selection inside a
    // text node on the chip's trailing edge, insertText renormalizes
    // the position to the last text BEFORE the chip and the keystroke
    // lands on the wrong side (real-browser P0: `Z` after a trailing
    // chip became `aZ{{ uid }}`). The fix is to own the edit itself:
    // plain insert/delete edits are intercepted, applied in the
    // SERIALIZED value space and re-rendered — engine-independent by
    // construction, and chips become atomically deletable for free.
    // Composition (IME) keeps the native path (composing flag already
    // defers normalization to compositionend); paste keeps its plain-
    // text handler.

    function currentRangeOffsets(): { start: number; end: number } {
      const root = editRef.value;
      const sel = window.getSelection();
      if (!root || !sel || sel.rangeCount === 0) {
        const len = serializeDom().length;
        return { start: len, end: len };
      }
      const range = sel.getRangeAt(0);
      if (!root.contains(range.startContainer)) {
        const len = serializeDom().length;
        return { start: len, end: len };
      }
      const start = currentCaretOffset();
      // Re-anchor to measure the END of the selection (collapsed
      // selections short-circuit to the same value).
      if (range.collapsed) return { start, end: start };
      const probe = document.createRange();
      probe.setStart(range.endContainer, range.endOffset);
      probe.collapse(true);
      const saved = range.cloneRange();
      sel.removeAllRanges();
      sel.addRange(probe);
      const end = currentCaretOffset();
      sel.removeAllRanges();
      sel.addRange(saved);
      return { start, end };
    }

    function insertAtCaret(text: string): void {
      const { start, end } = currentRangeOffsets();
      const value = serializeDom();
      const next = value.slice(0, start) + text + value.slice(end);
      const caret = start + text.length;
      setValue(next, caret);
      syncSuggestState(caret);
    }

    /** Delete one unit backward/forward. A caret hugging a chip edge
     * takes the WHOLE chip (the atomic edit); anything else deletes a
     * single character; a range selection deletes exactly the range. */
    function deleteDirection(dir: -1 | 1): void {
      const { start, end } = currentRangeOffsets();
      const value = serializeDom();
      if (start !== end) {
        const next = value.slice(0, start) + value.slice(end);
        setValue(next, start);
        syncSuggestState(start);
        return;
      }
      if (dir === -1 && start === 0) return;
      if (dir === 1 && start === value.length) return;
      // Chip edges: walk the parsed segments with their serialized
      // offsets — a caret exactly at a chip boundary removes the chip.
      let cursor = 0;
      for (const seg of parseTemplate(value)) {
        const width = seg.kind === "text" ? seg.text.length : seg.raw.length;
        if (seg.kind === "token") {
          if (dir === -1 && start === cursor + width) {
            const next = value.slice(0, cursor) + value.slice(cursor + width);
            setValue(next, cursor);
            syncSuggestState(cursor);
            return;
          }
          if (dir === 1 && start === cursor) {
            const next = value.slice(0, cursor) + value.slice(cursor + width);
            setValue(next, cursor);
            syncSuggestState(cursor);
            return;
          }
        }
        cursor += width;
      }
      const at = dir === -1 ? start - 1 : start;
      const next = value.slice(0, at) + value.slice(at + 1);
      setValue(next, at);
      syncSuggestState(at);
    }

    function onBeforeinput(e: InputEvent): void {
      if (composing.value || props.disabled) return;
      switch (e.inputType) {
        case "insertText":
          if (e.data) {
            e.preventDefault();
            insertAtCaret(e.data);
          }
          break;
        case "deleteContentBackward":
        case "deleteContentForward":
          e.preventDefault();
          deleteDirection(e.inputType === "deleteContentBackward" ? -1 : 1);
          break;
        case "insertParagraph":
        case "insertLineBreak":
          // Single-line field (Enter is the submit intent; Shift+Enter
          // has no meaning in a URL template).
          e.preventDefault();
          break;
        default:
          // insertCompositionText, insertFromPaste (handled by the
          // paste listener), historyUndo, deleteByCut… keep the native
          // path; the input/normalize pass reconciles afterwards.
          break;
      }
    }

    function onKeydown(e: KeyboardEvent): void {
      if (suggestOpen.value && filteredTokens.value.length > 0) {
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          const n = filteredTokens.value.length;
          const dir = e.key === "ArrowDown" ? 1 : -1;
          suggestActive.value = (suggestActive.value + dir + n) % n;
          return;
        }
        if (e.key === "Enter" || (e.key === "Tab" && !e.shiftKey)) {
          e.preventDefault();
          const def = filteredTokens.value[
            Math.min(suggestActive.value, filteredTokens.value.length - 1)
          ];
          if (def) pickSuggestion(def);
          return;
        }
      }
      if (e.key === "Escape" && suggestOpen.value) {
        e.preventDefault();
        e.stopPropagation();
        closeSuggestions();
        return;
      }
      if (e.key === "Enter" && !e.shiftKey) {
        // No active suggestion: Enter is the host's submit intent (the
        // chip editor, when open, owns keys inside itself instead).
        e.preventDefault();
        props.submitOnEnter?.();
      }
    }

    function onClick(e: MouseEvent): void {
      const target = e.target as HTMLElement | null;
      const chip = target?.closest?.(".hk-tpl-chip") as HTMLElement | null;
      if (chip && editRef.value?.contains(chip)) {
        e.preventDefault();
        e.stopPropagation();
        openChipEditor(chip);
      }
    }

    // The active row highlight rides the render — Vue patches the data
    // attribute; the ACTIVE row keeps itself in view so keyboard
    // navigation never scrolls the highlight off the panel.
    function setRowRef(i: number) {
      return (el: unknown) => {
        const row = el as HTMLElement | null;
        if (row && row.dataset.active !== undefined) {
          row.scrollIntoView?.({ block: "nearest" });
        }
      };
    }

    /** Grouped rows as labeled WRAPPERS, not sibling headings: a
     *  `role="group"` box carrying the group's name in `aria-label` is
     *  the pattern screen readers announce on entry (a bare
     *  role="presentation" heading band was invisible to them — the
     *  R3 P3 finding), and it is the sanctioned way to segment choices
     *  inside HkMenu's role="menu" surface. The visible heading text
     *  lives in the inner .hk-tpl-group-label band. */
    function renderGroupedRows(
      defs: readonly HkTemplateTokenDef[],
      renderRow: (row: HkTemplateFieldRow) => unknown,
    ): unknown[] {
      const out: unknown[] = [];
      let run: { label: string; rows: unknown[] } | null = null;
      const flush = () => {
        if (!run) return;
        out.push(
          <div class="hk-tpl-group" role="group" aria-label={run.label}>
            <div class="hk-tpl-group-label" aria-hidden="true">{run.label}</div>
            {run.rows}
          </div>,
        );
        run = null;
      };
      for (let i = 0; i < defs.length; i++) {
        const def = defs[i]!;
        if (def.group !== undefined) {
          const label = props.groupLabel ? props.groupLabel(def.group) : def.group;
          if (!run || run.label !== label) {
            flush();
            run = { label, rows: [] };
          }
        }
        // Tokens without a group simply continue under the previous
        // group's visual section — the documented contract for
        // partially-grouped vocabularies (see the prop doc). When the
        // run is open they ride inside it; a leading ungrouped run
        // renders bare, exactly as an ungrouped vocabulary does.
        const row = renderRow({ def, index: i });
        if (run) run.rows.push(row);
        else out.push(row);
      }
      flush();
      return out;
    }

    /** Row chrome shared by both surfaces. The ROLE rides the surface:
     *  the panel lives inside HkMenu's role="menu" (menuitem — the
     *  HkMenuActionItem family pattern), the editor lives in a dialog
     *  and is a proper listbox (option + aria-selected on the token
     *  being edited). */
    const renderTokenRow = (
      def: HkTemplateTokenDef,
      active: boolean,
      onPick: () => void,
      opts: {
        i?: number;
        role: "menuitem" | "option";
        selected?: boolean;
        id?: string;
      },
    ) => (
      <button
        key={def.name}
        type="button"
        class="hk-tpl-row"
        role={opts.role}
        id={opts.id}
        aria-selected={opts.role === "option" ? (opts.selected || false) : undefined}
        data-active={active || undefined}
        ref={opts.i !== undefined ? setRowRef(opts.i) : undefined}
        onMousedown={(e: MouseEvent) => e.preventDefault()}
        onClick={(e: MouseEvent) => {
          e.stopPropagation();
          onPick();
        }}
      >
        <span class="hk-tpl-row-name">{formatTokenDisplay(def.name)}</span>
        {def.description && <span class="hk-tpl-row-desc">{def.description}</span>}
      </button>
    );

    return () => (
      <div class="hk-template-field" data-disabled={props.disabled || undefined}>
        {props.label && (
          <label class="hk-template-field-label" for={fieldId}>{props.label}</label>
        )}
        <div
          class={[
            "hk-template-field-box",
            props.error ? "hk-template-field-box-error" : "",
          ].filter(Boolean).join(" ")}
        >
          <div
            ref={editRef}
            class="hk-template-field-edit"
            contenteditable={!props.disabled}
            role="textbox"
            aria-multiline="false"
            // Combobox announcement wiring: the editable OWNS the popup
            // (aria-owns makes the teleported rows virtual descendants)
            // and points aria-activedescendant at the highlighted row,
            // so arrow-key navigation is announced without moving DOM
            // focus out of the field.
            aria-haspopup="menu"
            aria-expanded={suggestOpen.value || undefined}
            aria-owns={
              suggestOpen.value && filteredTokens.value.length > 0 ? panelRowsId : undefined
            }
            aria-activedescendant={
              suggestOpen.value && filteredTokens.value.length > 0
                ? `${panelRowsId}-row-${Math.min(suggestActive.value, filteredTokens.value.length - 1)}`
                : undefined
            }
            id={fieldId}
            spellcheck={false}
            data-ph={props.placeholder}
            onInput={onInput}
            onKeydown={onKeydown}
            onPaste={onPaste}
            onBeforeinput={onBeforeinput}
            onClick={onClick}
            onCompositionstart={onCompositionStart}
            onCompositionend={onCompositionEnd}
            onFocusin={() => {
              editorHoldsFocus.value = false;
            }}
          />
        </div>
        {props.hint && !props.error && <p class="hk-template-field-hint">{props.hint}</p>}
        {props.error && <p class="hk-template-field-error">{props.error}</p>}

        {/* Vocabulary panel — anchored DIRECTLY BELOW the field on
            desktop (autoFlip off, user direction 2026-10-10: the panel
            opens in the flow under the input it completes; when the
            viewport below is too short the clamp slides it up only as
            far as full visibility requires), the standard bottom sheet
            on phone. The editable keeps focus; rows click through,
            arrows/Enter ride the editable keydown. */}
        <HkMenu
          variant="popup"
          items={[]}
          open={suggestOpen.value}
          onUpdate:open={(v: boolean) => {
            if (!v) closeSuggestions();
          }}
          anchorRef={editRef.value}
          placement="bottom-start"
          matchAnchorWidth
          maxHeight="min(18rem, 45dvh)"
          autoFlip={false}
          title={t("hikari::templateField.suggestTitle", "Placeholders")}
        >
          {filteredTokens.value.length > 0 ? (
            <div class="hk-tpl-rows" id={panelRowsId}>
              {renderGroupedRows(filteredTokens.value, ({ def, index }) =>
                renderTokenRow(
                  def,
                  index === Math.min(suggestActive.value, filteredTokens.value.length - 1),
                  () => pickSuggestion(def),
                  {
                    i: index,
                    role: "menuitem",
                    id: `${panelRowsId}-row-${index}`,
                  },
                ),
              )}
            </div>
          ) : (
            <p class="hk-tpl-rows-empty">
              {t("hikari::templateField.suggestEmpty", "No matching placeholders")}
            </p>
          )}
        </HkMenu>

        {/* Chip editor — a popover directly below the chip on desktop
            (autoFlip off, same below-first rule as the vocabulary panel:
            user direction 2026-10-10), a bottom sheet on phone; the form
            inside owns the concrete editing. */}
        <HPopover
          modelValue={editorOpen.value}
          onUpdate:modelValue={(v: boolean) => {
            if (!v) closeChipEditor();
          }}
          onClosed={() => {
            if (!pendingEditorReclaim.value) return;
            pendingEditorReclaim.value = false;
            // HkPopover emits this from a nextTick AFTER the patch that
            // removed the panel (its own doc contract, verified in a
            // real browser: the handler sees no panel and focus already
            // fallen to <body>) — so the ownership probe can run here
            // directly.
            reclaimEditorFocus();
          }}
          anchorRef={editorChip.value}
          sheetOnMobile
          placement="bottom-start"
          autoFlip={false}
          title={t("hikari::templateField.chipEditorTitle", "Edit placeholder")}
        >
          <div class="hk-tpl-editor" onFocusin={() => { editorHoldsFocus.value = true; }}>
            <div class="hk-tpl-editor-current">
              <span class="hk-tpl-chip" data-static="">
                {formatTokenDisplay(editorToken.value)}
              </span>
              {editorDef.value?.description && (
                <span class="hk-tpl-editor-desc">{editorDef.value.description}</span>
              )}
            </div>
            <div
              ref={editorSearchWrap}
              class="hk-tpl-editor-search"
              // Enter in the search picks the first matching row — the
              // HkAffixPicker onSearchEnter convention (keyboard flow
              // never has to leave the field to click).
              onKeydown={(e: KeyboardEvent) => {
                if (e.key !== "Enter") return;
                const first = editorRows.value[0];
                if (first) {
                  e.preventDefault();
                  applyChipToken(first.name);
                }
              }}
            >
              <HkInput
                modelValue={editorQuery.value}
                onUpdate:modelValue={(v: string) => {
                  editorQuery.value = v;
                  nextTick(syncEditorRowsScrollbar);
                }}
                placeholder={t("hikari::templateField.chipSearch", "Search placeholders")}
              />
            </div>
            <div ref={editorRowsHostRef} class="hk-tpl-editor-scroll">
              <div
                ref={editorRowsRef}
                class="hk-tpl-editor-rows"
                role="listbox"
                aria-label={t("hikari::templateField.chipEditorTitle", "Edit placeholder")}
              >
                {renderGroupedRows(editorRows.value, ({ def }) =>
                  renderTokenRow(def, def.name === editorToken.value, () => applyChipToken(def.name), {
                    role: "option",
                    selected: def.name === editorToken.value,
                  }),
                )}
                {editorRows.value.length === 0 && (
                  <p class="hk-tpl-rows-empty">
                    {t("hikari::templateField.suggestEmpty", "No matching placeholders")}
                  </p>
                )}
              </div>
            </div>
            <div class="hk-tpl-editor-footer">
              <HButton
                variant="ghost"
                size="sm"
                onClick={() => removeChip()}
              >
                <Trash2 size={14} />
                {t("hikari::templateField.chipRemove", "Remove")}
              </HButton>
            </div>
          </div>
        </HPopover>
      </div>
    );
  },
});

export default HkTemplateField;
