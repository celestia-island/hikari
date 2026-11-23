// AI-generated: developed with the DeepSeek Harness agent (model GLM-5.4),
// directed and reviewed by the lead agent — SySL-1.0 §2.3 disclosure.

import { describe, expect, it } from "vitest";

import {
  hkIsSameOriginPath,
  hkLoginPlanFromDiscovery,
  hkRelayEntryHref,
  type HkLoginDiscovery,
  type HkLoginMethod,
} from "./loginDiscovery";

const oauth: HkLoginMethod = {
  kind: "oauth",
  id: "feishu",
  label: "飞书登录",
  href: "/auth/oauth/feishu",
  provider: "feishu",
  icon: "feishu.svg",
};
const passkey: HkLoginMethod = { kind: "passkey", id: "passkey", label: "Passkey", href: "/auth/passkey" };
const custom: HkLoginMethod = { kind: "custom", id: "sms", label: "SMS", href: "/auth/sms" };
const methods = [oauth, passkey, custom];

function doc(over: Partial<HkLoginDiscovery>): HkLoginDiscovery {
  return { version: 1, mode: "local", password: true, methods, ...over };
}

describe("hkLoginPlanFromDiscovery", () => {
  it("relay: no channels and no default — the host mounts the hand-off screen, not HkLoginFlow", () => {
    const plan = hkLoginPlanFromDiscovery(doc({ mode: "relay", password: false }));
    // MUT:relay-credentials-channel (returning a credentials channel in
    // relay mode mounts a password form on a deployment that has none).
    expect(plan.channels).toEqual([]);
    expect(plan.defaultChannel).toBeNull();
    expect(plan.mode).toBe("relay");
  });

  it("local: exactly one credentials channel with the non-provider entrances as rows", () => {
    const plan = hkLoginPlanFromDiscovery(doc({ mode: "local" }));
    expect(plan.channels.length).toBe(1);
    const channel = plan.channels[0]!;
    expect(channel).toMatchObject({ key: "cloud", mode: "credentials" });
    expect(plan.defaultChannel).toBe("cloud");
    // MUT:local-keeps-oauth-row (an OAuth provider row on a local-only
    // deployment advertises an entrance the server refuses).
    expect(channel.mode === "credentials" && (channel.methods ?? []).map((m) => m.key)).toEqual([
      "passkey",
      "sms",
    ]);
    // Rows carry the wire label, icon and href.
    expect(channel.mode === "credentials" && channel.methods?.[1]).toEqual({
      key: "sms",
      label: "SMS",
      href: "/auth/sms",
    });
  });

  it("local: no divider unless the host passes one; host key and label win", () => {
    const bare = hkLoginPlanFromDiscovery(doc({ mode: "local" }));
    expect(bare.channels[0]).not.toHaveProperty("methodsDivider");
    const styled = hkLoginPlanFromDiscovery(doc({ mode: "local" }), {
      credentialsKey: "org",
      credentialsLabel: "组织登录",
      divider: "其他方式",
    });
    const channel = styled.channels[0]!;
    expect(channel.key).toBe("org");
    expect(channel.label).toBe("组织登录");
    // MUT:local-divider-defaulted (inventing a divider makes a bare
    // single-row card grow an orphan rule line the host never asked for).
    expect(channel.mode === "credentials" && channel.methodsDivider).toBe("其他方式");
    expect(styled.defaultChannel).toBe("org");
  });

  it("federated + password: the credentials channel with ALL methods as rows, wire order", () => {
    const plan = hkLoginPlanFromDiscovery(doc({ mode: "federated", password: true }));
    const channel = plan.channels[0]!;
    expect(channel.mode).toBe("credentials");
    // MUT:federated-password-drops-oauth (dropping the provider rows from
    // the password card hides every federated entrance).
    expect(channel.mode === "credentials" && (channel.methods ?? []).map((m) => m.key)).toEqual([
      "feishu",
      "passkey",
      "sms",
    ]);
    expect(plan.defaultChannel).toBe("cloud");
  });

  it("federated without a password card: every method is its own sso channel", () => {
    const plan = hkLoginPlanFromDiscovery(doc({ mode: "federated", password: false }));
    expect(plan.channels.length).toBe(3);
    expect(plan.channels.every((channel) => channel.mode === "sso")).toBe(true);
    expect(plan.channels[0]).toEqual({
      key: "feishu",
      mode: "sso",
      label: "飞书登录",
      icon: "feishu.svg",
      href: "/auth/oauth/feishu",
      buttonLabel: "飞书登录",
    });
    // MUT:federated-no-password-credentials (keeping a credentials channel
    // with no password renders an empty, dead card).
    expect(plan.defaultChannel).toBe("feishu");
  });

  it("ignores unknown kinds and empty ids instead of throwing", () => {
    const foreign = [
      ...methods,
      { kind: "magic-link", id: "ml", label: "Magic", href: "/ml" },
      { kind: "oauth", id: "", label: "No id", href: "/x", provider: "p" },
    ] as unknown as HkLoginMethod[];
    const plan = hkLoginPlanFromDiscovery(doc({ mode: "federated", password: true, methods: foreign }));
    const channel = plan.channels[0]!;
    // MUT:unknown-kind-kept (a row for a kind the host cannot start is a
    // dead button on the card).
    expect(channel.mode === "credentials" && (channel.methods ?? []).map((m) => m.key)).toEqual([
      "feishu",
      "passkey",
      "sms",
    ]);
  });

  it("does not mutate the document", () => {
    const d = doc({ mode: "local" });
    const snapshot = JSON.stringify(d);
    hkLoginPlanFromDiscovery(d);
    expect(JSON.stringify(d)).toBe(snapshot);
  });
});

describe("hkIsSameOriginPath", () => {
  it("accepts absolute same-origin paths and rejects everything else", () => {
    expect(hkIsSameOriginPath("/console")).toBe(true);
    expect(hkIsSameOriginPath("/a?b=1")).toBe(true);
    // MUT:protocol-relative-accepted (`//host/x` resolves to a foreign
    // origin — forwarding it is an open redirect).
    expect(hkIsSameOriginPath("//evil.example/x")).toBe(false);
    // MUT:root-accepted (`/` is a path, but never worth forwarding).
    expect(hkIsSameOriginPath("/")).toBe(false);
    expect(hkIsSameOriginPath("https://evil.example")).toBe(false);
    expect(hkIsSameOriginPath("console")).toBe(false);
    expect(hkIsSameOriginPath("")).toBe(false);
    // MUT:no-backslash — a path with a backslash (browsers turn `/\host`
    // into `//host`), a control character (C0, DEL and the C1 range), a
    // line separator or a display-reshaping format character never passes,
    // because the value ends up in a `Location` header; an internationalised
    // path always does. The same rule as kirino's navigation-target check.
    for (const bad of [
      "/\\evil.example/x",
      "/\nevil",
      "/in\u{007f}box",
      "/\u{2028}x",
      "/in\u{200b}box",
      "/\u{202e}xp",
      "/in\u{feff}box",
    ]) {
      expect(hkIsSameOriginPath(bad)).toBe(false);
    }
    // Internationalised paths are untouched by the rule.
    expect(hkIsSameOriginPath("/收件箱")).toBe(true);
    expect(hkIsSameOriginPath("/café/x?y=日本語")).toBe(true);
  });
});

describe("hkRelayEntryHref", () => {
  const relay = { entry: "/auth/relay/begin", return_param: "return" };

  it("is null outside relay mode or without a relay entry", () => {
    expect(hkRelayEntryHref(doc({ mode: "local" }), "/console")).toBeNull();
    // MUT:relay-href-outside-relay (a hand-off target on a non-relay
    // deployment sends the user to an entry that does not exist).
    expect(hkRelayEntryHref(doc({ mode: "federated", relay }), "/console")).toBeNull();
    expect(hkRelayEntryHref(doc({ mode: "relay" }), "/console")).toBeNull();
  });

  it("joins the same-origin return address, percent-encoded", () => {
    expect(hkRelayEntryHref(doc({ mode: "relay", relay }), "/console?tab=a b")).toBe(
      "/auth/relay/begin?return=%2Fconsole%3Ftab%3Da%20b",
    );
  });

  it("never forwards a foreign or unusable return address", () => {
    const d = doc({ mode: "relay", relay });
    // MUT:relay-href-foreign-return (forwarding an absolute URL turns the
    // return parameter into an open redirect).
    expect(hkRelayEntryHref(d, "https://evil.example/")).toBe("/auth/relay/begin");
    expect(hkRelayEntryHref(d, "//evil.example/")).toBe("/auth/relay/begin");
    expect(hkRelayEntryHref(d, "/")).toBe("/auth/relay/begin");
    expect(hkRelayEntryHref(d)).toBe("/auth/relay/begin");
  });

  it("joins with & when the entry already has a query string", () => {
    const d = doc({ mode: "relay", relay: { entry: "/begin?tenant=a", return_param: "next" } });
    // MUT:relay-href-double-question (a second `?` makes the parameter
    // part of the first value — the relay never sees it).
    expect(hkRelayEntryHref(d, "/console")).toBe("/begin?tenant=a&next=%2Fconsole");
  });
});
