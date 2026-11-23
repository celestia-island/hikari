// The frozen golden (`qrEncoder.test.ts`) pins shape, determinism, finder layout
// and density — but not orientation or the data region: a transposed matrix (an
// unscannable QR) passes it. This file pins the exact modules of a fixed payload,
// so a transposition, a polarity flip or a version/ECC regression is caught.
import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { qrMatrix, qrReady } from "./qrEncoder";

const PAYLOAD = "https://example.com/";

/** Compact, orientation-sensitive fingerprint of a matrix. */
function fingerprint(matrix: boolean[][]): string {
  return matrix.map((row) => row.map((cell) => (cell ? "1" : "0")).join("")).join("\n");
}

describe("qrMatrix orientation and data region", () => {
  it("encodes a fixed payload to an exact, orientation-stable matrix", async () => {
    await qrReady;
    const matrix = qrMatrix(PAYLOAD);
    expect(matrix.length).toBe(25); // version 2, ECC M
    // sha256 of the fingerprint — a transpose or a polarity flip changes it.
    const hash = createHash("sha256").update(fingerprint(matrix)).digest("hex");
    expect(hash).toBe(EXPECTED_SHA256);
  });
});

const EXPECTED_SHA256 = "e2ca213a2056b251ae59c19f5fcec564af7c64f3e0452ae78d5227dc460b55b1";
