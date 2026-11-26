// AI-generated: developed with the DeepSeek Harness agent (model GLM-5.4),
// directed and reviewed by the lead agent — SySL-1.0 §2.3 disclosure.

import type { HkLoginChannel, HkLoginCredentialsChannel } from "./HkLoginFlow";

/**
 * Pure discovery adapter — turns the server's login-policy document into
 * `HkLoginFlow` channels (or into "mount no flow at all"). No Vue
 * reactivity, no endpoint, no URL building: hosts fetch the document and
 * call `hkLoginPlanFromDiscovery`.
 *
 * The structural types mirror the wire document field-for-field. hikari
 * never validates it and never throws on a foreign document — unknown
 * methods are ignored; the SERVER stays the authority.
 */

/** Where the password form (if any) and the provider rows live. */
export type HkLoginMode = "local" | "federated" | "relay";

/** One non-password entrance announced by the server. */
export type HkLoginMethod =
  | { kind: "oauth"; id: string; label: string; href: string; provider: string; icon?: string }
  | { kind: "passkey"; id: string; label: string; href: string; icon?: string }
  | { kind: "custom"; id: string; label: string; href: string; icon?: string };

/** The login-policy wire document (see `kirino::auth::mode::LoginPolicy`). */
export interface HkLoginDiscovery {
  version: number;
  mode: HkLoginMode;
  password: boolean;
  methods: readonly HkLoginMethod[];
  /** Present in `relay` mode: the central sign-in entry and the query
   *  parameter it reads the return address from. */
  relay?: { entry: string; return_param: string };
}

/** What a host mounts for the discovered policy. */
export interface HkLoginPlan {
  mode: HkLoginMode;
  /** `HkLoginFlow` channels. EMPTY in relay mode — the host must not mount
   *  the flow; it shows the hand-off screen (`HkAuthHandoff`) instead. */
  channels: HkLoginChannel[];
  /** Seed for the flow's `v-model`; `null` in relay mode. */
  defaultChannel: string | null;
}

/** Host-owned copy. Everything is optional; the credentials channel is
 *  consumer-localised on purpose, as every auth label is. */
export interface HkLoginPlanCopy {
  /** Channel key of the credentials channel; default `"cloud"`. */
  credentialsKey?: string;
  /** Optional segment label for the credentials channel. */
  credentialsLabel?: string;
}

const KNOWN_KINDS: ReadonlySet<string> = new Set(["oauth", "passkey", "custom"]);

/** The usable methods in wire order: a known kind and a non-empty id.
 *  Anything else is a foreign document and is ignored, never thrown on. */
function usableMethods(d: HkLoginDiscovery): HkLoginMethod[] {
  const out: HkLoginMethod[] = [];
  for (const method of d.methods ?? []) {
    if (!method || typeof method !== "object") continue;
    const m = method as Record<string, unknown>;
    if (!KNOWN_KINDS.has(String(m.kind))) continue;
    if (typeof m.id !== "string" || m.id === "") continue;
    if (typeof m.label !== "string" || m.label === "") continue;
    if (typeof m.href !== "string" || m.href === "") continue;
    out.push(method);
  }
  return out;
}

/**
 * Map a discovery document to a `HkLoginPlan`.
 *
 * The 2026-11-26 method-selection grammar: every non-password entrance is
 * its OWN `sso` channel — the segment group at the top of the flow is the
 * only switcher, and no card ever stacks alternative rows under a form
 * (the divider facility is gone).
 *
 * - `relay` → `channels: []`, `defaultChannel: null` (hand-off screen).
 * - `password: true` → the credentials channel FIRST (the landing tab),
 *   then every announced entrance as its own `sso` channel. `local` mode
 *   keeps its old filter: an oauth method in a local document is not an
 *   entrance (contradictory document; the server is the authority), so
 *   only `passkey` / `custom` kinds become channels there.
 * - `password: false` → no credentials channel; every method becomes its
 *   own `sso` channel. `defaultChannel` = the first one's key.
 */
export function hkLoginPlanFromDiscovery(
  d: HkLoginDiscovery,
  copy?: HkLoginPlanCopy,
): HkLoginPlan {
  const methods = usableMethods(d);
  const key = copy?.credentialsKey ?? "cloud";
  const label = copy?.credentialsLabel;

  if (d.mode === "relay") {
    return { mode: "relay", channels: [], defaultChannel: null };
  }

  const entrances =
    d.mode === "local"
      ? methods.filter((method) => method.kind !== "oauth")
      : methods;
  const ssoChannels: HkLoginChannel[] = entrances.map((method) => ({
    key: method.id,
    mode: "sso" as const,
    label: method.label,
    icon: method.icon,
    href: method.href,
    buttonLabel: method.label,
  }));

  if (d.password === true) {
    const channel: HkLoginCredentialsChannel = { key, mode: "credentials" };
    if (label) channel.label = label;
    // The credentials tab leads; the provider tabs follow in wire order.
    return {
      mode: d.mode,
      channels: [channel, ...ssoChannels],
      defaultChannel: key,
    };
  }

  return {
    mode: d.mode,
    channels: ssoChannels,
    defaultChannel: ssoChannels[0]?.key ?? null,
  };
}

/** Characters a navigation target must never contain. A backslash is read
 *  as a slash by browsers, so `/` + backslash + host leaves the origin;
 *  control characters, the line/paragraph separators and the format
 *  characters that reshape how a path is displayed or ordered (soft hyphen,
 *  zero-width marks, bidi controls, BOM) are refused because the value ends
 *  up in a `Location` header and may be shown to a user. The same rule as
 *  kirino's `relay::is_unsafe_in_a_location`; keep the two in step. */
const UNSAFE_IN_A_LOCATION = /[\u0000-\u001f\u007f-\u009f\u2028\u2029\u00ad\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff\\]/;

/** True for a path hikari may forward as a return address: absolute,
 *  same-origin by construction (`/x`), not a protocol-relative URL
 *  (`//evil.example`), not the bare root, and free of backslashes, control
 *  and format characters (see `UNSAFE_IN_A_LOCATION`). */
export function hkIsSameOriginPath(raw: string): boolean {
  return (
    raw.startsWith("/") &&
    !raw.startsWith("//") &&
    raw !== "/" &&
    !UNSAFE_IN_A_LOCATION.test(raw)
  );
}

/**
 * The navigation target of a relay entry, or `null` when the document is
 * not in relay mode (or has no entry). The return address is appended only
 * when it is a same-origin path — a foreign URL is never forwarded. An
 * entry that already carries a query string is joined with `&`.
 */
export function hkRelayEntryHref(d: HkLoginDiscovery, returnTo?: string): string | null {
  if (d.mode !== "relay" || !d.relay || !d.relay.entry) return null;
  const entry = d.relay.entry;
  const param = d.relay.return_param;
  if (!returnTo || !hkIsSameOriginPath(returnTo) || !param) return entry;
  const joiner = entry.includes("?") ? "&" : "?";
  return `${entry}${joiner}${param}=${encodeURIComponent(returnTo)}`;
}
