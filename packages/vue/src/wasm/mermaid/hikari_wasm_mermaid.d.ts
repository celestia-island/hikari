// world root:component/root
export type ParseResult = import('./interfaces/hikari-mermaid-types.js').ParseResult;
export type * as HikariMermaidTypes from './interfaces/hikari-mermaid-types.js'; // import hikari:mermaid/types
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
export type * as WasiRandomInsecureSeed0212 from './interfaces/wasi-random-insecure-seed.js'; // import wasi:random/insecure-seed@0.2.12
export function parse(source: string): ParseResult;
/** Permanently stop this instance and dispose guest-owned host resources. */
export const _util: { stop(): void; whenIdle(): Promise<void>; };
