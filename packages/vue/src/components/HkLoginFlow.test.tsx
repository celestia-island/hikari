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

/** The crossfade generation with `key` (see HkTransitionContainer's
 *  `enteringItem`): during a swap both generations are in the DOM, so a
 *  whole-tree query reads whichever one renders first. */
function within(container: HTMLElement, key: string): HTMLElement {
  const item = Array.from(
    container.querySelectorAll<HTMLElement>(".hk-crossfade-item"),
  ).find((el) => el.dataset.crossfadeKey === key);
  expect(item, `no crossfade generation keyed ${key}`).toBeTruthy();
  return item!;
}

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

  it("never renders alternative rows under the credentials card (2026-11-26 grammar)", () => {
    // The divider + rows-under-the-form facility is GONE: every non-primary
    // entrance is its own channel and the segment group is the only
    // switcher (see hkLoginPlanFromDiscovery — providers map to channels).
    const c = mount(h(HkLoginFlow, { channels: [cloudChannel], modelValue: "cloud" }));
    // MUT:login-methods-rows-return (re-adding a methods block under the
    // credentials card reintroduces the banned divider shape and goes red).
    expect(c.querySelector(".hk-auth-channel-list")).toBeNull();
    expect(c.querySelector(".hk-auth-channel-divider")).toBeNull();
  });

  it("keeps a channel's own gate on its body: disabled closes the fields and the submit", async () => {
    const onSubmit = vi.fn();
    const active = ref<"create" | "bind">("create");
    const Host = defineComponent({
      setup: () => () =>
        h(HkLoginFlow, {
          // Two credentials channels with DIFFERENT gates: erp's register
          // body waits for its anti-abuse challenge, the bind body is
          // submittable from the start. The guard is per channel, so it
          // must travel with the swapped body rather than the flow.
          channels: [
            { key: "create", mode: "credentials", disabled: true, submitLabel: "Create" },
            { key: "bind", mode: "credentials", submitLabel: "Continue" },
          ],
          modelValue: active.value,
          initialUsername: "demiurge",
          onAccountSubmit: onSubmit,
        }),
    });
    const c = mount(h(Host));
    // Mid-dissolve BOTH bodies are mounted (the inner transition keeps
    // the leaving item for its fade), so the probes read the settled
    // item — the same scoping the stable-shell pins above use.
    const settled = () =>
      c.querySelector<HTMLElement>(
        ".hk-login-flow-body .hk-crossfade-item:not(.hk-crossfade-leave-active):not(.hk-crossfade-leave-to)",
      )!;
    const fieldOf = () =>
      settled().querySelector<HTMLInputElement>('input[name="signin-username"]')!;
    const submitOf = () =>
      settled().querySelector<HTMLButtonElement>(".hk-btn-primary")!;
    expect(fieldOf().disabled).toBe(true);
    // MUT:channel-disabled-dropped (ignoring the channel's `disabled`
    // leaves the gated body's submit enabled with a name in the field
    // and this goes red).
    expect(submitOf().disabled).toBe(true);

    active.value = "bind";
    for (let i = 0; i < 12; i++) await nextTick();
    // The settled body is the bind one: its gate is open with the same
    // typed name, which is what tells a per-channel guard apart from a
    // flow-level one.
    expect(submitOf().textContent).toContain("Continue");
    expect(fieldOf().disabled).toBe(false);
    expect(submitOf().disabled).toBe(false);
    fieldOf().value = "langyo";
    fieldOf().dispatchEvent(new Event("input"));
    await nextTick();
    submitOf().click();
    await nextTick();
    expect(onSubmit).toHaveBeenCalledWith("bind", "langyo", "");
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

  it("forwards href: the destination row is a real link; without it, a button", () => {
    const link = mount(
      h(HkLoginFlow, {
        channels: [{ ...orgChannel, href: "/auth/relay/begin" }],
        modelValue: "org",
      }),
    );
    const a = link.querySelector<HTMLAnchorElement>(".hk-login-flow-sso .hk-auth-channel-row")!;
    expect(a.tagName).toBe("A");
    // MUT:flow-sso-href-dropped (not forwarding the channel's href leaves
    // the row a button — hosts must go back to window.location).
    expect(a.getAttribute("href")).toBe("/auth/relay/begin");
    expect(a.textContent).toContain("Organization login");

    // Default (no href) is unchanged: today's button.
    const button = mount(h(HkLoginFlow, { channels: [orgChannel], modelValue: "org" }));
    const b = button.querySelector<HTMLButtonElement>(".hk-login-flow-sso .hk-auth-channel-row")!;
    expect(b.tagName).toBe("BUTTON");
    expect(b.hasAttribute("href")).toBe(false);
  });

  it("keeps the account body on an sso channel when no factor table is announced (fail-safe)", () => {
    // MUT:flow-sso-verify-unguarded (deriving `verifying` from
    // `step === "verify"` alone — or from `verifyFactors` without the
    // credentials arm — turns this into a dead MFA card on every sso
    // flow that has no second step).
    const c = mount(
      h(HkLoginFlow, {
        channels: [orgChannel],
        modelValue: "org",
        step: "verify",
        verifyFactors: [],
      }),
    );
    // No announced ladder = no second step to take: the panel keeps
    // showing the account card instead of a dead MFA card.
    expect(c.querySelector(".hk-auth-channel-row")).not.toBeNull();
    expect(c.querySelectorAll(".hk-otp-cell").length).toBe(0);
  });
});

describe("HkLoginFlow — verify step", () => {
  it("renders the step-up on an sso channel once the host announces factors (OAuth hand-off)", async () => {
    // The hand-off case: the OAuth callback returns with `mfa_pending` /
    // `mfa_factors`, and on an SSO-only deployment the sso channel is the
    // only channel there is. Without this arm every MFA account that
    // signs in through SSO dead-ends on a card with no second step.
    const step = ref<"account" | "verify">("account");
    const factors = ref<readonly string[]>([]);
    const Host = defineComponent({
      setup: () => () =>
        h(HkLoginFlow, {
          channels: [orgChannel],
          modelValue: "org",
          step: step.value,
          verifyFactors: factors.value,
        }),
    });
    const c = mount(h(Host));
    await nextTick();
    // The redirect row is on stage; no step-up yet.
    expect(c.querySelector(".hk-auth-channel-row")).not.toBeNull();
    expect(c.querySelectorAll(".hk-otp-cell").length).toBe(0);

    // The hand-off lands: step flips AND the ladder is announced.
    factors.value = ["totp"];
    step.value = "verify";
    for (let i = 0; i < 12; i++) await nextTick();
    // MUT:flow-sso-verify-credentials-only (reverting `verifying` to
    // `channel.mode === "credentials"` leaves the account body on stage
    // and this goes red — that is the dead-end bug).
    expect(c.querySelectorAll(".hk-otp-cell").length).toBeGreaterThan(0);
    // The header speaks the step-up vocabulary, not the sign-in title.
    // Scope it to the ENTERING generation: the leaving account body
    // lingers until the swap settles (jsdom fires no transitionend), and
    // a whole-tree querySelector would read its title instead.
    expect(
      within(c, "verify").querySelector(".s-auth-title")?.textContent,
    ).toBe("Verify account");
  });

  it("keeps the credentials channel's verify step working unchanged", async () => {
    const c = mount(
      h(HkLoginFlow, {
        channels: [cloudChannel],
        modelValue: "cloud",
        step: "verify",
        verifyFactors: ["totp"],
      }),
    );
    await nextTick();
    // MUT:flow-verify-credentials-arm-dropped (a fix that gates verify on
    // `verifyFactors` alone regresses this: a credentials step-up with an
    // empty ladder would fall back to the password form).
    expect(c.querySelectorAll(".hk-otp-cell").length).toBeGreaterThan(0);
    expect(
      within(c, "verify").querySelector(".s-auth-title")?.textContent,
    ).toBe("Verify account");
  });

  it("re-emits verify-back from the sso channel's step-up so the host can clear the step", async () => {
    const onBack = vi.fn();
    const step = ref<"account" | "verify">("verify");
    const Host = defineComponent({
      setup: () => () =>
        h(HkLoginFlow, {
          channels: [orgChannel],
          modelValue: "org",
          step: step.value,
          verifyFactors: ["totp"],
          onVerifyBack: () => {
            onBack();
            step.value = "account";
          },
        }),
    });
    const c = mount(h(Host));
    await nextTick();
    const back = Array.from(c.querySelectorAll("button")).find((b) =>
      b.textContent?.toLowerCase().includes("back"));
    expect(back).toBeTruthy();
    back!.click();
    await nextTick();
    expect(onBack).toHaveBeenCalledTimes(1);
    // The host cleared its step state; the sso row is reachable again.
    for (let i = 0; i < 12; i++) await nextTick();
    expect(c.querySelector(".hk-auth-channel-row")).not.toBeNull();
  });

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

  it("never renders third-party rows on the verify step (2026-11-26 grammar)", () => {
    // The verify step's alternative-row lane is GONE with the rest of the
    // divider facility: a visitor who would rather continue through a
    // linked provider goes BACK and picks the provider's channel there.
    const c = mount(
      h(HkLoginFlow, {
        channels: [cloudChannel],
        modelValue: "cloud",
        step: "verify",
        verifyFactors: ["password"],
        verifyAccountName: "langyo",
      }),
    );
    // MUT:flow-verify-methods-return (re-adding a channel list to the
    // verify generation reintroduces the banned divider shape and goes red).
    expect(c.querySelector(".hk-auth-channel-list")).toBeNull();
    expect(c.querySelector(".hk-auth-channel-divider")).toBeNull();
    // And the account generation never carried one either.
    const onAccount = mount(
      h(HkLoginFlow, { channels: [cloudChannel], modelValue: "cloud" }),
    );
    expect(onAccount.querySelector(".hk-auth-channel-list")).toBeNull();
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

  it("keeps the descendant :has arm that the flow's footer shape needs (structure pin)", () => {
    // The shell's bare credential fragment renders the footer block inside
    // the SWAPPED BODY, several levels below the shell's `.s-auth-form`
    // (`.s-auth-form > .hk-login-flow-body > .hk-crossfade >
    // .hk-crossfade-item > .s-auth-footer`). The sibling `:has(+ …)` rule
    // above it therefore does NOT match this shape — this descendant arm
    // is the only rule that does, so it is load-bearing, not a fallback.
    // MUT:r1487-rhythm-descendant (reverting to sibling-only rules makes
    // this match empty; the pin below then has nothing to assert).
    const here = dirname(fileURLToPath(import.meta.url));
    const scss = readFileSync(join(here, "../styles/admin-tokens.scss"), "utf-8");
    const collapse = scss.match(/\.s-auth-form:has\(\.s-auth-footer\)\s*{[^}]*}/g)?.join("\n") ?? "";
    expect(collapse, "descendant :has collapse rule must exist").toBeTruthy();
    expect(collapse).toContain("padding-bottom: var(--space-8, 0.5rem)");
    // The retired methods block's rules stay gone (2026-11-26 grammar).
    expect(scss).not.toContain(".s-auth-methods");

    // The DOM half — the reason the rule above exists, asserted against the
    // REAL tree instead of a prose claim. jsdom has no CSS engine, so the
    // pin is structural: it proves the footer is a descendant (and NOT a
    // sibling) of the form, which is exactly what makes the sibling arm
    // miss and the descendant arm the only working one. Behavioral
    // confirmation in a real engine: Chrome 155 computed
    // `padding-bottom: 8px` on this form via the descendant arm, and
    // deleting that single rule from the sheet flipped it to 32px.
    // MUT:r1487-footer-shape-drift (moving the footer out to sit beside
    // the form — or wrapping the fragment so no `.s-auth-form` covers it —
    // makes `matches` below flip and this goes red).
    const c = mount(h(HkLoginFlow, {
      modelValue: "cloud",
      channels: [cloudChannel],
    }, { footer: () => h("div", { class: "probe-footer" }, "row") }));
    const form = c.querySelector(".s-auth-form");
    const footer = c.querySelector(".s-auth-footer");
    expect(form, "the flow's credentials body must carry the shell's form block").not.toBeNull();
    expect(footer, "a passed footer must render its block").not.toBeNull();
    expect(form!.contains(footer), "the footer must be a DESCENDANT of the form").toBe(true);
    expect(footer!.previousElementSibling, "the footer must NOT be the form's sibling").not.toBe(form);
    expect(form!.querySelector(".s-auth-footer")).toBe(footer);
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
  // generation was its own `HkAuthCard`, so the frame dissolved and its
  // entrance keyframes replayed on the fresh node — the reported "the card
  // flies up". The pins below are ELEMENT-IDENTITY assertions on the frame,
  // plus two geometry pins on how the host may move it (2026-11-24 ruling,
  // the card must END a swap centered, so the frame box carries no pin).

  function mountStepHost(options: {
    accountName?: string;
    proven?: string;
    factors?: string[];
    showFactorPicker?: boolean;
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
          verifyShowFactorPicker: options.showFactorPicker ?? true,
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

  it("drops the factor picker when the host says there is nothing to pick", async () => {
    // A deployment announcing ONE factor has no choice to offer; the strip
    // above the field would be decoration. The default stays on, so the
    // multi-factor ladders keep their switch.
    const c = mountStepHost({ factors: ["password"], showFactorPicker: false });
    c.step.value = "verify";
    for (let i = 0; i < 12; i++) await nextTick();
    const gen = c.container.querySelector(
      '.hk-crossfade-item[data-crossfade-key="verify"]',
    ) as HTMLElement | null;
    expect(gen).not.toBeNull();
    expect(gen!.querySelector(".s-mfa-factors"), "no lone factor chip").toBeNull();
    // …and the proof field is still there (the body is live, not stubbed).
    expect(gen!.querySelector('input[type="password"]')).not.toBeNull();
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

  it("leaves no focus inside the inert leaving generation on either leg", async () => {
    // The invariant behind the blur watch, asserted directly instead of
    // through "the field I typed in is not focused": a control that stays
    // focused inside a generation HkCrossfade has marked `inert` is dead
    // focus — the browser refuses it, and on Android it makes the autofill
    // panel chase the morph.
    //
    // Which leg discriminates what: the SECOND leg (focused step-up
    // action) is the one this test kills the step-watch mutation on — the
    // first leg also passes whenever the entering action claims the caret
    // on the same tick, so the first leg's own teeth live in the sibling
    // "blurs a field focused inside the LEAVING body on a step swap".
    // MUT:step-swap-no-blur (dropping the step watch leaves the account
    // input focused inside the inert item on the first leg).
    // A passkey factor: its action is ENABLED with no input, so the
    // second leg can actually put focus on it (a disabled submit refuses
    // focus and would make this leg vacuous).
    const { container, step } = mountStepHost({ factors: ["passkey"] });
    const focusedInsideInert = () =>
      Array.from(container.querySelectorAll<HTMLElement>("[inert]"))
        .some((inert) => inert.contains(document.activeElement));

    // leg 1: account → verify with the username field focused
    const input = container.querySelector<HTMLInputElement>(
      'input[name="signin-username"]',
    )!;
    input.focus();
    step.value = "verify";
    for (let i = 0; i < 12; i++) await nextTick();
    expect(focusedInsideInert()).toBe(false);

    // leg 2: verify → account with the step-up action focused
    const action = container.querySelector<HTMLButtonElement>(
      '.hk-crossfade-item[data-crossfade-key="verify"] .hk-btn-primary',
    )!;
    action.focus();
    expect(document.activeElement).toBe(action);
    step.value = "account";
    for (let i = 0; i < 12; i++) await nextTick();
    expect(focusedInsideInert()).toBe(false);
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

  /** A layout MODEL of the host for the two geometry pins below. happy-dom
   *  has no layout engine (every rect reads zero), so the centering rule is
   *  spelled out here: the frame box's LAYOUT top is
   *  `(stage − cardHeight) / 2` for a stage never shorter than `stageMin`
   *  nor than the card, and its PAINTED top adds whatever inline
   *  translateY stands on the box and subtracts the page scroll — which is
   *  exactly what a real engine reports. The numbers are the ones the
   *  browser rig measured on the pinned tree (a 752 px stage; a 240 px
   *  viewport over a 3 rem footer for the scrolled case).
   *
   *  comment-gate-ok: this block documents the fake engine's geometry, not a
   *  behavioural claim of the component; the claims the pins make ("no
   *  transform remains", "the scrolled page does not jump") are anchored
   *  at the two cases below (`MUT:flow-repins-top-edge`). */
  async function mountCenteredStage(stageMin = 752) {
    let cardHeight = 310.5;
    let scrollY = 0;
    const frames: Array<(entries: unknown[]) => void> = [];
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(cb: (entries: unknown[]) => void) {
          frames.push(cb);
        }
        observe() {}
        disconnect() {}
        unobserve() {}
      },
    );
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
      function (this: Element) {
        const isFrame =
          (this as HTMLElement).classList?.contains("hk-login-flow-anchor") ?? false;
        const own = isFrame ? (this as HTMLElement).style.transform : "";
        const shift = Number(/translateY\((-?[\d.]+)px\)/.exec(own)?.[1] ?? 0);
        const height = isFrame ? cardHeight : 0;
        const layoutTop = (Math.max(stageMin, cardHeight) - cardHeight) / 2;
        const rendered = layoutTop + shift - scrollY;
        return {
          top: rendered, left: 0, bottom: rendered + height, right: 0,
          width: 0, height, x: 0, y: rendered, toJSON: () => ({}),
        } as DOMRect;
      },
    );
    const host = mountStepHost();
    // Let the mount settle before the caller acts, as it does on a page:
    // a template ref's first assignment queues jobs that read geometry.
    for (let i = 0; i < 4; i++) await nextTick();
    const frame = () =>
      host.container.querySelector(".hk-login-flow-anchor") as HTMLElement;
    return {
      step: host.step,
      frame,
      paintedTop: () => frame().getBoundingClientRect().top,
      /** One engine frame's notifications, to every live observer. The
       *  entries are empty: happy-dom measures no box, so a size-driven
       *  observer (HkTransitionContainer's) reads "nothing to pin" from
       *  this frame, exactly as it does from a zero rect. */
      deliverFrames: () => {
        for (const cb of frames.slice()) cb([]);
      },
      growCard: (height: number) => {
        cardHeight = height;
      },
      scrollTo: (y: number) => {
        scrollY = y;
      },
    };
  }

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("ends a step swap centered for the card's new height: the top edge is not pinned", async () => {
    // The reported defect (2026-11-24): the verify step is taller, and the
    // top-edge pin kept the card's PRE-swap top, so the card only grew
    // downward and sat visibly low for good (219.6 px above vs 163.4 px
    // below in a 752 px stage, engine-measured). A centered host re-centers
    // the taller box; the flow must let it.
    // MUT:flow-repins-top-edge (re-adding `useAnchoredTop(anchorRef)` to
    // the flow leaves `translateY(29.25px)` on the frame box once the
    // observers report the growth — both assertions at the end go red).
    const rig = await mountCenteredStage();
    rig.deliverFrames();
    expect(rig.frame().style.transform).toBe("");
    // At rest before the swap: centered for 310.5 px.
    expect(Math.abs(rig.paintedTop() - (752 - 310.5) / 2)).toBeLessThanOrEqual(1);

    // Engine order: the DOM is patched first, then laid out, then the
    // resize notifications of that frame are delivered.
    rig.step.value = "verify";
    for (let i = 0; i < 12; i++) await nextTick();
    rig.growCard(369); // account → verify: the password step is taller
    rig.deliverFrames();

    // Centered for the NEW height (±1 px), with nothing painted over the
    // layout.
    expect(rig.frame().style.transform).toBe("");
    expect(Math.abs(rig.paintedTop() - (752 - 369) / 2)).toBeLessThanOrEqual(1);
  });

  it("does not turn a page scroll into a jump when the swap lands on a scrolled page", async () => {
    // The pin's second defect, engine-measured: it measured in VIEWPORT
    // coordinates and re-based on a window resize only — scrolling fires
    // no ResizeObserver — so a swap on a scrolled page read the scroll
    // offset as drift and painted it back as a translateY (60 px downward,
    // and a transform does not extend the scroll range). The stage here is
    // shorter than the card (a 240 px viewport over a 3 rem footer), so
    // the layout top is 0 and any transform is a pure jump.
    // MUT:flow-repins-top-edge (re-adding the hook leaves
    // `translateY(60px)` on the frame box — both assertions at the end go
    // red).
    const rig = await mountCenteredStage(192);
    rig.deliverFrames();
    expect(rig.paintedTop()).toBe(0);

    // The visitor scrolls to reach the submit, then the swap lands.
    rig.scrollTo(60);
    rig.step.value = "verify";
    for (let i = 0; i < 12; i++) await nextTick();
    rig.growCard(369);
    rig.deliverFrames();

    expect(rig.frame().style.transform).toBe("");
    // Still where the scroll left it: the same document position.
    expect(rig.paintedTop()).toBe(-60);
  });

  it("keeps the frame box between the panel root and the card (structural pin)", async () => {
    const { container } = mountStepHost();
    // Hosts and probes address the frame through `.hk-login-flow-anchor`,
    // and the geometry pins above measure it. It is a plain box — no
    // transform is ever written to it.
    // MUT:step-swap-unguarded (dropping the wrapper puts the frame
    // straight under .hk-login-flow — this goes red).
    const frameBox = container.querySelector(".hk-login-flow-anchor");
    expect(frameBox).not.toBeNull();
    expect(frameBox!.querySelector(":scope > .s-auth-card")).not.toBeNull();
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
