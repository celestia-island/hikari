// Thin TS facade over the in-tree Rust QR encoder (hikari-wasm-qr), loaded
// through the tairitsu host client (stage 3).
//
// The component is a wasm32-wasip2 component transcribed at build time; the
// Rust `qrcode` crate provides the encoding core, and this module adapts it to
// the `qrMatrix` API HkQrCode has always consumed.
//
// The facade is SYNCHRONOUS (user ruling: callers do not change). The wrapper is
// loaded with a DYNAMIC import so a broken artifact degrades this component
// instead of aborting the module graph that hosts it: a static import is
// evaluated before this file's body runs, so no `try` here could ever catch its
// failure and the whole page went blank (#1498). The load starts at module init
// and the first calls render plaintext (or throw `QrNotReadyError`) until it
// lands.
import { QR_CAPABILITIES, QR_DECLARATION_PUBLISHED } from "./declare-caps";
// The GENERATED result type, not a hand-written copy of it: this file is the
// one path that consumes the component's contract, and re-typing the shape here
// made the generated type inert — the whole `interfaces/` tree could drift or
// be deleted with `vue-tsc` and the suite both green (measured).
import type { QrCode } from "../../wasm/qr/hikari_wasm_qr.js";
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
let loadFailure: QrNotReadyError | undefined;
let loadPromise: Promise<void> | undefined;

/** Start loading; cached so every caller shares one attempt. */
function ensureLoadedOnce(): Promise<void> {
  if (!loadPromise) {
    loadPromise = import("../../wasm/qr/hikari_wasm_qr.js")
      .then((wrapper) =>
        createSurface(
          wrapper as unknown as Record<string, unknown>,
          // Hand the declaration to the door, don't just publish it: with the
          // parameter omitted it defaults to `{}`, so the door's own refusal
          // (`sync-door-cannot-provide`) can never fire and a wrong declaration
          // would pass unnoticed. Passing it makes the declaration checkable.
          QR_CAPABILITIES,
        ),
      )
      .then((built) => {
        surface = built;
      })
      .catch((error: unknown) => {
        // Kept as the component's own error type so a caller can recognise it,
        // and re-thrown so the ready promise REJECTS: resolving here would tell
        // a waiting host the component is usable when it is not (measured — the
        // facade stayed silent and every later call returned nothing).
        loadFailure = new QrNotReadyError(error);
        // Clear the cached attempt so the next call retries, matching
        // `useHighlight`: a transient failure (a 404, a dropped connection)
        // otherwise degrades this component for the rest of the session.
        loadPromise = undefined;
        throw loadFailure;
      });
  }
  return loadPromise;
}

/**
 * Resolves once the component is usable; rejects if it could not be built.
 *
 * Safe to ignore for the common path — `qrMatrix` works without waiting — but
 * a host that can wait (`HkQrCode` re-draws on it) should.
 *
 * Derived lazily rather than captured once: a failed attempt clears the cached
 * promise so a later host can retry, and this getter then reflects that attempt
 * instead of replaying the first rejection for the rest of the session.
 */
export function whenQrReady(): Promise<void> {
  return ensureLoadedOnce().then(() => {
    if (!surface) throw loadFailure ?? new QrNotReadyError();
  });
}

/** Snapshot of the first attempt, kept for callers that only want a value. */
export const qrReady: Promise<void> = whenQrReady();

/** Keeps the declaration module live for bundlers that honour `sideEffects`. */
export const qrCapabilities = QR_CAPABILITIES;
void QR_DECLARATION_PUBLISHED;

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
    // Start (or retry) a load; this call still refuses.
    void ensureLoadedOnce();
    throw loadFailure ?? new QrNotReadyError();
  }
  const level = (opts.errorCorrectionLevel ?? "M").toLowerCase() as
    | "l"
    | "m"
    | "q"
    | "h";
  const result = surface.call<QrCode>(
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
