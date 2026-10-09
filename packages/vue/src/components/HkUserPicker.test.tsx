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

function rows() {
  return [...document.body.querySelectorAll<HTMLElement>(".hk-user-picker-row")];
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

  it("opening the dialog runs the injected search with the empty query", async () => {
    const search = vi.fn(async () => [alice, bob]);
    mount(() => h(HkUserPicker, { modelValue: [], search }));
    document.body.querySelector<HTMLElement>(".hk-user-picker-field")!.click();
    await nextTick();
    await nextTick();
    expect(search).toHaveBeenCalledWith("");
    expect(rows()).toHaveLength(2);
  });

  it("single mode emits one user on pick", async () => {
    const onUpdate = vi.fn();
    mount(() => h(HkUserPicker, {
      modelValue: [],
      search: async () => [alice, bob],
      "onUpdate:modelValue": (users: HkUserOption[]) => onUpdate(users),
    }));
    document.body.querySelector<HTMLElement>(".hk-user-picker-field")!.click();
    await nextTick();
    await nextTick();
    rows()[1].click();
    await nextTick();
    expect(onUpdate).toHaveBeenCalledWith([bob]);
  });

  it("multi mode accumulates picks and commits on confirm", async () => {
    const onUpdate = vi.fn();
    mount(() => h(HkUserPicker, {
      modelValue: [],
      mode: "multi",
      search: async () => [alice, bob, carol],
      "onUpdate:modelValue": (users: HkUserOption[]) => onUpdate(users),
    }));
    document.body.querySelector<HTMLElement>(".hk-user-picker-field")!.click();
    await nextTick();
    await nextTick();
    rows()[0].click();
    rows()[2].click();
    // Re-picking a drafted row toggles it OUT again — the de-dup half of
    // pickRow (pinned after the R2 mutation round caught it untested).
    rows()[0].click();
    await nextTick();
    expect(onUpdate).not.toHaveBeenCalled();
    const confirm = [...document.body.querySelectorAll<HTMLButtonElement>(".hk-modal-footer button")]
      .find((b) => b.textContent === "Confirm")!;
    confirm.click();
    await nextTick();
    expect(onUpdate).toHaveBeenCalledWith([carol]);
  });

  it("a stale search resolving late cannot clobber the newer results", async () => {
    let releaseFirst: ((value: HkUserOption[]) => void) | null = null;
    const first = new Promise<HkUserOption[]>((resolve) => { releaseFirst = resolve; });
    const search = vi.fn()
      .mockImplementationOnce(() => first)
      .mockImplementationOnce(async () => [bob]);
    mount(() => h(HkUserPicker, { modelValue: [], search }));
    document.body.querySelector<HTMLElement>(".hk-user-picker-field")!.click();
    await nextTick();
    // Second query (the component's race token advances)…
    // Reach runSearch directly through the input's search event wiring:
    // HkSearchInput debounces at 250ms; fake timers advance past it.
    vi.useFakeTimers();
    const input = document.body.querySelector<HTMLInputElement>(".hk-user-picker-dialog input");
    input!.value = "bob";
    input!.dispatchEvent(new Event("input"));
    // Flush the modelValue watch so HkSearchInput schedules its debounce
    // timer on the fake clock BEFORE time advances past it.
    await nextTick();
    vi.advanceTimersByTime(300);
    await Promise.resolve();
    await Promise.resolve();
    await nextTick();
    // …then the stale first answer lands LAST — it must not win.
    releaseFirst!([alice]);
    await Promise.resolve();
    await Promise.resolve();
    await nextTick();
    vi.useRealTimers();
    const names = rows().map((r) => r.querySelector(".hk-user-picker-row-name")!.textContent);
    expect(names).toEqual(["bob"]);
  });

  it("searches again on reopen after a full close (non-empty prior query)", async () => {
    const search = vi.fn(async (q: string) => (q ? [bob] : [alice, bob]));
    mount(() => h(HkUserPicker, { modelValue: [], search }));
    const field = () => document.body.querySelector<HTMLElement>(".hk-user-picker-field")!;

    // Session 1: open (search #1, ""), type "bob" (search #2), pick — single
    // mode closes the dialog.
    field().click();
    await nextTick(); await nextTick();
    const input = document.body.querySelector<HTMLInputElement>(".hk-user-picker-dialog input")!;
    input.value = "bob";
    input.dispatchEvent(new Event("input"));
    await new Promise((r) => setTimeout(r, 300));
    await nextTick();
    rows()[0].click();
    await nextTick();

    // FULL close: wait past HkModal's leave window so the dialog content
    // actually unmounts (the precondition of the R3 finding — while still
    // mounted, the input's watcher masked the bug).
    await new Promise((r) => setTimeout(r, 700));
    expect(document.body.querySelector(".hk-user-picker-dialog")).toBeNull();

    // Session 2: reopen MUST fire the initial-batch search("") again.
    field().click();
    await nextTick(); await nextTick();
    expect(search).toHaveBeenLastCalledWith("");
    expect(search.mock.calls.filter((c) => c[0] === "").length).toBe(2);
    expect(rows()).toHaveLength(2);
  });

  it("fires exactly one search per open within the modal leave window", async () => {
    const search = vi.fn(async (q: string) => (q ? [bob] : [alice, bob]));
    mount(() => h(HkUserPicker, { modelValue: [], mode: "multi", search }));
    const field = () => document.body.querySelector<HTMLElement>(".hk-user-picker-field")!;

    // Session 1: open + type.
    field().click();
    await nextTick(); await nextTick();
    const input = document.body.querySelector<HTMLInputElement>(".hk-user-picker-dialog input")!;
    input.value = "bob";
    input.dispatchEvent(new Event("input"));
    await new Promise((r) => setTimeout(r, 300));
    await nextTick();

    // Close WITHOUT picking: the modal header's own × button.
    const closeBtn = document.body.querySelector<HTMLButtonElement>(".hk-modal-close");
    expect(closeBtn, "modal close button").toBeDefined();
    closeBtn!.click();
    await nextTick();
    // Reopen IMMEDIATELY (inside the leave window — the input may still be
    // mounted): the session-key remount + explicit search("") must yield
    // exactly ONE new empty-query search, no watcher-originated duplicate.
    field().click();
    await nextTick(); await nextTick();
    await new Promise((r) => setTimeout(r, 320));
    const empties = search.mock.calls.filter((c) => c[0] === "");
    expect(empties.length).toBe(2);
    expect(search.mock.calls.filter((c) => c[0] === "bob").length).toBe(1);
  });

  it("a rejecting search renders the failure note instead of throwing", async () => {
    mount(() => h(HkUserPicker, { modelValue: [], search: async () => { throw new Error("down"); } }));
    document.body.querySelector<HTMLElement>(".hk-user-picker-field")!.click();
    await nextTick();
    await nextTick();
    expect(document.body.querySelector(".hk-user-picker-rows")!.getAttribute("data-state")).toBe("failed");
    expect(rows()).toHaveLength(0);
  });
});
