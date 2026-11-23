import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick, ref } from "vue";

import HkAuthSsoButton from "./HkAuthSsoButton";
import HkAuthScreen from "./HkAuthScreen";
import HkLoginFlow, { type HkLoginChannel } from "./HkLoginFlow";
import { hkMfaVerifySubtitle, hkMfaVerifyTitle } from "./HkMfaVerifyCard";

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

  it("renders alternative method rows and forwards their selection", async () => {
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
    const row = c.querySelector<HTMLButtonElement>('[data-key="feishu"]');
    expect(row).not.toBeNull();
    expect(row!.getAttribute("aria-label")).toBe("Feishu");
    expect(c.querySelector(".hk-auth-channel-divider")?.textContent).toContain("或");
    row!.click();
    await nextTick();
    expect(onSelect).toHaveBeenCalledWith("cloud", "feishu");
  });

  it("omits the whole methods block when the list is empty", () => {
    const c = mount(h(HkLoginFlow, { channels: [cloudChannel], modelValue: "cloud" }));
    // An empty methods list must not pad a dead strip under the form
    // (the operative pin is the channel list's absence — the retired
    // tile wrapper's absence is not observable here, R2).
    expect(c.querySelector(".hk-auth-channel-list")).toBeNull();
    expect(c.querySelector(".hk-auth-channel-divider")).toBeNull();
  });
});

describe("HkLoginFlow — sso channel", () => {
  it("renders the channel's destination row and emits sso-click", async () => {
    const onClick = vi.fn();
    const c = mount(
      h(HkLoginFlow, {
        channels: [orgChannel],
        modelValue: "org",
        onSsoClick: onClick,
      }),
    );
    // The 2026-11 list form: the destination renders as a standard
    // channel row (icon left, name right) — not a square tile.
    const row = c.querySelector<HTMLButtonElement>(".hk-auth-channel-row");
    expect(row).not.toBeNull();
    // No buttonLabel on the fixture → the conventional channel label.
    expect(row!.getAttribute("aria-label")).toBe("Organization login");
    row!.click();
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
    expect(c.querySelector(".hk-auth-channel-row")).not.toBeNull();
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

  it("morphs account → verify → back when the host flips the step prop reactively", async () => {
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
    // The account generation comes back. Scope the assertion to the
    // OUTER tier's DIRECT stage items (the step container inside the one
    // card frame) — the union of every crossfade item in the subtree is
    // unfalsifiable (the inner items ride inside the settled account
    // item, so a stuck-outer mutation can never turn this red; the
    // forward leg's OTP-presence check carries the teeth for that
    // mutation).
    // MUT:r1487-outer-key-channel (R7 M1: keying the outer container on
    // the channel makes `dataset.crossfadeKey` read "account:cloud" here
    // and this assertion goes red).
    const outerSettled = Array.from(
      c.querySelectorAll(
        ".hk-login-flow-anchor > .s-auth-card > .hk-tc > .hk-tc-stage > .hk-crossfade"
          + " > .hk-crossfade-item"
          + ":not(.hk-crossfade-leave-active):not(.hk-crossfade-leave-to)",
      ),
    );
    expect(outerSettled.length).toBe(1);
    expect((outerSettled[0] as HTMLElement).dataset.crossfadeKey).toBe("account");
    expect(outerSettled[0]!.querySelector('input[name="signin-username"]')).not.toBeNull();
    expect(outerSettled[0]!.querySelector(".hk-otp-cell")).toBeNull();
  });
});

describe("HkLoginFlow — stable shell channel swap (2026-11-24 user direction)", () => {  // "Switching the top segment group only crossfades the content below
  // it and morphs the height — use the library's existing component, do
  // not destroy the whole card." The pins below are ELEMENT-IDENTITY
  // assertions: if the shell (or the tabs, or the header) remounts on a
  // channel switch, the captured element nodes go stale and the test
  // fails — the exact regression the direction forbids.

  function mountTwoChannel(channel: "cloud" | "org") {
    const active = ref<"cloud" | "org">(channel);
    const Host = defineComponent({
      setup: () => () =>
        h(HkLoginFlow, {
          channels: [cloudChannel, orgChannel],
          modelValue: active.value,
          title: "Sign in",
          subtitle: "Console",
          "onUpdate:modelValue": (key: string) => {
            active.value = key as "cloud" | "org";
          },
        }),
    });
    return { container: mount(h(Host)), active };
  }

  it("keeps the shell, header and tabs mounted while only the body swaps", async () => {
    const { container, active } = mountTwoChannel("cloud");
    const tabsBefore = container.querySelector(".hk-tabs");
    const titleBefore = container.querySelector(".s-auth-title");
    const logoSlotBefore = container.querySelector(".s-auth-header");
    // The card frame itself is per-PANEL, not per-channel or per-step: it
    // owns the entrance animation, so a remount would replay it.
    const frameBefore = container.querySelector(".s-auth-card");
    expect(tabsBefore).not.toBeNull();
    expect(titleBefore?.textContent).toBe("Sign in");
    // Exactly ONE card — the shell. A silently-ignored `bare` mode
    // (HkSignInCard wrapping its own card inside the shell) shows up
    // as a second .s-auth-card / .s-auth-form here.
    // MUT:r1487-bare-ignored (deleting HkSignInCard's bare return
    // makes this count 2 and the nested selector non-null).
    expect(container.querySelectorAll(".s-auth-card")).toHaveLength(1);
    expect(container.querySelector(".s-auth-card .s-auth-card")).toBeNull();
    expect(container.querySelectorAll(".s-auth-form")).toHaveLength(1);
    // The flow owns the frame, so HkAuthCard's own smooth-height wrapper
    // must NOT be in the tree at all: the transition container owns the
    // height choreography, and a measuring wrapper would chain its 300ms
    // transition after the container's (a telescoping double-morph).
    // MUT:r1487-shell-double-morph (rendering HkAuthCard as the shell
    // again — e.g. reverting to the per-step card — puts
    // `.s-auth-card-height` back and turns this red).
    expect(container.querySelector(".s-auth-card-height")).toBeNull();

    active.value = "org";
    for (let i = 0; i < 12; i++) await nextTick();

    // SAME DOM NODES — the shell never dissolved.
    expect(container.querySelector(".s-auth-card")).toBe(frameBefore);
    expect(container.querySelector(".hk-tabs")).toBe(tabsBefore);
    expect(container.querySelector(".s-auth-title")).toBe(titleBefore);
    expect(container.querySelector(".s-auth-header")).toBe(logoSlotBefore);
    // The tabs sit ABOVE the swapped region — outside the inner
    // container's own class (a tabs-inside-the-body shape would
    // dissolve the switch itself; the tabs are necessarily inside the
    // OUTER tier, so the inner tier's class is the discriminator).
    // MUT:r1487-tabs-inside-body (moving tabsEl() into the inner
    // container gives the tabs a .hk-login-flow-body ancestor — this
    // fails).
    expect(tabsBefore!.closest(".hk-login-flow-body")).toBeNull();
    // The swapped region carries the org body (the sso row list), and
    // it lives BELOW the tabs inside the shell card.
    const shellCard = container.querySelector(".s-auth-card")!;
    const ssoBlock = container.querySelector(".hk-login-flow-sso");
    expect(ssoBlock).not.toBeNull();
    expect(shellCard.contains(ssoBlock!)).toBe(true);
    // The inner crossfade is keyed on the CHANNEL; the outer tier stayed
    // on the account generation (the shell item's key never changed).
    // MUT:r1487-inner-key-fixed (R7 M6: pinning the inner swapKey to a
    // constant leaves no item carrying data-crossfade-key="org" and
    // this assertion goes red).
    const innerItems = container.querySelectorAll(
      ".hk-tc .hk-tc .hk-crossfade-item",
    );
    expect(innerItems.length).toBeGreaterThan(0);
    expect(
      Array.from(innerItems).some(
        (el) => (el as HTMLElement).dataset.crossfadeKey === "org",
      ),
    ).toBe(true);
  });

  it("swaps the credentials body back without losing the typed tab state", async () => {
    const { container, active } = mountTwoChannel("org");
    active.value = "cloud";
    for (let i = 0; i < 12; i++) await nextTick();
    // The INNER container's settled item is the cloud body (the outer
    // account item contains the leaving inner org item too — scope the
    // assertion to the inner tier, the only thing that swapped).
    const innerSettled = Array.from(
      container.querySelectorAll(
        ".hk-tc .hk-tc .hk-crossfade-item:not(.hk-crossfade-leave-active):not(.hk-crossfade-leave-to)",
      ),
    );
    expect(innerSettled.length).toBe(1);
    expect((innerSettled[0] as HTMLElement).dataset.crossfadeKey).toBe("cloud");
    expect(innerSettled[0]!.querySelector('input[name="signin-username"]')).not.toBeNull();
    expect(innerSettled[0]!.querySelector(".hk-login-flow-sso")).toBeNull();
  });

  it("blurs a field focused inside the leaving body on a channel switch", async () => {
    // The anti-strobe cover HkStepFlow's dropFlowFocus used to provide
    // (chest round-22 field report: a focused field re-anchors the
    // Android autofill panel on every layout beat). The TAB button
    // keeps its focus — the blur scope is the swapped body only.
    const { container, active } = mountTwoChannel("cloud");
    const input = container.querySelector<HTMLInputElement>(
      'input[name="signin-username"]',
    )!;
    input.focus();
    expect(document.activeElement).toBe(input);
    active.value = "org";
    await nextTick();
    // MUT:r1487-focus-strobe (dropping the blur watch leaves the
    // dissolved field focused — the autofill strobe regression).
    expect(document.activeElement).not.toBe(input);

    // The exempt half: an activated TAB TRIGGER keeps focus across the
    // switch (keyboard a11y — the blur scope must not fold to the whole
    // flow).
    // MUT:r1487-blur-scope-fold (widening the scope to .hk-login-flow
    // blurs the trigger here and this goes red).
    active.value = "cloud";
    await nextTick();
    await new Promise((r) => setTimeout(r, 30));
    const trigger = container.querySelectorAll<HTMLButtonElement>(
      ".hk-tabs-trigger",
    )[0]!;
    trigger.focus();
    expect(document.activeElement).toBe(trigger);
    active.value = "org";
    await nextTick();
    expect(document.activeElement).toBe(trigger);
  });

  it("extends the :has rhythm collapse to the bare fragment's descendant blocks (styles pin)", () => {
    // The stable shell's bare fragment renders the methods/footer
    // blocks as DESCENDANTS of the shell's .s-auth-form — the sibling
    // `:has(+ …)` rules cannot see them, so the descendant variants
    // carry the same collapsed bottom padding (without them the form's
    // full 24px bottom padding stacks onto the footer's top margin).
    // MUT:r1487-rhythm-descendant (reverting to sibling-only rules
    // makes this match empty).
    const here = dirname(fileURLToPath(import.meta.url));
    const scss = readFileSync(join(here, "../styles/admin-tokens.scss"), "utf-8");
    const methods = scss.match(/\.s-auth-form:has\(\.s-auth-methods\)\s*,\s*\.s-auth-form:has\(\.s-auth-footer\)\s*{[^}]*}/)?.[0] ?? "";
    expect(methods, "descendant :has collapse rule must exist").toBeTruthy();
    expect(methods).toContain("padding-bottom: var(--space-8, 0.5rem)");
  });

  it("renders no footer band when the host passed no footer slot (flow-level dead-space guard)", () => {
    // The flow's own footer-slot existence guard (mirroring the card's
    // methods/footer rules): an unconditional lambda would make the
    // bare fragment render an empty padded .s-auth-footer band under
    // every channel body.
    // MUT:r1487-flow-footer-dead-space (forwarding the footer lambda
    // unconditionally renders the empty band here).
    const c = mount(h(HkLoginFlow, {
      channels: [cloudChannel],
      modelValue: "cloud",
    }));
    expect(c.querySelector(".s-auth-footer")).toBeNull();
    // The default username icon lane survives the bare fragment (the
    // fallback <User> mark rides the field unless a channel overrides).
    // MUT:r1487-icon-fallback-drop (dropping the else branch leaves
    // the field icon-less).
    expect(c.querySelector(".s-auth-card-field-icon")).not.toBeNull();
  });

  it("flows the per-channel fallback title through the stable shell header", async () => {
    // Without a flow-level title the ACTIVE channel's title supplies
    // the header copy (single-channel hosts unchanged); switching then
    // updates the text in place — the header node itself stays mounted.
    const active = ref<"cloud" | "org">("cloud");
    const Host = defineComponent({
      setup: () => () =>
        h(HkLoginFlow, {
          channels: [
            cloudChannel,
            { key: "org", mode: "sso", icon: h("svg"), title: "Organization access" },
          ],
          modelValue: active.value,
          "onUpdate:modelValue": () => {},
        }),
    });
    const container = mount(h(Host));
    const titleEl = container.querySelector(".s-auth-title")!;
    expect(titleEl.textContent).toContain("Sign in");
    active.value = "org";
    for (let i = 0; i < 12; i++) await nextTick();
    expect(container.querySelector(".s-auth-title")).toBe(titleEl);
    expect(titleEl.textContent).toContain("Organization access");
  });
});

describe("HkLoginFlow — in-card step swap (2026-11-24 user direction)", () => {  // "Where the content can change inside the card, do not let the whole
  // card fly." The account→verify move used to swap TWO whole cards: each
  // generation was its own `HkAuthCard`, so the frame dissolved, its
  // entrance keyframes replayed on the fresh node, and the height morph
  // re-centred the panel in the host (the reported "the card flies up").
  // The pins below are ELEMENT-IDENTITY assertions on the frame.

  function mountStepHost(options: {
    accountName?: string;
    proven?: string;
    factors?: string[];
  } = {}) {
    const step = ref<"account" | "verify">("account");
    const Host = defineComponent({
      setup: () => () =>
        h(HkLoginFlow, {
          channels: [cloudChannel],
          modelValue: "cloud",
          step: step.value,
          verifyFactors: options.factors ?? ["password"],
          verifyAccountName: options.accountName ?? "demiurge",
          verifyProven: options.proven,
        }),
    });
    return { container: mount(h(Host)), step };
  }

  it("keeps ONE card frame across account → verify → account", async () => {
    const { container, step } = mountStepHost();
    const frame = container.querySelector(".s-auth-card");
    expect(frame).not.toBeNull();

    // The frame is the ANCESTOR of the step tier — a per-generation card
    // would sit INSIDE the tier instead (the shape before this change).
    // MUT:step-swap-two-cards (rendering HkAuthCard per generation moves
    // the card below this container and this goes red).
    const stepTier = frame!.querySelector(":scope > .hk-tc");
    expect(stepTier).not.toBeNull();

    step.value = "verify";
    // ONE tick in, i.e. MID-dissolve: both generations are mounted, so a
    // per-generation frame would already read two cards here. The frame
    // node itself must survive (it owns the entrance keyframes, which is
    // what the user saw replay as the card flying out and back in).
    // MUT:step-swap-two-cards (a second `.s-auth-card` appears at this
    // instant and both assertions go red).
    await nextTick();
    expect(container.querySelectorAll(".s-auth-card")).toHaveLength(1);
    expect(container.querySelector(".s-auth-card")).toBe(frame);
    for (let i = 0; i < 12; i++) await nextTick();
    expect(container.querySelector(".s-auth-card")).toBe(frame);
    expect(container.querySelectorAll(".s-auth-card")).toHaveLength(1);

    step.value = "account";
    for (let i = 0; i < 12; i++) await nextTick();
    expect(container.querySelector(".s-auth-card")).toBe(frame);
  });

  it("renames the header inside that frame and renders the bare step-up body", async () => {
    const { container, step } = mountStepHost({ factors: ["totp"] });

    const titleBefore = container.querySelector(".s-auth-title");
    expect(titleBefore?.textContent).toBe("Sign in");
    expect(container.querySelector(".s-mfa-factors")).toBeNull();

    step.value = "verify";
    for (let i = 0; i < 12; i++) await nextTick();

    // Scope to the ENTERING generation: jsdom fires no transitionend,
    // so the leaving account generation is still in the DOM during the
    // dissolve (the same convention the reactive `morphs …` test uses).
    const verifyGen = container.querySelector(
      '.hk-crossfade-item[data-crossfade-key="verify"]',
    ) as HTMLElement | null;
    expect(verifyGen).not.toBeNull();

    // The header copy is INSIDE the swap (it must rename), while the
    // header BLOCK still belongs to the one frame.
    expect(verifyGen!.querySelector(".s-auth-title")?.textContent)
      .toBe("Verify account");
    expect(verifyGen!.querySelector(".s-auth-subtitle")?.textContent)
      .toContain("demiurge");

    // The step-up body is the MFA card's BARE fragment: the frame's own
    // `.s-auth-form` block hosts it, so there is no second card, no
    // second header block and no HkAuthCard measuring wrapper.
    // MUT:step-swap-mfa-shell (dropping `bare` renders HkAuthCard inside
    // the frame: a nested .s-auth-card / .s-auth-header and a
    // .s-auth-card-height all appear inside this generation — the
    // assertions below go red).
    expect(verifyGen!.querySelectorAll(".s-auth-form")).toHaveLength(1);
    expect(verifyGen!.querySelector(".s-auth-card")).toBeNull();
    expect(verifyGen!.querySelectorAll(".s-auth-header")).toHaveLength(1);
    expect(verifyGen!.querySelector(".s-auth-card-height")).toBeNull();
    expect(verifyGen!.querySelector(".s-mfa-factors")).not.toBeNull();
    // The announced factor (totp here) drives the body inside the frame —
    // the bare fragment is live, not a header-only stub.
    expect(verifyGen!.querySelectorAll(".hk-otp-cell")).toHaveLength(6);
  });

  it("keeps the step-up copy derivable by the host (the card's own vocabulary)", () => {
    // One derivation, two renderers: the flow's header and the card body
    // must name the step identically. A second copy of these strings is
    // how the header and the body drift apart across locales.
    // MUT:step2-copy-inline (inlining the step-two wording in the flow
    // instead of calling the helper leaves this helper's output — and
    // the header — stale).
    expect(hkMfaVerifyTitle((key: string, fallback?: string) => fallback ?? key)).toBe("Verify account");
    expect(
      hkMfaVerifyTitle((key: string, fallback?: string) => fallback ?? key, { proven: "password" }),
    ).toBe("One more verification");
    expect(
      hkMfaVerifySubtitle((key: string, fallback?: string) => fallback ?? key, {
        accountName: "demiurge",
      }),
    ).toBe("Verifying demiurge — complete a sign-in method to continue");
    expect(
      hkMfaVerifySubtitle((key: string, fallback?: string) => fallback ?? key, {
        accountName: "demiurge",
        proven: "password",
      }),
    ).toBe("Account password passed — choose one more method to finish signing in to demiurge");
  });

  it("blurs a field focused inside the LEAVING body on a step swap", async () => {
    // The user's real sequence: type the name, click 登录. The focused
    // field is inside the generation that is about to be marked inert, so
    // the flow blurs it BEFORE the dissolve (HkCrossfade's own note: a
    // control focused in the leaving item is blurred when inert lands,
    // and the autofill panel chases every layout beat until it does).
    // MUT:step-swap-no-blur (dropping props.step from the watch leaves
    // the field focused and this goes red).
    const { container, step } = mountStepHost();
    const input = container.querySelector<HTMLInputElement>(
      'input[name="signin-username"]',
    )!;
    input.focus();
    expect(document.activeElement).toBe(input);
    step.value = "verify";
    await nextTick();
    expect(document.activeElement).not.toBe(input);
  });

  it("marks the verify body as the swapped region, and never the tabs", async () => {
    // `hk-login-flow-body` is the blur scope: it must match the swapped
    // body of whichever generation is on stage. The account generation's
    // is the inner channel container (the tabs stay outside it); the
    // verify generation's is its form block (no tabs there at all).
    // MUT:verify-body-unscoped (dropping the class from the verify form
    // block leaves a focused proof field inside the leaving body on the
    // verify→account leg and this goes red).
    const { container, step } = mountStepHost({ factors: ["totp"] });
    const accountBody = container.querySelector(".hk-login-flow-body");
    expect(accountBody).not.toBeNull();
    expect(accountBody!.querySelector(".hk-tabs")).toBeNull();

    step.value = "verify";
    for (let i = 0; i < 12; i++) await nextTick();
    const verifyGen = container.querySelector(
      '.hk-crossfade-item[data-crossfade-key="verify"]',
    ) as HTMLElement;
    const verifyBody = verifyGen.querySelector(".hk-login-flow-body");
    expect(verifyBody).not.toBeNull();
    expect(verifyBody!.querySelectorAll(".hk-otp-cell").length).toBe(6);
  });

  it("hands the caret to the entering step-up action for a passkey account", async () => {
    // A passkey-only account has no input: the card's autofocus must
    // still land somewhere, or the step swap drops the caret on <body>.
    // MUT:passkey-focus-drop (reverting focusStage to the password-only
    // branch leaves activeElement === body and this goes red).
    const { container, step } = mountStepHost({ factors: ["passkey"] });
    step.value = "verify";
    for (let i = 0; i < 12; i++) await nextTick();
    await new Promise((r) => setTimeout(r, 20));
    const verifyGen = container.querySelector(
      '.hk-crossfade-item[data-crossfade-key="verify"]',
    ) as HTMLElement;
    const action = verifyGen.querySelector<HTMLButtonElement>(".hk-btn-primary")!;
    expect(document.activeElement).toBe(action);
  });

  it("lets a host brand the verify header without touching the account copy", async () => {
    // The flow-level `title`/`subtitle` are the ACCOUNT header contract;
    // the verify step has its own overrides, and leaving them undefined
    // keeps the step-up vocabulary (the card's own wording).
    // MUT:verify-header-props-dropped (not forwarding verifyTitle /
    // verifySubtitle leaves the default title here and this goes red).
    const branded = mount(
      h(HkLoginFlow, {
        channels: [cloudChannel],
        modelValue: "cloud",
        step: "verify",
        verifyFactors: ["totp"],
        title: "Sign in to Acme",
        verifyTitle: "Confirm it's you",
        verifySubtitle: "Acme keeps your account safe",
      }),
    );
    expect(branded.querySelector(".s-auth-title")?.textContent)
      .toBe("Confirm it's you");
    expect(branded.querySelector(".s-auth-subtitle")?.textContent)
      .toBe("Acme keeps your account safe");
  });

  it("anchors the card's top edge on a growing frame (structural pin)", async () => {
    const { container } = mountStepHost();
    // The anchor wrapper is the element useAnchoredTop owns: a centered
    // host re-centres the frame on every height change, and without the
    // wrapper there is no element to paint back onto the resting top.
    // MUT:step-swap-unguarded (dropping the wrapper / the hook puts the
    // frame straight under .hk-login-flow — this goes red).
    const anchor = container.querySelector(".hk-login-flow-anchor");
    expect(anchor).not.toBeNull();
    expect(anchor!.querySelector(":scope > .s-auth-card")).not.toBeNull();
    expect(container.querySelector(".hk-login-flow > .s-auth-card")).toBeNull();
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
