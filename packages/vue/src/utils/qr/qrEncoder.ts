// Thin TS facade over the in-tree Rust QR encoder (hikari-wasm-qr), loaded
// through the tairitsu host client (stage 3).
//
// The component is a wasm32-wasip2 component transcribed at build time; the
// Rust `qrcode` crate provides the encoding core, and this module adapts it to
// the `qrMatrix` API HkQrCode has always consumed.
//
// The facade is SYNCHRONOUS (user ruling: callers do not change). The host
// client's synchronous door (`createSurface`) is what makes that possible: the
// wrapper is in this module graph, so its exports are callable as soon as the
// module is evaluated — no readiness dance in the common path.
import "./declare-caps";
import * as qrWrapper from "../../wasm/qr/hikari_wasm_qr.js";
import {
  createSurface,
  HostClientError,
  type HostComponent,
} from "@celestia-island/tairitsu-host-client";

export type QrErrorCorrectionLevel = "L" | "M" | "Q" | "H";

export interface QrMatrixOptions {
  /** Explicit QR version 1..40, or 0 for auto-detection. Default 0. */
  typeNumber?: number;
  /** Error-correction level. Default "M". */
  errorCorrectionLevel?: QrErrorCorrectionLevel;
}

/** Thrown when `qrMatrix` is called before the component is usable. */
export class QrNotReadyError extends Error {
  constructor(cause?: unknown) {
    super(
      "the QR component is not loaded; await qrReady (or render again once it resolves)",
      { cause },
    );
    this.name = "QrNotReadyError";
  }
}

let surface: HostComponent | undefined;
let loadFailure: unknown;

try {
  surface = createSurface(qrWrapper as unknown as Record<string, unknown>);
} catch (error) {
  loadFailure = error;
}

/** Resolves once the component is usable; rejects if it could not be built. */
export const qrReady: Promise<void> = surface
  ? Promise.resolve()
  : Promise.reject(loadFailure ?? new QrNotReadyError());

qrReady.catch(() => {
  // Consumed by callers that care (`HkQrCode` re-renders on it); a rejected
  // module-level promise nobody handles would be an unhandled rejection.
});

/**
 * Encode `text` as a QR module matrix. `true` = dark module.
 *
 * When `typeNumber` is 0 (default), the encoder auto-selects the smallest
 * version that fits the payload and the chosen ECC level. Throws when the
 * payload overflows the largest version (same contract as the vendored
 * generator it replaced), and `QrNotReadyError` if the component is unusable.
 */
export function qrMatrix(text: string, opts: QrMatrixOptions = {}): boolean[][] {
  if (!surface) {
    if (loadFailure) throw loadFailure;
    throw new QrNotReadyError();
  }
  const level = (opts.errorCorrectionLevel ?? "M").toLowerCase() as
    | "l"
    | "m"
    | "q"
    | "h";
  const result = surface.call<{ size: number; modules: Uint8Array | number[] }>(
    "encode",
    text,
    { ecc: level, version: opts.typeNumber ?? 0 },
  );
  const size = result.size;
  const matrix: boolean[][] = [];
  for (let row = 0; row < size; row++) {
    const line: boolean[] = [];
    for (let col = 0; col < size; col++) {
      line.push(Boolean(result.modules[row * size + col]));
    }
    matrix.push(line);
  }
  return matrix;
}

export { HostClientError };
