// Types for scripts/build-error-landing.mjs — the standalone error-landing
// artifact generator. The drift test (src/errorReporting/
// errorLandingStandalone.test.ts) imports the builder's constants and
// result shape; vue-tsc has no JS sources in its program, so this
// declaration is what keeps that import typed.

/** Absolute path of the committed artifact the CLI writes. */
export declare const ERROR_LANDING_OUTPUT: string;

/** The placeholder written into the committed artifact's provenance sha. */
export declare const DEV_SHA_PLACEHOLDER: "<dev>";

/** The family modules the built page must be built from (import identity). */
export declare const IDENTITY_MODULES: Readonly<Record<"islandReader" | "takeover" | "card", string>>;

/** The i18n namespaces the page's bundled components read. */
export declare const LOCALE_KEY_PREFIXES: readonly string[];

export interface ErrorLandingBuildResult {
  /** The full artifact html (single file, inline style + module script). */
  html: string;
  /** Gzipped size of `html` at level 9, in bytes. */
  gzipBytes: number;
  /** Sorted `importer -> resolved` edges of the build's module graph. */
  recorded: string[];
}

/**
 * Build the artifact bytes in memory (writes nothing). Deterministic for
 * the same tree; the provenance sha comes from `options.sha`, then
 * `HIKARI_ERROR_LANDING_SHA8`, then the `<dev>` placeholder.
 */
export declare function buildErrorLandingHtml(options?: {
  version?: string;
  sha?: string;
}): Promise<ErrorLandingBuildResult>;

/** `<meta name="hk-error-landing" content="v1 <version> <sha>">`. */
export declare function provenanceMeta(version: string, sha: string): string;

/** The narrowed locale module table for the i18n context's glob. */
export declare function buildLocaleSubset(): {
  modules: Record<string, { default: Record<string, string> }>;
  locales: string[];
};
