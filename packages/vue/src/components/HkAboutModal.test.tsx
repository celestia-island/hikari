import { afterEach, describe, expect, it } from "vitest";
import { createApp, defineComponent, h, nextTick, ref } from "vue";

import { HkAboutModal } from "./HkAboutModal";
import { setLocale } from "../i18n/context";

/**
 * HkAboutModal contract tests for the branding wave:
 * - the first-letter tile is the default identity and `logoSrc` swaps it
 *   for an image
 * - tagline / description / author / license / copyright render the given
 *   strings, authorHref turns the author value into an external link
 * - the backdrop factory renders inside the clipped backdrop layer
 * - links render as external chips
 * - author / license labels resolve through the i18n bundles
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

  it("renders the made-by sentence with a linked author name", async () => {
    mountAbout({
      madeByPrefix: "由",
      madeByName: "伊欧",
      madeByNameHref: "https://github.com/langyo",
      madeBySuffix: " 主创，来自 Celestia Island",
    });
    await flushModal();
    const line = query<HTMLElement>(".s-about-modal-made-by");
    expect(line.textContent).toBe("由伊欧 主创，来自 Celestia Island");
    const link = query<HTMLAnchorElement>(".s-about-modal-row-link");
    expect(link.textContent).toBe("伊欧");
    expect(link.getAttribute("href")).toBe("https://github.com/langyo");
    expect(link.getAttribute("target")).toBe("_blank");
  });

  it("renders the made-by sentence without a link when no href", async () => {
    mountAbout({ madeByPrefix: "由", madeByName: "伊欧", madeBySuffix: " 主创" });
    await flushModal();
    expect(query<HTMLElement>(".s-about-modal-made-by").textContent).toBe("由伊欧 主创");
    expect(document.body.querySelector(".s-about-modal-row-link")).toBeNull();
  });

  it("renders software-component version rows", async () => {
    mountAbout({
      componentVersions: [
        { label: "WebUI 版本", value: "0.1.138 REW2HF 生产" },
        { label: "计算引擎版本", value: "0.1.0" },
      ],
    });
    await flushModal();
    const rows = [...document.body.querySelectorAll<HTMLElement>(".s-about-modal-row")];
    expect(rows.length).toBe(2);
    expect(rows[0]!.textContent).toContain("WebUI 版本");
    expect(rows[0]!.textContent).toContain("0.1.138 REW2HF 生产");
    expect(rows[1]!.textContent).toContain("计算引擎版本");
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
    expect(document.body.querySelector(".s-about-modal-made-by")).toBeNull();
    expect(document.body.querySelector(".s-about-modal-links")).toBeNull();
  });
});
