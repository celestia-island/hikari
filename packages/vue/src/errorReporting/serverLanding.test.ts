import { describe, expect, it } from "vitest";

import {
  HkServerErrorLandingError,
  parseServerErrorLanding,
  readServerErrorLanding,
  serializeServerErrorLanding,
  SERVER_ERROR_LANDING_ID,
  SERVER_ERROR_LANDING_VERSION,
  type HkServerErrorLanding,
} from "./serverLanding";

const VALID = {
  v: SERVER_ERROR_LANDING_VERSION,
  status: 502,
  code: "identity_provider_unreachable",
  message: "identity provider unreachable: identity provider answered 400 Bad Request",
  raw: { error: "identity provider unreachable: identity provider answered 400 Bad Request" },
};

/** The island exactly as a server injects it into index.html. */
function plantIsland(text: string, type = "application/json"): HTMLScriptElement {
  const island = document.createElement("script");
  island.id = SERVER_ERROR_LANDING_ID;
  island.type = type;
  island.textContent = text;
  document.head.appendChild(island);
  return island;
}

describe("parseServerErrorLanding", () => {
  it("accepts the documented island shape and keeps every field", () => {
    expect(parseServerErrorLanding(JSON.stringify(VALID))).toEqual({
      status: 502,
      code: "identity_provider_unreachable",
      message: VALID.message,
      raw: VALID.raw,
    });
  });

  it("derives nothing: an absent code is an empty code, an absent message an empty one", () => {
    // The CARD owns the fallbacks (`http_<status>` chip, the generic
    // description) so a host reading the payload sees what the server
    // actually sent.
    expect(parseServerErrorLanding('{"v":1,"status":404}')).toEqual({
      status: 404,
      code: "",
      message: "",
    });
    expect(parseServerErrorLanding('{"v":1,"status":404,"raw":null}')?.raw).toBeNull();
  });

  it("ignores unknown keys (a newer server may add fields)", () => {
    const parsed = parseServerErrorLanding('{"v":1,"status":403,"trace_id":"abc-123"}');
    expect(parsed).toEqual({ status: 403, code: "", message: "" });
  });

  it("refuses a future island version instead of half-rendering it", () => {
    expect(parseServerErrorLanding('{"v":2,"status":502,"message":"x"}')).toBeNull();
    // A missing version is not "version 1 by default": the contract is
    // explicit so a shape change can never be mistaken for this one.
    expect(parseServerErrorLanding('{"status":502,"message":"x"}')).toBeNull();
  });

  it("refuses anything that is not an error status", () => {
    // A 2xx/3xx "handoff" would be a bug in the server; a 3xx is a
    // redirect the browser must follow, never a landing.
    for (const status of [200, 302, 399, 600, 700, 400.5, "502", null]) {
      expect(parseServerErrorLanding(JSON.stringify({ v: 1, status })), `status ${status}`).toBeNull();
    }
  });

  it("refuses malformed text and non-object payloads", () => {
    for (const text of ["", "not json", "null", "[]", '"a string"', "42", "{", undefined as unknown as string]) {
      expect(parseServerErrorLanding(text as string), String(text)).toBeNull();
    }
  });

  it("reads escapes back: a payload with markup characters survives the round trip", () => {
    const landing: HkServerErrorLanding = {
      status: 400,
      code: "bad_redirect",
      message: "</script><script>alert(1)</script> & <b>",
      raw: { next: "https://example.test/?a=1&b=2" },
    };
    const text = serializeServerErrorLanding(landing);
    // Nothing in the island text can close the element or read as markup.
    expect(text).not.toContain("<");
    expect(text).not.toContain(">");
    expect(text).not.toContain("&");
    expect(parseServerErrorLanding(text)).toEqual(landing);
  });
});

describe("serializeServerErrorLanding", () => {
  it("writes the version and omits `raw` when there is none", () => {
    expect(serializeServerErrorLanding({ status: 404, code: "not_found", message: "no such file" }))
      .toBe('{"v":1,"status":404,"code":"not_found","message":"no such file"}');
  });

  it("keeps line and paragraph separators escaped (they end a JS string literal)", () => {
    const text = serializeServerErrorLanding({ status: 500, code: "", message: "\u2028\u2029" });
    expect(text).not.toMatch(/[\u2028\u2029]/);
    expect(JSON.parse(text).message).toBe("\u2028\u2029");
  });
});

describe("HkServerErrorLandingError", () => {
  it("names itself after the wire code, or http_<status> without one", () => {
    const withCode = new HkServerErrorLandingError({ status: 502, code: "upstream_down", message: "m" });
    expect(withCode.name).toBe("upstream_down");
    expect(withCode.message).toBe("m");
    expect(withCode.status).toBe(502);
    expect(withCode.raw).toBeUndefined();

    const bare = new HkServerErrorLandingError({ status: 404, code: "  ", message: "" });
    expect(bare.name).toBe("http_404");
  });

  it("is an Error, so the ordinary error channels treat it like any other", () => {
    const err = new HkServerErrorLandingError({ status: 503, code: "", message: "down", raw: { a: 1 } });
    expect(err).toBeInstanceOf(Error);
    expect(err.raw).toEqual({ a: 1 });
    // The report reads `details`; the wire calls it `raw` — one value.
    expect(err.details).toEqual({ a: 1 });
  });
});

describe("readServerErrorLanding", () => {
  it("returns null when the document carries no island", () => {
    expect(readServerErrorLanding()).toBeNull();
  });

  it("ignores a same-id element that is not a JSON data block", () => {
    // An executable script must never be read as a payload, whatever its id.
    plantIsland(JSON.stringify(VALID), "module");
    expect(readServerErrorLanding()).toBeNull();
    document.getElementById(SERVER_ERROR_LANDING_ID)?.remove();
  });

  it("reads the island and CONSUMES it — a second read sees nothing", () => {
    plantIsland(serializeServerErrorLanding(VALID));
    const first = readServerErrorLanding();
    expect(first).toEqual({
      status: 502,
      code: VALID.code,
      message: VALID.message,
      raw: VALID.raw,
    });
    expect(document.getElementById(SERVER_ERROR_LANDING_ID)).toBeNull();
    expect(readServerErrorLanding()).toBeNull();
  });

  it("consumes a malformed island too, so it is not re-parsed on every install", () => {
    plantIsland("{not json");
    expect(readServerErrorLanding()).toBeNull();
    expect(document.getElementById(SERVER_ERROR_LANDING_ID)).toBeNull();
  });

  it("searches the given root, not just the document", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const island = document.createElement("script");
    island.id = SERVER_ERROR_LANDING_ID;
    island.type = "application/json";
    island.textContent = '{"v":1,"status":410,"message":"gone"}';
    host.appendChild(island);
    expect(readServerErrorLanding(host)?.status).toBe(410);
    expect(host.children.length).toBe(0);
    host.remove();
  });
});
