import { afterEach, describe, expect, it } from "vitest";
import { createApp, h, nextTick } from "vue";

import HkMarkdownEditor, { applyLinePrefix, applyWrap } from "./HkMarkdownEditor";

/**
 * HkMarkdownEditor contract: the v-model textarea, the pure toolbar
 * transforms (applyWrap / applyLinePrefix — the string algebra every
 * action reduces to), the mode segmented control, the split-view preview
 * through HkMarkdownRenderer, and the imageDrop reporting channel
 * (one event per image file; the editor never embeds or uploads).
 * MUT:hikari-1486-R3-M18 (emit-only-files[0] mutation → "one imageDrop per
 * file" assertion red) and MUT:hikari-1486-R3-M5 (preventDefault claim
 * mutation → defaultPrevented assertion red) pin the emission contract.
 */

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

interface EditorEvents {
  values: string[];
  modes: string[];
  files: File[];
}

function mountEditor(
  props: Record<string, unknown> = {},
): { container: HTMLElement; events: EditorEvents } {
  const events: EditorEvents = { values: [], modes: [], files: [] };
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({
    render: () =>
      h(HkMarkdownEditor, {
        ...props,
        "onUpdate:modelValue": (v: string) => { events.values.push(v); },
        "onUpdate:mode": (m: string) => { events.modes.push(m); },
        onImageDrop: (f: File) => { events.files.push(f); },
      }),
  });
  app.mount(container);
  mounts.push({ app, container });
  return { container, events };
}

function textareaOf(c: HTMLElement): HTMLTextAreaElement {
  const ta = c.querySelector<HTMLTextAreaElement>(".hk-md-editor-input");
  expect(ta).not.toBeNull();
  return ta!;
}

function actionButton(c: HTMLElement, label: string): HTMLButtonElement {
  const btn = [...c.querySelectorAll<HTMLButtonElement>(".hk-md-editor-action")].find(
    (b) => b.getAttribute("aria-label") === label,
  );
  expect(btn, `toolbar button "${label}"`).toBeTruthy();
  return btn!;
}

function modeButton(c: HTMLElement, label: string): HTMLButtonElement {
  const btn = [...c.querySelectorAll<HTMLButtonElement>(".hk-md-editor-mode")].find(
    (b) => b.textContent?.trim() === label,
  );
  expect(btn, `mode button "${label}"`).toBeTruthy();
  return btn!;
}

afterEach(() => {
  for (const { app, container } of mounts.splice(0)) {
    app.unmount();
    container.remove();
  }
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The renderer's parse pipeline is async (lazy marked/DOMPurify imports
 *  behind a coalesce window) — poll until the preview settles. */
async function settleFor(root: HTMLElement, predicate: () => boolean, tries = 240): Promise<void> {
  for (let i = 0; i < tries; i += 1) {
    if (predicate()) return;
    await sleep(5);
    await nextTick();
  }
}

/** happy-dom does not populate DragEvent/ClipboardEvent payloads; the
 *  editor only reads `.files`, so a plain stub object is the payload.
 *  comment-gate-ok: environment statement about the test runner, not a
 *  behaviour claim — the payload handling itself is pinned red-side by the
 *  drop/paste suites (MUT:hikari-1486-R3-M4/M19 gate-bypass mutations). */
function dropEvent(type: string, files: File[], types?: string[]): Event {
  const ev = new Event(type, { bubbles: true, cancelable: true });
  (ev as unknown as { dataTransfer: { files: File[]; types?: string[] } }).dataTransfer = {
    files,
    ...(types !== undefined ? { types } : {}),
  };
  return ev;
}

// ── Pure helpers ──────────────────────────────────────────────────────────

describe("applyWrap", () => {
  it("wraps a middle selection and keeps it selected inside the markers", () => {
    const edit = applyWrap("hello world", 6, 11, "**");
    expect(edit.text).toBe("hello **world**");
    // selection restored INSIDE the wrap, still around "world"
    expect(edit.text.slice(edit.selectionStart, edit.selectionEnd)).toBe("world");
  });

  it("parks the caret between the markers for an empty selection", () => {
    const edit = applyWrap("hello", 5, 5, "`");
    expect(edit.text).toBe("hello``");
    expect(edit.selectionStart).toBe(6);
    expect(edit.selectionEnd).toBe(6);
  });

  it("supports asymmetric markers (link text)", () => {
    const edit = applyWrap("say hi", 4, 6, "[", "]()");
    expect(edit.text).toBe("say [hi]()");
    expect(edit.text.slice(edit.selectionStart, edit.selectionEnd)).toBe("hi");
  });

  it("clamps an out-of-range selection instead of corrupting the source", () => {
    // Both indices clamp to the end: an empty-selection wrap there.
    const edit = applyWrap("abc", 10, 99, "*");
    expect(edit.text).toBe("abc**");
    expect(edit.selectionStart).toBe(4);
    expect(edit.selectionEnd).toBe(4);
  });
});

describe("applyLinePrefix", () => {
  it("prefixes the line holding a mid-line caret", () => {
    const edit = applyLinePrefix("one\ntwo\nthree", 5, 5, "## ");
    expect(edit.text).toBe("one\n## two\nthree");
    // selection covers the rewritten line
    expect(edit.text.slice(edit.selectionStart, edit.selectionEnd)).toBe("## two");
  });

  it("prefixes each selected line (multiline selection)", () => {
    const edit = applyLinePrefix("a\nb\nc", 0, 3, "- ");
    expect(edit.text).toBe("- a\n- b\nc");
    expect(edit.text.slice(edit.selectionStart, edit.selectionEnd)).toBe("- a\n- b");
  });

  it("numbers ordered-list lines per line index", () => {
    const edit = applyLinePrefix("x\ny\nz", 0, 6, (i) => `${i + 1}. `);
    expect(edit.text).toBe("1. x\n2. y\n3. z");
  });

  it("operates through the last line without a trailing newline", () => {
    const edit = applyLinePrefix("first\nlast", 7, 7, "> ");
    expect(edit.text).toBe("first\n> last");
  });
});

// ── Component ─────────────────────────────────────────────────────────────

describe("HkMarkdownEditor", () => {
  it("typing in the textarea emits update:modelValue", async () => {
    const { container, events } = mountEditor({ modelValue: "" });
    const ta = textareaOf(container);
    ta.value = "hello";
    ta.dispatchEvent(new Event("input", { bubbles: true }));
    await nextTick();
    expect(events.values).toEqual(["hello"]);
  });

  it("toolbar bold wraps the current textarea selection", async () => {
    const { container, events } = mountEditor({ modelValue: "hello world" });
    const ta = textareaOf(container);
    ta.selectionStart = 6;
    ta.selectionEnd = 11;
    actionButton(container, "Bold").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await nextTick();
    expect(events.values).toEqual(["hello **world**"]);
  });

  it("toolbar ordered list prefixes each selected line", async () => {
    const { container, events } = mountEditor({ modelValue: "a\nb" });
    const ta = textareaOf(container);
    ta.selectionStart = 0;
    ta.selectionEnd = 3;
    actionButton(container, "Ordered list").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await nextTick();
    expect(events.values).toEqual(["1. a\n2. b"]);
  });

  it("toolbar link puts the caret in the url slot — empty selection too (R2 S1 pin)", async () => {
    // The caret assertion needs the v-model loop CLOSED (the restored
    // selection lands on the fed-back value), so this harness is stateful.
    const container = document.createElement("div");
    document.body.appendChild(container);
    const app = createApp({
      data: () => ({ value: "hello world" }),
      render() {
        return h(HkMarkdownEditor, {
          modelValue: this.value,
          "onUpdate:modelValue": (v: string) => { this.value = v; },
        });
      },
    });
    app.mount(container);
    mounts.push({ app, container });

    // Empty selection at the end: `hello world[]()` … caret in the url slot.
    const ta = textareaOf(container);
    ta.focus();
    ta.selectionStart = 11;
    ta.selectionEnd = 11;
    actionButton(container, "Link").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await nextTick();
    await nextTick();
    expect(ta.value).toBe("hello world[]()");
    expect(ta.selectionStart).toBe(14);
    expect(ta.selectionEnd).toBe(14);

    // Non-empty selection: the selection becomes the link text, caret in
    // the url slot — `hello [world]()[]()` … caret after the FIRST `(`.
    ta.selectionStart = 6;
    ta.selectionEnd = 11;
    actionButton(container, "Link").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await nextTick();
    await nextTick();
    expect(ta.value).toBe("hello [world]()[]()");
    expect(ta.selectionStart).toBe(14);
    expect(ta.selectionEnd).toBe(14);
  });

  it("mode toggle emits update:mode (and never echoes the active mode)", async () => {
    // The no-op guard reads the FED-BACK mode prop, so the harness has to
    // close the v-model:mode loop like a real host.
    const events: string[] = [];
    const container = document.createElement("div");
    document.body.appendChild(container);
    const app = createApp({
      data: () => ({ mode: "markdown" as string }),
      render() {
        return h(HkMarkdownEditor, {
          modelValue: "",
          mode: this.mode,
          "onUpdate:mode": (m: string) => { events.push(m); this.mode = m; },
        });
      },
    });
    app.mount(container);
    mounts.push({ app, container });

    modeButton(container, "Plain text").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await nextTick();
    expect(events).toEqual(["plain"]);
    // The active state followed the emitted mode; re-clicking is a no-op.
    const plain = modeButton(container, "Plain text");
    expect(plain.hasAttribute("data-active")).toBe(true);
    plain.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await nextTick();
    expect(events).toEqual(["plain"]);
  });

  it("split view renders the markdown preview for a heading", async () => {
    const { container } = mountEditor({ modelValue: "# hi" });
    const preview = container.querySelector<HTMLElement>(".hk-md-editor-preview");
    expect(preview, "preview pane renders in split view").not.toBeNull();
    // The preview IS a mounted HkMarkdownRenderer fed the live source.
    // Under happy-dom DOMPurify strips heading ELEMENTS (verified:
    // sanitize('<h1>hi</h1>') → 'hi'), so the assertion rides the
    // renderer's own output classes plus the settled text content —
    // the same textContent idiom HkMarkdownRenderer's suites use.
    // comment-gate-ok: verified environment fact (probe output quoted
    // above), not an unproven behaviour claim; the renderer wiring itself
    // is pinned by MUT:hikari-1486-R3-M6 (plain-flag mutation → this
    // suite's preview assertions red).
    expect(preview!.querySelector(".hk-markdown .hk-markdown-body")).not.toBeNull();
    await settleFor(container, () =>
      (preview!.querySelector(".hk-markdown-body")?.textContent ?? "").includes("hi"),
    );
    expect(preview!.querySelector(".hk-markdown-body")?.textContent).toContain("hi");
    // data-plain is off in markdown mode (the plain-mode case pins the on state).
    expect(preview!.querySelector(".hk-markdown")?.hasAttribute("data-plain")).toBe(false);
  });

  it("edit view renders no preview pane", () => {
    const { container } = mountEditor({ modelValue: "# hi", view: "edit" });
    expect(container.querySelector(".hk-md-editor-preview")).toBeNull();
    expect(container.querySelector(".hk-md-editor-input")).not.toBeNull();
  });

  it("plain mode hides the markdown actions and previews pre-wrapped text", async () => {
    const { container } = mountEditor({ modelValue: "*raw* markup", mode: "plain" });
    expect(container.querySelector(".hk-md-editor-actions")).toBeNull();
    // The mode control stays reachable in plain mode (the way back).
    expect(container.querySelector(".hk-md-editor-modes")).not.toBeNull();
    const preview = container.querySelector<HTMLElement>(".hk-md-editor-preview");
    expect(preview).not.toBeNull();
    await settleFor(container, () => preview!.querySelector("pre.hk-md-plain") !== null);
    // Plain preview shows the RAW source, not rendered markdown.
    expect(preview!.querySelector("pre.hk-md-plain")?.textContent).toContain("*raw* markup");
  });

  it("toolbar=false hides the actions but keeps the mode control", () => {
    const { container } = mountEditor({ modelValue: "", toolbar: false });
    expect(container.querySelector(".hk-md-editor-actions")).toBeNull();
    expect(container.querySelector(".hk-md-editor-modes")).not.toBeNull();
  });

  it("dropping an image file emits one imageDrop per file and prevents the default", async () => {
    const png = new File(["x"], "a.png", { type: "image/png" });
    const jpg = new File(["y"], "b.jpg", { type: "image/jpeg" });
    const txt = new File(["z"], "c.txt", { type: "text/plain" });
    const { container, events } = mountEditor({ modelValue: "" });
    const pane = container.querySelector<HTMLElement>(".hk-md-editor-input-pane")!;
    const ev = dropEvent("drop", [png, jpg, txt]);
    pane.dispatchEvent(ev);
    await nextTick();
    expect(events.files).toEqual([png, jpg]);
    expect(ev.defaultPrevented, "an image drop is claimed, never navigated").toBe(true);
  });

  it("dragover highlights the pane; dragleave and drop clear it", async () => {
    const file = new File(["x"], "a.png", { type: "image/png" });
    const { container } = mountEditor({ modelValue: "" });
    const pane = container.querySelector<HTMLElement>(".hk-md-editor-input-pane")!;

    // The highlight is a rendered attribute — it flushes on the next patch
    // tick, not synchronously with the event.
    pane.dispatchEvent(dropEvent("dragover", [file]));
    await nextTick();
    expect(pane.hasAttribute("data-dragging"), "dragover sets data-dragging").toBe(true);

    pane.dispatchEvent(new Event("dragleave", { bubbles: true }));
    await nextTick();
    expect(pane.hasAttribute("data-dragging"), "dragleave clears data-dragging").toBe(false);

    pane.dispatchEvent(dropEvent("dragover", [file]));
    await nextTick();
    pane.dispatchEvent(dropEvent("drop", [file]));
    await nextTick();
    expect(pane.hasAttribute("data-dragging"), "drop clears data-dragging").toBe(false);
  });

  it("an in-page drag (no Files payload type) never highlights", async () => {
    const { container } = mountEditor({ modelValue: "" });
    const pane = container.querySelector<HTMLElement>(".hk-md-editor-input-pane")!;
    // A text/node drag over the pane advertises non-Files types — the
    // highlight is reserved for file drags only.
    pane.dispatchEvent(dropEvent("dragover", [], ["text/plain"]));
    await nextTick();
    expect(pane.hasAttribute("data-dragging")).toBe(false);
  });

  it("pasting an image emits imageDrop and prevents the default", async () => {
    const file = new File(["x"], "shot.png", { type: "image/png" });
    const { container, events } = mountEditor({ modelValue: "" });
    const ta = textareaOf(container);
    const ev = new Event("paste", { bubbles: true, cancelable: true });
    (ev as unknown as { clipboardData: { files: File[] } }).clipboardData = { files: [file] };
    ta.dispatchEvent(ev);
    await nextTick();
    expect(events.files).toEqual([file]);
    expect(ev.defaultPrevented).toBe(true);
  });

  it("a non-image drop falls through to the browser default", async () => {
    const txt = new File(["z"], "notes.txt", { type: "text/plain" });
    const { container, events } = mountEditor({ modelValue: "" });
    const pane = container.querySelector<HTMLElement>(".hk-md-editor-input-pane")!;
    const ev = dropEvent("drop", [txt]);
    pane.dispatchEvent(ev);
    await nextTick();
    expect(events.files).toEqual([]);
    expect(ev.defaultPrevented).toBe(false);
  });

  it("imageDrop=false disables the channel: no emit, default not prevented", async () => {
    const file = new File(["x"], "a.png", { type: "image/png" });
    const { container, events } = mountEditor({ modelValue: "", imageDrop: false });
    const pane = container.querySelector<HTMLElement>(".hk-md-editor-input-pane")!;
    const dropEv = dropEvent("drop", [file]);
    pane.dispatchEvent(dropEv);

    const ta = textareaOf(container);
    const pasteEv = new Event("paste", { bubbles: true, cancelable: true });
    (pasteEv as unknown as { clipboardData: { files: File[] } }).clipboardData = { files: [file] };
    ta.dispatchEvent(pasteEv);
    await nextTick();
    expect(events.files).toEqual([]);
    expect(dropEv.defaultPrevented).toBe(false);
    expect(pasteEv.defaultPrevented).toBe(false);
  });

  it("disabled blocks the channel too and disables the textarea and controls", async () => {
    const file = new File(["x"], "a.png", { type: "image/png" });
    const { container, events } = mountEditor({ modelValue: "", disabled: true });
    const pane = container.querySelector<HTMLElement>(".hk-md-editor-input-pane")!;
    const dropEv = dropEvent("drop", [file]);
    pane.dispatchEvent(dropEv);
    await nextTick();
    expect(events.files).toEqual([]);
    expect(dropEv.defaultPrevented).toBe(false);
    expect(textareaOf(container).disabled).toBe(true);
    expect(actionButton(container, "Bold").disabled).toBe(true);
    expect(modeButton(container, "Plain text").disabled).toBe(true);
  });
});
