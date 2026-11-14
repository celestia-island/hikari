/** @module Interface wasi:io/streams@0.2.12 **/
export type Error = import('./wasi-io-error.js').Error;
export type StreamError = StreamErrorLastOperationFailed | StreamErrorClosed;
export interface StreamErrorLastOperationFailed {
  tag: 'last-operation-failed',
  val: Error,
}
export interface StreamErrorClosed {
  tag: 'closed',
}
export type Pollable = import('./wasi-io-poll.js').Pollable;

export class InputStream {
  /**
   * This type does not have a public constructor.
   */
  private constructor();
}

export class OutputStream {
  /**
   * This type does not have a public constructor.
   */
  private constructor();
  /**
  * @throws {StreamError} To return the error of the result, throw it, or an `Error` that has it as its `payload`.
  */
  checkWrite(): bigint;
  /**
  * @throws {StreamError} To return the error of the result, throw it, or an `Error` that has it as its `payload`.
  */
  write(contents: Uint8Array): void;
  /**
  * @throws {StreamError} To return the error of the result, throw it, or an `Error` that has it as its `payload`.
  */
  blockingFlush(): void;
  subscribe(): Pollable;
}
