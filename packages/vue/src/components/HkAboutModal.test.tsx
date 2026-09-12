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

  it("renders author and license rows with an linked author", async () => {
    mountAbout({
      author: "Celestia Island",
      authorHref: "https://github.com/celestia-island",
      license: "BUSL-1.1",
    });
    await flushModal();
    const link = query<HTMLAnchorElement>(".s-about-modal-row-link");
    expect(link.textContent).toBe("Celestia Island");
    expect(link.getAttribute("href")).toBe("https://github.com/celestia-island");
    expect(link.getAttribute("target")).toBe("_blank");
    const rows = [...document.body.querySelectorAll<HTMLElement>(".s-about-modal-row")];
    const licenseRow = rows.find((row) => row.textContent?.includes("BUSL-1.1"));
    expect(licenseRow, "license row renders").toBeTruthy();
    expect(licenseRow!.textContent).toContain("License");
  });

  it("renders the author row as plain text without authorHref", async () => {
    mountAbout({ author: "Celestia Island" });
    await flushModal();
    expect(query<HTMLElement>(".s-about-modal-row").textContent).toContain("Celestia Island");
    expect(document.body.querySelector(".s-about-modal-row-link")).toBeNull();
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

  it("localizes the author and license labels", async () => {
    mountAbout({ author: "Celestia Island", license: "BUSL-1.1" });
    await flushModal();
    const rows = () => [
      ...document.body.querySelectorAll<HTMLElement>(".s-about-modal-row-label"),
    ];

    setLocale("zh-Hans");
    await flushModal();
    let text = rows().map((el) => el.textContent);
    expect(text.some((t) => t === "作者")).toBe(true);
    expect(text.some((t) => t === "许可证")).toBe(true);

    setLocale("en");
    await flushModal();
    text = rows().map((el) => el.textContent);
    expect(text.some((t) => t === "Author")).toBe(true);
    expect(text.some((t) => t === "License")).toBe(true);
  });
});
