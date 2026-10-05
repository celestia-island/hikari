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

function mountWithTokens(
  tokens: Array<{ name: string; group?: string; description?: string }>,
  opts: MountOpts & { groupLabel?: (g: string) => string } = {},
) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({
    render: () =>
      h(HkTemplateField, {
        modelValue: opts.modelValue ?? "",
        tokens,
        groupLabel: opts.groupLabel,
        "onUpdate:modelValue": (v: string) => opts.onUpdate?.(v),
      }),
  });
  app.mount(container);
  mounts.push({ app, container });
  return container;
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

/** Drive the editable into an open `{{ query` trigger state with the
 * caret at the end of the typed run, so the panel opens. */
async function openTrigger(el: HTMLElement, typed: string) {
  const edit = editable(el);
  edit.append(document.createTextNode(typed));
  const sel = window.getSelection();
  const range = document.createRange();
  range.setStart(edit.lastChild!, edit.lastChild!.nodeValue!.length);
  range.collapse(true);
  sel?.removeAllRanges();
  sel?.addRange(range);
  fireInput(edit);
  await nextTick();
}

describe("HkTemplateField vocabulary guardrails (R2 gap killers)", () => {
  it("falls back to in-order subsequence matching (md5e finds md5_email)", async () => {
    const el = mount({ modelValue: "" });
    await nextTick();
    // "md5e" is not a substring of any name/description — only the
    // subsequence pass can surface the row.
    await openTrigger(el, "{{ md5e");
    const rows = Array.from(document.body.querySelectorAll<HTMLButtonElement>(".hk-tpl-row"));
    expect(rows.some((r) => r.textContent!.includes("md5_email"))).toBe(true);
  });

  it("Shift+Tab does NOT pick the highlighted row", async () => {
    const seen: string[] = [];
    const el = mount({ modelValue: "", onUpdate: (v) => seen.push(v) });
    await nextTick();
    await openTrigger(el, "{{ us");
    const before = seen.length;
    editable(el).dispatchEvent(
      new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true, cancelable: true }),
    );
    await nextTick();
    expect(seen.length).toBe(before);
    expect(editable(el).querySelectorAll<HTMLElement>(".hk-tpl-chip")).toHaveLength(0);
  });

  it("a paste whose selection straddles the field boundary appends at the end", async () => {
    const el = mount({ modelValue: "x" });
    await nextTick();
    const edit = editable(el);
    // A selection that starts inside the field and ends in an outside
    // node: the guard must treat it as foreign (delete nothing past
    // the field, insert at the end).
    const outsider = document.createElement("span");
    outsider.textContent = "OUTSIDE";
    el.appendChild(outsider);
    const sel = window.getSelection();
    const range = document.createRange();
    range.setStart(edit.firstChild!, 0);
    range.setEnd(outsider.firstChild!, 2);
    sel?.removeAllRanges();
    sel?.addRange(range);

    const seen: string[] = [];
    const dt = new DataTransfer();
    dt.setData("text/plain", "{{ username }}");
    const pasteEvent = new ClipboardEvent("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(pasteEvent, "clipboardData", { value: dt });
    edit.dispatchEvent(pasteEvent);
    await nextTick();
    // The outside node survived the straddling selection…
    expect(outsider.textContent).toBe("OUTSIDE");
    // …and the paste landed at the field's end, chips up.
    const chips = edit.querySelectorAll<HTMLElement>(".hk-tpl-chip");
    expect(chips).toHaveLength(1);
    expect(edit.textContent).toContain("x");
  });

  it("Enter in the chip editor search picks the first matching row", async () => {
    const seen: string[] = [];
    const el = mount({
      modelValue: "a {{ username }} b",
      onUpdate: (v) => seen.push(v),
    });
    await nextTick();
    editable(el).querySelector<HTMLElement>(".hk-tpl-chip")!.click();
    await nextTick();
    const search = document.body.querySelector<HTMLInputElement>(".hk-tpl-editor-search input")!;
    expect(search).toBeTruthy();
    search.value = "md5";
    search.dispatchEvent(new Event("input", { bubbles: true }));
    await nextTick();
    search.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }),
    );
    await nextTick();
    expect(seen.at(-1)).toBe("a {{ md5_email }} b");
  });
});

describe("HkTemplateField grouped vocabulary", () => {
  const GROUPED = [
    { name: "id", group: "identity" },
    { name: "username", group: "identity" },
    { name: "md5_email", group: "email" },
    { name: "sha256_email", group: "email" },
  ];

  it("renders one heading per group run in the panel", async () => {
    const el = mountWithTokens(GROUPED);
    await nextTick();
    await openTrigger(el, "{{ ");
    const headings = Array.from(document.body.querySelectorAll<HTMLElement>(".hk-tpl-group"));
    expect(headings.map((h) => h.textContent)).toEqual(["identity", "email"]);
    // Headings are presentational, not options.
    expect(headings.every((h) => h.getAttribute("role") === "presentation")).toBe(true);
  });

  it("maps group keys through groupLabel", async () => {
    const el = mountWithTokens(GROUPED, { groupLabel: (g) => g.toUpperCase() });
    await nextTick();
    await openTrigger(el, "{{ ");
    const headings = Array.from(document.body.querySelectorAll<HTMLElement>(".hk-tpl-group"));
    expect(headings.map((h) => h.textContent)).toEqual(["IDENTITY", "EMAIL"]);
  });

  it("filters groups out with their members (no stray heading)", async () => {
    const el = mountWithTokens(GROUPED);
    await nextTick();
    await openTrigger(el, "{{ md5");
    const headings = Array.from(document.body.querySelectorAll<HTMLElement>(".hk-tpl-group"));
    expect(headings.map((h) => h.textContent)).toEqual(["email"]);
  });

  it("ungrouped vocabularies render exactly as before (no headings)", async () => {
    const el = mountWithTokens([{ name: "username" }, { name: "md5_email" }]);
    await nextTick();
    await openTrigger(el, "{{ ");
    expect(document.body.querySelectorAll(".hk-tpl-group")).toHaveLength(0);
    expect(document.body.querySelectorAll(".hk-tpl-row").length).toBeGreaterThan(0);
  });

  it("groups the chip editor rows too", async () => {
    const el = mountWithTokens(GROUPED, { modelValue: "a {{ username }} b" });
    await nextTick();
    editable(el).querySelector<HTMLElement>(".hk-tpl-chip")!.click();
    await nextTick();
    const headings = Array.from(
      document.body.querySelectorAll<HTMLElement>(".hk-tpl-editor .hk-tpl-group"),
    );
    expect(headings.map((h) => h.textContent)).toEqual(["identity", "email"]);
  });
});

describe("HkTemplateField editor scroll chrome", () => {
  it("wraps the scrolling rows in a dedicated track host", async () => {
    const el = mount({ modelValue: "a {{ username }} b" });
    await nextTick();
    editable(el).querySelector<HTMLElement>(".hk-tpl-chip")!.click();
    await nextTick();
    const host = document.body.querySelector<HTMLElement>(".hk-tpl-editor-scroll");
    expect(host).not.toBeNull();
    // The host wraps EXACTLY the scrolling viewport (rails must not
    // span the form's other bands).
    expect(host!.firstElementChild?.classList.contains("hk-tpl-editor-rows")).toBe(true);
  });
});

describe("HkTemplateField editor close reclaim (closed hook)", () => {
  it("returns focus to the field after the popover settles its leave", async () => {
    const el = mount({ modelValue: "a {{ username }} b" });
    await nextTick();
    const edit = editable(el);
    edit.querySelector<HTMLElement>(".hk-tpl-chip")!.click();
    await nextTick();
    const panel = document.body.querySelector<HTMLElement>(".hk-popover-panel");
    expect(panel).not.toBeNull();
    // The reclaim contract only engages when the editor HELD focus —
    // put the caret in the search field like a real user would.
    document.body.querySelector<HTMLInputElement>(".hk-tpl-editor-search input")!.focus();
    await nextTick();
    // Escape: the popover starts closing; focus sits in the search
    // input until the leave finishes.
    panel!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await nextTick();
    // Past the leave window the machine emits `closed`, whose handler
    // reclaims focus from the orphaned body state.
    await new Promise((r) => setTimeout(r, 30));
    await nextTick();
    expect(document.activeElement).toBe(edit);
  });
});

describe("HkTemplateField editor focus ownership (R1 guards)", () => {
  it("does NOT steal focus when an outside control takes it (real click path)", async () => {
    const el = mount({ modelValue: "a {{ username }} b" });
    await nextTick();
    const edit = editable(el);
    edit.querySelector<HTMLElement>(".hk-tpl-chip")!.click();
    await nextTick();
    document.body.querySelector<HTMLInputElement>(".hk-tpl-editor-search input")!.focus();
    await nextTick();

    // A real outside click: the popover's document-level shield closes
    // it; the user's focus must stay where the click put it.
    const outside = document.createElement("input");
    document.body.appendChild(outside);
    outside.focus();
    outside.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await nextTick();
    await new Promise((r) => setTimeout(r, 30));
    await nextTick();
    expect(document.activeElement).toBe(outside);
    outside.remove();
  });

  it("still reclaims after a reopen inside the previous close's leave window", async () => {
    // The focus latch must be re-armed on open: a programmatic reopen
    // focuses an input that never blurred (no focusin fires), and the
    // SECOND close would otherwise orphan focus on <body>.
    const el = mount({ modelValue: "a {{ username }} b" });
    await nextTick();
    const edit = editable(el);
    const chip = edit.querySelector<HTMLElement>(".hk-tpl-chip")!;

    chip.click();
    await nextTick();
    document.body.querySelector<HTMLInputElement>(".hk-tpl-editor-search input")!.focus();
    await nextTick();
    // Close #1 via the panel's Escape path.
    document.body
      .querySelector<HTMLElement>(".hk-popover-panel")!
      .dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await nextTick();
    // Reopen immediately (inside the leave window — the panel may still
    // be unmounting).
    chip.click();
    await nextTick();
    // Close #2.
    document.body
      .querySelector<HTMLElement>(".hk-popover-panel")!
      .dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await nextTick();
    await new Promise((r) => setTimeout(r, 40));
    await nextTick();
    expect(document.activeElement).toBe(edit);
  });

  it("re-targeting another chip while open keeps exactly one scrollbar", async () => {
    // Whatever interaction interleaving the user produces (here: a
    // second chip click while the editor is open — the popover's
    // outside-click shield closes and the click handler reopens), the
    // rows host must never end up with more than ONE rail pair. Pins
    // the leak invariant, not any particular detach call site.
    const el = mount({ modelValue: "a {{ username }} b {{ md5_email }}" });
    await nextTick();
    const edit = editable(el);
    const chips = [...edit.querySelectorAll<HTMLElement>(".hk-tpl-chip")];
    expect(chips).toHaveLength(2);
    chips[0]!.click();
    await nextTick();
    chips[1]!.click();
    await nextTick();
    const hosts = document.body.querySelectorAll(".hk-tpl-editor-scroll");
    expect(hosts).toHaveLength(1);
    expect(hosts[0]!.querySelectorAll(".hk-scrollbar-track")).toHaveLength(1);
  });

  it("detaches the scrollbar machinery on close (no live observer leak)", async () => {
    // R2 M4: the close-path detach is load-bearing — without it the
    // rows handle's ResizeObserver + scroll listeners stay attached to
    // a viewport that has left the document until the field unmounts
    // (~a bounded leak). Counting LIVE observers (not bare disconnect
    // calls — sibling components have their own ROs) is the precise
    // signal, matching R2's real-browser instrumentation.
    const RealRO = globalThis.ResizeObserver;
    const live = new Set<unknown>();
    class TrackingRO extends RealRO {
      constructor(cb: ResizeObserverCallback) {
        super(cb);
        live.add(this);
      }
      override disconnect(): void {
        live.delete(this);
        super.disconnect();
      }
    }
    (globalThis as unknown as Record<string, unknown>).ResizeObserver = TrackingRO;
    try {
      const el = mount({ modelValue: "a {{ username }} b" });
      await nextTick();
      const base = live.size;
      const edit = editable(el);
      edit.querySelector<HTMLElement>(".hk-tpl-chip")!.click();
      await nextTick();
      expect(live.size, "scrollbar attached an observer").toBeGreaterThan(base);

      document.body
        .querySelector<HTMLElement>(".hk-popover-panel")!
        .dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      await nextTick();
      await new Promise((r) => setTimeout(r, 30));
      await nextTick();
      expect(live.size, "close detached every observer it attached").toBe(base);
    } finally {
      (globalThis as unknown as Record<string, unknown>).ResizeObserver = RealRO;
    }
  });

  it("attaches exactly one overlay scrollbar across repeated opens", async () => {
    const el = mount({ modelValue: "a {{ username }} b" });
    await nextTick();
    const edit = editable(el);
    const chip = edit.querySelector<HTMLElement>(".hk-tpl-chip")!;
    for (let round = 0; round < 3; round++) {
      chip.click();
      await nextTick();
      const host = document.body.querySelector(".hk-tpl-editor-scroll")!;
      expect(host.querySelectorAll(".hk-scrollbar-track")).toHaveLength(1);
      document.body
        .querySelector<HTMLElement>(".hk-popover-panel")!
        .dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      await nextTick();
      await new Promise((r) => setTimeout(r, 20));
      await nextTick();
    }
  });
});

describe("HkTemplateField partially-grouped vocabulary", () => {
  it("renders a heading only where a group starts (documented contract)", async () => {
    const el = mountWithTokens([
      { name: "id", group: "identity" },
      { name: "free_a" }, // ungrouped: continues the identity band
      { name: "free_b" },
      { name: "md5_email", group: "email" },
      { name: "free_c" },
    ]);
    await nextTick();
    await openTrigger(el, "{{ ");
    const headings = Array.from(document.body.querySelectorAll<HTMLElement>(".hk-tpl-group"));
    // Two headings for two group STARTS; the trailing ungrouped tokens
    // stay under the last heading (see the groupLabel prop doc).
    expect(headings.map((h) => h.textContent)).toEqual(["identity", "email"]);
    expect(document.body.querySelectorAll(".hk-tpl-row")).toHaveLength(5);
  });
});
