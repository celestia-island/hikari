import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { clearLeaveGeometry, pinLeaveGeometry } from "./dom";

/**
 * pinLeaveGeometry contract:
 * - freezes the in-flow box (right|left/top/width/height + border-box)
 *   of a leaving list item against its offsetParent — anchored to the
 *   containing block's right padding-box edge by default
 *   (right = clientWidth - (offsetLeft + offsetWidth)), or left-pinned
 *   with anchorX:"left" for inline-start-stable hosts (the tab track)
 * - a supplied LeaveBoxSnapshot (pre-patch) wins over live reads, so a
 *   later sibling's pin survives the synchronous absolute-lift of an
 *   earlier leaving sibling in the same patch pass
 * - reads every metric before writing any style, so no intermediate
 *   write can skew a later read (content-box rewrap hazard)
 * - is a no-op when layout info is unavailable (offsetParent null)
 */

interface StubElement {
  offsetParent: unknown;
  offsetTop: number;
  offsetLeft: number;
  offsetWidth: number;
  offsetHeight: number;
  style: Record<string, string>;
}

/**
 * A real element carrying stub layout metrics.
 *
 * `pinLeaveGeometry` / `clearLeaveGeometry` are declared against `Element`,
 * so the fixture must BE one — but happy-dom reports zero geometry and no
 * `offsetParent` for detached nodes, and exposes each of those fields as a
 * getter-only accessor (a plain assignment throws). An OWN data property
 * shadows the prototype accessor without invoking a setter, and a plain
 * `style` bag replaces the `CSSStyleDeclaration`, which keeps this file's
 * "empty string vs missing key" assertions meaningful. No assertion is
 * involved: the result is an `Element` by construction.
 */
function stubEl(parent: unknown, over: Partial<StubElement> = {}): HTMLElement {
  const metrics: StubElement = {
    offsetParent: parent,
    offsetTop: 0,
    offsetLeft: 0,
    offsetWidth: 0,
    offsetHeight: 0,
    style: {},
    ...over,
  };
  const el = document.createElement("div");
  for (const key of Object.keys(metrics) as (keyof StubElement)[]) {
    Object.defineProperty(el, key, {
      value: metrics[key],
      configurable: true,
      writable: true,
    });
  }
  return el;
}

describe("pinLeaveGeometry", () => {
  it("pins the in-flow box anchored to the parent's right padding edge", () => {
    const parent = { clientWidth: 384 };
    const el = stubEl(parent, { offsetTop: 0, offsetLeft: 0, offsetWidth: 384, offsetHeight: 83 });

    pinLeaveGeometry(el);

    expect(el.style).toEqual({
      right: "0px",
      top: "0px",
      width: "384px",
      height: "83px",
      boxSizing: "border-box",
    });
  });

  it("measures the right offset from the parent's inner width, not the viewport", () => {
    const parent = { clientWidth: 400 };
    const el = stubEl(parent, { offsetTop: 60, offsetLeft: 100, offsetWidth: 200, offsetHeight: 48 });

    pinLeaveGeometry(el);

    // 400 - (100 + 200) = 100px from the containing block's right edge.
    expect(el.style.right).toBe("100px");
    expect(el.style.top).toBe("60px");
    expect(el.style.width).toBe("200px");
    expect(el.style.height).toBe("48px");
  });

  it("is a no-op without layout information (offsetParent null)", () => {
    const el = stubEl(null, { offsetWidth: 384, offsetHeight: 83 });

    pinLeaveGeometry(el);

    expect(el.style).toEqual({});
  });

  it("pins left-anchored when anchorX is 'left' (tab-track hosts)", () => {
    const parent = { clientWidth: 400 };
    const el = stubEl(parent, { offsetTop: 2, offsetLeft: 96, offsetWidth: 84, offsetHeight: 28 });

    pinLeaveGeometry(el, { anchorX: "left" });

    // No right pin: a middle removal's ghost must sit at its in-flow
    // left offset, not re-anchored to the collapsing right edge.
    expect(el.style.right).toBeUndefined();
    expect(el.style.left).toBe("96px");
    expect(el.style.top).toBe("2px");
    expect(el.style.width).toBe("84px");
    expect(el.style.height).toBe("28px");
    expect(el.style.boxSizing).toBe("border-box");
  });

  it("prefers a supplied pre-patch box snapshot over live reads", () => {
    // Live metrics simulate the post-lift reflow (sibling already
    // absolute → this element shifted left by 60px); the snapshot must
    // win so the ghost pins where the option actually was.
    const parent = { clientWidth: 400 };
    const el = stubEl(parent, { offsetTop: 2, offsetLeft: 36, offsetWidth: 84, offsetHeight: 28 });

    pinLeaveGeometry(el, {
      anchorX: "left",
      box: { top: 2, left: 96, width: 84, height: 28 },
    });

    expect(el.style.left).toBe("96px");
    expect(el.style.top).toBe("2px");
    expect(el.style.width).toBe("84px");
    expect(el.style.height).toBe("28px");
    expect(el.style.boxSizing).toBe("border-box");
  });

  it("prefers the snapshot's right pin over a live clientWidth on the right anchor", () => {
    // Right-anchored hosts re-fit mid-removal: by the time a later
    // sibling pins, the live clientWidth has already collapsed, so the
    // snapshot-time right offset must win over the live computation.
    const parent = { clientWidth: 138 };
    const el = stubEl(parent, { offsetTop: 95, offsetLeft: 0, offsetWidth: 384, offsetHeight: 48 });

    pinLeaveGeometry(el, {
      box: { top: 95, left: 0, width: 384, height: 48, right: 0 },
    });

    expect(el.style.right).toBe("0px");
    expect(el.style.top).toBe("95px");
    expect(el.style.width).toBe("384px");
    expect(el.style.height).toBe("48px");
    expect(el.style.boxSizing).toBe("border-box");
  });

  it("clearLeaveGeometry strips exactly the pins pinLeaveGeometry wrote", () => {
    const parent = { clientWidth: 384 };
    const el = stubEl(parent, { offsetWidth: 384, offsetHeight: 83 });
    el.style.marginLeft = "4px"; // foreign style must survive the clear.

    pinLeaveGeometry(el, { anchorX: "left" });
    clearLeaveGeometry(el);

    // On a real CSSStyleDeclaration an empty string removes the
    // property; the stub keeps the keys, so assert emptiness.
    expect(el.style.right).toBe("");
    expect(el.style.left).toBe("");
    expect(el.style.top).toBe("");
    expect(el.style.width).toBe("");
    expect(el.style.height).toBe("");
    expect(el.style.boxSizing).toBe("");
    expect(el.style.marginLeft).toBe("4px");
  });
});

/**
 * FOCUSABLE_SELECTOR contract (#1206): every element-type branch must
 * exclude [tabindex="-1"].
 *
 * The generic `[tabindex]` branch always did; the named branches did not,
 * so a `button[tabindex="-1"]` (HkNumberSteppers' hold-to-repeat buttons
 * are exactly that) MATCHED and could become a container's last
 * "focusable" element. `trapFocus` only wraps when the focused element is
 * the first/last member of the set — with a non-tab-stop as `last`, a
 * forward Tab from the previous input walked straight out of the dialog
 * (chest's SMS policy window was the reporter; the selector's own doc
 * comment already claimed "excluding tabindex=-1", the implementation
 * just never delivered it for the named branches).
 *
 * These tests use REAL DOM nodes appended to the document: happy-dom
 * implements matches()/focus() on connected nodes, and the trap's wrap
 * semantics depend on document.activeElement.
 */
import { FOCUSABLE_SELECTOR, getFocusableElements, trapFocus } from "./dom";

describe("FOCUSABLE_SELECTOR excludes tabindex=-1 in every branch", () => {
  let host: HTMLElement;

  const tabFrom = (el: HTMLElement): boolean => {
    el.focus();
    const ev = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
    trapFocus(host, ev);
    return ev.defaultPrevented;
  };

  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);
  });

  afterEach(() => {
    host.remove();
  });

  it("excludes a button[tabindex=-1] that would otherwise be the trap's last", () => {
    // The reporter's shape: switch/input, then a number field whose
    // stepper column ends with tabindex=-1 buttons, then a disabled Save.
    host.innerHTML = `
      <input type="checkbox" data-name="switch" />
      <input type="number" data-name="ttl" />
      <button type="button" tabindex="-1" data-name="ttl-up"></button>
      <button type="button" tabindex="-1" data-name="ttl-down"></button>
      <input type="number" data-name="cap" />
      <button type="button" tabindex="-1" data-name="cap-up"></button>
      <button type="button" tabindex="-1" data-name="cap-down"></button>
    `;
    const focusable = getFocusableElements(host);
    // The three real inputs; the four steppers are excluded.
    expect(focusable).toHaveLength(3);
    const last = focusable[focusable.length - 1]!;
    expect(last.dataset.name).toBe("cap");
    // The native tab order ends here too — so the trap's last IS the
    // last real tab stop, and a forward Tab from `cap` wraps to first.
    expect((last.nextElementSibling as HTMLElement).tabIndex).toBe(-1);
    expect(tabFrom(last)).toBe(true);
    expect((document.activeElement as HTMLElement).dataset.name).toBe("switch");
  });

  it("excludes tabindex=-1 in the a[href], textarea and select branches too", () => {
    host.innerHTML = `
      <a href="#" tabindex="-1" data-name="link"></a>
      <a href="#" data-name="link-ok"></a>
      <textarea tabindex="-1" data-name="ta"></textarea>
      <textarea data-name="ta-ok"></textarea>
      <select tabindex="-1" data-name="sel"></select>
      <select data-name="sel-ok"></select>
    `;
    const names = getFocusableElements(host).map((el) => el.dataset.name);
    expect(names).toEqual(["link-ok", "ta-ok", "sel-ok"]);
  });

  it("still counts explicit tabindex=0 as a real tab stop", () => {
    host.innerHTML = `
      <button type="button" data-name="first"></button>
      <div tabindex="0" data-name="panel"></div>
    `;
    const names = getFocusableElements(host).map((el) => el.dataset.name);
    expect(names).toEqual(["first", "panel"]);
  });

  it("falls back to an empty set when nothing is focusable (trap no-ops)", () => {
    host.innerHTML = `<button type="button" tabindex="-1"></button>`;
    expect(getFocusableElements(host)).toHaveLength(0);
    // trapFocus with an empty set must not throw and must not move focus.
    expect(tabFrom(document.activeElement as HTMLElement)).toBe(false);
  });
});
