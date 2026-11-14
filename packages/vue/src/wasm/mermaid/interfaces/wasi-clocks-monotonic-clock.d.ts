/** @module Interface wasi:clocks/monotonic-clock@0.2.12 **/
export function subscribeDuration(when: Duration): Pollable;
export type Duration = bigint;
export type Pollable = import('./wasi-io-poll.js').Pollable;
