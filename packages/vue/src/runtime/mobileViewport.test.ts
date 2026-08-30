import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  applyViewportPolicy,
  parseViewportContent,
} from "./mobileViewport";

function metaEl(content: string): HTMLMetaElement {
  const el = document.createElement("meta");
  el.name = "viewport";
  el.content = content;
  document.head.appendChild(el);
  return el;
}

function contentOf(): string {
  return document.head.querySelector<HTMLMetaElement>('meta[name="viewport"]')!
    .content;
}

describe("parseViewportContent", () => {
  it("splits ordered key=value entries and normalizes key case", () => {
    expect(parseViewportContent("Width=device-width, initial-scale=1.0, foo")).toEqual([
      { key: "width", value: "device-width" },
      { key: "initial-scale", value: "1.0" },
      { key: "foo", value: null },
    ]);
  });

  it("drops empty segments", () => {
    expect(parseViewportContent("a=1,, b=2,")).toEqual([
      { key: "a", value: "1" },
      { key: "b", value: "2" },
    ]);
  });
});

describe("applyViewportPolicy", () => {
  beforeEach(() => {
    document.head.innerHTML = "";
  });

  afterEach(() => {
    document.head.innerHTML = "";
  });

  it("strips zoom blockers and keeps other keys", () => {
    metaEl(
      "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover",
    );
    const res = applyViewportPolicy();
    expect(res.removed).toEqual(["maximum-scale=1.0", "user-scalable=no"]);
    expect(res.content).toBe(
      "width=device-width, initial-scale=1.0, viewport-fit=cover, user-scalable=yes",
    );
  });

  it("creates the meta when missing", () => {
    const res = applyViewportPolicy();
    expect(res.meta.name).toBe("viewport");
    expect(res.content).toBe("width=device-width, user-scalable=yes");
    expect(res.removed).toEqual([]);
  });

  it("adds width=device-width when width is absent", () => {
    metaEl("initial-scale=1");
    expect(applyViewportPolicy().content).toBe(
      "width=device-width, initial-scale=1, user-scalable=yes",
    );
  });

  it("is idempotent across re-runs", () => {
    metaEl("width=device-width, user-scalable=no, viewport-fit=cover");
    const first = applyViewportPolicy().content;
    const second = applyViewportPolicy().content;
    expect(first).toBe(second);
    expect(first).toBe("width=device-width, viewport-fit=cover, user-scalable=yes");
  });

  it("pins minimum-scale when allowZoomOut is requested", () => {
    metaEl("width=device-width, initial-scale=1");
    const res = applyViewportPolicy({ allowZoomOut: true });
    expect(res.content).toBe(
      "width=device-width, initial-scale=1, user-scalable=yes, minimum-scale=0.25",
    );
  });

  it("clamps a numeric allowZoomOut into (0, 1]", () => {
    metaEl("width=device-width");
    expect(applyViewportPolicy({ allowZoomOut: 2 }).content).toBe(
      "width=device-width, user-scalable=yes, minimum-scale=1",
    );
    expect(applyViewportPolicy({ allowZoomOut: 0 }).content).toBe(
      "width=device-width, user-scalable=yes, minimum-scale=0.05",
    );
  });

  it("keeps a permissive minimum-scale when zoom-out is not requested", () => {
    metaEl("width=device-width, minimum-scale=0.5");
    expect(applyViewportPolicy().content).toBe(
      "width=device-width, minimum-scale=0.5, user-scalable=yes",
    );
  });

  it("drops a blocking minimum-scale=1 when zoom-out is not requested", () => {
    metaEl("width=device-width, minimum-scale=1");
    const res = applyViewportPolicy();
    expect(res.removed).toContain("minimum-scale=1");
    expect(res.content).not.toContain("minimum-scale");
  });

  it("leaves zoom keys untouched when allowZoom is false", () => {
    metaEl("width=device-width, user-scalable=no");
    const res = applyViewportPolicy({ allowZoom: false });
    expect(res.removed).toEqual([]);
    expect(res.content).toBe("width=device-width, user-scalable=no");
  });

  it("preserves unknown vendor keys", () => {
    metaEl("width=device-width, interactive-widget=resizes-content, maximum-scale=1");
    expect(applyViewportPolicy().content).toBe(
      "width=device-width, interactive-widget=resizes-content, user-scalable=yes",
    );
  });

  it("reuses the existing meta element instead of duplicating it", () => {
    const existing = metaEl("width=device-width");
    const res = applyViewportPolicy();
    expect(res.meta).toBe(existing);
    expect(document.head.querySelectorAll('meta[name="viewport"]').length).toBe(1);
  });
});
