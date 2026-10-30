/**
 * Behavior contract for the shared number steppers (2026-10-30): the
 * lucide-drawn up/down column (ChevronUp / ChevronDown) that replaced both
 * the hand-inlined polyline SVGs of HkNumberInput and the browser-native
 * spin buttons of HkInput's number variant.
 *
 * Pinned behavior:
 *  1. Click = one step per direction; a dead bound disables its button.
 *  2. Press-and-hold arms on the shared animation bus (300ms) and repeats
 *     every 50ms; the release click after a held run is SWALLOWED (the
 *     original HkNumberInput cadence delivered it as one extra step).
 *  3. A hold dies the moment its direction's bound goes dead mid-hold —
 *     no repeat keeps running behind a button no mouseup can reach.
 *  4. Non-primary buttons never arm a hold; leaving the button cancels it.
 *  5. The stack root carries the size class and reports itself through the
 *     rootRef function ref (the host's trailing-affix measurement), then
 *     clears it on unmount.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick, ref } from "vue";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import HkNumberSteppers from "./HkNumberSteppers";

const here = dirname(fileURLToPath(import.meta.url));
const scss = readFileSync(join(here, "HkNumberSteppers.scss"), "utf-8");

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

/* ── rAF pump: drive the shared animation bus deterministically ── */
const rafQueue: Array<{ id: number; cb: FrameRequestCallback }> = [];
let rafSeq = 0;
let rafStubbed = false;
/* Virtual clock: strictly increasing fired timestamps on the SAME axis as
   performance.now() (the bus arms entries against the real clock). Per-pump
   offsets accumulate, so a small offset never underflows the previous tick. */
let vnow = 0;

function stubRaf(): void {
  if (rafStubbed) return;
  rafStubbed = true;
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    const id = ++rafSeq;
    rafQueue.push({ id, cb });
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => {
    const i = rafQueue.findIndex((e) => e.id === id);
    if (i !== -1) rafQueue.splice(i, 1);
  });
}

/** Fire every queued frame `offsetMs` past the running virtual clock (which
 *  never trails the real clock the bus armed its entries against). */
function pumpRaf(offsetMs: number): void {
  vnow = Math.max(vnow, performance.now()) + offsetMs;
  for (const { cb } of rafQueue.splice(0)) cb(vnow);
}

/* ── mount harness ── */
function mountSteppers(props: Record<string, unknown> = {}): {
  container: HTMLElement;
  steps: string[];
} {
  const steps: string[] = [];
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({
    render: () =>
      h(HkNumberSteppers, {
        onStep: (dir: "up" | "down") => steps.push(dir),
        ...props,
      }),
  });
  app.mount(container);
  mounts.push({ app, container });
  return { container, steps };
}

function button(container: HTMLElement, dir: "up" | "down"): HTMLButtonElement {
  const el = container.querySelector(`.hk-number-input-step-${dir}`);
  expect(el, `${dir} button must render`).not.toBeNull();
  return el as HTMLButtonElement;
}

function press(target: HTMLButtonElement, buttonArg = 0): void {
  target.dispatchEvent(
    new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: buttonArg }),
  );
}

function release(target: HTMLButtonElement): void {
  target.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
}

function click(target: HTMLButtonElement): void {
  target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
}

afterEach(() => {
  for (const { app, container } of mounts.splice(0)) {
    app.unmount();
    container.remove();
  }
  document.body.innerHTML = "";
  rafQueue.length = 0;
  vnow = 0;
  if (rafStubbed) vi.unstubAllGlobals();
  rafStubbed = false;
});

describe("HkNumberSteppers behavior", () => {
  it("steps once per click and greys out dead bounds", () => {
    const { container, steps } = mountSteppers();
    click(button(container, "up"));
    click(button(container, "down"));
    expect(steps).toEqual(["up", "down"]);

    const bounded = mountSteppers({ canUp: false });
    expect(button(bounded.container, "up").disabled).toBe(true);
    expect(button(bounded.container, "down").disabled).toBe(false);
    click(button(bounded.container, "up"));
    expect(bounded.steps).toEqual([]);
    click(button(bounded.container, "down"));
    expect(bounded.steps).toEqual(["down"]);
  });

  it("respects the disabled prop on both buttons", () => {
    const { container, steps } = mountSteppers({ disabled: true });
    expect(button(container, "up").disabled).toBe(true);
    expect(button(container, "down").disabled).toBe(true);
    click(button(container, "up"));
    click(button(container, "down"));
    expect(steps).toEqual([]);
  });

  it("arms the hold after 300ms, repeats per 50ms tick, and swallows the release click", () => {
    stubRaf();
    const { container, steps } = mountSteppers();
    const up = button(container, "up");

    press(up);
    pumpRaf(10);
    expect(steps, "arming delay — nothing yet").toEqual([]);

    pumpRaf(320);
    expect(steps, "threshold crossed — the first repeat fires in the same tick (the interval arms with lastRun=0, and the Map iteration visits entries added mid-tick)").toEqual(["up"]);

    pumpRaf(1);
    expect(steps, "inside the 50ms repeat window — nothing").toEqual(["up"]);

    pumpRaf(60);
    expect(steps).toEqual(["up", "up"]);

    pumpRaf(120);
    expect(steps, "one fire per frame, not two").toEqual(["up", "up", "up"]);

    release(up);
    pumpRaf(10);
    expect(steps, "hold stopped — no further repeats").toEqual(["up", "up", "up"]);

    click(up);
    expect(steps, "the release click after a held run is swallowed").toEqual([
      "up",
      "up",
      "up",
    ]);

    click(up);
    expect(steps, "a fresh plain click steps again").toEqual([
      "up",
      "up",
      "up",
      "up",
    ]);
  });

  it("kills the hold when its bound goes dead mid-hold", async () => {
    stubRaf();
    const steps: string[] = [];
    const bounds = ref({ canUp: true });
    const container = document.createElement("div");
    document.body.appendChild(container);
    const Wrapper = defineComponent({
      render: () =>
        h(HkNumberSteppers, {
          canUp: bounds.value.canUp,
          onStep: (dir: "up" | "down") => {
            steps.push(dir);
            // The host clamps at its max and reports the dead bound.
            bounds.value = { canUp: false };
          },
        }),
    });
    const app = createApp(Wrapper);
    app.mount(container);
    mounts.push({ app, container });

    const up = button(container, "up");
    press(up);
    pumpRaf(320);
    expect(steps, "arm + first repeat in the same tick").toEqual(["up"]);
    await nextTick();

    pumpRaf(60);
    expect(steps, "the dead bound released the hold — no further steps").toEqual(["up"]);
    pumpRaf(60);
    expect(steps).toEqual(["up"]);
  });

  it("ignores non-primary buttons", () => {
    stubRaf();
    const { container, steps } = mountSteppers();
    press(button(container, "up"), 2);
    pumpRaf(400);
    expect(steps).toEqual([]);
  });

  it("cancels a pending hold when the pointer leaves the button", () => {
    stubRaf();
    const { container, steps } = mountSteppers();
    const up = button(container, "up");
    press(up);
    up.dispatchEvent(new MouseEvent("mouseleave"));
    pumpRaf(400);
    expect(steps).toEqual([]);
  });
});

describe("HkNumberSteppers DOM + stylesheet contract", () => {
  it("renders lucide chevrons, carries the size class, and reports its root", () => {
    const roots: Array<HTMLElement | null> = [];
    const { container } = mountSteppers({ size: "lg", rootRef: (el: HTMLElement | null) => roots.push(el) });

    const stack = container.querySelector<HTMLElement>(".hk-number-input-steppers");
    expect(stack, "stepper column must render").not.toBeNull();
    expect(stack!.className).toBe("hk-number-input-steppers hk-number-input-steppers-lg");
    expect(stack!.querySelector("svg.lucide-chevron-up")).not.toBeNull();
    expect(stack!.querySelector("svg.lucide-chevron-down")).not.toBeNull();
    expect(roots).toEqual([stack]);
    expect(button(container, "up").getAttribute("tabindex")).toBe("-1");

    mounts[0]!.app.unmount();
    mounts.splice(0);
    expect(roots.at(-1), "the rootRef clears on unmount").toBeNull();
  });

  it("owns every size's geometry in the shared stylesheet", () => {
    for (const [size, px] of [["sm", "12px"], ["md", "14px"], ["lg", "16px"]] as const) {
      const svg = scss.match(
        new RegExp(`\\.hk-number-input-steppers-${size} \\.hk-number-input-step svg\\s*{[^}]*}`),
      )?.[0];
      expect(svg, `${size} svg rule must exist`).toBeTruthy();
      expect(svg).toContain(`width: ${px}`);
      expect(svg).toContain(`height: ${px}`);
      const column = scss.match(
        new RegExp(`\\.hk-number-input-steppers-${size} \\.hk-number-input-step\\s*{[^}]*}`),
      )?.[0];
      expect(column, `${size} column rule must exist`).toBeTruthy();
    }
    const stack = scss.match(/\.hk-number-input-steppers\s*{[^}]*}/)?.[0] ?? "";
    expect(stack).toContain("align-self: stretch");
    expect(stack).toContain("border-inline-start: 1px solid var(--hi-color-border)");
  });
});
