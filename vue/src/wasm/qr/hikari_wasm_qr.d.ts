// world root:component/root
export type EncodeOptions = import('./interfaces/hikari-qr-types.js').EncodeOptions;
export type QrCode = import('./interfaces/hikari-qr-types.js').QrCode;
export type * as HikariQrTypes from './interfaces/hikari-qr-types.js'; // import hikari:qr/types
export type * as WasiCliEnvironment0212 from './interfaces/wasi-cli-environment.js'; // import wasi:cli/environment@0.2.12
export type * as WasiCliExit0212 from './interfaces/wasi-cli-exit.js'; // import wasi:cli/exit@0.2.12
export type * as WasiCliStderr0212 from './interfaces/wasi-cli-stderr.js'; // import wasi:cli/stderr@0.2.12
export type * as WasiCliStdin0212 from './interfaces/wasi-cli-stdin.js'; // import wasi:cli/stdin@0.2.12
export type * as WasiCliStdout0212 from './interfaces/wasi-cli-stdout.js'; // import wasi:cli/stdout@0.2.12
export type * as WasiCliTerminalInput0212 from './interfaces/wasi-cli-terminal-input.js'; // import wasi:cli/terminal-input@0.2.12
export type * as WasiCliTerminalOutput0212 from './interfaces/wasi-cli-terminal-output.js'; // import wasi:cli/terminal-output@0.2.12
export type * as WasiCliTerminalStderr0212 from './interfaces/wasi-cli-terminal-stderr.js'; // import wasi:cli/terminal-stderr@0.2.12
export type * as WasiCliTerminalStdin0212 from './interfaces/wasi-cli-terminal-stdin.js'; // import wasi:cli/terminal-stdin@0.2.12
export type * as WasiCliTerminalStdout0212 from './interfaces/wasi-cli-terminal-stdout.js'; // import wasi:cli/terminal-stdout@0.2.12
export type * as WasiClocksMonotonicClock0212 from './interfaces/wasi-clocks-monotonic-clock.js'; // import wasi:clocks/monotonic-clock@0.2.12
export type * as WasiIoError0212 from './interfaces/wasi-io-error.js'; // import wasi:io/error@0.2.12
export type * as WasiIoPoll0212 from './interfaces/wasi-io-poll.js'; // import wasi:io/poll@0.2.12
export type * as WasiIoStreams0212 from './interfaces/wasi-io-streams.js'; // import wasi:io/streams@0.2.12
/**
* @throws {Error & { payload: string }} The error of the result, as the `payload` of the thrown error.
*/
export function encode(text: string, options: EncodeOptions | undefined): QrCode;
/** Permanently stop this instance and dispose guest-owned host resources. */
export const _util: { stop(): void; whenIdle(): Promise<void>;  /** Test whether a value is a declared WIT result error from this instance. */
isComponentError(value: unknown): value is Error & { readonly payload: unknown }; };
export type Option<T> = { tag: 'none' } | { tag: 'some', val: T };
export type Result<T, E> = { tag: 'ok', val: T } | { tag: 'err', val: E };
