/**
 * Browser CORS reachability probe (upstreamed from shittim-chest).
 *
 * Distinguishes "host unreachable" from "not allowed by CORS": a
 * credentialed fetch first; on failure a no-cors probe — if that also
 * fails the origin is unreachable, otherwise the host responded but the
 * CORS policy rejected the credentialed request.
 */
import { bindHostFetch } from "@celestia-island/tairitsu-transport/contract";

export type OriginProbe =
  | { ok: true }
  | { ok: false; reason: "unreachable" | "cors-blocked" };

export async function probeOrigin(
  url: string,
  opts?: { fetchFn?: typeof fetch },
): Promise<OriginProbe> {
  // Bare `?? fetch` detaches Window's fetch receiver — the default path
  // throws "Illegal invocation" in a browser (2026-10-17 chest live
  // report family). The shared bindHostFetch() from tairitsu-transport is
  // the one sanctioned acquisition, re-resolved per call.
  const fetchFn = opts?.fetchFn ?? bindHostFetch();
  try {
    // A successful credentialed fetch means reachable + CORS-whitelisted,
    // regardless of the HTTP status code (4xx/5xx still prove the origin).
    await fetchFn(url, { credentials: "include", mode: "cors" });
    return { ok: true };
  } catch {
    // no-cors probe: still reports success if the server is reachable,
    // just without reading the response.
    try {
      await fetchFn(url, { mode: "no-cors" });
      return { ok: false, reason: "cors-blocked" };
    } catch {
      return { ok: false, reason: "unreachable" };
    }
  }
}

/**
 * Like `probeOrigin` but captures the response body when the credentialed
 * fetch succeeds — for identity assertions (e.g. checking a product field)
 * without re-implementing the probe ladder.
 */
export async function probeOriginWithBody(
  url: string,
  opts?: { fetchFn?: typeof fetch },
): Promise<{ ok: boolean; body?: string }> {
  // Same receiver rule as probeOrigin: never capture Window's fetch bare.
  const fetchFn = opts?.fetchFn ?? bindHostFetch();
  try {
    const resp = await fetchFn(url, { credentials: "include", mode: "cors" });
    return { ok: true, body: await resp.text().catch(() => undefined) };
  } catch {
    return { ok: false };
  }
}
