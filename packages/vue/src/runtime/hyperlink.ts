/**
 * The hyperlink coordination context — THE one surface every hikari
 * component (and every host consumer) goes through to open a link.
 *
 * WHY (2026-11-12 field report): markdown-rendered agreements (the chest
 * login protocol modal) carry REAL anchors. In a plain browser a click
 * navigated or blanked the tab; in the Tauri shell it navigated the
 * webview itself onto the app origin — the user watched the login window
 * turn into a bare 404 from the local static server. Every ad-hoc
 * window.open / target="_blank" in the family has the same two failure
 * modes, so hikari owns ONE coordinator instead:
 *
 *   - browser face — external URLs open in a new tab
 *     (window.open(url, "_blank", "noopener,noreferrer")), mail/tel
 *     hand off to the OS handler in place;
 *   - native shell (isNative()) — external URLs go to the SYSTEM
 *     browser through the shell's opener bridge, never the webview. The
 *     documented __TAURI__.opener / __TAURI__.shell globals are tried
 *     first, then the plugin:opener|open_url IPC every
 *     tauri-plugin-opener shell exposes (mirroring the two wiring paths
 *     of runtime/windowChrome.ts), and window.open is only the last
 *     resort. Same-origin app URLs are REFUSED here: an unresolved
 *     relative href must never point the user's browser at the app
 *     origin (that is the 404 report verbatim).
 *
 * Hosts customize the two halves through provideHyperlinkCoordinator at
 * bootstrap:
 *
 *   - resolve(info) — map a link to the URL that should actually open
 *     (the chest canonicalizes vendored protocol-doc relative links to
 *     their docs.celestia.world pages), or return null to swallow the
 *     click;
 *   - open(url, info) — replace the opener (a host with its own shell
 *     command plugs it here; everything else keeps the default).
 *
 * openHyperlink is the one entry every component calls. It classifies
 * the href, runs the resolver, then opens — and it is what the delegated
 * click handler of HkMarkdownRenderer and the anchors of HkAboutModal
 * (and, by the family convention, every host surface) drive.
 */

import { isNative } from "./env";

/** Where a link was activated from — hosts use it to scope resolution. */
export type HyperlinkSource = "markdown" | "about" | "host";

/** How the raw href classifies. */
export type HyperlinkKind = "external" | "mailto" | "tel" | "internal" | "other";

/** Everything known about one link activation. */
export interface HyperlinkInfo {
  /** The href exactly as written — never rewritten by the coordinator. */
  readonly href: string;
  /** The classification of the href. */
  readonly kind: HyperlinkKind;
  /** Where the activation came from. */
  readonly source: HyperlinkSource;
  /** The opaque per-surface tag the renderer carried, if any — the chest
   *  tags its vendored protocol docs so only those resolve relatively. */
  readonly linkContext?: string;
}

/** The two host-replaceable halves of the coordinator. */
export interface HyperlinkCoordinator {
  /** Map a link to the URL that should actually open. Return null to
   *  swallow the activation (the default for hosts that vet links). */
  resolve?(info: HyperlinkInfo): string | null | Promise<string | null>;
  /** Open the (already resolved) URL. Defaults to the environment-aware
   *  opener below. A false verdict (or a thrown error) reports the
   *  refusal - a plain void return means "delivered". */
  open?(url: string, info: HyperlinkInfo): boolean | void | Promise<boolean | void>;
}

/** Classify an href without resolving it. Scheme detection stays strict:
 *  anything without an explicit scheme is internal (relative, root or
 *  hash links), because treating it as external is exactly the bug this
 *  module exists for. */
export function classifyHyperlink(href: string): HyperlinkKind {
  const trimmed = href.trim();
  if (!trimmed || trimmed.startsWith("#")) return "internal";
  const scheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.exec(trimmed)?.[0]?.slice(0, -1).toLowerCase();
  if (!scheme) return "internal";
  if (scheme === "http" || scheme === "https") return "external";
  if (scheme === "mailto") return "mailto";
  if (scheme === "tel") return "tel";
  return "other";
}

/**
 * Schemes that execute script (or re-enter the local filesystem) the moment
 * a browser navigates to them. SECURITY (2026-11-15, audit PS-18): the
 * `other` bucket exists so custom protocols (`vscode:`, `zoommtg:`, …) reach
 * the OS handler — `safeHref`'s allowlist would kill every one of them, so
 * this is deliberately a BLOCKLIST applied on top.
 *
 * Obfuscation: engines drop ASCII tab/LF/CR anywhere inside the scheme, so
 * `java\tscript:` still runs. Matching therefore retries on a
 * control-character-squeezed copy rather than trusting the raw prefix.
 */
// `blob:` and `filesystem:` join the list because the web face of this
// module ASSIGNS `location.href` (navigating the app away) and a blob minted
// by the page is same-origin HTML — one click away from running script here.
// A legitimate download should carry `download`, not ride a hyperlink.
const DANGEROUS_SCHEME = /^(?:javascript|vbscript|data|file|blob|filesystem)$/;

function schemeOf(candidate: string): string | null {
  const match = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(candidate.trim());
  return match?.[1]?.toLowerCase() ?? null;
}

/** True when `href` would execute script (or reach local files) if a browser
 *  navigated to it. Never true for http(s)/mailto/tel/relative/fragment, and
 *  never true for a custom scheme such as `vscode:` — those stay in `other`
 *  and keep flowing to the OS handler. */
export function isDangerousHref(href: string): boolean {
  if (typeof href !== "string") return false;
  const direct = schemeOf(href);
  if (direct !== null) return DANGEROUS_SCHEME.test(direct);
  // No clean scheme at the front: re-test after removing what engines skip.
  const squeezed = schemeOf(href.replace(/[\u0000-\u0020]/g, ""));
  return squeezed !== null && DANGEROUS_SCHEME.test(squeezed);
}

/** True when an absolute http(s) URL points at the CURRENT app origin.
 *  Only used by the default native opener — a system browser must never
 *  be pointed at the shell's own origin (a local server URL the user
 *  cannot meaningfully reach outside the app). */
function isSameOriginUrl(url: string): boolean {
  try {
    return new URL(url, window.location.href).origin === window.location.origin;
  } catch {
    return false;
  }
}

/** Shapes of the shell-injected globals this module may read. */
interface TauriOpenerScope {
  __TAURI__?: {
    opener?: { openUrl?: (url: string) => unknown };
    shell?: { open?: (url: string) => unknown };
  };
  __TAURI_INTERNALS__?: {
    invoke?: (command: string, args?: Record<string, unknown>) => unknown;
  };
}

/** The ONE native open: documented opener API first, legacy shell second,
 *  the tauri-plugin-opener IPC third, window.open as the last resort.
 *  Returns false when every bridge refused (the caller may surface that;
 *  the click still never navigates the webview). */
export async function openExternalHyperlink(url: string): Promise<boolean> {
  // SECURITY (PS-18 follow-up): this one is publicly exported, so a host may
  // call it directly — a guard living only in its callers would leave the last
  // `window.open` sink reachable. Cheap, so it guards itself.
  if (isDangerousHref(url)) return false;
  if (typeof window === "undefined") return false;
  const scope = window as unknown as TauriOpenerScope;

  const opener = scope.__TAURI__?.opener;
  if (typeof opener?.openUrl === "function") {
    try {
      await opener.openUrl(url);
      return true;
    } catch {
      /* fall through to the next bridge */
    }
  }

  const shell = scope.__TAURI__?.shell;
  if (typeof shell?.open === "function") {
    try {
      await shell.open(url);
      return true;
    } catch {
      /* fall through to the next bridge */
    }
  }

  const internals = scope.__TAURI_INTERNALS__;
  const invoke = internals?.invoke;
  if (internals && typeof invoke === "function") {
    try {
      // tauri-plugin-opener's command surface: open_url(url, with). The
      // default permission set admits http/https/mailto/tel — exactly the
      // hyperlink vocabulary; anything else is refused by the plugin's
      // scope and the error falls through to the last resort below.
      await invoke.call(internals, "plugin:opener|open_url", {
        url,
        with: null,
      });
      return true;
    } catch {
      /* fall through to the last resort */
    }
  }

  // No native bridge answered (a shell without the opener plugin, or the
  // web face that reached here through a host-open override). window.open
  // is the harmless floor: on the web it opens the tab, in a shell it is
  // the engine's own new-window policy.
  try {
    const opened = window.open(url, "_blank", "noopener,noreferrer");
    if (opened) {
      opened.opener = null;
      return true;
    }
  } catch {
    /* popup blocked / engine refused — report the refusal */
  }
  return false;
}

/** The default open half: environment-specific destination routing.
 *  External http(s) goes to the system browser on the native shell and to
 *  a new tab on the web; mail/tel and custom schemes hand off to the OS
 *  handler in place; unresolved same-origin/internal links are swallowed
 *  on the native shell (never leak the app origin outward) and open in a
 *  new tab resolved against the document base on the web. */
async function defaultOpenHyperlink(url: string, info: HyperlinkInfo): Promise<boolean> {
  if (typeof window === "undefined") return false;
  // SECURITY (PS-18): belt to openHyperlink's braces — this is the function
  // that actually assigns `window.location.href` / calls `window.open`, so it
  // must never be reachable with a script scheme even if a caller bypasses
  // the entry (or a host wires this half in directly).
  if (isDangerousHref(url)) return false;

  // The native shell must never hand its own origin to the system browser.
  if (isNative() && info.kind === "external" && isSameOriginUrl(url)) {
    return false;
  }

  if (!isNative()) {
    // Web face: mail/tel/custom schemes hand off in place (the page never
    // unloads for external protocol handlers); http(s) and internal links
    // open a new tab, mirroring target="_blank" semantics.
    if (info.kind === "mailto" || info.kind === "tel" || info.kind === "other") {
      try {
        window.location.href = url;
        return true;
      } catch {
        return false;
      }
    }
    try {
      const absolute = info.kind === "external" ? url : new URL(url, document.baseURI).href;
      const opened = window.open(absolute, "_blank", "noopener,noreferrer");
      if (opened) {
        opened.opener = null;
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  // Native shell: mail/tel/custom schemes and http(s) all ride the opener
  // bridge (the plugin's default scope admits mailto/tel/http/https).
  if (info.kind === "internal") {
    // An unresolved internal link has no destination outside the app —
    // swallow it instead of navigating the webview (the 404 report).
    return false;
  }
  return openExternalHyperlink(url);
}

/** The registered host coordinator, if any. Module-level by design: the
 *  delegated handlers run outside any component setup, and the tooltip
 *  bridge set the precedent for bootstrap-installed singletons. */
let hostCoordinator: HyperlinkCoordinator | null = null;

/** Register the host coordinator (call once at bootstrap). null resets to
 *  the built-in behavior — tests use that. */
export function provideHyperlinkCoordinator(coordinator: HyperlinkCoordinator | null): void {
  hostCoordinator = coordinator;
}

/** The active coordinator with both halves filled in: the host resolve
 *  defaults to the href itself, the host open defaults to the
 *  environment-aware opener. */
export function useHyperlinkCoordinator(): {
  resolve: (info: HyperlinkInfo) => string | null | Promise<string | null>;
  open: (url: string, info: HyperlinkInfo) => boolean | void | Promise<boolean | void>;
} {
  return {
    resolve: async (info) => {
      const own = hostCoordinator?.resolve;
      // A DISTINCT absent-vs-null read: null is the resolver's "swallow"
      // verdict, never a reason to fall back to the raw href.
      return own ? own(info) : info.href;
    },
    open: (url, info) => {
      const own = hostCoordinator?.open;
      return own ? own(url, info) : defaultOpenHyperlink(url, info);
    },
  };
}

/** THE one entry: classify, resolve, open. Returns the URL that actually
 *  opened (null when the activation was swallowed — refused same-origin
 *  internal links on the native shell, a host resolver returning null, or
 *  an opener that failed). Components never navigate the webview by hand. */
export async function openHyperlink(
  href: string,
  opts: { source?: HyperlinkSource; linkContext?: string } = {},
): Promise<string | null> {
  const kind = classifyHyperlink(href);
  const info: HyperlinkInfo = {
    href,
    kind,
    source: opts.source ?? "host",
    ...(opts.linkContext !== undefined ? { linkContext: opts.linkContext } : {}),
  };
  const coordinator = useHyperlinkCoordinator();

  let url = await coordinator.resolve(info);
  if (typeof url !== "string" || url === "") return null;
  // SECURITY (PS-18): the resolver may hand back anything — including a
  // `javascript:` URL minted from the href it was given. Refuse here, at the
  // ONE entry every component drives, so a future sink cannot forget the
  // check. A host-supplied `open` never sees a dangerous URL at all.
  if (isDangerousHref(url)) return null;
  if (url === info.href && info.kind === "internal") {
    // The resolver left a relative link untouched — give it its absolute
    // form so the opener decides on a real origin (native refuses it,
    // web resolves against the document base).
    try {
      url = new URL(url, document.baseURI).href;
    } catch {
      return null;
    }
  }

  // The open half speaks in refusals: false (or a thrown error) means the
  // link did not open — surface that as a swallowed activation. A plain
  // void return is the host saying "delivered" without a verdict value.
  try {
    const verdict = await coordinator.open(url, info);
    return verdict === undefined || verdict ? url : null;
  } catch {
    return null;
  }
}
