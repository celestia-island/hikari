import { afterEach, describe, expect, it } from "vitest";
import { createApp, h } from "vue";

import { HkSectionCard } from "./HkSectionCard";

/**
 * HkSectionCard contract — the section-level chrome standard:
 * - the heading block carries the title and the hint (its ONLY place: the
 *   drift this component exists to end was one section printing its hint
 *   above the table and another below it)
 * - the body is ONE card: flush for tables (padded default false), padded
 *   when the body is not a table
 * - `error` replaces the body with an alert and `loading` with a spinner,
 *   both inside a PADDED card — a state is content, not a table
 * - the optional `actions` slot reaches the header (the heading row's
 *   trailing affordances), not the card
 *
 * (Repo test convention: raw createApp + document queries, no
 * @vue/test-utils.)
 */

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

afterEach(() => {
  while (mounts.length) {
    const { app, container } = mounts.pop()!;
    app.unmount();
    container.remove();
  }
});

function mountCard(props: Record<string, unknown>, slots: Record<string, () => unknown> = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({
    render: () => h(HkSectionCard, props as never, slots as never),
  });
  mounts.push({ app, container });
  app.mount(container);
  return container;
}

describe("HkSectionCard", () => {
  it("renders the title and the hint in the heading block, above the card", () => {
    const c = mountCard({ title: "Public domains", hint: "Where this instance is reachable." }, {
      default: () => h("table", { class: "body-table" }, h("tbody")),
    });
    const header = c.querySelector(".hk-section-header")!;
    expect(header.textContent).toContain("Public domains");
    expect(header.textContent).toContain("Where this instance is reachable.");
    // The hint belongs to the HEADER, never to the card body.
    const card = c.querySelector(".hk-card")!;
    expect(card.textContent).not.toContain("Where this instance is reachable.");
    expect(card.querySelector(".body-table")).not.toBeNull();
    // Header precedes the card in document order (the one rhythm).
    expect(header.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("keeps a table body flush in the card and pads a non-table body on request", () => {
    const flush = mountCard({ title: "T" }, { default: () => h("span", "row") });
    // HkCard spells "no padding" as a body modifier — the body carries the
    // padding decision, not the card shell.
    expect(flush.querySelector(".hk-card-body")!.className).toContain("hk-card-body-unpadded");
    const padded = mountCard({ title: "T", padded: true }, { default: () => h("span", "row") });
    // HkCard carries the padding itself — no caller wrapper.
    expect(padded.querySelector(".hk-card-body")!.className).not.toContain("hk-card-body-unpadded");
  });

  it("replaces the body with an alert on error, inside a padded card", () => {
    const c = mountCard({ title: "T", error: "boom" }, { default: () => h("span", "row") });
    expect(c.querySelector(".hk-alert")).not.toBeNull();
    expect(c.textContent).toContain("boom");
    expect(c.querySelector(".hk-card-body")!.className).not.toContain("hk-card-body-unpadded");
    expect(c.textContent).not.toContain("row");
  });

  it("replaces the body with a centred spinner while loading", () => {
    const c = mountCard({ title: "T", loading: true }, { default: () => h("span", "row") });
    expect(c.querySelector(".hk-spinner")).not.toBeNull();
    expect(c.querySelector(".hk-card-body")!.className).not.toContain("hk-card-body-unpadded");
    expect(c.textContent).not.toContain("row");
  });

  it("forwards the actions slot into the heading row", () => {
    const c = mountCard({ title: "T" }, { actions: () => h("button", { class: "hdr-act" }, "x") });
    expect(c.querySelector(".hk-section-header")!.querySelector(".hdr-act")).not.toBeNull();
    expect(c.querySelector(".hk-card")!.querySelector(".hdr-act")).toBeNull();
  });

  it("carries the count into the title and renders no hint paragraph when none is given", () => {
    const c = mountCard({ title: "T", count: "3" });
    expect(c.querySelector(".hk-section-header-count")!.textContent).toBe("3");
    expect(c.querySelector(".hk-section-header-description")).toBeNull();
  });
});
