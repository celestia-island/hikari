/**
 * Browser CORS reachability probe (upstreamed from shittim-chest).
 *
 * Distinguishes "host unreachable" from "not allowed by CORS": a
 * credentialed fetch first; on failure a no-cors probe — if that also
 * fails the origin is unreachable, otherwise the host responded but the
 * CORS policy rejected the credentialed request.
 */
export type OriginProbe =
  | { ok: true }
  | { ok: false; reason: "unreachable" | "cors-blocked" };

export async function probeOrigin(
  url: string,
  opts?: { fetchFn?: typeof fetch },
): Promise<OriginProbe> {
  const fetchFn = opts?.fetchFn ?? fetch;
  try {
    const resp = await fetchFn(url, { credentials: "include", mode: "cors" });
    return { ok: resp.ok };
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
