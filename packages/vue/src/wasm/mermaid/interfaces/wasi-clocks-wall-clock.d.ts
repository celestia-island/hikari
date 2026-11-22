/** @module Interface wasi:clocks/wall-clock@0.2.12 **/
export function now(): Datetime;
export interface Datetime {
  seconds: bigint,
  nanoseconds: number,
}
