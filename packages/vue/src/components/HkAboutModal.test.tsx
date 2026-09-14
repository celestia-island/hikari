import { afterEach, describe, expect, it } from "vitest";
import { createApp, defineComponent, h, nextTick, ref } from "vue";

import { HkAboutModal } from "./HkAboutModal";
import { setLocale } from "../i18n/context";

/**
 * HkAboutModal contract tests for the branding + redesign waves:
 * - the first-letter tile is the default identity and `logoSrc` swaps it
 *   for an image inside the identity frame
 * - version and tagline share one subtitle line
 * - the credits sentence assembles text runs and linked name chips, and a
 *   name without an href stays plain text
 * - description / license / copyright render the given strings
 * - component rows split the machine value from an optional meta pill
 * - the backdrop factory renders inside the clipped backdrop layer
 * - licenses and links render as chips under one centered block
 * - footer (filing) links render as external links
 * - `face: "plain"` / `face: "accent"` turn any of them into a bare text
 *   link (still a link,
 *   still a new tab), and an entry carrying an `icon` renders the mark, with
 *   an accessible name when it has no label to be named by
 *
 * (Repo test convention: raw createApp + document queries, no
 * @vue/test-utils dependency.)
 */

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

interface AboutHarness {
  open: ReturnType<typeof ref<boolean>>;
  unmount: () => void;
}

function mountAbout(props: Record<string, unknown> = {}): AboutHarness {
  const container = document.createElement("div");
  document.body.appendChild(container);

  const open = ref(true);
  const Wrapper = defineComponent({
    setup() {
      return () =>
        h(HkAboutModal, {
          appName: "Test App",
          version: "1.2.3",
          ...props,
          modelValue: open.value,
          "onUpdate:modelValue": (v: boolean) => {
            open.value = v;
          },
        });
    },
  });
  const app = createApp(Wrapper);
  app.mount(container);
  mounts.push({ app, container });
  return { open, unmount: () => app.unmount() };
}

function query<T extends Element>(selector: string): T {
  const el = document.body.querySelector<T>(selector);
  expect(el, `${selector} renders`).toBeTruthy();
  return el!;
}

async function flushModal() {
  await nextTick();
  await nextTick();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

afterEach(() => {
  for (const { app, container } of mounts.splice(0)) {
    app.unmount();
    container.remove();
  }
  setLocale("en");
});

describe("HkAboutModal branding", () => {
  it("renders the first-letter tile when no logoSrc is given", async () => {
    mountAbout();
    await flushModal();
    const tile = query<HTMLElement>(".s-about-modal-logo");
    expect(tile.textContent?.trim()).toBe("T");
    expect(document.body.querySelector(".s-about-modal-logo-img")).toBeNull();
  });

  it("renders the logo image when logoSrc is given", async () => {
    mountAbout({ logoSrc: "data:image/webp;base64,AAA" });
    await flushModal();
    const img = query<HTMLImageElement>("img.s-about-modal-logo-img");
    expect(img.getAttribute("src")).toBe("data:image/webp;base64,AAA");
    expect(document.body.querySelector(".s-about-modal-logo")).toBeNull();
  });

  it("renders tagline and description strings", async () => {
    mountAbout({ tagline: "Chat with your agents", description: "Save the world." });
    await flushModal();
    expect(query<HTMLElement>(".s-about-modal-tagline").textContent).toBe("Chat with your agents");
    expect(query<HTMLElement>(".s-about-modal-description").textContent).toBe("Save the world.");
  });

  it("renders the credits sentence with linked name chips", async () => {
    mountAbout({
      credits: [
        { text: "来自 " },
        { name: "Celestia Island", href: "https://github.com/celestia-island" },
        { text: "，由 " },
        { name: "伊欧", href: "https://github.com/langyo" },
        { text: " 主创" },
      ],
    });
    await flushModal();
    const line = query<HTMLElement>(".s-about-modal-credits-line");
    expect(line.textContent).toBe("来自 Celestia Island，由 伊欧 主创");
    const chips = [
      ...document.body.querySelectorAll<HTMLAnchorElement>(".s-about-modal-credit-link"),
    ];
    expect(chips.map((chip) => chip.textContent)).toEqual(["Celestia Island", "伊欧"]);
    // Every link in the dialog opens in a new tab; the chip is the default
    // face, so an entry that asks for nothing keeps the tag.
    for (const chip of chips) {
      expect(chip.classList.contains("s-about-modal-link")).toBe(true);
      expect(chip.getAttribute("data-face")).toBe("chip");
      expect(chip.getAttribute("target")).toBe("_blank");
      expect(chip.getAttribute("rel")).toContain("noopener");
    }
    expect(chips[0]!.getAttribute("href")).toBe("https://github.com/celestia-island");
  });

  it("renders a credit name as a plain text link when the entry asks for it", async () => {
    mountAbout({
      credits: [
        { text: "来自 " },
        { name: "Celestia Island", href: "https://github.com/celestia-island", face: "plain" },
        { text: "，由 " },
        { name: "伊欧", href: "https://github.com/langyo", face: "plain" },
        { text: " 主创" },
      ],
    });
    await flushModal();
    // The names stay inside the sentence — same text, same flow, no frame.
    expect(query<HTMLElement>(".s-about-modal-credits-line").textContent).toBe(
      "来自 Celestia Island，由 伊欧 主创",
    );
    const links = [
      ...document.body.querySelectorAll<HTMLAnchorElement>(".s-about-modal-credit-link"),
    ];
    expect(links.map((link) => link.textContent)).toEqual(["Celestia Island", "伊欧"]);
    for (const link of links) {
      expect(link.getAttribute("data-face")).toBe("plain");
      expect(link.classList.contains("s-about-modal-link")).toBe(true);
      expect(link.getAttribute("target")).toBe("_blank");
      // A text link is named by its own text — no redundant aria-label.
      expect(link.getAttribute("aria-label")).toBeNull();
    }
  });

  it("renders a credit name as a tinted accent link when the entry asks for it", async () => {
    mountAbout({
      credits: [
        { text: "来自 " },
        { name: "Celestia Island", href: "https://github.com/celestia-island", face: "accent" },
        { text: "，由 " },
        { name: "伊欧", href: "https://github.com/langyo", face: "accent" },
        { text: " 主创" },
      ],
    });
    await flushModal();
    const links = [
      ...document.body.querySelectorAll<HTMLAnchorElement>(".s-about-modal-credit-link"),
    ];
    // Same bare-text shape as `plain` (no chip geometry), but the entry's
    // face reaches the stylesheet as `accent`.
    expect(links.map((link) => link.textContent)).toEqual(["Celestia Island", "伊欧"]);
    for (const link of links) {
      expect(link.getAttribute("data-face")).toBe("accent");
      expect(link.classList.contains("s-about-modal-link")).toBe(true);
      expect(link.getAttribute("target")).toBe("_blank");
      expect(link.getAttribute("aria-label")).toBeNull();
    }
  });

  it("renders plain faces across the link rows and the legal filings", async () => {
    mountAbout({
      links: [
        { label: "celestia.world", href: "https://celestia.world", face: "plain" },
        { label: "celestia.ac.cn", href: "https://celestia.ac.cn", face: "plain" },
      ],
      footerLinks: [
        { label: "苏ICP备2025155733号-2", href: "https://beian.miit.gov.cn/", face: "plain" },
      ],
    });
    await flushModal();
    const links = [
      ...document.body.querySelectorAll<HTMLAnchorElement>(
        ".s-about-modal-links-list .s-about-modal-link",
      ),
    ];
    expect(links.map((link) => link.textContent)).toEqual(["celestia.world", "celestia.ac.cn"]);
    expect(links.map((link) => link.getAttribute("data-face"))).toEqual(["plain", "plain"]);
    expect(
      query<HTMLElement>(".s-about-modal-footer-link").getAttribute("data-face"),
    ).toBe("plain");
  });

  it("renders an icon-only link with an accessible name beside the text links", async () => {
    mountAbout({
      links: [
        { label: "celestia.world", href: "https://celestia.world", face: "plain" },
        {
          icon: "github",
          href: "https://github.com/celestia-island/shittim-chest",
          face: "plain",
          ariaLabel: "GitHub",
        },
      ],
    });
    await flushModal();
    const links = [
      ...document.body.querySelectorAll<HTMLAnchorElement>(
        ".s-about-modal-links-list .s-about-modal-link",
      ),
    ];
    expect(links.length).toBe(2);
    const mark = links[1]!;
    expect(mark.textContent).toBe("");
    expect(mark.classList.contains("s-about-modal-link-has-icon")).toBe(true);
    expect(mark.getAttribute("aria-label")).toBe("GitHub");
    expect(mark.getAttribute("href")).toBe("https://github.com/celestia-island/shittim-chest");
    expect(mark.getAttribute("target")).toBe("_blank");
    expect(mark.querySelector(".s-about-modal-link-icon svg")).toBeTruthy();
    // …and it is the GitHub mark, not just any glyph.
    expect(
      mark
        .querySelector(".s-about-modal-link-icon svg")!
        .classList.contains("lucide-github-icon"),
    ).toBe(true);
    // The mark is decoration: it must not join the link's accessible name.
    expect(
      mark.querySelector(".s-about-modal-link-icon")!.getAttribute("aria-hidden"),
    ).toBe("true");
    // The text link next to it stays text: no mark, no extra naming.
    expect(links[0]!.querySelector("svg")).toBeNull();
    expect(links[0]!.getAttribute("aria-label")).toBeNull();
  });

  it("names an icon-only link from the icon when none is given", async () => {
    mountAbout({ links: [{ icon: "github", href: "https://example.test/repo", face: "plain" }] });
    await flushModal();
    const mark = query<HTMLElement>(".s-about-modal-link");
    expect(mark.getAttribute("aria-label")).toBe("GitHub");
    expect(mark.getAttribute("data-face")).toBe("plain");
  });

  it("lets a host name a text link explicitly", async () => {
    mountAbout({
      links: [
        {
          label: "celestia.world",
          href: "https://celestia.world",
          ariaLabel: "Celestia World 官网",
        },
      ],
    });
    await flushModal();
    // An explicit name outranks the visible text (and the visible text stays).
    const link = query<HTMLAnchorElement>(".s-about-modal-link");
    expect(link.getAttribute("aria-label")).toBe("Celestia World 官网");
    expect(link.textContent).toBe("celestia.world");
  });

  it("drops a link entry with neither a label nor an icon", async () => {
    mountAbout({
      links: [
        { label: "celestia.world", href: "https://celestia.world", face: "plain" },
        // No text and no mark: an invisible but focusable link named by its
        // raw URL is worse than no link.
        { href: "https://example.test/blank" },
      ],
    });
    await flushModal();
    const links = [
      ...document.body.querySelectorAll<HTMLAnchorElement>(
        ".s-about-modal-links-list .s-about-modal-link",
      ),
    ];
    expect(links.map((link) => link.textContent)).toEqual(["celestia.world"]);
    expect(document.body.textContent).not.toContain("example.test/blank");
  });

  it("renders no link row when every entry is empty", async () => {
    mountAbout({ links: [{ href: "https://example.test/blank" }] });
    await flushModal();
    expect(document.body.querySelector(".s-about-modal-links")).toBeNull();
  });

  it("drops an empty legal entry too", async () => {
    mountAbout({
      footerLinks: [
        { label: "苏ICP备2025155733号-2", href: "https://beian.miit.gov.cn/" },
        { href: "https://example.test/blank-filing" },
      ],
    });
    await flushModal();
    const links = [
      ...document.body.querySelectorAll<HTMLAnchorElement>(".s-about-modal-footer-link"),
    ];
    expect(links.map((link) => link.textContent)).toEqual(["苏ICP备2025155733号-2"]);
    expect(document.body.textContent).not.toContain("example.test/blank-filing");
  });

  it("renders no legal row when every filing is empty", async () => {
    mountAbout({ footerLinks: [{ href: "https://example.test/blank-filing" }] });
    await flushModal();
    expect(document.body.querySelector(".s-about-modal-footer-links")).toBeNull();
  });

  it("keeps a credit name as plain text when no href is given", async () => {
    mountAbout({ credits: [{ text: "由 " }, { name: "伊欧" }, { text: " 主创" }] });
    await flushModal();
    expect(query<HTMLElement>(".s-about-modal-credits-line").textContent).toBe("由 伊欧 主创");
    expect(query<HTMLElement>(".s-about-modal-credit-name").textContent).toBe("伊欧");
    expect(document.body.querySelector(".s-about-modal-credit-link")).toBeNull();
  });

  it("skips empty credit parts", async () => {
    mountAbout({ credits: [{ text: "" }, { name: "" }, { text: "仅此一句。" }] });
    await flushModal();
    expect(query<HTMLElement>(".s-about-modal-credits-line").textContent).toBe("仅此一句。");
  });

  it("renders software-component version rows with a meta pill and tone", async () => {
    mountAbout({
      componentVersions: [
        { label: "WebUI 版本", value: "0.1.138 REW2HF", meta: "生产", metaTone: "positive" },
        { label: "计算引擎版本", value: "0.1.0" },
      ],
    });
    await flushModal();
    const rows = [...document.body.querySelectorAll<HTMLElement>(".s-about-modal-row")];
    expect(rows.length).toBe(2);
    expect(rows[0]!.textContent).toContain("WebUI 版本");
    // The number and the environment word are separate nodes: the value
    // stays machine-readable, the tag carries the typography.
    const number = query<HTMLElement>(".s-about-modal-row-number");
    expect(number.textContent).toBe("0.1.138 REW2HF");
    const meta = query<HTMLElement>(".s-about-modal-row-meta");
    expect(meta.textContent).toBe("生产");
    expect(meta.getAttribute("data-tone")).toBe("positive");
    // The second row has no meta, so it renders no pill.
    expect(rows[1]!.querySelector(".s-about-modal-row-meta")).toBeNull();
  });

  it("defaults the meta pill to the neutral tone", async () => {
    mountAbout({
      componentVersions: [{ label: "计算引擎版本", value: "0.1.0", meta: "测试" }],
    });
    await flushModal();
    expect(query<HTMLElement>(".s-about-modal-row-meta").getAttribute("data-tone")).toBe(
      "neutral",
    );
  });

  it("carries the caution tone through to the pill", async () => {
    mountAbout({
      componentVersions: [
        { label: "云模型调度引擎版本", value: "0.1.26", meta: "预发", metaTone: "caution" },
      ],
    });
    await flushModal();
    expect(query<HTMLElement>(".s-about-modal-row-meta").getAttribute("data-tone")).toBe(
      "caution",
    );
  });

  it("renders centered license chips", async () => {
    mountAbout({
      licenses: [
        { label: "SySL-1.0", href: "https://github.com/celestia-island/hikari/blob/master/LICENSE" },
        { label: "BUSL-1.1", href: "https://github.com/celestia-island/shittim-chest/blob/master/LICENSE" },
      ],
    });
    await flushModal();
    const chips = [...document.body.querySelectorAll<HTMLAnchorElement>(".s-about-modal-link")];
    expect(chips.map((chip) => chip.textContent)).toEqual(["SySL-1.0", "BUSL-1.1"]);
    for (const chip of chips) expect(chip.getAttribute("target")).toBe("_blank");
  });

  it("renders centered legal footer links", async () => {
    mountAbout({
      footerLinks: [{ label: "京ICP备2026xxxx号", href: "https://beian.miit.gov.cn/" }],
    });
    await flushModal();
    const links = [
      ...document.body.querySelectorAll<HTMLAnchorElement>(".s-about-modal-footer-link"),
    ];
    expect(links.length).toBe(1);
    expect(links[0]!.textContent).toBe("京ICP备2026xxxx号");
    expect(links[0]!.getAttribute("href")).toBe("https://beian.miit.gov.cn/");
  });

  it("renders the backdrop factory inside the clipped layer", async () => {
    mountAbout({ backdrop: () => h("div", { class: "test-backdrop-marker" }) });
    await flushModal();
    const layer = query<HTMLElement>(".s-about-modal-backdrop");
    expect(layer.getAttribute("aria-hidden")).toBe("true");
    expect(layer.querySelector(".test-backdrop-marker")).toBeTruthy();
  });

  it("renders links as external chips", async () => {
    mountAbout({
      links: [
        { label: "celestia.world", href: "https://celestia.world" },
        { label: "celestia.ac.cn", href: "https://celestia.ac.cn" },
      ],
    });
    await flushModal();
    const chips = [
      ...document.body.querySelectorAll<HTMLAnchorElement>(".s-about-modal-link"),
    ];
    expect(chips.map((chip) => chip.textContent)).toEqual(["celestia.world", "celestia.ac.cn"]);
    for (const chip of chips) {
      expect(chip.getAttribute("target")).toBe("_blank");
      expect(chip.getAttribute("rel")).toContain("noopener");
    }
  });

  it("honors the copyright override and defaults to the app name", async () => {
    const year = String(new Date().getFullYear());
    const harness = mountAbout({ copyright: "Celestia Island" });
    await flushModal();
    let badge = query<HTMLElement>(".s-about-modal-footer");
    expect(badge.textContent).toContain(`© ${year} Celestia Island`);
    harness.unmount();
    await flushModal();

    mountAbout();
    await flushModal();
    badge = query<HTMLElement>(".s-about-modal-footer");
    expect(badge.textContent).toContain(`© ${year} Test App`);
  });

  it("renders no branding rows when no branding props are given", async () => {
    mountAbout();
    await flushModal();
    expect(document.body.querySelectorAll(".s-about-modal-row").length).toBe(0);
    expect(document.body.querySelector(".s-about-modal-credits-line")).toBeNull();
    expect(document.body.querySelector(".s-about-modal-links")).toBeNull();
    expect(document.body.querySelector(".s-about-modal-chips")).toBeNull();
    expect(document.body.querySelector(".s-about-modal-credits")).toBeNull();
  });

  it("groups license and link chips under one centered chips block", async () => {
    mountAbout({
      licenses: [{ label: "SySL-1.0", href: "https://example.test/sysl" }],
      links: [{ label: "celestia.world", href: "https://celestia.world" }],
    });
    await flushModal();
    const chips = query<HTMLElement>(".s-about-modal-chips");
    const slots = [...chips.querySelectorAll<HTMLElement>(".s-about-modal-links")].map((el) =>
      el.getAttribute("data-slot"),
    );
    expect(slots).toEqual(["licenses", "links"]);
    expect(
      [...chips.querySelectorAll<HTMLAnchorElement>(".s-about-modal-link")].map(
        (chip) => chip.textContent,
      ),
    ).toEqual(["SySL-1.0", "celestia.world"]);
  });

  it("frames the logo image inside the identity frame", async () => {
    mountAbout({ logoSrc: "data:image/webp;base64,AAA" });
    await flushModal();
    const frame = query<HTMLElement>(".s-about-modal-logo-frame");
    expect(frame.querySelector("img.s-about-modal-logo-img")).toBeTruthy();
  });

  it("keeps version and tagline on one subtitle line", async () => {
    mountAbout({ version: "9.9.9", tagline: "Chat with your agents" });
    await flushModal();
    const subtitle = query<HTMLElement>(".s-about-modal-subtitle");
    expect(subtitle.querySelector(".s-about-modal-version")?.textContent).toContain("9.9.9");
    expect(subtitle.querySelector(".s-about-modal-tagline")?.textContent).toBe(
      "Chat with your agents",
    );
    expect(subtitle.querySelector(".s-about-modal-subtitle-sep")).toBeTruthy();
  });
});
