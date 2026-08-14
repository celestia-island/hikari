import { solvePow, type PowChallenge } from "./pow";

export type ChallengeDescriptor =
  | { type: "pow"; seed: string; bits: number }
  | { type: "captcha"; provider: string; sitekey: string; script_url: string }
  | null;

/**
 * Fetch the anti-bot challenge descriptor from a public `/health`-style
 * endpoint (upstreamed from shittim-chest's api/pow.ts).
 *
 * Returns:
 * - the descriptor when the challenge gate is active,
 * - `null` when the backend answered but has no challenge configured,
 * - `undefined` when the fetch itself failed (network/transport error), so
 *   callers can distinguish "gate off" from "could not reach the backend".
 */
export async function fetchChallenge(
  baseUrl: string,
  fetchFn: typeof fetch = fetch,
): Promise<ChallengeDescriptor | undefined> {
  let resp: Response;
  try {
    resp = await fetchFn(`${baseUrl}/health`, { credentials: "same-origin" });
  } catch {
    return undefined;
  }
  if (!resp.ok) return undefined;
  const json = (await resp.json().catch(() => null)) as {
    challenge?: ChallengeDescriptor;
  } | null;
  return json?.challenge ?? null;
}

/**
 * Negotiate a single-use X-Nonce by solving the PoW challenge (or passing
 * a captcha token). Returns the nonce string for the X-Nonce header, or
 * undefined when the exchange fails — including when a captcha challenge
 * is configured but no token was provided.
 */
export async function negotiateNonce(
  baseUrl: string,
  opts?: {
    captchaToken?: string;
    solve?: (challenge: PowChallenge) => Promise<number>;
    fetchFn?: typeof fetch;
  },
): Promise<string | undefined> {
  try {
    const fetchFn = opts?.fetchFn ?? fetch;
    let body: Record<string, unknown> | undefined;
    if (opts?.captchaToken) {
      body = { type: "captcha", token: opts.captchaToken };
    } else {
      const challenge = await fetchChallenge(baseUrl, fetchFn);
      if (challenge === undefined) return undefined;
      if (challenge?.type === "pow") {
        const solve = opts?.solve ?? solvePow;
        const counter = await solve({ seed: challenge.seed, bits: challenge.bits });
        body = { type: "pow", seed: challenge.seed, counter };
      } else if (challenge?.type === "captcha") {
        // A captcha is required but no token was provided — fail cleanly
        // instead of posting a garbage solution.
        return undefined;
      }
      // challenge === null: the gate is disabled and the backend issues a
      // nonce without proof, so an empty body is the correct request.
    }
    const resp = await fetchFn(`${baseUrl}/auth/nonce`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      credentials: "same-origin",
    });
    if (!resp.ok) return undefined;
    const json = (await resp.json().catch(() => null)) as {
      nonce?: string;
    } | null;
    return json?.nonce;
  } catch {
    return undefined;
  }
}
