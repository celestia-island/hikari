import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createApp, h } from "vue";

import HkCornerText from "./HkCornerText";

const sheet = readFileSync(resolve(__dirname, "HkCornerText.scss"), "utf8");

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

function mount(node: ReturnType<typeof h>) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({ render: () => node });
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

const items = [
  { key: "identity", text: "Celestia 统一登录系统" },
  { key: "icp", text: "苏ICP备2025155733号-2", href: "https://beian.miit.gov.cn/" },
];

describe("HkCornerText", () => {
  it("renders structured entries; href entries are real new-tab links, plain ones spans", () => {
    const c = mount(h(HkCornerText, { items }));
    const entries = c.querySelectorAll<HTMLElement>(".hk-corner-text-entry");
    expect(entries.length).toBe(2);
    expect(entries[0]!.tagName).toBe("SPAN");
    expect(entries[0]!.textContent).toBe("Celestia 统一登录系统");
    const link = entries[1] as HTMLAnchorElement;
    expect(link.tagName).toBe("A");
    // MUT:corner-link-noopener-dropped (dropping the rel lets the registry
    // site hold a handle on the auth page's window).
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    expect(link.getAttribute("target")).toBe("_blank");
    // MUT:corner-link-href-dropped (without the href the filing link goes
    // nowhere — middle-click and crawlers see no target).
    expect(link.getAttribute("href")).toBe("https://beian.miit.gov.cn/");
  });

  it("aligns to the corner: data-align carries start/center/end", () => {
    const c = mount(h(HkCornerText, { items, align: "center" }));
    expect(c.querySelector(".hk-corner-text")!.getAttribute("data-align")).toBe("center");
    const right = mount(h(HkCornerText, { items, align: "end" }));
    expect(right.querySelector(".hk-corner-text")!.getAttribute("data-align")).toBe("end");
    const left = mount(h(HkCornerText, { items }));
    expect(left.querySelector(".hk-corner-text")!.getAttribute("data-align")).toBe("start");
  });

  it("wraps BETWEEN entries and never inside one (the scss pins)", () => {
    // MUT:corner-nowrap-entry (dropping the entry `white-space: nowrap`
    // lets a filing number break mid-sequence and this pin goes red).
    expect(sheet).toMatch(/\.hk-corner-text\s*\{[^}]*flex-wrap:\s*wrap/);
    expect(sheet).toMatch(/\.hk-corner-text-entry\s*\{[^}]*white-space:\s*nowrap/);
    // MUT:corner-align-pair (decoupling justify-content from text-align
    // leaves wrapped rows drifting off the corner edge and these pins
    // go red).
    expect(sheet).toMatch(/&\[data-align="center"\]\s*\{[^}]*justify-content:\s*center[^}]*text-align:\s*center/);
    expect(sheet).toMatch(/&\[data-align="end"\]\s*\{[^}]*justify-content:\s*flex-end[^}]*text-align:\s*right/);
    expect(sheet).toMatch(/&\[data-align="start"\]\s*\{[^}]*justify-content:\s*flex-start[^}]*text-align:\s*left/);
  });

  it("is chrome-quiet by default; muted=false restores full ink", () => {
    const c = mount(h(HkCornerText, { items }));
    expect(c.querySelector(".hk-corner-text")!.getAttribute("data-muted")).toBe("true");
    const loud = mount(h(HkCornerText, { items, muted: false }));
    expect(loud.querySelector(".hk-corner-text")!.getAttribute("data-muted")).toBeNull();
    expect(sheet).toMatch(/&\[data-muted="true"\]\s*\{[^}]*opacity:\s*0\.6/);
  });

  it("combines structured entries with slot children (slot rides last)", () => {
    const c = mount(
      h(HkCornerText, { items: [items[1]!] }, { default: () => h("span", { class: "chip" }, "OK") }),
    );
    const children = Array.from(c.querySelector(".hk-corner-text")!.children);
    expect(children.length).toBe(2);
    expect(children[0]!.textContent).toBe("苏ICP备2025155733号-2");
    expect(children[1]!.classList.contains("chip")).toBe(true);
  });

  it("renders nothing when empty (the dead-space rule)", () => {
    const c = mount(h(HkCornerText, { items: [] }));
    expect(c.querySelector(".hk-corner-text")).toBeNull();
  });

  it("treats a slot that PAINTS nothing as empty (the dead-space rule reads children, not the slot)", () => {
    // A declared slot is always truthy, so `!slotContent` kept an
    // invisible `.hk-corner-text` box (and the corner's flex margins with
    // it) for every one of these shapes. The rule now walks the rendered
    // nodes; each arm below is a shape a host writes by accident.
    // MUT:corner-dead-space-slot-truthiness (restoring `!slotContent`
    // renders the box for all of these and this goes red).
    const emptyShapes: Array<[string, () => unknown]> = [
      ["empty array", () => []],
      ["nulls only", () => [null, null]],
      ["false", () => false],
      ["empty string", () => ""],
      ["whitespace only", () => "   "],
      ["nested null array", () => [null]],
    ];
    for (const [label, slot] of emptyShapes) {
      const c = mount(h(HkCornerText, { items: [] }, { default: slot as never }));
      expect(c.querySelector(".hk-corner-text"), `slot shape "${label}" must not paint a lane`).toBeNull();
    }
  });

  it("keeps the lane for slot children that DO paint (zero and text are content)", () => {
    // The counterpart arm: the new check must not swallow real content.
    // MUT:corner-dead-space-overreach (treating numbers as empty or
    // dropping text nodes hides these lanes).
    const zero = mount(h(HkCornerText, { items: [] }, { default: () => 0 }));
    expect(zero.querySelector(".hk-corner-text")?.textContent).toBe("0");
    const text = mount(h(HkCornerText, { items: [] }, { default: () => "苏ICP备" }));
    expect(text.querySelector(".hk-corner-text")?.textContent).toBe("苏ICP备");
    const nested = mount(h(HkCornerText, { items: [] }, { default: () => [[h("i", { class: "deep" }, "x")]] }));
    expect(nested.querySelector(".hk-corner-text .deep")).not.toBeNull();
  });

  it("as=nav marks a link lane as a labeled landmark; div stays unlabeled", () => {
    const c = mount(h(HkCornerText, { items, as: "nav", ariaLabel: "备案" }));
    const nav = c.querySelector("nav.hk-corner-text")!;
    expect(nav).not.toBeNull();
    expect(nav.getAttribute("aria-label")).toBe("备案");
    const plain = mount(h(HkCornerText, { items }));
    const div = plain.querySelector("div.hk-corner-text")!;
    expect(div.tagName).toBe("DIV");
    expect(div.getAttribute("aria-label")).toBeNull();
  });
});
