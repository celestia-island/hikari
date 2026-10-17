import { afterEach, describe, expect, it, vi } from "vitest";

import { probeOrigin, probeOriginWithBody } from "./connectivity";
import { probeHealthEndpoint } from "./healthProbe";
import { fetchChallenge, negotiateNonce } from "./powNonce";

/**
 * The browser's `fetch` is a Window method: capturing it as a bare value
 * (`opts?.fetchFn ?? fetch`) detaches the receiver, and every default call
 * throws "Failed to execute 'fetch' on 'Window': Illegal invocation"
 * (2026-10-17 chest live report: branding silently fell back and health
 * probes reported every panel unreachable — the TypeError was swallowed
 * into `{ok:false}` results). Node's fetch does not check its receiver,
 * so these tests stub the browser's exact contract — `this !== globalThis`
 * rejects with the same TypeError — making a detached capture red here.
 */
function stubWindowFetch(): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(function (this: unknown, input: RequestInfo | URL): Promise<Response> {
      if (this !== globalThis) {
        return Promise.reject(
          new TypeError("Failed to execute 'fetch' on 'Window': Illegal invocation"),
        );
      }
      const url = String(input);
      if (url.endsWith("/health")) {
        return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }));
      }
      if (url.endsWith("/auth/nonce")) {
        return Promise.resolve(
          new Response(JSON.stringify({ nonce: "nonce-1" }), { status: 200 }),
        );
      }
      // probeOrigin / probeOriginWithBody / health probe targets.
      return Promise.resolve(new Response("pong", { status: 200 }));
    }),
  );
}

describe("connectivity / healthProbe / powNonce — default fetches keep the Window receiver", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("probeOrigin's default fetchFn probes instead of throwing illegal invocation", async () => {
    stubWindowFetch();

    await expect(probeOrigin("https://panel.example/health")).resolves.toEqual({ ok: true });
  });

  it("probeOriginWithBody's default fetchFn captures the body", async () => {
    stubWindowFetch();

    // Non-/health URL: the stub's default branch answers the body "pong".
    await expect(probeOriginWithBody("https://panel.example/ping")).resolves.toEqual({
      ok: true,
      body: "pong",
    });
  });

  it("probeHealthEndpoint's default fetchFn reads a healthy body", async () => {
    stubWindowFetch();

    const result = await probeHealthEndpoint("https://panel.example/health");
    expect(result.ok).toBe(true);
    expect(result.body).toEqual({});
  });

  it("powNonce defaults complete the challenge/nonce exchange", async () => {
    stubWindowFetch();

    // `undefined` (fetch failed) would mean the default threw — the exact
    // silent regression that dropped the X-Nonce on chest's live login.
    await expect(fetchChallenge("/api")).resolves.toBe(null);
    await expect(negotiateNonce("/api")).resolves.toBe("nonce-1");
  });

  it("an explicit fetchFn still wins over every default", async () => {
    const guard = vi.fn(() => Promise.reject(new Error("global fetch must not be called")));
    vi.stubGlobal("fetch", guard);
    const explicit = vi.fn(async () => new Response("{}", { status: 200 }));

    await probeOrigin("https://panel.example/", { fetchFn: explicit });
    await probeOriginWithBody("https://panel.example/", { fetchFn: explicit });
    await probeHealthEndpoint("https://panel.example/", { fetchFn: explicit });
    await fetchChallenge("/api", explicit);
    await negotiateNonce("/api", { fetchFn: explicit });

    // negotiateNonce rides the explicit fn twice (challenge + exchange).
    expect(explicit).toHaveBeenCalledTimes(6);
    expect(guard).not.toHaveBeenCalled();
  });
});
