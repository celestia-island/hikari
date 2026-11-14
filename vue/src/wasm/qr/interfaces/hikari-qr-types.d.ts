/** @module Interface hikari:qr/types **/
/**
 * # Variants
 * 
 * ## `"l"`
 * 
 * ## `"m"`
 * 
 * ## `"q"`
 * 
 * ## `"h"`
 */
export type EccLevel = "l" | "m" | "q" | "h";
export interface EncodeOptions {
  ecc?: EccLevel,
  version?: number,
}
export interface QrCode {
  size: number,
  modules: Array<boolean>,
  version: number,
  ecc: EccLevel,
  mask: number,
}
