// AI-generated: developed with the DeepSeek Harness agent (model GLM-5.4),
// directed and reviewed by the lead agent — SySL-1.0 §2.3 disclosure.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick } from "vue";

import HkAuthHandoff from "./HkAuthHandoff";

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

function mount(node: ReturnType<typeof h>) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({ render: () => node });
  app.mount(container);
  mounts.push({ app, container });
  return container;
}

let assign: ReturnType<typeof vi.fn>;

beforeEach(() => {
  assign = vi.fn();
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...window.location, assign },
  });
  vi.useFakeTimers();
});

afterEach(() => {
  for (const { app, container } of mounts.splice(0)) {
    app.unmount();
    container.remove();
  }
  vi.useRealTimers();
});

function statusText(c: HTMLElement) {
  return c.querySelector(".hk-auth-handoff")?.textContent ?? "";
}

describe("HkAuthHandoff", () => {
  it("shell + card grammar: HkAuthScreen stage, s-auth-card frame, title from the status copy", () => {
    const c = mount(h(HkAuthHandoff, { status: "completing" }));
    expect(c.querySelector(".hk-auth-screen-stage .s-auth-card.hk-auth-handoff-card")).not.toBeNull();
    // MUT:handoff-title-key (wiring the wrong status key shows the wrong
    // line on the completing screen).
    expect(c.querySelector(".hk-auth-handoff-title")?.textContent).toBe("Completing sign-in…");
    expect(c.querySelector(".hk-auth-handoff-description")).toBeNull();
    expect(c.querySelector(".hk-auth-handoff-logo")).toBeNull();
  });

  it("title, description and logoSrc override the defaults", () => {
    const c = mount(
      h(HkAuthHandoff, {
        status: "failed",
        title: "Bind failed",
        description: "Use another account",
        logoSrc: "/logo.svg",
      }),
    );
    expect(c.querySelector(".hk-auth-handoff-title")?.textContent).toBe("Bind failed");
    expect(c.querySelector(".hk-auth-handoff-description")?.textContent).toBe("Use another account");
    const logo = c.querySelector<HTMLImageElement>(".hk-auth-handoff-logo");
    expect(logo?.getAttribute("src")).toBe("/logo.svg");
    // MUT:handoff-logo-announced (a decorative logo with a non-empty alt
    // makes screen readers read the mark before the status).
    expect(logo?.getAttribute("alt")).toBe("");
  });

  it("transient states: spinner + polite status region; failures: alert, no spinner", () => {
    const redirecting = mount(h(HkAuthHandoff, { status: "redirecting", href: "" }));
    const region = redirecting.querySelector<HTMLElement>(".hk-auth-handoff")!;
    expect(region.getAttribute("role")).toBe("status");
    expect(region.getAttribute("aria-live")).toBe("polite");
    expect(region.querySelector(".hk-spinner")).not.toBeNull();

    const failed = mount(h(HkAuthHandoff, { status: "expired" }));
    const alert = failed.querySelector<HTMLElement>(".hk-auth-handoff")!;
    // MUT:handoff-failed-polite (an expired session announced politely is
    // missed by screen readers — failures must interrupt).
    expect(alert.getAttribute("role")).toBe("alert");
    expect(alert.getAttribute("aria-live")).toBeNull();
    expect(alert.querySelector(".hk-spinner")).toBeNull();
    expect(alert.querySelector(".hk-auth-handoff-title")?.textContent).toBe(
      "Your session expired. Sign in to continue.",
    );
  });

  it("success shows a status line, no spinner, no buttons", () => {
    const c = mount(h(HkAuthHandoff, { status: "success" }));
    expect(c.querySelector(".hk-spinner")).toBeNull();
    // The default title already names the state: it is not repeated in a badge.
    // MUT:handoff-success-duplicated (a badge under the default title reads the
    // same sentence twice).
    expect(c.querySelector(".hk-auth-handoff-title")?.textContent).toContain("Signed in");
    expect(c.querySelector(".hk-auth-handoff-state")).toBeNull();
    expect(c.querySelector(".hk-auth-handoff-actions")).toBeNull();
    // Under a host title the badge is the only place the state is named.
    // MUT:handoff-success-badge-dropped (without it the success screen is a
    // heading that never says the sign-in succeeded).
    const titled = mount(h(HkAuthHandoff, { status: "success", title: "Welcome back" }));
    expect(titled.querySelector(".hk-auth-handoff-title")?.textContent).toBe("Welcome back");
    expect(titled.querySelector(".hk-auth-handoff-state .hk-badge")?.textContent).toContain("Signed in");
  });

  it("default actions: back for failed/expired, none otherwise; each emits", async () => {
    const onRetry = vi.fn();
    const onBack = vi.fn();
    const c = mount(h(HkAuthHandoff, { status: "failed", onRetry, onBack }));
    const buttons = c.querySelectorAll<HTMLButtonElement>(".hk-auth-handoff-actions button");
    // MUT:handoff-default-actions (the default action set for `failed` is exactly
    // `['back']`: a retry button the host did not ask for must not render).
    expect(buttons.length).toBe(1);
    expect(buttons[0]!.textContent).toContain("Back to sign in");
    buttons[0]!.click();
    await nextTick();
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onRetry).not.toHaveBeenCalled();

    const quiet = mount(h(HkAuthHandoff, { status: "redirecting", href: "", delayMs: 1e9 }));
    expect(quiet.querySelector(".hk-auth-handoff-actions")).toBeNull();
  });

  it("explicit actions render in order and the actions slot replaces the buttons", async () => {
    const onRetry = vi.fn();
    const c = mount(
      h(HkAuthHandoff, {
        status: "expired",
        actions: ["retry", "back"],
        onRetry,
      }),
    );
    const buttons = c.querySelectorAll<HTMLButtonElement>(".hk-auth-handoff-actions button");
    expect(Array.from(buttons).map((b) => b.textContent?.trim())).toEqual([
      "Try again",
      "Back to sign in",
    ]);
    buttons[0]!.click();
    await nextTick();
    expect(onRetry).toHaveBeenCalledTimes(1);

    const slotted = mount(
      h(HkAuthHandoff, { status: "failed" }, { actions: () => h("button", { class: "mine" }, "Mine") }),
    );
    expect(slotted.querySelectorAll(".hk-auth-handoff-actions button").length).toBe(1);
    expect(slotted.querySelector(".hk-auth-handoff-actions .mine")).not.toBeNull();
  });

  it("forwards header and footer slots to HkAuthScreen", () => {
    const c = mount(
      h(HkAuthHandoff, { status: "success" }, { header: () => h("b", "H"), footer: () => h("i", "F") }),
    );
    expect(c.querySelector(".hk-auth-screen-header b")?.textContent).toBe("H");
    expect(c.querySelector(".hk-auth-screen-footer i")?.textContent).toBe("F");
  });

  it("redirecting with href navigates after delayMs and emits redirect first", () => {
    const onRedirect = vi.fn();
    mount(h(HkAuthHandoff, { status: "redirecting", href: "/relay/begin", delayMs: 500, onRedirect }));
    expect(assign).not.toHaveBeenCalled();
    vi.advanceTimersByTime(499);
    expect(assign).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    // MUT:handoff-delay-ignored (navigating on mount skips the splash the
    // host paid `delayMs` for).
    expect(assign).toHaveBeenCalledTimes(1);
    expect(assign).toHaveBeenCalledWith("/relay/begin");
    // The host's hook runs before the browser leaves.
    expect(onRedirect).toHaveBeenCalledTimes(1);
    expect(onRedirect).toHaveBeenCalledWith("/relay/begin");
  });

  it("a redirect handler returning false cancels the navigation", () => {
    const onRedirect = vi.fn(() => false);
    mount(h(HkAuthHandoff, { status: "redirecting", href: "/relay/begin", onRedirect }));
    vi.runAllTimers();
    expect(onRedirect).toHaveBeenCalledWith("/relay/begin");
    // MUT:handoff-redirect-veto-ignored (assigning anyway turns the host's
    // veto into a double navigation).
    expect(assign).not.toHaveBeenCalled();
  });

  it("without href the component navigates nothing — the host handles redirect", () => {
    const onRedirect = vi.fn();
    mount(h(HkAuthHandoff, { status: "redirecting", onRedirect }));
    vi.runAllTimers();
    expect(onRedirect).toHaveBeenCalledTimes(1);
    expect(assign).not.toHaveBeenCalled();
  });

  it("never navigates in a non-redirecting status, and never after unmount", () => {
    const onRedirect = vi.fn();
    const c = mount(h(HkAuthHandoff, { status: "redirecting", href: "/relay/begin", delayMs: 100 }));
    mounts.splice(0)[0]!.app.unmount();
    c.remove();
    vi.runAllTimers();
    // MUT:handoff-timer-leak (a timer that survives unmount sends the user
    // to the relay after the host already swapped the screen).
    expect(assign).not.toHaveBeenCalled();
    expect(onRedirect).not.toHaveBeenCalled();

    mount(h(HkAuthHandoff, { status: "completing", href: "/relay/begin", delayMs: 0 }));
    vi.runAllTimers();
    expect(assign).not.toHaveBeenCalled();
  });
});
