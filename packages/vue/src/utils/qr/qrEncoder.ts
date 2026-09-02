// Thin TS wrapper over the vendored MIT qrcode-generator (Kazuhiko Arase).
// Exposes a single `qrMatrix` helper used by HkQrCode to render a QR code
// without any external dependency (the shared pnpm virtual-store layout
// cannot install new packages in this workspace, so the encoder is vendored
// as a self-contained ES module).

import qrcode from "./qrcode-generator";

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
 * When `typeNumber` is 0 (default), the vendored generator auto-selects the
 * smallest version that fits the payload and the chosen ECC level.
 */
export function qrMatrix(text: string, opts: QrMatrixOptions = {}): boolean[][] {
  const level = opts.errorCorrectionLevel ?? "M";
  const typeNumber = opts.typeNumber ?? 0;
  const qr = qrcode(typeNumber, level);
  qr.addData(text);
  qr.make();
  const count = qr.getModuleCount();
  const matrix: boolean[][] = [];
  for (let row = 0; row < count; row++) {
    const line: boolean[] = [];
    for (let col = 0; col < count; col++) line.push(qr.isDark(row, col));
    matrix.push(line);
  }
  return matrix;
}
