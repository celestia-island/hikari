// Thin TS wrapper over the in-tree Rust QR encoder (hikari-wasm-qr,
// compiled to a wasm component via tairitsu's wasm32-wasip2 target).
//
// The Rust `qrcode` crate (same author and algorithm as the vendored
// qrcode-generator.js it replaces) provides the encoding core; the wasm
// component exports a WIT-defined `encode(text, options) -> QrCode`
// contract, and this wrapper adapts it to the `qrMatrix` API HkQrCode
// has always consumed — the component swap is invisible to callers.

import { encode } from "../../wasm/qr/hikari_wasm_qr.js";

export type QrErrorCorrectionLevel = "L" | "M" | "Q" | "H";

export interface QrMatrixOptions {
  /** Explicit QR version 1..40, or 0 for auto-detection. Default 0. */
  typeNumber?: number;
  /** Error-correction level. Default "M". */
  errorCorrectionLevel?: QrErrorCorrectionLevel;
}

/**
 * Encode `text` as a QR module matrix. `true` = dark module.
 *
 * When `typeNumber` is 0 (default), the encoder auto-selects the smallest
 * version that fits the payload and the chosen ECC level. Throws when the
 * payload overflows the largest version (same contract as the vendored
 * generator it replaced).
 */
export function qrMatrix(text: string, opts: QrMatrixOptions = {}): boolean[][] {
  const level = (opts.errorCorrectionLevel ?? "M").toLowerCase() as
    | "l" | "m" | "q" | "h";
  const result = encode(text, {
    ecc: level,
    version: opts.typeNumber ?? 0,
  });
  const size = result.size;
  const matrix: boolean[][] = [];
  for (let row = 0; row < size; row++) {
    const line: boolean[] = [];
    for (let col = 0; col < size; col++) {
      line.push(result.modules[row * size + col]);
    }
    matrix.push(line);
  }
  return matrix;
}
