/**
 * Types for `scripts/emit-res-scripts.mjs` — the `res/*.ts` -> `res/*.js`
 * compiler that `src/res/authoredResScripts.test.ts` imports.
 *
 * The emitter itself stays `.mjs` on purpose: it is a node-run build driver,
 * not part of the shipped package (`files` lists `src/`, `dist/types/`, so
 * `scripts/` never travels to a consumer), and it is executed by node directly
 * rather than type-stripped. This declaration is the seam that lets the drift
 * test import it under `strict` without the emitter having to be TypeScript —
 * the same split the package uses for `boot-chrome.js` / `boot-chrome.d.ts`.
 */

/** One `res/<name>.ts` source and the `res/<name>.js` it compiles to. */
export interface ResScript {
  /** Source file name, e.g. `theme-loader.ts`. */
  readonly source: string;
  /** Shared stem, e.g. `theme-loader`. */
  readonly stem: string;
  /** Absolute path of the `.ts` source. */
  readonly sourcePath: string;
  /** Absolute path of the `.js` output. */
  readonly outputPath: string;
}

/** The banner every emitted asset opens with. */
export declare const GENERATED_BANNER: string;

/** The compile targets, computed once at load. */
export declare const AUTHORED_RES_SCRIPTS: readonly ResScript[];

/** Discover every `res/<name>.ts` as a compile target, sorted by name. */
export declare function authoredResScripts(): ResScript[];

/**
 * Transpile one authored source to its classic-script JavaScript.
 *
 * Pure and deterministic: the build writes this string, and the drift test
 * compares it against the committed `.js`.
 */
export declare function transpile(sourceText: string, fileName?: string): string;

/** Compile every authored asset and write the outputs; returns what it wrote. */
export declare function emitAll(): Array<ResScript & { readonly output: string }>;
