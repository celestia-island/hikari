// AI-generated: developed with the DeepSeek Harness agent (model
// DeepSeek-V4.1-Flash) directed and reviewed by the lead agent — SySL-1.0
// §2.3 disclosure.

import { useI18n } from "../i18n/context";

/**
 * The built-in presentation of the central identity provider's sign-in row.
 *
 * Celestia's central identity provider has one wire id (`"erp"` — the id every
 * live service already emits, which this module deliberately does NOT rename)
 * and no name or icon of its own. Every host therefore shipped its own answer:
 * a bare id in the row, or a hand-typed "Celestia ID" with no mark. This module
 * is the single home for both, so chest, 0721 and future front ends render the
 * same row.
 *
 * The module is free of Vue dependencies EXCEPT for reading the name out of
 * hikari's own i18n context ({@link hkCentralAuthName}): the predicate and the
 * constants below stay pure, so a non-Vue consumer can still import them.
 *
 * @example
 * ```tsx
 * import {
 *   HK_CENTRAL_AUTH_PROVIDER_ID, hkCentralAuthMarkSrc, hkCentralAuthName,
 *   hkProviderLabelIsId,
 * } from "@celestia-island/hikari/vue";
 *
 * const name = hkCentralAuthName();
 * const label =
 *   method.provider === HK_CENTRAL_AUTH_PROVIDER_ID && hkProviderLabelIsId(method.provider, method.label)
 *     ? name
 *     : method.label;
 * const icon =
 *   method.provider === HK_CENTRAL_AUTH_PROVIDER_ID && !method.icon
 *     ? hkCentralAuthMarkSrc
 *     : method.icon;
 * ```
 *
 * The rules a host must honour, in order of precedence:
 *
 * 1. **Nothing an operator configures is overridden.** A provider `label` or
 *    `icon` set in the host's own configuration always wins; a deployment that
 *    renames the row to its company's portal keeps that name.
 * 2. **The built-in name fills a fallback, not a default.** Serve the translated
 *    name only when the label has degenerated to the id — the long-standing
 *    server-side convention where an unset label is emitted as the id. Use
 *    `hkProviderLabelIsId` for that test; it matches the id exactly, so a
 *    deliberately lower-cased alias ("erp-europe") is left alone. Read the name
 *    through {@link hkCentralAuthName}.
 * 3. **The built-in mark fills a gap, not a default.** Use
 *    {@link hkCentralAuthMarkSrc} only when the server supplied no icon.
 * 4. **A deployment that does not configure this provider sees no change.** The
 *    self-hosted default is still local username/password: nothing here is
 *    imported unless the login-policy document actually lists the provider.
 * 5. **The icon is a 64×64 inline WebP data URI.** Render it at 16×16 — the
 *    same box as the surrounding row glyphs; the source is scaled for exactly
 *    that and carries the margin to match their optical weight.
 */

/**
 * The central identity provider's wire id: the value every live host already
 * emits in its login-policy document under `methods[].provider`.
 *
 * This is a wire contract with kirino and with each deployed service. It is
 * named here so a host does not have to hard-code the literal, NOT to
 * introduce a new id — the asset in this module (name and mark) is what
 * changed, the id is not.
 */
export const HK_CENTRAL_AUTH_PROVIDER_ID = "erp";

/**
 * The i18n key of the provider's display name, in every shipped locale.
 *
 * `hkCentralAuthName()` reads it; a host whose own catalog merges the
 * `hikari::` keys may also pass it to its `t()` directly, with
 * {@link HK_CENTRAL_AUTH_NAME_EN} as the fallback.
 */
export const HK_CENTRAL_AUTH_NAME_KEY = "hikari::loginFlow.providerCelestiaAuth";

/** The provider's display name in English — the canonical literal and the
 *  fallback behind {@link HK_CENTRAL_AUTH_NAME_KEY}. */
export const HK_CENTRAL_AUTH_NAME_EN = "Celestia Unified Authentication Platform";

/**
 * The provider's display name in the language hikari's locale context is
 * currently in — THE entry point hosts should render.
 *
 * Why not `t(HK_CENTRAL_AUTH_NAME_KEY, HK_CENTRAL_AUTH_NAME_EN)` in the host's
 * own translator: that only works for a host whose i18n catalog actually merges
 * hikari's `hikari::` keys. 0721's vue-i18n instance deliberately does not, so
 * the same call would sit on the English fallback in every language. Every host
 * does, however, keep hikari's context in step with the app language when the
 * user switches (`setLocale` / `setHikariLocale` on that switch), which is
 * exactly the state this function reads — so it is the one spelling that works
 * everywhere. A host that DOES merge the keys may keep using `t(...)` with
 * {@link HK_CENTRAL_AUTH_NAME_KEY} and {@link HK_CENTRAL_AUTH_NAME_EN}.
 *
 * Reads hikari's reactive locale state, so calling it inside a render or a
 * `computed` makes the row re-render on a language switch. Call it there — do
 * not hoist the result into a module-level constant, which would freeze
 * whichever language happened to be active at import time. It returns whatever
 * hikari's current language is; a host that never calls `setLocale` sees
 * English.
 */
export function hkCentralAuthName(): string {
  return useI18n().t(HK_CENTRAL_AUTH_NAME_KEY, HK_CENTRAL_AUTH_NAME_EN);
}

/**
 * Whether a provider's `label` has degenerated to its id — the server-side
 * convention for "the operator did not name this provider", so the host should
 * substitute its built-in name.
 *
 * True when the label is absent, empty, or whitespace only, and when it equals
 * `providerId` character for character. Case differences are NOT a match:
 * `"ERP"` over `"erp"` is a name an operator typed, and a host must not
 * overwrite it. An empty `providerId` is never a match — every empty label
 * would otherwise collapse onto it.
 */
export function hkProviderLabelIsId(
  providerId: string,
  label: string | null | undefined,
): boolean {
  if (!providerId) return false;
  if (label == null) return true;
  const trimmed = label.trim();
  return trimmed.length === 0 || trimmed === providerId;
}

// Single exit point for the generated mark: importers reach it through this
// module (and the package barrel) rather than the generated artifact.
export { hkCentralAuthMarkSrc } from "./centralAuthMarkData";
