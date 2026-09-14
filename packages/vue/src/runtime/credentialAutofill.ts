import { isTauri } from "./env";

/**
 * Credential-field autocomplete policy (user direction 2026-09-14): no
 * Tauri app in the group may surface the webview's native credential
 * machinery — the stored-password dropdown or the save-password bubble.
 *
 * The policy is *runtime Tauri-aware*, not absolute: the same hikari app
 * runs in plain browsers too, where password managers are welcome and the
 * standard tokens (`username` / `current-password`) are the correct UX.
 *
 * Inside a Tauri webview we degrade to the strongest suppression tokens:
 *
 *  - password: `new-password` — the one autocomplete token Chromium-family
 *    engines (WebView2 included) respect for suppressing saved-credential
 *    fill; plain `off` is explicitly ignored by them for login forms.
 *  - username: `off` — WebView2's fill store is additionally emptied by the
 *    native hardening layer each app ships (`webview_hardening.rs` flips
 *    `ICoreWebView2Settings4.IsPasswordAutosaveEnabled` and
 *    `IsGeneralAutofillEnabled` off), so there is nothing to offer; the
 *    token here keeps the DOM contract aligned on engines without that
 *    native layer.
 *
 * Extensions such as 1Password/LastPass are signaled separately by the
 * components (`data-1p-ignore` / `data-lpignore`).
 *
 * @param kind which credential field the token is for.
 * @param browserDefault the token this component uses in a plain browser.
 */
export function credentialAutocomplete(
  kind: "username" | "password",
  browserDefault: string,
): string {
  if (isTauri()) {
    return kind === "password" ? "new-password" : "off";
  }
  return browserDefault;
}
