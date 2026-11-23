// AI-generated: developed with the DeepSeek Harness agent (model GLM-5.4),
// directed and reviewed by the lead agent — SySL-1.0 §2.3 disclosure.

import type { HkAuthChannelListEntry } from "./HkAuthChannelList";
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
  /** Divider text above the provider rows. Omitted when not given (the
   *  list renders no divider) — the consumer-localised rule is kept. */
  divider?: string;
}

const KNOWN_KINDS: ReadonlySet<string> = new Set(["oauth", "passkey", "custom"]);

function rowOf(method: HkLoginMethod): HkAuthChannelListEntry {
  const row: HkAuthChannelListEntry = { key: method.id, label: method.label, href: method.href };
  if (method.icon) row.icon = method.icon;
  return row;
}

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
 * - `relay` → `channels: []`, `defaultChannel: null` (hand-off screen).
 * - `local` → ONE credentials channel whose rows are the non-provider
 *   entrances (`passkey`, `custom`); `defaultChannel` is its key.
 * - `federated` + `password: true` → the credentials channel with EVERY
 *   method as a row, wire order preserved.
 * - `federated` + `password: false` → no credentials channel; every method
 *   becomes its own `sso` channel. `defaultChannel` = the first one's key.
 */
export function hkLoginPlanFromDiscovery(
  d: HkLoginDiscovery,
  copy?: HkLoginPlanCopy,
): HkLoginPlan {
  const methods = usableMethods(d);
  const key = copy?.credentialsKey ?? "cloud";
  const label = copy?.credentialsLabel;
  const divider = copy?.divider;

  if (d.mode === "relay") {
    return { mode: "relay", channels: [], defaultChannel: null };
  }

  if (d.mode === "federated" && d.password !== true) {
    const channels: HkLoginChannel[] = methods.map((method) => ({
      key: method.id,
      mode: "sso" as const,
      label: method.label,
      icon: method.icon,
      href: method.href,
      buttonLabel: method.label,
    }));
    return {
      mode: "federated",
      channels,
      defaultChannel: channels[0]?.key ?? null,
    };
  }

  const entrances =
    d.mode === "local"
      ? methods.filter((method) => method.kind !== "oauth")
      : methods;
  const channel: HkLoginCredentialsChannel = { key, mode: "credentials" };
  if (label) channel.label = label;
  channel.methods = entrances.map(rowOf);
  // Only when the host passed one: the divider is consumer copy and an
  // empty string must not render an orphan rule line.
  if (divider) channel.methodsDivider = divider;
  return { mode: d.mode, channels: [channel], defaultChannel: key };
}

/** True for a path hikari may forward as a return address: absolute,
 *  same-origin by construction (`/x`), and not a protocol-relative URL
 *  (`//evil.example`) or the bare root. */
export function hkIsSameOriginPath(raw: string): boolean {
  return raw.startsWith("/") && !raw.startsWith("//") && raw !== "/";
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
