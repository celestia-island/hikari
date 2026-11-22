import {
  Bold,
  Code,
  Heading2,
  Italic,
  Link,
  List,
  ListOrdered,
  Quote,
  Strikethrough,
} from "lucide-vue-next";
import { h, nextTick, defineComponent, ref, type Component } from "vue";

import HkMarkdownRenderer from "./HkMarkdownRenderer";
import { useI18n } from "../i18n/context";
import "./HkMarkdownEditor.scss";

/** Editing dialect of the editor body. `markdown` runs the toolbar and the
 *  rendered live preview; `plain` reduces the surface to a textarea (the
 *  split preview degrades to pre-wrapped plain text). */
export type HkMarkdownEditorMode = "markdown" | "plain";

/** The result of one pure text transform: the rewritten source plus the
 *  selection the editor should restore afterwards. Selections are plain
 *  string indices into `text` — the same coordinates a textarea's
 *  selectionStart/selectionEnd speak. */
export interface MarkdownTextEdit {
  text: string;
  selectionStart: number;
  selectionEnd: number;
}

function clampIndex(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Wrap the current selection with markers (pure). `before`/`after` default
 * to the same string (`**`, `*`, `` ` ``, `~~` …). The returned selection is
 * restored INSIDE the wrap: a non-empty selection stays selected around its
 * wrapped text, an empty one parks the caret between the markers so the
 * next keystroke lands inside the emphasis.
 */
export function applyWrap(
  source: string,
  selectionStart: number,
  selectionEnd: number,
  before: string,
  after: string = before,
): MarkdownTextEdit {
  const start = clampIndex(selectionStart, 0, source.length);
  const end = clampIndex(selectionEnd, start, source.length);
  const selected = source.slice(start, end);
  const text = source.slice(0, start) + before + selected + after + source.slice(end);
  const inner = start + before.length;
  return { text, selectionStart: inner, selectionEnd: inner + selected.length };
}

/**
 * Prefix every line covered by the selection (pure). The operated range is
 * the full line range containing the selection — a caret mid-line still
 * prefixes that whole line, and a selection spanning lines prefixes each
 * one. `prefix` is either a literal (`- `, `> `, `## `) or a per-line
 * factory receiving the zero-based line index (ordered lists emit
 * `1. `, `2. `, …). The returned selection covers the rewritten lines.
 */
export function applyLinePrefix(
  source: string,
  selectionStart: number,
  selectionEnd: number,
  prefix: string | ((lineIndex: number) => string),
): MarkdownTextEdit {
  const start = clampIndex(selectionStart, 0, source.length);
  const end = clampIndex(selectionEnd, start, source.length);
  const lineStart = source.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
  const newlineAfter = source.indexOf("\n", end);
  const lineEnd = newlineAfter === -1 ? source.length : newlineAfter;

  let cursor = lineStart;
  let outStart = lineStart;
  let outEnd = lineStart;
  const rebuilt = source
    .slice(lineStart, lineEnd)
    .split("\n")
    .map((line, index) => {
      const marker = typeof prefix === "function" ? prefix(index) : prefix;
      const rebuiltLine = marker + line;
      if (index === 0) outStart = cursor;
      cursor += rebuiltLine.length;
      outEnd = cursor;
      cursor += 1; // the newline this line was split on
      return rebuiltLine;
    })
    .join("\n");

  return {
    text: source.slice(0, lineStart) + rebuilt + source.slice(lineEnd),
    selectionStart: outStart,
    selectionEnd: outEnd,
  };
}

/** The translator shape from useI18n. */
type Translate = (key: string, fallback?: string) => string;

/** The toolbar vocabulary, in render order. Icons are lucide components.
 *  Labels are RESOLVER closures so every i18n key sits at a literal
 *  `t("hikari::…")` call site — the i18n usage-surface audit scans
 *  literals adjacent to `t(`, and keys moved into a data table would
 *  silently escape it (a typo'd key would fall back to English in all
 *  11 locales with every gate green). */
type ToolbarActionId =
  | "bold"
  | "italic"
  | "strikethrough"
  | "code"
  | "link"
  | "heading"
  | "bulletList"
  | "orderedList"
  | "quote";

const TOOLBAR: Array<{
  id: ToolbarActionId;
  icon: Component;
  label: (t: Translate) => string;
}> = [
  { id: "bold", icon: Bold, label: (t) => t("hikari::mdEditor.bold", "Bold") },
  { id: "italic", icon: Italic, label: (t) => t("hikari::mdEditor.italic", "Italic") },
  { id: "strikethrough", icon: Strikethrough, label: (t) => t("hikari::mdEditor.strikethrough", "Strikethrough") },
  { id: "code", icon: Code, label: (t) => t("hikari::mdEditor.code", "Inline code") },
  { id: "link", icon: Link, label: (t) => t("hikari::mdEditor.link", "Link") },
  { id: "heading", icon: Heading2, label: (t) => t("hikari::mdEditor.heading", "Heading") },
  { id: "bulletList", icon: List, label: (t) => t("hikari::mdEditor.bulletList", "Bullet list") },
  { id: "orderedList", icon: ListOrdered, label: (t) => t("hikari::mdEditor.orderedList", "Ordered list") },
  { id: "quote", icon: Quote, label: (t) => t("hikari::mdEditor.quote", "Quote") },
];

/** Mode-segment label — both keys at literal `t(` call sites for the same
 *  usage-surface reason as the toolbar closures above. */
function modeLabel(t: Translate, mode: HkMarkdownEditorMode): string {
  return mode === "markdown"
    ? t("hikari::mdEditor.markdown", "Markdown")
    : t("hikari::mdEditor.plain", "Plain text");
}

/** One toolbar action as a pure string transform of the current source +
 *  selection (no DOM). `link` is the one wrap that moves the caret OUT of
 * the wrapped text: the selection becomes the link text (empty selection →
 * empty text) and the caret always parks in the empty url slot. */
function toolbarEdit(
  id: ToolbarActionId,
  source: string,
  selectionStart: number,
  selectionEnd: number,
): MarkdownTextEdit {
  switch (id) {
    case "bold":
      return applyWrap(source, selectionStart, selectionEnd, "**");
    case "italic":
      return applyWrap(source, selectionStart, selectionEnd, "*");
    case "strikethrough":
      return applyWrap(source, selectionStart, selectionEnd, "~~");
    case "code":
      return applyWrap(source, selectionStart, selectionEnd, "`");
    case "link": {
      const edit = applyWrap(source, selectionStart, selectionEnd, "[", "]()");
      // applyWrap parks the selection ON `]` — for an empty selection the
      // collapsed caret sits there too. +2 lands just after `(`: the empty
      // url slot, on both the empty and non-empty paths.
      const caret = edit.selectionEnd + 2;
      return { ...edit, selectionStart: caret, selectionEnd: caret };
    }
    case "heading":
      return applyLinePrefix(source, selectionStart, selectionEnd, "## ");
    case "bulletList":
      return applyLinePrefix(source, selectionStart, selectionEnd, "- ");
    case "orderedList":
      return applyLinePrefix(source, selectionStart, selectionEnd, (i) => `${i + 1}. `);
    case "quote":
      return applyLinePrefix(source, selectionStart, selectionEnd, "> ");
  }
}

/** Image files of a drag/paste payload — the only kinds this editor ever
 *  claims. Everything else falls through to the browser default. */
function imageFilesOf(list: FileList | null | undefined): File[] {
  return [...(list ?? [])].filter((f) => f.type.startsWith("image/"));
}

/**
 * HkMarkdownEditor — the family's standard two-pane markdown/plain-text
 * editor. Left: the textarea (every toolbar action a pure string transform
 * over the current selection, refocused with a restored selection after
 * each action). Right: the live preview through HkMarkdownRenderer,
 * shown in split view — markdown mode renders, plain mode degrades to
 * pre-wrapped plain text. Image drops/pastes are REPORTED (one
 * `imageDrop` event per file) and never embedded or uploaded: the host
 * owns the upload and inserts its own markdown marker.
 */
export default defineComponent({
  name: "HkMarkdownEditor",
  props: {
    modelValue: { type: String, default: "" },
    mode: { type: String as () => HkMarkdownEditorMode, default: "markdown" },
    view: { type: String as () => "split" | "edit", default: "split" },
    placeholder: { type: String, default: "" },
    disabled: { type: Boolean, default: false },
    /** Toolbar actions row (markdown mode only — plain mode has no
     *  markdown to insert). The mode segmented control always renders. */
    toolbar: { type: Boolean, default: true },
    /** Report drag-dropped and pasted images through `imageDrop`. */
    imageDrop: { type: Boolean, default: true },
  },
  emits: {
    "update:modelValue": (_value: string) => true,
    "update:mode": (_mode: HkMarkdownEditorMode) => true,
    imageDrop: (_file: File) => true,
  },
  setup(props, { emit }) {
    const { t } = useI18n();
    const textareaRef = ref<HTMLTextAreaElement | null>(null);
    // Drag-over highlight state — an attribute so the SCSS owns the look
    // and tests can read it without a computed style engine.
    const dragging = ref(false);

    function onInput(e: Event): void {
      emit("update:modelValue", (e.target as HTMLTextAreaElement).value);
    }

    function runAction(id: ToolbarActionId): void {
      if (props.disabled) return;
      const ta = textareaRef.value;
      if (!ta) return;
      const edit = toolbarEdit(id, props.modelValue, ta.selectionStart, ta.selectionEnd);
      emit("update:modelValue", edit.text);
      // The textarea's value follows modelValue back down; the selection
      // is restored one patch later, after the new value has landed.
      void nextTick(() => {
        const el = textareaRef.value;
        if (!el) return;
        el.focus();
        el.setSelectionRange(edit.selectionStart, edit.selectionEnd);
      });
    }

    function onDragOver(e: DragEvent): void {
      if (!props.imageDrop || props.disabled) return;
      // During dragover the payload files are not readable yet — the
      // affordance keys off `types` when the environment provides it.
      const types = e.dataTransfer?.types;
      if (types && !Array.from(types).includes("Files")) return;
      e.preventDefault();
      dragging.value = true;
    }

    function onDragLeave(): void {
      dragging.value = false;
    }

    function onDrop(e: DragEvent): void {
      dragging.value = false;
      if (!props.imageDrop || props.disabled) return;
      const files = imageFilesOf(e.dataTransfer?.files);
      if (files.length === 0) return; // non-image drop: browser default
      e.preventDefault();
      for (const file of files) emit("imageDrop", file);
    }

    function onPaste(e: ClipboardEvent): void {
      if (!props.imageDrop || props.disabled) return;
      const files = imageFilesOf(e.clipboardData?.files);
      if (files.length === 0) return; // ordinary paste stays native
      e.preventDefault();
      for (const file of files) emit("imageDrop", file);
    }

    function switchMode(mode: HkMarkdownEditorMode): void {
      if (props.disabled || props.mode === mode) return;
      emit("update:mode", mode);
    }

    return () => {
      const isMarkdown = props.mode === "markdown";
      return (
        <div class="hk-md-editor" data-mode={props.mode} data-view={props.view}>
          <div class="hk-md-editor-toolbar">
            {props.toolbar && isMarkdown && (
              <div class="hk-md-editor-actions">
                {TOOLBAR.map((action) => {
                  const label = action.label(t);
                  return (
                    <button
                      key={action.id}
                      type="button"
                      class="hk-md-editor-action"
                      title={label}
                      aria-label={label}
                      disabled={props.disabled}
                      onClick={() => runAction(action.id)}
                    >
                      {h(action.icon, { size: 16, "aria-hidden": "true" })}
                    </button>
                  );
                })}
              </div>
            )}
            <div class="hk-md-editor-modes">
              {(["markdown", "plain"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  class="hk-md-editor-mode"
                  data-active={props.mode === mode || undefined}
                  aria-pressed={props.mode === mode ? "true" : "false"}
                  disabled={props.disabled}
                  onClick={() => switchMode(mode)}
                >
                  {modeLabel(t, mode)}
                </button>
              ))}
            </div>
          </div>
          <div class="hk-md-editor-body">
            <div
              class="hk-md-editor-input-pane"
              data-dragging={dragging.value || undefined}
              onDragover={onDragOver}
              onDragleave={onDragLeave}
              onDrop={onDrop}
            >
              <textarea
                ref={textareaRef}
                class="hk-md-editor-input"
                value={props.modelValue}
                placeholder={props.placeholder}
                disabled={props.disabled}
                aria-label={t("hikari::mdEditor.editorAriaLabel", "Message body")}
                onInput={onInput}
                onPaste={onPaste}
              />
            </div>
            {props.view === "split" && (
              <div
                class="hk-md-editor-preview"
                role="region"
                aria-label={t("hikari::mdEditor.previewLabel", "Preview")}
              >
                <HkMarkdownRenderer content={props.modelValue} plain={props.mode === "plain"} />
              </div>
            )}
          </div>
        </div>
      );
    };
  },
});
