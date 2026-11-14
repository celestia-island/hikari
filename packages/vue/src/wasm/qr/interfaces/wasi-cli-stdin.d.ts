/** @module Interface wasi:cli/stdin@0.2.12 **/
export function getStdin(): InputStream;
export type InputStream = import('./wasi-io-streams.js').InputStream;
