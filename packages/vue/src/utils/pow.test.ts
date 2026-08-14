import { describe, expect, it } from "vitest";
import { leadingZeroBits, sha256, solvePow, solvePowSync, verifyPow } from "./pow";

describe("pow", () => {
  it("leadingZeroBits counts correctly", () => {
    // Two zero bytes (16) plus the 0x01 byte's seven leading zeros = 23.
    // The upstream plana expectation of 16 missed the final byte.
    expect(leadingZeroBits(new Uint8Array([0, 0, 1, 0]))).toBe(23);
    expect(leadingZeroBits(new Uint8Array([0x80, 0, 0]))).toBe(0);
    expect(leadingZeroBits(new Uint8Array([0x01, 0, 0]))).toBe(7);
  });

  it("solvePow finds a counter meeting the difficulty", async () => {
    const counter = await solvePow({ seed: "test-seed", bits: 8 });
    expect(await verifyPow({ seed: "test-seed", bits: 8 }, counter)).toBe(true);
  });

  it("matches the NIST SHA-256 known-answer vectors (sync core)", () => {
    const enc = new TextEncoder();
    const hex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
    const vectors: Array<[string, string]> = [
      ["abc", "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"],
      ["", "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"],
      ["abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq", "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1"],
    ];
    for (const [input, expected] of vectors) {
      expect(hex(sha256(enc.encode(input)))).toBe(expected);
    }
  });

  it("the sync solver matches the subtle path (same wire contract)", async () => {
    const counter = solvePowSync("test-seed", 8);
    expect(await verifyPow({ seed: "test-seed", bits: 8 }, counter)).toBe(true);
    const c1 = solvePowSync("fixed-seed", 12);
    const c2 = solvePowSync("fixed-seed", 12);
    expect(c1).toBe(c2);
  });

  it("the hash layout is deterministic (wire contract)", async () => {
    const c1 = await solvePow({ seed: "fixed-seed", bits: 12 });
    const c2 = await solvePow({ seed: "fixed-seed", bits: 12 });
    expect(c1).toBe(c2);
    expect(await verifyPow({ seed: "fixed-seed", bits: 12 }, c1)).toBe(true);
  });
});
