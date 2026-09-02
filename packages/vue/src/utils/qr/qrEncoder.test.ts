import { describe, expect, it } from "vitest";

import { qrMatrix } from "./qrEncoder";

const OTPAUTH =
  "otpauth://totp/Example:langyo%40example.com?secret=JBSWY3DPEHPK3PXP&issuer=Example";

describe("qrMatrix", () => {
  it("returns a square boolean matrix for a real otpauth URI", () => {
    const m = qrMatrix(OTPAUTH);
    expect(m.length).toBeGreaterThan(0);
    for (const row of m) {
      expect(row).toHaveLength(m.length);
    }
  });

  it("is deterministic for the same payload", () => {
    expect(qrMatrix(OTPAUTH)).toEqual(qrMatrix(OTPAUTH));
  });

  it("places three 7x7 finder patterns on the corners", () => {
    const m = qrMatrix("HELLO WORLD");
    const n = m.length;
    // Finder pattern: dark border ring, light 1-module gap ring, dark 3x3
    // core. Check the top-left corner box.
    const expectFinderAt = (r0: number, c0: number) => {
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 7; c++) {
          const ring = r === 0 || r === 6 || c === 0 || c === 6;
          const core = r >= 2 && r <= 4 && c >= 2 && c <= 4;
          expect(m[r0 + r][c0 + c]).toBe(ring || core);
        }
      }
    };
    expectFinderAt(0, 0);
    expectFinderAt(0, n - 7);
    expectFinderAt(n - 7, 0);
  });

  it("encodes a balanced module population", () => {
    const m = qrMatrix(OTPAUTH);
    const dark = m.flat().filter(Boolean).length;
    const total = m.length * m.length;
    // QR data is error-corrected and masked; a healthy code lands well
    // between an empty and a full grid.
    expect(dark).toBeGreaterThan(total * 0.2);
    expect(dark).toBeLessThan(total * 0.8);
  });

  it("throws when the payload overflows the largest version", () => {
    expect(() => qrMatrix("x".repeat(5000))).toThrow();
  });
});
