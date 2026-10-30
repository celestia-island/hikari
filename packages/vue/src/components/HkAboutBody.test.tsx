import { afterEach, describe, expect, it } from "vitest";
import { createApp, defineComponent, h, nextTick } from "vue";

import { HkAboutBody } from "./HkAboutModal";

/**
 * HkAboutBody contract tests for the extraction wave (2026-10-29): the
 * body is the modal's whole layout mountable OUTSIDE a modal — the desktop
 * settings' About pane renders it directly, and a second hand-copied body
 * is exactly how the credits links drifted. These tests pin the two
 * body-level knobs the modal never needed:
 * - `filingsAsChips` renders the legal filings as their own chip group
 *   (`data-slot="filings"`) and NO bare footer-links row
 * - default (modal) behavior keeps the bare footer-links row and no filings
 *   group
 * - the default slot appends host content after the copyright footer
 * - without a backdrop factory no backdrop layer renders (a body host may
 *   not want the decorative canvas at all)
 * - a version row's `metaTone: "danger"` reaches the pill as
 *   `data-tone="danger"`, and an EMPTY `value` drops the mono number cell
 *   entirely (the "component not wired up" row shows only its red label)
 *
 * (Repo test convention: raw createApp + document queries, no
 * @vue/test-utils dependency.)
 */

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

function mountBody(props: Record<string, unknown> = {}, slot?: () => unknown): void {
  const container = document.createElement("div");
  document.body.appendChild(container);

  const Wrapper = defineComponent({
    setup() {
      return () =>
        h(HkAboutBody, { appName: "Test App", version: "1.2.3", ...props }, slot ? { default: slot } : undefined);
    },
  });
  const app = createApp(Wrapper);
  app.mount(container);
  mounts.push({ app, container });
}

function query<T extends Element>(selector: string): T {
  const el = document.body.querySelector<T>(selector);
  expect(el, `${selector} renders`).toBeTruthy();
  return el!;
}

async function flush() {
  await nextTick();
  await nextTick();
}

afterEach(() => {
  for (const { app, container } of mounts.splice(0)) {
    app.unmount();
    container.remove();
  }
});

const FILINGS = [
  { label: "苏ICP备2025155733号-2", href: "https://beian.miit.gov.cn/", face: "chip" as const },
];

describe("HkAboutBody extraction", () => {
  it("mounts the full body outside a modal", async () => {
    mountBody({
      tagline: "Chat with your AI agents",
      credits: [
        { text: "来自 " },
        { name: "Celestia Island", href: "https://celestia.world", face: "accent" },
        { text: "，由 " },
        { name: "伊欧", href: "https://github.com/langyo", face: "accent" },
        { text: " 主创" },
      ],
      componentVersions: [{ label: "WebUI 版本", value: "0.1.0 master:abc1234" }],
    });
    await flush();

    expect(query(".s-about-modal")).toBeTruthy();
    // No HModal shell around it: no dialog surface, no overlay.
    expect(document.body.querySelector(".hk-modal")).toBeNull();
    expect(query(".s-about-modal-name").textContent).toContain("Test App");
    expect(document.body.querySelectorAll(".s-about-modal-credit-link")).toHaveLength(2);
    expect(query(".s-about-modal-row-number").textContent).toContain("master:abc1234");
  });

  it("filingsAsChips renders the filings group and no footer-links row", async () => {
    mountBody({ footerLinks: FILINGS, filingsAsChips: true });
    await flush();

    const group = query('.s-about-modal-links[data-slot="filings"]');
    const link = group.querySelector<HTMLAnchorElement>(".s-about-modal-link");
    expect(link?.getAttribute("data-face")).toBe("chip");
    expect(link?.getAttribute("href")).toBe("https://beian.miit.gov.cn/");
    // The bare row is the modal face; chips mode must not render both.
    expect(document.body.querySelector(".s-about-modal-footer-links")).toBeNull();
  });

  it("default filings keep the bare footer-links row with no group", async () => {
    mountBody({ footerLinks: [{ label: "ICP", href: "https://beian.miit.gov.cn/" }] });
    await flush();

    expect(query(".s-about-modal-footer-links")).toBeTruthy();
    expect(document.body.querySelector('.s-about-modal-links[data-slot="filings"]')).toBeNull();
  });

  it("appends default-slot content after the copyright footer", async () => {
    mountBody({}, () => h("button", { class: "body-slot-row" }, "Check update"));
    await flush();

    const body = query(".s-about-modal-body");
    const footer = body.querySelector(".s-about-modal-footer")!;
    const button = body.querySelector(".body-slot-row")!;
    expect(button).toBeTruthy();
    // After the footer in document order: the slot rides at the body's end.
    expect(footer.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("renders no backdrop layer when the host passes no factory", async () => {
    mountBody();
    await flush();

    expect(document.body.querySelector(".s-about-modal-backdrop")).toBeNull();
  });

  it("tints a version row's meta pill with the danger tone", async () => {
    mountBody({
      componentVersions: [
        { label: "Edge engine", value: "1.4.0", meta: "Not connected", metaTone: "danger" },
      ],
    });
    await flush();

    const pill = query(".s-about-modal-row-meta");
    expect(pill.getAttribute("data-tone")).toBe("danger");
    expect(pill.textContent).toBe("Not connected");
  });

  it("drops the mono number cell when a row's value is empty", async () => {
    mountBody({
      componentVersions: [
        // A host with nothing to report names the state in `meta` and leaves
        // `value` empty (the "not wired up" row).
        { label: "Edge engine", value: "", meta: "Not connected", metaTone: "danger" },
      ],
    });
    await flush();

    // No blank tabular slot: the mono cell is absent, not just empty.
    expect(document.body.querySelector(".s-about-modal-row-number")).toBeNull();
    // The label and the pill still carry the row.
    expect(query(".s-about-modal-row-label").textContent).toContain("Edge engine");
    const pill = query(".s-about-modal-row-meta");
    expect(pill.textContent).toBe("Not connected");
    expect(pill.getAttribute("data-tone")).toBe("danger");
  });
});
