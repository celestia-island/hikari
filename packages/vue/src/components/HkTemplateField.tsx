import {
  computed,
  defineComponent,
  nextTick,
  onMounted,
  ref,
  watch,
  type PropType,
} from "vue";
import { Trash2 } from "lucide-vue-next";

import HButton from "./HkButton";
import HkInput from "./HkInput";
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

/** Matches an UNFINISHED `{{ query` the caret is typing inside — the
 * autocomplete trigger. Identifiers only; anything else (a filter pipe,
 * a space) drops out of trigger state and closes the panel. */
const OPEN_TRIGGER_RE = /\{\{\s*([A-Za-z0-9_]*)$/;

/**
 * HkTemplateField — the editing half of the fill-template surfaces.
 *
 * A single-line rich input for values that mix literal text with
 * `{{ token }}` placeholders (URL fill templates and friends). Typing a
 * placeholder converts it, the moment it closes, into an inline chip —
 * the styled form of the exact template it serializes to — Gutenberg
 * style, without any block chrome:
 *
 * - typing `{{` opens the vocabulary panel (desktop: anchored under the
 *   caret's field; phone: the standard bottom sheet) and picking a row
 *   inserts the chip; typing a full `{{ name }}` by hand converts it
 *   just the same;
 * - clicking a chip opens the chip editor (desktop: a popover beside
 *   the chip; phone: a bottom sheet) whose form owns the concrete
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
  },
  emits: {
    "update:modelValue": (_v: string) => true,
  },
  setup(props, { emit }) {
    const { t } = useI18n();

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
          // Mid-chip point: snap AFTER the chip (editing continues
          // past it) — except offset 0, which stays before it.
          const anchor = rest === 0 ? i : i + 1;
          placeRange(root, anchor, root, anchor);
          return;
        }
        rest -= len;
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

    const filteredTokens = computed(() => {
      const q = suggestQuery.value.trim().toLowerCase();
      if (!q) return props.tokens;
      return props.tokens.filter(
        (def) =>
          def.name.toLowerCase().includes(q) ||
          (def.label ?? "").toLowerCase().includes(q) ||
          (def.description ?? "").toLowerCase().includes(q),
      );
    });

    function syncSuggestState(): void {
      const root = editRef.value;
      if (!root || props.disabled) {
        suggestOpen.value = false;
        triggerRange.value = null;
        return;
      }
      const text = serializeDom();
      const before = text.slice(0, currentCaretOffset());
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

    const editorRows = computed(() => {
      const q = editorQuery.value.trim().toLowerCase();
      if (!q) return props.tokens;
      return props.tokens.filter(
        (def) =>
          def.name.toLowerCase().includes(q) ||
          (def.label ?? "").toLowerCase().includes(q) ||
          (def.description ?? "").toLowerCase().includes(q),
      );
    });

    const editorDef = computed(() => tokenIndex.value.get(editorToken.value));

    function openChipEditor(chip: HTMLElement): void {
      if (props.disabled) return;
      editorChip.value = chip;
      editorToken.value = chip.dataset.token ?? "";
      editorQuery.value = "";
      editorOpen.value = true;
      // Focus MOVES INTO the form (the point of the popover): the
      // search field takes it once mounted, in both the desktop
      // popover and the mobile sheet.
      nextTick(() => {
        editorSearchWrap.value?.querySelector("input")?.focus();
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
      const next = segments.map((seg) => {
        if (seg.kind === "text") {
          caret += seg.text.length;
          return seg;
        }
        seen += 1;
        if (seen === target) {
          const raw = formatTokenDisplay(name);
          caret += raw.length;
          return { kind: "token" as const, token: name, raw };
        }
        caret += seg.raw.length;
        return seg;
      });
      const value = serializeTemplate(next);
      closeChipEditor();
      setValue(value, caret);
      editRef.value?.focus();
    }

    function removeChip(): void {
      const chip = editorChip.value;
      if (!chip) return;
      const segments = parseTemplate(serializeDom());
      const target = chipEls().indexOf(chip);
      let seen = -1;
      let caret = 0;
      const next: HkTemplateSegment[] = [];
      for (const seg of segments) {
        if (seg.kind === "token") {
          seen += 1;
          if (seen === target) continue; // dropped
          caret += seg.raw.length;
          next.push(seg);
        } else {
          caret += seg.text.length;
          next.push(seg);
        }
      }
      const value = serializeTemplate(next);
      closeChipEditor();
      setValue(value, caret);
      editRef.value?.focus();
    }

    function closeChipEditor(): void {
      if (!editorOpen.value) return;
      editorOpen.value = false;
      if (editorHoldsFocus.value) {
        editorHoldsFocus.value = false;
        nextTick(() => {
          editRef.value?.focus();
          if (editorChip.value) applyCaretOffset(offsetAfterChip(editorChip.value));
        });
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
      const inside = !!range && root.contains(range.startContainer);
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

    function onKeydown(e: KeyboardEvent): void {
      if (suggestOpen.value && filteredTokens.value.length > 0) {
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          const n = filteredTokens.value.length;
          const dir = e.key === "ArrowDown" ? 1 : -1;
          suggestActive.value = (suggestActive.value + dir + n) % n;
          return;
        }
        if (e.key === "Enter" || e.key === "Tab") {
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

    const renderTokenRow = (
      def: HkTemplateTokenDef,
      active: boolean,
      onPick: () => void,
      i?: number,
    ) => (
      <button
        key={def.name}
        type="button"
        class="hk-tpl-row"
        data-active={active || undefined}
        ref={i !== undefined ? setRowRef(i) : undefined}
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
        {props.label && <label class="hk-template-field-label">{props.label}</label>}
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
            aria-label={props.label}
            spellcheck={false}
            data-ph={props.placeholder}
            onInput={onInput}
            onKeydown={onKeydown}
            onPaste={onPaste}
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

        {/* Vocabulary panel — anchored under the field on desktop, the
            standard bottom sheet on phone. The editable keeps focus;
            rows click through, arrows/Enter ride the editable keydown. */}
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
          title={t("hikari::templateField.suggestTitle", "Placeholders")}
        >
          {filteredTokens.value.length > 0 ? (
            <div class="hk-tpl-rows" role="listbox">
              {filteredTokens.value.map((def, i) =>
                renderTokenRow(
                  def,
                  i === Math.min(suggestActive.value, filteredTokens.value.length - 1),
                  () => pickSuggestion(def),
                  i,
                ),
              )}
            </div>
          ) : (
            <p class="hk-tpl-rows-empty">
              {t("hikari::templateField.suggestEmpty", "No matching placeholders")}
            </p>
          )}
        </HkMenu>

        {/* Chip editor — a popover beside the chip on desktop, a bottom
            sheet on phone; the form inside owns the concrete editing. */}
        <HPopover
          modelValue={editorOpen.value}
          onUpdate:modelValue={(v: boolean) => {
            if (!v) closeChipEditor();
          }}
          anchorRef={editorChip.value}
          sheetOnMobile
          placement="bottom-start"
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
            <div ref={editorSearchWrap} class="hk-tpl-editor-search">
              <HkInput
                modelValue={editorQuery.value}
                onUpdate:modelValue={(v: string) => { editorQuery.value = v; }}
                placeholder={t("hikari::templateField.chipSearch", "Search placeholders")}
              />
            </div>
            <div class="hk-tpl-editor-rows" role="listbox">
              {editorRows.value.map((def) =>
                renderTokenRow(def, def.name === editorToken.value, () => applyChipToken(def.name)),
              )}
              {editorRows.value.length === 0 && (
                <p class="hk-tpl-rows-empty">
                  {t("hikari::templateField.suggestEmpty", "No matching placeholders")}
                </p>
              )}
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
