// Type declarations for the vendored MIT qrcode-generator (Kazuhiko Arase).
// The implementation lives in ./qrcode-generator.js (ESM default export).
export interface QRCodeModule {
  /** Add a data segment (default mode "Byte"). */
  addData(data: string, mode?: string): void;
  /** Encode the added data and render the module matrix. */
  make(): void;
  /** Number of modules per side (the rendered matrix is count x count). */
  getModuleCount(): number;
  /** Whether the module at (row, col) is dark. */
  isDark(row: number, col: number): boolean;
}

declare function qrcode(
  typeNumber: number,
  errorCorrectionLevel: "L" | "M" | "Q" | "H",
): QRCodeModule;

export default qrcode;
