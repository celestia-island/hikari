/**
 * Hashcash-style proof-of-work helpers (upstreamed from shittim-chest,
 * P5 auth-kit consolidation).
 *
 * Given a `{ seed, bits }` challenge, `solvePow` finds a `counter` such
 * that `SHA-256(UTF-8(seed) || UTF-8(decimal counter))` has at least
 * `bits` leading zero bits. The byte layout is part of the wire contract
 * and must match the verifying backend exactly.
 */

const BATCH = 64;

// ── Synchronous SHA-256 (dependency-free) ─────────────────────────────
// Upstreamed from shittim-chest's PoW worker; runs when `crypto.subtle`
// is unavailable (plain-HTTP non-localhost origins are not a secure
// context and have no WebCrypto at all). Verified against crypto.subtle
// by the pow contract tests.
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
  0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rotr(x: number, n: number): number {
  return (x >>> n) | (x << (32 - n));
}

/** SHA-256 of `data` written into `out` (8 x u32, reuses the buffer). */
function sha256Into(data: Uint8Array, out: Uint32Array): void {
  const len = data.length;
  const bitLen = len * 8;
  const paddedLen = Math.ceil((len + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLen);
  padded.set(data);
  padded[len] = 0x80;
  const dv = new DataView(padded.buffer);
  dv.setUint32(paddedLen - 4, bitLen >>> 0, false);
  dv.setUint32(paddedLen - 8, Math.floor(bitLen / 0x100000000), false);

  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;

  const w = new Uint32Array(64);
  for (let off = 0; off < paddedLen; off += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = dv.getUint32(off + i * 4, false);
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[i] + w[i]) | 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) | 0;
      h = g; g = f; f = e;
      e = (d + temp1) | 0;
      d = c; c = b; b = a;
      a = (temp1 + temp2) | 0;
    }
    h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0; h5 = (h5 + f) | 0; h6 = (h6 + g) | 0; h7 = (h7 + h) | 0;
  }
  out[0] = h0; out[1] = h1; out[2] = h2; out[3] = h3;
  out[4] = h4; out[5] = h5; out[6] = h6; out[7] = h7;
}

/** Leading zero bits of a SHA-256 digest stored as 8 x u32 words. */
function leadingZeroBits32(hash: Uint32Array): number {
  let count = 0;
  for (let i = 0; i < 8; i++) {
    const word = hash[i];
    if (word === 0) {
      count += 32;
    } else {
      count += Math.clz32(word);
      break;
    }
  }
  return count;
}

/**
 * SHA-256 digest of `data` (32 bytes) via the dependency-free sync core.
 * Exported for contract tests (NIST known-answer vectors).
 */
export function sha256(data: Uint8Array): Uint8Array {
  const out = new Uint32Array(8);
  sha256Into(data, out);
  const bytes = new Uint8Array(32);
  const dv = new DataView(bytes.buffer);
  for (let i = 0; i < 8; i++) dv.setUint32(i * 4, out[i], false);
  return bytes;
}

/** Synchronous solver for non-WebCrypto contexts (plain-HTTP origins). */
export function solvePowSync(
  seed: string,
  bits: number,
  onProgress?: (hashed: number) => void,
): number {
  const enc = new TextEncoder();
  const seedBytes = enc.encode(seed);
  const hashOut = new Uint32Array(8);
  let counter = 0;
  const MAX = 268435456;
  for (;;) {
    const counterBytes = enc.encode(String(counter));
    const data = new Uint8Array(seedBytes.length + counterBytes.length);
    data.set(seedBytes, 0);
    data.set(counterBytes, seedBytes.length);
    sha256Into(data, hashOut);
    if (leadingZeroBits32(hashOut) >= bits) {
      return counter;
    }
    counter++;
    if (counter > MAX) {
      throw new Error("PoW exceeded max iterations");
    }
    if (counter % BATCH === 0) onProgress?.(counter);
  }
}

export interface PowChallenge {
  seed: string;
  bits: number;
}

export interface PowSolution {
  seed: string;
  bits: number;
  counter: number;
}

/**
 * Solve a PoW challenge via `crypto.subtle.digest` in batches (correct
 * everywhere, async per batch — the pure-logic path without a worker).
 */
export async function solvePow(
  challenge: PowChallenge,
  onProgress?: (hashed: number) => void,
): Promise<number> {
  const { seed, bits } = challenge;
  const encoder = new TextEncoder();
  const seedBytes = encoder.encode(seed);
  const digest = typeof crypto !== "undefined" && crypto.subtle
    ? crypto.subtle.digest.bind(crypto.subtle)
    : null;
  if (!digest) {
    // Not a secure context (plain-HTTP non-localhost): no WebCrypto at all.
    return solvePowSync(seed, bits, onProgress);
  }

  let base = 0;
  for (;;) {
    const batch = Math.min(BATCH, 1 << 20 - base.toString().length);
    const tasks: Array<Promise<{ counter: number; hash: Uint8Array }>> = [];
    for (let i = 0; i < batch; i++) {
      const counter = base + i;
      tasks.push(
        digest("SHA-256", concat(seedBytes, encoder.encode(String(counter))).buffer).then(
          (buf) => ({ counter, hash: new Uint8Array(buf) }),
        ),
      );
    }
    const results = await Promise.all(tasks);
    for (const { counter, hash } of results) {
      if (leadingZeroBits(hash) >= bits) {
        return counter;
      }
    }
    base += batch;
    onProgress?.(base);
  }
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

/** Number of leading zero bits of a 32-byte SHA-256 digest. */
export function leadingZeroBits(hash: Uint8Array): number {
  let count = 0;
  for (let i = 0; i < hash.length; i++) {
    const byte = hash[i];
    if (byte === 0) {
      count += 8;
    } else {
      count += Math.clz32(byte) - 24;
      break;
    }
  }
  return count;
}

/** Verify a solution against the challenge (async; mirrors the backend check). */
export async function verifyPow(
  challenge: PowChallenge,
  counter: number,
): Promise<boolean> {
  const encoder = new TextEncoder();
  const input = concat(encoder.encode(challenge.seed), encoder.encode(String(counter)));
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const buf = await crypto.subtle.digest("SHA-256", input.buffer);
    return leadingZeroBits(new Uint8Array(buf)) >= challenge.bits;
  }
  const out = new Uint32Array(8);
  sha256Into(input, out);
  return leadingZeroBits32(out) >= challenge.bits;
}
