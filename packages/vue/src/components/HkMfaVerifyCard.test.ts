import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick, reactive, ref } from "vue";

import {
  HkMfaVerifyCard,
  hkIsMfaFactor,
  hkMfaFactorLabel,
  hkMfaVerifySubtitle,
  hkMfaVerifyTitle,
  hkPreferredMfaFactor,
} from "./HkMfaVerifyCard";

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

/** Mount a render closure, returning its container. Reading reactive
 *  state INSIDE the closure keeps re-renders honest (a static vnode
 *  never updates, so prop-mutation tests need this shape). */
function mount(render: () => ReturnType<typeof h>) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({ render });
  app.mount(container);
  mounts.push({ app, container });
  return { app, container };
}

/** The card instance's exposed handles (clearProof / focusPassword). */
function exposedOf(app: ReturnType<typeof createApp>): { clearProof: () => void } {
  const instance = app._instance?.subTree?.component;
  expect(instance?.exposed, "the card exposes its proof handles").toBeTruthy();
  const exposed = instance!.exposed!;
  return { clearProof: exposed.clearProof };
}

afterEach(() => {
  for (const { app, container } of mounts.splice(0)) {
    app.unmount();
    container.remove();
  }
});

function typeInto(input: HTMLInputElement, value: string) {
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function pickerButtons(c: HTMLElement) {
  return Array.from(c.querySelectorAll<HTMLButtonElement>("button.hk-icon-group-item"));
}

function primaryButton(c: HTMLElement) {
  return c.querySelector(".hk-btn-primary") as HTMLButtonElement;
}

function buttonText(c: HTMLElement, text: string) {
  return Array.from(c.querySelectorAll("button")).find((b) => b.textContent?.includes(text));
}

function otpCells(c: HTMLElement) {
  return Array.from(c.querySelectorAll<HTMLInputElement>(".hk-otp-cell"));
}

function flush() {
  // nextTick, deliberately NOT a setTimeout macrotask: in happy-dom the
  // re-arm assertions only settle deterministically on the microtask
  // queue the components themselves schedule on.
  return nextTick();
}

describe("hkPreferredMfaFactor", () => {
  it("follows the passkey > totp > sms ladder and keeps password last", () => {
    expect(hkPreferredMfaFactor(["password", "totp"])).toBe("totp");
    expect(hkPreferredMfaFactor(["sms", "totp"])).toBe("totp");
    expect(hkPreferredMfaFactor(["password", "sms"])).toBe("sms");
    expect(hkPreferredMfaFactor(["password"])).toBe("password");
  });

  it("returns null for nothing drivable and filters unknown kinds", () => {
    expect(hkPreferredMfaFactor([])).toBeNull();
    expect(hkPreferredMfaFactor(["eyes", "voice"])).toBeNull();
  });

  it("type-guards raw server strings", () => {
    expect(hkIsMfaFactor("totp")).toBe(true);
    expect(hkIsMfaFactor("iris")).toBe(false);
  });
});

describe("HkMfaVerifyCard", () => {
  it("renders the verify-account shell with the default factor's proof field", () => {
    const { container } = mount(() =>
      h(HkMfaVerifyCard, { factors: ["totp"], accountName: "demierge" }));
    expect(container.querySelector(".s-auth-card")).toBeTruthy();
    expect(container.querySelector(".s-auth-title")?.textContent).toBe("Verify account");
    // The account-aware subtitle carries the name (locale interpolation).
    expect(container.querySelector(".s-auth-subtitle")?.textContent).toContain("demierge");
    // totp is the default → six code cells, TOTP hint, no password field.
    expect(otpCells(container)).toHaveLength(6);
    expect(container.textContent).toContain("Enter the 6-digit TOTP code");
    expect(container.querySelector('input[name="mfa-verify-password"]')).toBeNull();
  });

  it("keeps the generic subtitle when no account name is given", () => {
    const { container } = mount(() => h(HkMfaVerifyCard, { factors: ["totp"] }));
    expect(container.querySelector(".s-auth-subtitle")?.textContent)
      .toBe("This account requires an extra verification step");
  });

  it("prefers the ladder's head even when the server announces password first", () => {
    const { container } = mount(() =>
      h(HkMfaVerifyCard, { factors: ["password", "totp"] }));
    expect(otpCells(container).length).toBe(6);
    expect(container.querySelector('input[name="mfa-verify-password"]')).toBeNull();
  });

  it("renders the password proof with a disabled submit until a password exists", () => {
    const { container } = mount(() =>
      h(HkMfaVerifyCard, { factors: ["password"] }));
    const field = container.querySelector('input[name="mfa-verify-password"]') as HTMLInputElement;
    expect(field).toBeTruthy();
    expect(otpCells(container)).toHaveLength(0);
    const submit = Array.from(container.querySelectorAll("button"))
      .find((b) => b.textContent?.includes("Verify and sign in")) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
  });

  it("emits verify with the composed code once the row fills", async () => {
    const onVerify = vi.fn();
    const { container } = mount(() =>
      h(HkMfaVerifyCard, { factors: ["totp"], onVerify }));
    // Typing a whole code into the first cell distributes it forward.
    typeInto(otpCells(container)[0]!, "123456");
    await flush();
    expect(primaryButton(container).disabled).toBe(false);
    primaryButton(container).click();
    await flush();
    expect(onVerify).toHaveBeenCalledWith("totp", "123456");
  });

  it("does not emit verify while the proof is incomplete", async () => {
    const onVerify = vi.fn();
    const { container } = mount(() =>
      h(HkMfaVerifyCard, { factors: ["totp"], onVerify }));
    typeInto(otpCells(container)[0]!, "123");
    await flush();
    expect(primaryButton(container).disabled).toBe(true);
    primaryButton(container).click();
    await flush();
    expect(onVerify).not.toHaveBeenCalled();
  });

  it("emits the password proof", async () => {
    const onVerify = vi.fn();
    const { container } = mount(() =>
      h(HkMfaVerifyCard, { factors: ["password"], onVerify }));
    typeInto(
      container.querySelector('input[name="mfa-verify-password"]') as HTMLInputElement,
      "secret",
    );
    await flush();
    const submit = Array.from(container.querySelectorAll("button"))
      .find((b) => b.textContent?.includes("Verify and sign in"))!;
    submit.click();
    await flush();
    expect(onVerify).toHaveBeenCalledWith("password", "secret");
  });

  it("emits an empty passkey proof and shows the retry hint only when passed", async () => {
    const onVerify = vi.fn();
    const { container } = mount(() =>
      h(HkMfaVerifyCard, {
        factors: ["passkey"],
        onVerify,
        passkeyRetryHint: "try another entry",
      }));
    expect(container.textContent).toContain("Verify with Passkey");
    expect(container.querySelector(".hk-alert-warning")?.textContent).toContain("try another entry");
    expect(otpCells(container)).toHaveLength(0);
    primaryButton(container).click();
    await flush();
    expect(onVerify).toHaveBeenCalledWith("passkey", "");
  });

  it("omits the retry alert when no hint is passed", () => {
    const { container } = mount(() => h(HkMfaVerifyCard, { factors: ["passkey"] }));
    expect(container.querySelector(".hk-alert-warning")).toBeNull();
  });

  it("pins the proven factor and switches to the step-two wording", async () => {
    const onVerify = vi.fn();
    const { container } = mount(() =>
      h(HkMfaVerifyCard, {
        factors: ["totp", "sms"],
        proven: "totp",
        accountName: "demierge",
        onVerify,
      }));
    expect(container.querySelector(".s-auth-title")?.textContent).toBe("One more verification");
    const subtitle = container.querySelector(".s-auth-subtitle")?.textContent ?? "";
    expect(subtitle).toContain("TOTP authenticator app");
    expect(subtitle).toContain("demierge");
    // The proven entry stays visible, pinned disabled with the marker…
    const buttons = pickerButtons(container);
    expect(buttons).toHaveLength(2);
    const pinned = buttons.find((b) => b.getAttribute("data-marker") === "success")!;
    expect(pinned).toBeTruthy();
    expect(pinned.disabled).toBe(true);
    // …and the default selection moved on to the next ladder entry (sms:
    // separated shape + sms hint).
    await flush();
    expect(container.querySelector(".hk-otp-gap")).toBeTruthy();
    expect(container.textContent).toContain("Enter the 6-digit SMS code");
    // Proving the sms factor emits "sms", not the pinned totp.
    typeInto(otpCells(container)[0]!, "654321");
    await flush();
    primaryButton(container).click();
    await flush();
    expect(onVerify).toHaveBeenCalledWith("sms", "654321");
  });

  it("re-arms (selection + fields) when the proven factor arrives late", async () => {
    const onVerify = vi.fn();
    const state = reactive<{ proven?: string }>({});
    const { container } = mount(() =>
      h(HkMfaVerifyCard, {
        factors: ["totp", "sms"],
        proven: state.proven,
        onVerify,
      }));
    await nextTick(); // settle the first paint before feeding the row
    expect(otpCells(container)).toHaveLength(6); // totp selected first
    typeInto(otpCells(container)[0]!, "11");
    await nextTick();
    // Step two: totp now proven — the card must reselect AND clear the
    // half-typed code.
    state.proven = "totp";
    await nextTick();
    expect(container.querySelector(".hk-otp-gap")).toBeTruthy(); // sms now selected
    expect(otpCells(container).every((cell) => cell.value === "")).toBe(true);
    expect(onVerify).not.toHaveBeenCalled();
  });

  it("wires the SMS resend and the back action", async () => {
    const onResend = vi.fn();
    const onBack = vi.fn();
    const { container } = mount(() =>
      h(HkMfaVerifyCard, { factors: ["sms"], onResend, onBack }));
    buttonText(container, "Resend code")!.click();
    await flush();
    expect(onResend).toHaveBeenCalledTimes(1);
    buttonText(container, "Back to sign in")!.click();
    await flush();
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("omits the resend row outside the sms factor", () => {
    const { container } = mount(() => h(HkMfaVerifyCard, { factors: ["totp"] }));
    expect(buttonText(container, "Resend code")).toBeUndefined();
  });

  it("hides the picker entirely when nothing drivable is announced", () => {
    const { container } = mount(() =>
      h(HkMfaVerifyCard, { factors: ["iris-scan"] }));
    expect(pickerButtons(container)).toHaveLength(0);
    // Degenerate but alive: the card still renders its shell + actions.
    expect(container.querySelector(".s-auth-card")).toBeTruthy();
    expect(buttonText(container, "Back to sign in")).toBeTruthy();
  });

  it("clears the active proof through the exposed handle", async () => {
    const onVerify = vi.fn();
    const cardRef = ref<{ clearProof: () => void } | null>(null);
    const { app, container } = mount(() =>
      h(HkMfaVerifyCard, { factors: ["totp"], onVerify }));
    cardRef.value = exposedOf(app);
    // A PARTIAL code: a full one would autoSubmit mid-type and emit
    // before the clear ever runs.
    typeInto(otpCells(container)[0]!, "123");
    await flush();
    cardRef.value!.clearProof();
    await flush();
    expect(otpCells(container).every((cell) => cell.value === "")).toBe(true);
    primaryButton(container).click();
    await flush();
    expect(onVerify).not.toHaveBeenCalled();
  });

  it("disables the actions while loading (the picker stays live)", () => {
    const { container } = mount(() =>
      h(HkMfaVerifyCard, { factors: ["passkey", "totp"], loading: true }));
    // The passkey submit + the back action are out of the user's hands;
    // the picker stays live — re-clicking the active factor is a radio
    // no-op, and chest's panel kept it enabled during verify too.
    expect(primaryButton(container).disabled).toBe(true);
    const back = buttonText(container, "Back to sign in") as HTMLButtonElement;
    expect(back.disabled).toBe(true);
  });
});

describe("HkMfaVerifyCard — autofocus arms the factor on stage", () => {
  // The card's `autofocus` is a HOST contract (the verify step just
  // opened), so it must land somewhere keyboard-reachable for EVERY
  // factor — not only the ones with a text field.
  // MUT:passkey-focus-drop (reverting focusStage to the password-only
  // branch leaves activeElement on <body> and this goes red).
  const settle = async () => {
    await nextTick();
    await new Promise((r) => setTimeout(r, 20));
  };

  it("focuses the passkey action when the account has no field to focus", async () => {
    const { container } = mount(() =>
      h(HkMfaVerifyCard, { factors: ["passkey"], autofocus: true }));
    await settle();
    const action = container.querySelector<HTMLButtonElement>(".hk-btn-primary")!;
    expect(action).not.toBeNull();
    expect(document.activeElement).toBe(action);
  });

  it("focuses the password field when the password factor leads", async () => {
    const { container } = mount(() =>
      h(HkMfaVerifyCard, { factors: ["password"], autofocus: true }));
    await settle();
    const input = container.querySelector<HTMLInputElement>(
      'input[name="mfa-verify-password"]',
    )!;
    expect(document.activeElement).toBe(input);
  });

  it("keeps the caret where the host put it when autofocus is off", async () => {
    const outside = document.createElement("button");
    document.body.appendChild(outside);
    outside.focus();
    mount(() => h(HkMfaVerifyCard, { factors: ["passkey"] }));
    await settle();
    expect(document.activeElement).toBe(outside);
    outside.remove();
  });
});

describe("HkMfaVerifyCard — alternative sign-in rows", () => {
  // A host whose ladder also accepts a linked third-party identity lists
  // the providers HERE (erp's "bind an existing account" verify step).
  const rows = [
    { key: "github", label: "GitHub" },
    { key: "feishu", label: "Feishu" },
  ];

  it("renders the rows under the proof and forwards a picked row", async () => {
    const onVerify = vi.fn();
    const onSelect = vi.fn();
    const { container } = mount(() =>
      h(HkMfaVerifyCard, {
        factors: ["password"],
        methods: rows,
        methodsDivider: "or continue with",
        onVerify,
        onMethodSelect: onSelect,
      }));
    const github = container.querySelector<HTMLButtonElement>('[data-key="github"]');
    expect(github).not.toBeNull();
    expect(github!.getAttribute("aria-label")).toBe("GitHub");
    expect(container.querySelector('[data-key="feishu"]')).not.toBeNull();
    expect(container.querySelector(".hk-auth-channel-divider")?.textContent)
      .toContain("or continue with");
    // Lane order: proof → submit → rows → back. The back action is the
    // last control of the step; the rows sit above it, inside the
    // step-up's own column.
    // MUT:verify-rows-after-back (moving the list below the back action
    // puts the back button before the list and this goes red).
    const list = container.querySelector(".hk-auth-channel-list")!;
    const back = buttonText(container, "Back to sign in")!;
    expect(
      (list.compareDocumentPosition(back) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
      "the back action follows the rows",
    ).toBe(true);
    github!.click();
    await flush();
    // A row is not a factor: the pick reports the provider and leaves
    // the verify lane alone.
    // MUT:verify-rows-emit-verify (emitting `verify` from the row click
    // calls onVerify here and this goes red).
    expect(onSelect).toHaveBeenCalledWith("github");
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onVerify).not.toHaveBeenCalled();
  });

  it("omits the rows and the divider when no method is passed", () => {
    // MUT:verify-rows-unconditional (dropping the length guard renders an
    // empty list block under the proof — the divider-only list root
    // appears and this goes red).
    const { container } = mount(() => h(HkMfaVerifyCard, { factors: ["totp"] }));
    expect(container.querySelector(".hk-auth-channel-list")).toBeNull();
    expect(container.querySelector(".hk-auth-channel-divider")).toBeNull();
    const empty = mount(() =>
      h(HkMfaVerifyCard, { factors: ["totp"], methods: [], methodsDivider: "or" }));
    expect(empty.container.querySelector(".hk-auth-channel-list")).toBeNull();
    expect(empty.container.querySelector(".hk-auth-channel-divider")).toBeNull();
  });

  it("keeps a provider row out of the factor picker", () => {
    // The picker lists FACTORS only; a provider joins as a row below.
    const { container } = mount(() =>
      h(HkMfaVerifyCard, { factors: ["password", "totp"], methods: rows }));
    expect(pickerButtons(container)).toHaveLength(2);
    expect(
      pickerButtons(container).some((b) => b.textContent?.includes("GitHub")),
    ).toBe(false);
  });

  it("closes every row while the card is busy", () => {
    const busy = mount(() =>
      h(HkMfaVerifyCard, { factors: ["password"], methods: rows, loading: true }));
    const guarded = busy.container.querySelectorAll<HTMLButtonElement>(".hk-auth-channel-row");
    expect(guarded).toHaveLength(2);
    // MUT:verify-rows-live-while-busy (returning the rows untouched while
    // `loading` leaves both enabled and this goes red).
    expect(Array.from(guarded).every((row) => row.disabled)).toBe(true);
    const disabled = mount(() =>
      h(HkMfaVerifyCard, { factors: ["password"], methods: rows, disabled: true }));
    expect(
      Array.from(disabled.container.querySelectorAll<HTMLButtonElement>(".hk-auth-channel-row"))
        .every((row) => row.disabled),
    ).toBe(true);
    const idle = mount(() =>
      h(HkMfaVerifyCard, { factors: ["password"], methods: rows }));
    expect(
      Array.from(idle.container.querySelectorAll<HTMLButtonElement>(".hk-auth-channel-row"))
        .every((row) => !row.disabled),
    ).toBe(true);
  });

  it("keeps a row the host closed ITSELF closed, busy or idle", () => {
    // The prop doc promises "a row the host closed itself stays closed":
    // the busy arm must ADD the flag, never overwrite the host's own. Both
    // arms are probed because two different implementations each break
    // exactly one of them (`disabled: loading || disabled` wipes the gate
    // while idle, coercing idle rows to `false` wipes it too, and a
    // clone that DROPS the field is the same defect).
    // MUT:verify-rows-host-gateidle (coercing the idle arm to `disabled:
    // false`) reds the first assertion; MUT:verify-rows-host-gatebusy
    // (`disabled: props.loading || props.disabled` on every row) reds it
    // as well once the card is idle.
    const closed = [{ key: "github", label: "GitHub", disabled: true }, { key: "feishu", label: "Feishu" }];
    const idle = mount(() =>
      h(HkMfaVerifyCard, { factors: ["password"], methods: closed }));
    const idleGithub = idle.container.querySelector<HTMLButtonElement>('[data-key="github"]')!;
    const idleFeishu = idle.container.querySelector<HTMLButtonElement>('[data-key="feishu"]')!;
    expect(idleGithub.disabled).toBe(true);
    expect(idleFeishu.disabled).toBe(false);

    const busy = mount(() =>
      h(HkMfaVerifyCard, { factors: ["password"], methods: closed, loading: true }));
    expect(
      busy.container.querySelector<HTMLButtonElement>('[data-key="github"]')!.disabled,
    ).toBe(true);
    expect(
      busy.container.querySelector<HTMLButtonElement>('[data-key="feishu"]')!.disabled,
    ).toBe(true);
  });

  it("renders the rows in bare mode too (one body, two shells)", () => {
    const { container } = mount(() =>
      h(HkMfaVerifyCard, { bare: true, factors: ["password"], methods: rows }));
    expect(container.querySelector('[data-key="github"]')).not.toBeNull();
    expect(container.querySelector(".s-auth-card")).toBeNull();
  });
});

describe("HkMfaVerifyCard — bare mode (host-owned card shell)", () => {
  const flat = (key: string, fallback?: string) => fallback ?? key;

  it("renders the step-up body with NO card frame and NO header block", () => {
    // HkLoginFlow's in-card step swap puts this body inside ITS frame:
    // a shell here would nest a second card inside the first one.
    // MUT:verify-bare-shell (dropping the `bare` branch's early return
    // renders HkAuthCard again — `.s-auth-card` /.s-auth-header appear
    // and both assertions go red).
    const { container } = mount(() =>
      h(HkMfaVerifyCard, { bare: true, factors: ["totp"], accountName: "demiurge" }));
    expect(container.querySelector(".s-auth-card")).toBeNull();
    expect(container.querySelector(".s-auth-header")).toBeNull();
    expect(container.querySelector(".s-auth-title")).toBeNull();
    // The body itself is all there: the picker and the six code cells.
    expect(container.querySelector(".s-mfa-factors")).not.toBeNull();
    expect(container.querySelectorAll(".hk-otp-cell")).toHaveLength(6);
    expect(container.querySelector(".hk-btn-primary")).not.toBeNull();
    expect(container.querySelector(".hk-btn-ghost")).not.toBeNull();
  });

  it("keeps every handler live in bare mode", async () => {
    const onVerify = vi.fn();
    const onBack = vi.fn();
    const { container } = mount(() =>
      h(HkMfaVerifyCard, {
        bare: true,
        factors: ["totp"],
        autofocus: true,
        onVerify,
        onBack,
      }));
    const cells = Array.from(container.querySelectorAll<HTMLInputElement>(".hk-otp-cell"));
    cells.forEach((cell, i) => typeInto(cell, String(i)));
    await nextTick();
    container.querySelector<HTMLButtonElement>(".hk-btn-primary")!.click();
    await nextTick();
    expect(onVerify).toHaveBeenCalledWith("totp", "012345");
    container.querySelector<HTMLButtonElement>(".hk-btn-ghost")!.click();
    await nextTick();
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("derives the header copy a host shell renders (one vocabulary, two renderers)", () => {
    // The flow renders its own header around the bare body; these are
    // the exact strings the shell-mode card would render for the same
    // inputs (a second copy of the wording is how the header and the
    // body drift apart).
    expect(hkMfaVerifyTitle(flat)).toBe("Verify account");
    expect(hkMfaVerifyTitle(flat, { proven: "passkey" })).toBe("One more verification");
    expect(hkMfaVerifyTitle(flat, { title: "Step up" })).toBe("Step up");
    expect(hkMfaVerifySubtitle(flat)).toBe(
      "This account requires an extra verification step");
    expect(hkMfaVerifySubtitle(flat, { accountName: "demiurge" })).toBe(
      "Verifying demiurge — complete a sign-in method to continue");
    expect(hkMfaVerifySubtitle(flat, { accountName: "demiurge", proven: "totp" })).toBe(
      "TOTP authenticator app passed — choose one more method to finish signing in to demiurge");
    expect(hkMfaVerifySubtitle(flat, { proven: "totp" })).toBe(
      "Verified via TOTP authenticator app — choose one more method to finish signing in");
    // A host override keeps its own wording but still interpolates: a
    // literal `{name}` on screen is the silent difference this helper
    // exists to remove (the prop's doc promises the interpolation).
    // MUT:subtitle-override-raw (returning the override verbatim leaves
    // the placeholders in and this goes red).
    expect(hkMfaVerifySubtitle(flat, { subtitle: "Custom" })).toBe("Custom");
    expect(
      hkMfaVerifySubtitle(flat, {
        subtitle: "Acme needs {proven} from {name}",
        accountName: "demiurge",
        proven: "passkey",
      }),
    ).toBe("Acme needs Passkey from demiurge");
    expect(
      hkMfaVerifySubtitle(flat, { subtitle: "Acme needs nothing else", accountName: "demiurge" }),
    ).toBe("Acme needs nothing else");
    // Shell mode and bare mode name the factors identically.
    expect(hkMfaFactorLabel(flat, "password")).toBe("Account password");
  });

  it("renders the same body in shell mode (the bare split is a frame split only)", () => {
    const { container } = mount(() =>
      h(HkMfaVerifyCard, { factors: ["totp"], accountName: "demiurge" }));
    expect(container.querySelector(".s-auth-card")).not.toBeNull();
    expect(container.querySelector(".s-auth-header")).not.toBeNull();
    expect(container.querySelector(".s-auth-title")?.textContent).toBe("Verify account");
    expect(container.querySelectorAll(".hk-otp-cell")).toHaveLength(6);
  });
});
