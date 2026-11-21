import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick, ref } from "vue";

import HkAuthSsoButton from "./HkAuthSsoButton";
import HkAuthScreen from "./HkAuthScreen";
import HkLoginFlow, { type HkLoginChannel } from "./HkLoginFlow";

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

const cloudChannel: HkLoginChannel = {
  key: "cloud",
  mode: "credentials",
};
const orgChannel: HkLoginChannel = {
  key: "org",
  mode: "sso",
  icon: h("svg"),
};

describe("HkAuthSsoButton", () => {
  it("renders the provider label under a framed square tile and emits on click", async () => {
    const onClick = vi.fn();
    const c = mount(h(HkAuthSsoButton, { label: "Celestia 账号", icon: h("svg"), onClick }));
    const tile = c.querySelector<HTMLButtonElement>(".hk-auth-sso-tile");
    expect(tile).not.toBeNull();
    expect(tile!.getAttribute("aria-label")).toBe("Celestia 账号");
    expect(c.querySelector(".hk-auth-sso-label")?.textContent).toBe("Celestia 账号");
    tile!.click();
    await nextTick();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("stays inert while disabled or loading", async () => {
    const onClick = vi.fn();
    const c = mount(h(HkAuthSsoButton, { label: "Feishu", disabled: true, onClick }));
    const tile = c.querySelector<HTMLButtonElement>(".hk-auth-sso-tile")!;
    expect((tile as HTMLButtonElement).disabled).toBe(true);
    tile.click();
    await nextTick();
    expect(onClick).not.toHaveBeenCalled();
  });

  it("falls back to the label's initial without an icon", () => {
    const c = mount(h(HkAuthSsoButton, { label: "demo" }));
    expect(c.querySelector(".hk-auth-sso-icon")?.textContent).toContain("D");
  });
});

describe("HkLoginFlow — channel segment group", () => {
  it("renders the pill segment group for two channels with the conventional locale labels", () => {
    const c = mount(
      h(HkLoginFlow, {
        channels: [cloudChannel, orgChannel],
        modelValue: "cloud",
        "onUpdate:modelValue": () => {},
      }),
    );
    // The segment labels are the PANEL's own locale keys — never a
    // server-provided provider name (chest 2026-09-30 direction).
    const tabs = c.querySelectorAll(".hk-tabs-trigger");
    expect(tabs.length).toBe(2);
    expect(tabs[0]!.textContent).toContain("Celestia Cloud");
    expect(tabs[1]!.textContent).toContain("Organization login");
  });

  it("hides the segment group entirely for a single channel", () => {
    const c = mount(h(HkLoginFlow, { channels: [cloudChannel], modelValue: "cloud" }));
    expect(c.querySelector(".hk-tabs")).toBeNull();
  });

  it("emits update:modelValue when a segment is picked", async () => {
    const onUpdate = vi.fn();
    const c = mount(
      h(HkLoginFlow, {
        channels: [cloudChannel, orgChannel],
        modelValue: "cloud",
        "onUpdate:modelValue": onUpdate,
      }),
    );
    const tabs = c.querySelectorAll<HTMLButtonElement>(".hk-tabs-trigger");
    tabs[1]!.click();
    await nextTick();
    expect(onUpdate).toHaveBeenCalledWith("org");
  });
});

describe("HkLoginFlow — credentials channel", () => {
  it("is account-first by default: NO password field on the opening card", () => {
    const c = mount(h(HkLoginFlow, { channels: [cloudChannel], modelValue: "cloud" }));
    const passwordInput = c.querySelector<HTMLInputElement>('input[name="signin-password"]');
    // The family-wide posture since the MFA redesign: the password is
    // proven on the verify step, so the opening card never asks for it.
    expect(passwordInput).toBeNull();
    expect(c.querySelector('input[name="signin-username"]')).not.toBeNull();
  });

  it("keeps the classic two-field card behind passwordField: true", () => {
    const c = mount(
      h(HkLoginFlow, {
        channels: [{ key: "cloud", mode: "credentials", passwordField: true }],
        modelValue: "cloud",
      }),
    );
    expect(c.querySelector('input[name="signin-password"]')).not.toBeNull();
  });

  it("emits account-submit with the channel key and the typed username", async () => {
    const onSubmit = vi.fn();
    const c = mount(
      h(HkLoginFlow, {
        channels: [cloudChannel],
        modelValue: "cloud",
        onAccountSubmit: onSubmit,
      }),
    );
    const input = c.querySelector<HTMLInputElement>('input[name="signin-username"]')!;
    input.value = "demiurge";
    input.dispatchEvent(new Event("input"));
    await nextTick();
    const form = c.querySelector("form")!;
    form.dispatchEvent(new Event("submit"));
    await nextTick();
    expect(onSubmit).toHaveBeenCalledWith("cloud", "demiurge", "");
  });

  it("renders alternative method tiles and forwards their selection", async () => {
    const onSelect = vi.fn();
    const channel: HkLoginChannel = {
      key: "cloud",
      mode: "credentials",
      methods: [{ key: "feishu", label: "Feishu" }],
      methodsDivider: "或",
    };
    const c = mount(
      h(HkLoginFlow, {
        channels: [channel],
        modelValue: "cloud",
        onMethodSelect: onSelect,
      }),
    );
    const tile = c.querySelector<HTMLButtonElement>('[data-key="feishu"]');
    expect(tile).not.toBeNull();
    expect(c.querySelector(".s-auth-methods-divider")?.textContent).toContain("或");
    tile!.click();
    await nextTick();
    expect(onSelect).toHaveBeenCalledWith("cloud", "feishu");
  });

  it("omits the whole methods block when the list is empty", () => {
    const c = mount(h(HkLoginFlow, { channels: [cloudChannel], modelValue: "cloud" }));
    // An empty methods list must not pad a dead strip under the form.
    expect(c.querySelector(".s-auth-methods")).toBeNull();
    expect(c.querySelector(".s-auth-methods-divider")).toBeNull();
  });
});

describe("HkLoginFlow — sso channel", () => {
  it("renders one centered primary tile and emits sso-click", async () => {
    const onClick = vi.fn();
    const c = mount(
      h(HkLoginFlow, {
        channels: [orgChannel],
        modelValue: "org",
        onSsoClick: onClick,
      }),
    );
    const tile = c.querySelector<HTMLButtonElement>(".hk-auth-sso-tile");
    expect(tile).not.toBeNull();
    tile!.click();
    await nextTick();
    expect(onClick).toHaveBeenCalledWith("org");
  });

  it("does not enter the verify step on an sso channel (fail-safe)", () => {
    const c = mount(
      h(HkLoginFlow, {
        channels: [orgChannel],
        modelValue: "org",
        step: "verify",
        verifyFactors: ["totp"],
      }),
    );
    // A redirect flow has no second step by construction; the panel
    // keeps showing the account card instead of a dead MFA card.
    expect(c.querySelector(".hk-auth-sso-tile")).not.toBeNull();
  });
});

describe("HkLoginFlow — verify step", () => {
  it("slides to the MFA card and forwards the verify event with the composed proof", async () => {
    const onVerify = vi.fn();
    const c = mount(
      h(HkLoginFlow, {
        channels: [cloudChannel],
        modelValue: "cloud",
        step: "verify",
        verifyFactors: ["totp"],
        verifyAccountName: "demiurge",
        onVerify,
      }),
    );
    await nextTick();
    const cells = Array.from(c.querySelectorAll<HTMLInputElement>(".hk-otp-cell"));
    expect(cells.length).toBe(6);
    // Compose the 6-digit code cell by cell (the OTP input owns one
    // character per cell), then submit through the primary button.
    cells.forEach((cell, i) => {
      cell.value = String(i);
      cell.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await nextTick();
    const submit = c.querySelector<HTMLButtonElement>(".hk-btn-primary")!;
    submit.click();
    await nextTick();
    expect(onVerify).toHaveBeenCalledWith("totp", "012345");
  });

  it("forwards the resend and back events from the MFA card", async () => {
    const onResend = vi.fn();
    const onBack = vi.fn();
    const c = mount(
      h(HkLoginFlow, {
        channels: [cloudChannel],
        modelValue: "cloud",
        step: "verify",
        verifyFactors: ["sms"],
        onVerifyResend: onResend,
        onVerifyBack: onBack,
      }),
    );
    await nextTick();
    const resend = Array.from(c.querySelectorAll("button")).find((b) =>
      b.textContent?.toLowerCase().includes("resend"));
    expect(resend).toBeTruthy();
    resend!.click();
    await nextTick();
    expect(onResend).toHaveBeenCalledTimes(1);
    const back = Array.from(c.querySelectorAll("button")).find((b) =>
      b.textContent?.toLowerCase().includes("back"));
    expect(back).toBeTruthy();
    back!.click();
    await nextTick();
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("re-exposes the MFA card's clearProof, focusPassword and selectedFactor handles", async () => {
    const c = mount(
      h(HkLoginFlow, {
        channels: [cloudChannel],
        modelValue: "cloud",
        step: "verify",
        verifyFactors: ["totp"],
      }),
    );
    await nextTick();
    const cells = Array.from(c.querySelectorAll<HTMLInputElement>(".hk-otp-cell"));
    cells.forEach((cell, i) => {
      cell.value = String(i);
      cell.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await nextTick();
    // The handles live on the flow's root component instance — all three
    // the documented host contract for the verify step.
    const flowRoot = c.querySelector(".hk-login-flow") as HTMLElement & {
      __vueParentComponent?: {
        exposed: {
          clearProof: () => void;
          focusPassword: () => void;
          selectedFactor: () => unknown;
        } | null;
      };
    };
    const exposed = flowRoot.__vueParentComponent?.exposed;
    expect(typeof exposed?.clearProof).toBe("function");
    expect(typeof exposed?.focusPassword).toBe("function");
    expect(typeof exposed?.selectedFactor).toBe("function");
    // selectedFactor reports the factor on stage (totp is the default
    // pick of the ladder); clearProof empties the composed code.
    expect(exposed!.selectedFactor()).toBe("totp");
    exposed!.clearProof();
    await nextTick();
    expect(cells.every((cell) => cell.value === "")).toBe(true);
  });

  it("renders the top and below slots around the panel body", () => {
    const c = mount(
      h(HkLoginFlow, { channels: [cloudChannel], modelValue: "cloud" }, {
        top: () => h("div", { class: "banner" }, "banner"),
        below: () => h("div", { class: "signup" }, "signup"),
      }),
    );
    expect(c.querySelector(".banner")).not.toBeNull();
    expect(c.querySelector(".signup")).not.toBeNull();
    // top renders ABOVE the card body, below UNDER it.
    const root = c.querySelector(".hk-login-flow")!;
    expect(root.firstElementChild?.className).toContain("banner");
    expect(root.lastElementChild?.className).toContain("signup");
  });

  it("keeps the channel segment group off the verify step", () => {
    const c = mount(
      h(HkLoginFlow, {
        channels: [cloudChannel, orgChannel],
        modelValue: "cloud",
        step: "verify",
        verifyFactors: ["totp"],
      }),
    );
    // The verify step owns the whole card; a channel switch mid-verify
    // would drop the ladder state, so the tabs never render here.
    expect(c.querySelector(".hk-tabs")).toBeNull();
  });

  it("slides account → verify → back when the host flips the step prop reactively", async () => {
    // The host mirrors every real consumer: reactive state read INSIDE
    // the render function, so each change re-evaluates the props. (A
    // one-shot `h()` snapshot VNode never updates — re-mounting such a
    // probe "shows" a dead verify step that no real host exhibits; this
    // regression test pins the actual contract after that false alarm.)
    const step = ref<"account" | "verify">("account");
    const Host = defineComponent({
      setup: () => () =>
        h(HkLoginFlow, {
          channels: [cloudChannel],
          modelValue: "cloud",
          step: step.value,
          verifyFactors: ["totp"],
        }),
    });
    const c = mount(h(Host));
    await nextTick();
    expect(c.querySelectorAll('input[name="signin-username"]').length).toBe(1);
    expect(c.querySelectorAll(".hk-otp-cell").length).toBe(0);

    step.value = "verify";
    for (let i = 0; i < 12; i++) await nextTick();
    // The verify body is on stage (the leaving account body may linger
    // in the DOM until the swap settles — jsdom fires no transitionend —
    // so assert on PRESENCE of the OTP cells, not absence of the card).
    expect(c.querySelectorAll(".hk-otp-cell").length).toBeGreaterThan(0);

    step.value = "account";
    for (let i = 0; i < 12; i++) await nextTick();
    // The account card comes back as a FRESH body: jsdom fires no
    // transitionend, so the leaving verify body lingers with its OTP
    // cells — asserting a bare username-input count would pass even if
    // the flip-back never happened (the leaving account input from the
    // entry leg also lingers). Pin the body that is NOT on its way
    // out: the username input inside a body without the leave class.
    const settledInput = c.querySelector(
      '.hk-stepflow-body:not(.hk-stepflow-leave-to) input[name="signin-username"]',
    );
    expect(settledInput).not.toBeNull();
    // And the OTP cells of the returning stage live only in a leaving
    // body — the settled stage carries none.
    expect(
      c.querySelectorAll('.hk-stepflow-body:not(.hk-stepflow-leave-to) .hk-otp-cell').length,
    ).toBe(0);
  });
});

describe("HkLoginFlow — host wiring details", () => {
  it("falls back to the first channel when modelValue matches nothing", () => {
    const c = mount(
      h(HkLoginFlow, {
        channels: [cloudChannel, orgChannel],
        modelValue: "ghost",
        "onUpdate:modelValue": () => {},
      }),
    );
    // No phantom selection: the first channel's card renders and the
    // segment group stays coherent (first tab selected).
    expect(c.querySelector('input[name="signin-username"]')).not.toBeNull();
    const active = c.querySelector('.hk-tabs-trigger[aria-selected="true"]');
    expect(active?.textContent).toContain("Celestia Cloud");
  });

  it("keeps one channel's account name out of another channel's field", () => {
    // The per-channel seed override: the org (email) channel pins "" so
    // the cloud channel's typed account name — seeded flow-level for the
    // verify round-trip — never pre-fills the org email field. Both
    // postures mounted statically (the channel swap's crossfade settles
    // on environment-dependent timing; the MOUNT-TIME seed is the
    // contract under test).
    const orgMount = mount(
      h(HkLoginFlow, {
        channels: [
          { key: "cloud", mode: "credentials" },
          { key: "org", mode: "credentials", usernameType: "email", usernameAutocomplete: "email", initialUsername: "" },
        ],
        modelValue: "org",
        initialUsername: "cloud-user",
      }),
    );
    expect(
      orgMount.querySelector<HTMLInputElement>('input[name="signin-username"]')?.value,
    ).toBe("");

    const cloudMount = mount(
      h(HkLoginFlow, {
        channels: [
          { key: "cloud", mode: "credentials" },
          { key: "org", mode: "credentials", usernameType: "email", usernameAutocomplete: "email", initialUsername: "" },
        ],
        modelValue: "cloud",
        initialUsername: "cloud-user",
      }),
    );
    expect(
      cloudMount.querySelector<HTMLInputElement>('input[name="signin-username"]')?.value,
    ).toBe("cloud-user");
  });

  it("forwards per-channel autocomplete tokens to the username field", () => {
    const c = mount(
      h(HkLoginFlow, {
        channels: [
          { key: "org", mode: "credentials", usernameType: "email", usernameAutocomplete: "email" },
        ],
        modelValue: "org",
      }),
    );
    const input = c.querySelector<HTMLInputElement>('input[name="signin-username"]')!;
    expect(input.getAttribute("autocomplete")).toBe("email");
    expect(input.getAttribute("type")).toBe("email");
  });
});

describe("HkAuthScreen", () => {
  it("renders header, centered stage and footer slots", () => {
    const c = mount(
      h(HkAuthScreen, null, {
        header: () => h("div", { class: "brand" }, "brand"),
        default: () => h("div", { class: "card" }, "card"),
        footer: () => h("div", { class: "legal" }, "legal"),
      }),
    );
    expect(c.querySelector(".hk-auth-screen-header .brand")).not.toBeNull();
    expect(c.querySelector(".hk-auth-screen-stage .card")).not.toBeNull();
    expect(c.querySelector(".hk-auth-screen-footer .legal")).not.toBeNull();
  });

  it("renders beian entries as new-tab links", () => {
    const c = mount(
      h(HkAuthScreen, {
        beian: [
          { title: "京ICP备00000000号-1", url: "https://beian.miit.gov.cn/" },
          { title: "plain line" },
        ],
      }),
    );
    const links = c.querySelectorAll<HTMLAnchorElement>(".hk-auth-screen-beian-link");
    expect(links.length).toBe(1);
    expect(links[0]!.getAttribute("href")).toBe("https://beian.miit.gov.cn/");
    expect(links[0]!.getAttribute("target")).toBe("_blank");
    expect(links[0]!.getAttribute("rel")).toContain("noopener");
    expect(c.querySelector(".hk-auth-screen-beian-item")?.textContent).toBe("plain line");
  });

  it("labels the beian nav only when beianAriaLabel is set", () => {
    const labelled = mount(
      h(HkAuthScreen, {
        beian: [{ title: "x" }],
        beianAriaLabel: "备案信息",
      }),
    );
    expect(labelled.querySelector(".hk-auth-screen-beian")?.getAttribute("aria-label")).toBe("备案信息");
    const unlabelled = mount(h(HkAuthScreen, { beian: [{ title: "x" }] }));
    expect(unlabelled.querySelector(".hk-auth-screen-beian")?.getAttribute("aria-label")).toBeNull();
  });

  it("renders no footer at all without footer content or beian entries", () => {
    const c = mount(h(HkAuthScreen, null, { default: () => h("div", "x") }));
    expect(c.querySelector(".hk-auth-screen-footer")).toBeNull();
    expect(c.querySelector(".hk-auth-screen-beian")).toBeNull();
  });
});
