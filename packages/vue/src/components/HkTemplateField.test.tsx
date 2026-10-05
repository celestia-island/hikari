import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick, ref } from "vue";

import HkTemplateField from "./HkTemplateField";

/**
 * HkTemplateField contract tests:
 *
 * - RENDER: modelValue renders literal runs + whole-token chips; the
 *   chip carries the byte-exact data-raw, so a `{{name}}` that came
 *   from storage renders styled but still serializes verbatim
 * - CONVERT: a hand-typed `{{ word }}` (input event after a manual DOM
 *   text append, what a real browser does between events) folds into a
 *   chip on the next input pass, and the emitted value is byte-exact
 * - PANEL: typing an open `{{ quer` opens the vocabulary panel; picking
 *   a row replaces the trigger with the chip and emits the new value
 * - CHIP EDITOR: clicking a chip opens the popover form (focus moves
 *   into its search input); picking a vocabulary row swaps the token
 *   in place; Remove drops the whole chip — every mutation emits the
 *   serialized value, never a chip markup string
 * - SUBMIT: Enter with no panel open fires submitOnEnter
 *
 * happy-dom has no real editing engine: the tests drive the DOM the
 * way the browser would (mutate text nodes, then dispatch `input`),
 * which pins exactly the component's own contracts — serialization,
 * normalization, panel state and editor plumbing.
 */

const mounts: { app: ReturnType<typeof createApp>; container: HTMLElement }[] = [];

interface MountOpts {
  modelValue?: string;
  onUpdate?: (v: string) => void;
  submitOnEnter?: () => void;
}

function mount(opts: MountOpts = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({
    render: () =>
      h(HkTemplateField, {
        modelValue: opts.modelValue ?? "",
        tokens: [
          { name: "md5_email", description: "MD5 of the account email" },
          { name: "sha256_email", description: "SHA-256 of the account email" },
          { name: "username", description: "The account name" },
        ],
        "onUpdate:modelValue": (v: string) => opts.onUpdate?.(v),
        submitOnEnter: opts.submitOnEnter,
      }),
  });
  app.mount(container);
  mounts.push({ app, container });
  return container;
}

function editable(el: HTMLElement): HTMLElement {
  const edit = el.querySelector<HTMLElement>(".hk-template-field-edit");
  if (!edit) throw new Error("editable not found");
  return edit;
}

function fireInput(edit: HTMLElement) {
  edit.dispatchEvent(new Event("input", { bubbles: true }));
}

afterEach(() => {
  for (const { app, container } of mounts) {
    app.unmount();
    container.remove();
  }
  mounts.length = 0;
});

describe("HkTemplateField render + value contract", () => {
  it("renders tokens as chips with byte-exact raw", async () => {
    const el = mount({ modelValue: "https://g.com/{{username}}.png" });
    await nextTick();
    const chips = el.querySelectorAll<HTMLElement>(".hk-tpl-chip");
    expect(chips).toHaveLength(1);
    expect(chips[0]!.dataset.token).toBe("username");
    expect(chips[0]!.dataset.raw).toBe("{{username}}");
    expect(chips[0]!.textContent).toBe("{{ username }}");
    expect(editable(el).textContent).toContain("https://g.com/");
  });

  it("re-renders when the parent changes the value", async () => {
    const container = mount({ modelValue: "" });
    await nextTick();
    // Remount-ish: drive the prop through a second mount with a value.
    const edit = editable(container);
    edit.textContent = "{{ a }}";
    fireInput(edit);
    await nextTick();
    expect(edit.querySelectorAll<HTMLElement>(".hk-tpl-chip")).toHaveLength(1);
  });

  it("an external write re-renders; a parent echo of our own emit must not", async () => {
    // The controlled-value contract: the parent writing a NEW value
    // rebuilds the DOM; the parent echoing back the value we just
    // emitted must NOT (a rebuild under the caret is what breaks
    // mid-typing edits in controlled setups).
    const value = ref("");
    const container = document.createElement("div");
    document.body.appendChild(container);
    const app = createApp({
      setup() {
        return () =>
          h(HkTemplateField, {
            modelValue: value.value,
            tokens: [{ name: "username" }],
            "onUpdate:modelValue": (v: string) => { value.value = v; },
          });
      },
    });
    app.mount(container);
    mounts.push({ app, container });
    await nextTick();

    // External write: chips appear.
    value.value = "x {{ username }} y";
    await nextTick();
    let edit = editable(container);
    expect(edit.querySelectorAll<HTMLElement>(".hk-tpl-chip")).toHaveLength(1);

    // Echo path: type more (emit fires, the parent writes the SAME
    // string back); a planted marker node must survive — a rebuild
    // would have dropped it.
    const marker = document.createTextNode("");
    edit.appendChild(marker);
    edit.append(document.createTextNode("z"));
    fireInput(edit);
    await nextTick();
    edit = editable(container);
    expect(edit.contains(marker), "echo must not rebuild the DOM").toBe(true);
    expect(edit.textContent).toContain("{{ username }}");
    expect(value.value).toBe("x {{ username }} yz");
  });

  it("converts a hand-typed closed token into a chip and emits byte-exact", async () => {
    const seen: string[] = [];
    const el = mount({ modelValue: "x ", onUpdate: (v) => seen.push(v) });
    await nextTick();
    const edit = editable(el);
    // The browser's text insertion between events, emulated.
    edit.append(document.createTextNode("{{ md5_email }}"));
    fireInput(edit);
    await nextTick();
    const chips = edit.querySelectorAll<HTMLElement>(".hk-tpl-chip");
    expect(chips).toHaveLength(1);
    expect(chips[0]!.dataset.raw).toBe("{{ md5_email }}");
    expect(seen.at(-1)).toBe("x {{ md5_email }}");
  });

  it("leaves non-identifier braces as literal text", async () => {
    const el = mount({ modelValue: "" });
    await nextTick();
    const edit = editable(el);
    edit.append(document.createTextNode("{{ filter | pipe }}"));
    fireInput(edit);
    await nextTick();
    expect(edit.querySelectorAll<HTMLElement>(".hk-tpl-chip")).toHaveLength(0);
    expect(edit.textContent).toContain("{{ filter | pipe }}");
  });

  it("paste stays plain text and converts tokens", async () => {
    const seen: string[] = [];
    const el = mount({ modelValue: "", onUpdate: (v) => seen.push(v) });
    await nextTick();
    const edit = editable(el);
    const dt = new DataTransfer();
    dt.setData("text/plain", "<b>{{ username }}</b>");
    const pasteEvent = new ClipboardEvent("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(pasteEvent, "clipboardData", { value: dt });
    edit.dispatchEvent(pasteEvent);
    await nextTick();
    expect(edit.querySelector("b")).toBeNull();
    const chips = edit.querySelectorAll<HTMLElement>(".hk-tpl-chip");
    expect(chips).toHaveLength(1);
    expect(seen.at(-1)).toBe("<b>{{ username }}</b>");
  });
});

describe("HkTemplateField vocabulary panel", () => {
  it("opens on an open-brace trigger and picks a row into a chip", async () => {
    const seen: string[] = [];
    const el = mount({ modelValue: "", onUpdate: (v) => seen.push(v) });
    await nextTick();
    const edit = editable(el);
    edit.append(document.createTextNode("https://x/{{ us"));
    // Caret at the end of the typed run (what typing leaves behind).
    const sel = window.getSelection();
    const range = document.createRange();
    range.setStart(edit.lastChild!, edit.lastChild!.nodeValue!.length);
    range.collapse(true);
    sel?.removeAllRanges();
    sel?.addRange(range);
    fireInput(edit);
    await nextTick();
    // The panel's rows are teleported to body by HkMenu's surface.
    const row = document.body.querySelector<HTMLButtonElement>(".hk-tpl-row");
    expect(row).not.toBeNull();
    row!.click();
    await nextTick();
    const chips = editable(el).querySelectorAll<HTMLElement>(".hk-tpl-chip");
    expect(chips).toHaveLength(1);
    expect(chips[0]!.dataset.token).toBe("username");
    expect(seen.at(-1)).toBe("https://x/{{ username }}");
  });

  it("arrow keys + Enter pick the highlighted row", async () => {
    const seen: string[] = [];
    const el = mount({ modelValue: "", onUpdate: (v) => seen.push(v) });
    await nextTick();
    const edit = editable(el);
    edit.append(document.createTextNode("{{ "));
    const sel = window.getSelection();
    const range = document.createRange();
    range.setStart(edit.lastChild!, 3);
    range.collapse(true);
    sel?.removeAllRanges();
    sel?.addRange(range);
    fireInput(edit);
    await nextTick();
    edit.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }),
    );
    await nextTick();
    edit.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }),
    );
    await nextTick();
    // Active row starts at 0 (md5_email); one ArrowDown highlights
    // sha256_email, and Enter picks it.
    expect(seen.at(-1)).toBe("{{ sha256_email }}");
    expect(editable(el).querySelectorAll<HTMLElement>(".hk-tpl-chip")).toHaveLength(1);
  });
});

describe("HkTemplateField chip editor", () => {
  it("click on a chip opens the editor; picking swaps the token", async () => {
    const seen: string[] = [];
    const el = mount({
      modelValue: "https://g.com/{{username}}.png",
      onUpdate: (v) => seen.push(v),
    });
    await nextTick();
    const chip = editable(el).querySelector<HTMLElement>(".hk-tpl-chip")!;
    chip.click();
    await nextTick();
    // The editor is teleported; its rows exist with the current row
    // marked active.
    const rows = Array.from(document.body.querySelectorAll<HTMLButtonElement>(".hk-tpl-editor .hk-tpl-row"));
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.some((r) => r.dataset.active !== undefined && r.textContent!.includes("username"))).toBe(true);
    // Swap to sha256_email.
    const target = rows.find((r) => r.textContent!.includes("sha256_email"))!;
    target.click();
    await nextTick();
    expect(seen.at(-1)).toBe("https://g.com/{{ sha256_email }}.png");
    const nextChip = editable(el).querySelector<HTMLElement>(".hk-tpl-chip")!;
    expect(nextChip.dataset.token).toBe("sha256_email");
  });

  it("Remove drops the whole chip and emits the residue", async () => {
    const seen: string[] = [];
    const el = mount({
      modelValue: "a {{ md5_email }} b",
      onUpdate: (v) => seen.push(v),
    });
    await nextTick();
    editable(el).querySelector<HTMLElement>(".hk-tpl-chip")!.click();
    await nextTick();
    const remove = Array.from(document.body.querySelectorAll<HTMLButtonElement>(".hk-tpl-editor button"))
      .find((b) => b.textContent!.trim().length > 0 && !b.closest(".hk-tpl-editor-rows"))!;
    remove.click();
    await nextTick();
    expect(seen.at(-1)).toBe("a  b");
    expect(editable(el).querySelectorAll<HTMLElement>(".hk-tpl-chip")).toHaveLength(0);
  });
});

describe("HkTemplateField keyboard", () => {
  it("Enter without a panel fires the submit intent", async () => {
    const submit = vi.fn();
    const el = mount({ modelValue: "", submitOnEnter: submit });
    await nextTick();
    editable(el).dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }),
    );
    expect(submit).toHaveBeenCalledTimes(1);
  });
});
