// HkUserPicker — the search-first anchored panel (HkSelectPanel surface).
//
// The contract these tests pin (2026-11 user direction): the panel opens
// EMPTY — no candidates and no request for an empty query — typing is
// debounced into ONE query, single mode emits + closes on a row, multi
// mode only commits from its in-panel Confirm, a rejection renders a retry
// affordance (never a throw), and a slow older answer can never clobber
// the newer one. The keyboard lives on the search field (combobox
// activedescendant) and the surface owns Escape.
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick } from "vue";

import HkUserPicker, { type HkUserOption } from "./HkUserPicker";

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

function mount(renderNode: () => ReturnType<typeof h>) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({ render: renderNode });
  app.mount(container);
  mounts.push({ app, container });
  return container;
}

afterEach(() => {
  for (const { app, container } of mounts.splice(0)) {
    app.unmount();
    container.remove();
  }
});

const alice: HkUserOption = { uid: "u-1", username: "alice", email: "alice@example.com", displayName: "Alice" };
const bob: HkUserOption = { uid: "u-2", username: "bob", email: "bob@example.com" };
const carol: HkUserOption = { uid: "u-3", username: "carol", email: "carol@example.com", displayName: "Carol" };

/** The generated debounce interval (+ slack) — the component's own 250ms
 *  pause; tests wait it out on real timers instead of fighting fake ones. */
const DEBOUNCE_WAIT = 320;
/** Long enough for the surface's leave transition to unmount its content. */
const CLOSE_WAIT = 420;

const field = () => document.body.querySelector<HTMLElement>(".hk-user-picker-field")!;
const rows = () => [...document.body.querySelectorAll<HTMLElement>(".hk-user-picker-row")];
const names = () => rows().map((row) => row.querySelector(".hk-user-picker-row-name")!.textContent);
const rowsBand = () => document.body.querySelector<HTMLElement>(".hk-user-picker-rows");
const searchField = () => document.body.querySelector<HTMLInputElement>(".hk-user-picker-search input");

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function settle() {
  await nextTick();
  await nextTick();
}

/** Open the panel from the field and let the surface render its content. */
async function openPanel() {
  field().click();
  await settle();
  await nextTick();
}

/** Type into the panel's search field (the input event the field listens
 *  to), leaving the debounce pending. */
async function type(text: string) {
  const input = searchField()!;
  input.value = text;
  input.dispatchEvent(new Event("input"));
  await nextTick();
}

/** Type and wait out the debounce, so exactly one query has run. */
async function searchFor(text: string) {
  await type(text);
  await wait(DEBOUNCE_WAIT);
  await settle();
}

function key(target: HTMLElement, name: string) {
  target.dispatchEvent(new KeyboardEvent("keydown", { key: name, bubbles: true, cancelable: true }));
}

describe("HkUserPicker", () => {
  it("renders the value as tags showing the display name and email", () => {
    mount(() => h(HkUserPicker, { modelValue: [alice, bob], search: async () => [] }));
    const tags = [...document.body.querySelectorAll(".hk-user-picker-tag")];
    expect(tags).toHaveLength(2);
    expect(tags[0].textContent).toContain("Alice");
    expect(tags[0].textContent).toContain("alice@example.com");
    // No display name → the username is the tag title.
    expect(tags[1].textContent).toContain("bob");
  });

  it("removing a tag emits the value without that user", async () => {
    const onUpdate = vi.fn();
    mount(() => h(HkUserPicker, {
      modelValue: [alice, bob],
      search: async () => [],
      "onUpdate:modelValue": (users: HkUserOption[]) => onUpdate(users),
    }));
    const x = document.body.querySelector<HTMLButtonElement>(".hk-user-picker-tag-x");
    x!.click();
    await nextTick();
    expect(onUpdate).toHaveBeenCalledWith([bob]);
  });

  // ── The hard requirement: empty query ⇒ empty candidates ────────────
  it("opens with an empty query: no request, no candidates, only the hint", async () => {
    const search = vi.fn(async () => [alice, bob]);
    mount(() => h(HkUserPicker, { modelValue: [], search }));
    await openPanel();
    // Well past the debounce window: an empty query must never fire.
    await wait(DEBOUNCE_WAIT);
    await settle();
    expect(search).not.toHaveBeenCalled();
    expect(rows()).toHaveLength(0);
    expect(rowsBand()!.getAttribute("data-state")).toBe("empty");
    expect(rowsBand()!.textContent).toContain("Type a nickname, username or email to search.");
  });

  it("clearing the query drops the candidates without a request", async () => {
    const search = vi.fn(async () => [alice, bob]);
    mount(() => h(HkUserPicker, { modelValue: [], search }));
    await openPanel();
    await searchFor("bo");
    expect(rows()).toHaveLength(2);
    await type("   ");
    await wait(DEBOUNCE_WAIT);
    await settle();
    // Only the real query ran; the whitespace-only one never did.
    expect(search).toHaveBeenCalledTimes(1);
    expect(rows()).toHaveLength(0);
    expect(rowsBand()!.getAttribute("data-state")).toBe("empty");
  });

  // ── Debounce ────────────────────────────────────────────────────────
  it("debounces typing into exactly one request with the final query", async () => {
    const search = vi.fn(async () => [alice]);
    mount(() => h(HkUserPicker, { modelValue: [], search }));
    await openPanel();
    await type("a");
    await type("al");
    await type("ali");
    expect(search).not.toHaveBeenCalled();
    await wait(120);
    expect(search, "still inside the debounce window").not.toHaveBeenCalled();
    await wait(DEBOUNCE_WAIT);
    await settle();
    expect(search).toHaveBeenCalledTimes(1);
    expect(search).toHaveBeenCalledWith("ali");
  });

  // ── Single mode ─────────────────────────────────────────────────────
  it("single mode emits one user and closes the panel on a row pick", async () => {
    const onUpdate = vi.fn();
    const search = vi.fn(async () => [alice, bob]);
    mount(() => h(HkUserPicker, {
      modelValue: [],
      search,
      "onUpdate:modelValue": (users: HkUserOption[]) => onUpdate(users),
    }));
    await openPanel();
    await searchFor("bo");
    expect(names()).toEqual(["Alice", "bob"]);
    rows()[1].click();
    await nextTick();
    expect(onUpdate).toHaveBeenCalledWith([bob]);
    await wait(CLOSE_WAIT);
    expect(document.body.querySelector(".hk-user-picker-panel"), "panel closed").toBeNull();
  });

  // ── Multi mode: draft + in-panel confirm ────────────────────────────
  it("multi mode toggles a draft and emits only on the in-panel confirm", async () => {
    const onUpdate = vi.fn();
    const search = vi.fn(async () => [alice, bob, carol]);
    mount(() => h(HkUserPicker, {
      modelValue: [],
      mode: "multi",
      search,
      "onUpdate:modelValue": (users: HkUserOption[]) => onUpdate(users),
    }));
    await openPanel();
    await searchFor("a");
    // Nothing drafted yet → the confirm is inert.
    const disabledConfirm = document.body.querySelector<HTMLButtonElement>(".hk-user-picker-confirm")!;
    expect(disabledConfirm.disabled).toBe(true);

    rows()[0].click();
    rows()[2].click();
    // Re-picking a drafted row toggles it OUT again (the de-dup half).
    rows()[0].click();
    await nextTick();
    expect(onUpdate).not.toHaveBeenCalled();
    expect(rows()[2].getAttribute("aria-selected")).toBe("true");
    expect(rows()[0].getAttribute("aria-selected")).toBe("false");
    expect(document.body.querySelector(".hk-user-picker-count")!.textContent).toContain("1 selected");

    const confirm = document.body.querySelector<HTMLButtonElement>(".hk-user-picker-confirm")!;
    expect(confirm.disabled).toBe(false);
    confirm.click();
    await nextTick();
    expect(onUpdate).toHaveBeenCalledWith([carol]);
    await wait(CLOSE_WAIT);
    expect(document.body.querySelector(".hk-user-picker-panel"), "panel closed").toBeNull();
  });

  // ── Failure + retry ─────────────────────────────────────────────────
  it("a rejecting search renders the retry note and retries without throwing", async () => {
    let attempts = 0;
    const search = vi.fn(async () => {
      attempts += 1;
      if (attempts === 1) throw new Error("down");
      return [bob];
    });
    mount(() => h(HkUserPicker, { modelValue: [], search }));
    await openPanel();
    await searchFor("bob");
    expect(rowsBand()!.getAttribute("data-state")).toBe("failed");
    expect(rows()).toHaveLength(0);
    const retry = document.body.querySelector<HTMLButtonElement>(".hk-user-picker-retry");
    expect(retry, "retry affordance").toBeTruthy();
    retry!.click();
    await settle();
    await nextTick();
    expect(search).toHaveBeenCalledTimes(2);
    expect(names()).toEqual(["bob"]);
    expect(rowsBand()!.getAttribute("data-state")).toBe("ready");
  });

  // ── Race guard ──────────────────────────────────────────────────────
  it("a stale answer resolving late cannot clobber the newer results", async () => {
    let releaseSlow: ((value: HkUserOption[]) => void) | null = null;
    const slow = new Promise<HkUserOption[]>((resolve) => { releaseSlow = resolve; });
    const search = vi.fn()
      .mockImplementationOnce(() => slow)
      .mockImplementationOnce(async () => [carol]);
    mount(() => h(HkUserPicker, { modelValue: [], search }));
    await openPanel();
    await searchFor("bo");
    await searchFor("carol");
    expect(names()).toEqual(["Carol"]);
    // …then the stale first answer lands LAST — it must not win.
    releaseSlow!([alice]);
    await settle();
    expect(names()).toEqual(["Carol"]);
  });

  // ── Keyboard ────────────────────────────────────────────────────────
  it("arrows walk the rows, publish the activedescendant and Enter picks", async () => {
    const onUpdate = vi.fn();
    const search = vi.fn(async () => [alice, bob, carol]);
    mount(() => h(HkUserPicker, {
      modelValue: [],
      search,
      "onUpdate:modelValue": (users: HkUserOption[]) => onUpdate(users),
    }));
    await openPanel();
    await searchFor("a");
    const input = searchField()!;
    expect(input.getAttribute("aria-activedescendant"), "nothing active initially").toBeNull();
    key(input, "ArrowDown");
    await nextTick();
    expect(input.getAttribute("aria-activedescendant")).toBe(rows()[0].id);
    key(input, "ArrowDown");
    await nextTick();
    expect(input.getAttribute("aria-activedescendant")).toBe(rows()[1].id);
    key(input, "ArrowUp");
    await nextTick();
    expect(input.getAttribute("aria-activedescendant")).toBe(rows()[0].id);
    key(input, "Enter");
    await nextTick();
    expect(onUpdate).toHaveBeenCalledWith([alice]);
  });

  it("Escape pressed in the search field closes the panel", async () => {
    mount(() => h(HkUserPicker, { modelValue: [], search: async () => [alice] }));
    await openPanel();
    expect(document.body.querySelector(".hk-user-picker-panel")).toBeTruthy();
    key(searchField()!, "Escape");
    await nextTick();
    await wait(CLOSE_WAIT);
    expect(document.body.querySelector(".hk-user-picker-panel")).toBeNull();
  });

  // ── A11y wiring ─────────────────────────────────────────────────────
  it("wires the search field as the combobox of the option listbox", async () => {
    const search = vi.fn(async () => [alice, bob]);
    mount(() => h(HkUserPicker, { modelValue: [], mode: "multi", search }));
    await openPanel();
    await searchFor("a");
    const input = searchField()!;
    const listbox = rowsBand()!;
    expect(input.getAttribute("role")).toBe("combobox");
    expect(input.getAttribute("aria-controls")).toBe(listbox.getAttribute("id"));
    expect(input.getAttribute("aria-label")).toBe("Nickname, username or email");
    expect(listbox.getAttribute("role")).toBe("listbox");
    expect(listbox.getAttribute("aria-multiselectable")).toBe("true");
    const options = rows();
    for (const option of options) {
      expect(option.getAttribute("role")).toBe("option");
      expect(option.getAttribute("aria-selected")).toBe("false");
      expect(option.getAttribute("tabindex")).toBe("-1");
    }
  });

  it("focuses the search field when the panel opens", async () => {
    mount(() => h(HkUserPicker, { modelValue: [], search: async () => [alice] }));
    await openPanel();
    await nextTick();
    expect(document.activeElement).toBe(searchField());
  });

  // ── Caps + session reset ────────────────────────────────────────────
  it("caps the rendered rows at maxResults", async () => {
    mount(() => h(HkUserPicker, {
      modelValue: [],
      maxResults: 2,
      search: async () => [alice, bob, carol],
    }));
    await openPanel();
    await searchFor("a");
    expect(rows()).toHaveLength(2);
  });

  it("reopening starts a fresh session: query cleared, no stale candidates", async () => {
    const search = vi.fn(async (q: string) => (q === "bo" ? [bob] : [alice, bob]));
    mount(() => h(HkUserPicker, { modelValue: [], search }));
    await openPanel();
    await searchFor("bo");
    expect(names()).toEqual(["bob"]);
    key(searchField()!, "Escape");
    await nextTick();
    await wait(CLOSE_WAIT);
    expect(document.body.querySelector(".hk-user-picker-panel")).toBeNull();

    await openPanel();
    await wait(DEBOUNCE_WAIT);
    await settle();
    // Exactly one search ran across both sessions — the empty reopen
    // queries nothing, and the panel is blank with its hint back.
    expect(search).toHaveBeenCalledTimes(1);
    expect(rows()).toHaveLength(0);
    expect(searchField()!.value).toBe("");
    expect(rowsBand()!.textContent).toContain("Type a nickname, username or email to search.");
  });

  // ── Trigger presentation (2026-11-18 third pass) ────────────────────
  // The host collapses the field into its own icon button via the
  // `trigger` slot; the SAME panel anchors to that button.
  it("trigger mode renders the slot instead of the tag field", () => {
    mount(() => h(HkUserPicker, { modelValue: [alice], search: async () => [] }, {
      trigger: ({ open }: { open: boolean }) =>
        h("button", { class: "test-trigger", "data-open": String(open) }, "Add member"),
    }));
    // No tag field: the slot content IS the visible chrome.
    expect(document.body.querySelector(".hk-user-picker-field")).toBeNull();
    const anchor = document.body.querySelector<HTMLElement>(".hk-user-picker-trigger")!;
    expect(anchor).not.toBeNull();
    const button = anchor.querySelector<HTMLButtonElement>("button.test-trigger")!;
    expect(button.textContent).toBe("Add member");
    expect(button.getAttribute("data-open")).toBe("false");
  });

  it("clicking the trigger opens the same search-first panel and mirrors the open state", async () => {
    const search = vi.fn(async () => [bob]);
    mount(() => h(HkUserPicker, { modelValue: [], search }, {
      trigger: ({ open }: { open: boolean }) =>
        h("button", { class: "test-trigger", "data-open": String(open) }, "Add member"),
    }));
    const button = () =>
      document.body.querySelector<HTMLButtonElement>("button.test-trigger")!;
    expect(button().getAttribute("data-open")).toBe("false");
    button().click();
    await settle();
    await nextTick();
    // The panel content mounted (anchored to the trigger wrapper) and the
    // slot saw the open flip.
    expect(button().getAttribute("data-open")).toBe("true");
    expect(document.body.querySelector(".hk-user-picker-rows")).not.toBeNull();
    expect(document.body.querySelector<HTMLInputElement>(".hk-user-picker-search input")).not.toBeNull();
    await wait(DEBOUNCE_WAIT);
    await settle();
    // The empty-query contract survives the trigger form.
    expect(search).not.toHaveBeenCalled();
    expect(rows()).toHaveLength(0);
  });

  it("single-mode pick from the trigger panel emits and closes", async () => {
    const onUpdate = vi.fn();
    mount(() => h(HkUserPicker, {
      modelValue: [],
      search: async () => [bob],
      "onUpdate:modelValue": (users: HkUserOption[]) => onUpdate(users),
    }, {
      trigger: () => h("button", { class: "test-trigger" }, "Add member"),
    }));
    document.body.querySelector<HTMLButtonElement>("button.test-trigger")!.click();
    await settle();
    await searchFor("bo");
    rows()[0].click();
    await nextTick();
    expect(onUpdate).toHaveBeenCalledWith([bob]);
    await wait(CLOSE_WAIT);
    expect(document.body.querySelector(".hk-user-picker-panel"), "panel closed").toBeNull();
  });

  // ── Group-kind rows (2026-11-18 third pass) ─────────────────────────
  it("group-kind rows render the group glyph and data-kind, user rows stay plain", async () => {
    const team: HkUserOption = { uid: "g-1", username: "", displayName: "Design team", kind: "group" };
    mount(() => h(HkUserPicker, { modelValue: [], search: async () => [team, alice] }));
    await openPanel();
    await searchFor("a");
    expect(rows()).toHaveLength(2);
    const groupRow = rows()[0];
    expect(groupRow.getAttribute("data-kind")).toBe("group");
    expect(groupRow.querySelector(".hk-user-picker-row-kind")).not.toBeNull();
    expect(groupRow.textContent).toContain("Design team");
    const userRow = rows()[1];
    expect(userRow.getAttribute("data-kind")).toBeNull();
    expect(userRow.querySelector(".hk-user-picker-row-kind")).toBeNull();
  });

  it("a group-kind row picks like any other row", async () => {
    const onUpdate = vi.fn();
    const team: HkUserOption = { uid: "g-1", username: "", displayName: "Design team", kind: "group" };
    mount(() => h(HkUserPicker, {
      modelValue: [],
      mode: "multi",
      search: async () => [team, alice],
      "onUpdate:modelValue": (users: HkUserOption[]) => onUpdate(users),
    }));
    await openPanel();
    await searchFor("a");
    rows()[0].click();
    rows()[1].click();
    await nextTick();
    const confirm = document.body.querySelector<HTMLButtonElement>(".hk-user-picker-confirm")!;
    confirm.click();
    await nextTick();
    expect(onUpdate).toHaveBeenCalledWith([team, alice]);
  });
});