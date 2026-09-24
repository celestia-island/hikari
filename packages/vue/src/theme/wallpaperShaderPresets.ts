/**
 * Wallpaper shader preset registry — the HOST-facing half of the pipeline
 * wallpaper layer. A host registers its fragment shaders (plus optional
 * texture / scale / overlay config) under runtime preset ids; the shared
 * renderer (`wallpaperShaderRenderer.ts`) and the wallpaper logic layer
 * (via `WallpaperPipelineLookup`) resolve those ids through this registry.
 *
 * Why a registry and not an import: hikari ships TS source with zero path
 * aliases, and shader sources are application assets that live in each
 * host's generated bundle (chest's `@shaders/shaders`, erp's
 * `.generated/shaders`) — an alias import here would force every consumer
 * to configure the same vite/tsconfig mapping. The same design language as
 * `registerTokenGroup` / `registerThemeDecor`: hikari owns the mechanism,
 * the host owns the content, and the built-in default is an EMPTY table —
 * hikari deliberately bundles no GLSL of its own.
 *
 * Hard rules this module holds:
 *
 *  - **Zero alias imports.** Nothing here may reference `@shaders/*`,
 *    `@wallpapers/*` or any other consumer-side alias (guarded by
 *    `wallpaperShaderAliasGuard.test.ts`).
 *  - **Registration is not a side effect of importing.** A host that never
 *    calls `registerShaderPresets` gets an untouched (empty) registry and
 *    every pipeline lookup degrades to `null` — the "no pipeline
 *    wallpapers" state the backdrop renders as the solid floor.
 *  - **Invalid input fails loudly** (themeDecor's rule): an empty preset
 *    id or an empty fragment throws at registration time. The silent
 *    alternative is a wallpaper that renders nothing with no error
 *    anywhere.
 *  - **Re-registration overrides.** Registering the same id again
 *    replaces the previous entry — the escape hatch for hosts that swap
 *    preset tables at runtime (a fresh codegen, an A/B experiment).
 */

/** Normalized render-scale config: flat on landscape, a curve on portrait. */
export interface WallpaperShaderScaleConfig {
  /** Uniform value at aspect >= 1.0. */
  desktop: number;
  /** Uniform value below aspect 1.0, given the live canvas aspect. */
  mobile: (aspect: number) => number;
}

/** Host input for `render`: the mobile scale as a safe-evaluated formula
 *  string (the generated theme manifests carry `"Math.min(4.0, 2.88 /
 *  aspect)"`-style expressions) or a ready-made closure. */
export interface WallpaperShaderScaleInput {
  desktop: number;
  mobile: string | ((aspect: number) => number);
}

/** Scrim colors the host's page CSS mixes over the canvas, per mode. */
export interface WallpaperShaderOverlayConfig {
  light: string;
  dark: string;
}

/** What a host hands to `registerShaderPresets` — the record KEY is the
 *  preset id (`omphalos.dark`, `single`, …); no `id` field to drift. */
export interface WallpaperShaderPresetInput {
  /** Fragment-shader source (GLSL ES 3.00). Must be non-empty. */
  fragment: string;
  /** Optional texture URL (data: or asset import) bound to `u_texture`. */
  texture?: string;
  /** Optional scale config (see `WallpaperShaderScaleInput`). */
  render?: WallpaperShaderScaleInput;
  /** Optional overlay colors for the host's scrim. */
  overlay?: WallpaperShaderOverlayConfig;
}

/** The stored preset `getShaderPreset` resolves to — the input with `id`
 *  filled from the registration key and `render` normalized to a
 *  `WallpaperShaderScaleConfig`. */
export interface WallpaperShaderPreset {
  id: string;
  fragment: string;
  texture?: string;
  render?: WallpaperShaderScaleConfig;
  overlay?: WallpaperShaderOverlayConfig;
}

// The registry itself. A Map (not a plain object) so preset ids cannot
// collide with Object.prototype members ("constructor", "toString", …) —
// a generated manifest containing such an id would otherwise shadow a
// prototype member and misbehave in surprising ways.
const shaderPresets = new Map<string, WallpaperShaderPreset>();

/**
 * Safe arithmetic evaluator for mobile-scale formula strings — a
 * hand-rolled recursive-descent parser, NOT `eval`/`Function`: generated
 * theme manifests are build inputs, and feeding those to `eval` would
 * make one poisoned codegen artifact a code-execution vector.
 *
 * Supported grammar: `+ - * /`, parentheses, unary minus, number
 * literals, the registered variable names (the live aspect), and exactly
 * `Math.min(a, b)` / `Math.max(a, b)` as the only function calls.
 */
function safeEvalArithmetic(
  expr: string,
  vars: Record<string, number>,
): number {
  const s = expr.trim();
  let pos = 0;

  function skip() {
    while (pos < s.length && s[pos] === " ") pos++;
  }

  function parseAtom(): number {
    skip();
    if (s[pos] === "(") {
      pos++;
      const v = parseExpr();
      skip();
      pos++;
      return v;
    }
    for (const name of ["Math.min", "Math.max"] as const) {
      if (s.slice(pos, pos + name.length) === name) {
        pos += name.length;
        skip();
        pos++;
        const a = parseExpr();
        skip();
        pos++;
        const b = parseExpr();
        skip();
        pos++;
        return name === "Math.min" ? Math.min(a, b) : Math.max(a, b);
      }
    }
    for (const [name, val] of Object.entries(vars)) {
      if (
        s.slice(pos, pos + name.length) === name &&
        !/[a-zA-Z0-9_]/.test(s[pos + name.length] ?? "")
      ) {
        pos += name.length;
        return val;
      }
    }
    const start = pos;
    while (pos < s.length && /[\d.]/.test(s[pos])) pos++;
    return parseFloat(s.slice(start, pos));
  }

  function parseUnary(): number {
    skip();
    if (s[pos] === "-") {
      pos++;
      return -parseUnary();
    }
    return parseAtom();
  }

  function parseMul(): number {
    let left = parseUnary();
    skip();
    while (pos < s.length && (s[pos] === "*" || s[pos] === "/")) {
      const op = s[pos++];
      const right = parseUnary();
      left = op === "*" ? left * right : left / right;
      skip();
    }
    return left;
  }

  function parseExpr(): number {
    let left = parseMul();
    skip();
    while (pos < s.length && (s[pos] === "+" || s[pos] === "-")) {
      const op = s[pos++];
      const right = parseMul();
      left = op === "+" ? left + right : left - right;
      skip();
    }
    return left;
  }

  return parseExpr();
}

/** The sanctioned charset for a formula string — reject anything outside
 *  arithmetic, parentheses, whitespace and identifier letters up front. */
const FORMULA_CHARSET = /^[\d\s+\-*/().,a-zA-Z]+$/;

/**
 * Normalize a host's `render` input into the stored scale config.
 *
 * Two fallback tiers, both degrading to the constant desktop scale (never
 * to NaN — a NaN `u_scale` poisons the vertex math and the canvas goes
 * black):
 *
 *  1. a formula string with characters outside the arithmetic charset is
 *     rejected unread;
 *  2. a formula that passes the charset gate but still fails to parse
 *     (`Math.pow(aspect, 2)`) evaluates to NaN and is dropped at call
 *     time (the `Number.isFinite` guard carried from chest's registry).
 */
function normalizeScaleConfig(cfg: WallpaperShaderScaleInput): WallpaperShaderScaleConfig {
  if (typeof cfg.mobile === "function") {
    // A host-provided closure needs no evaluation — but its output still
    // must not leak NaN into the uniform, so it gets the same finite gate.
    const mobileFn = cfg.mobile;
    return {
      desktop: cfg.desktop,
      mobile: (a) => {
        const v = mobileFn(a);
        return Number.isFinite(v) ? v : cfg.desktop;
      },
    };
  }
  const mobileSrc = cfg.mobile.trim();
  if (!FORMULA_CHARSET.test(mobileSrc)) {
    return { desktop: cfg.desktop, mobile: () => cfg.desktop };
  }
  return {
    desktop: cfg.desktop,
    mobile: (a) => {
      const v = safeEvalArithmetic(mobileSrc, { aspect: a });
      return Number.isFinite(v) ? v : cfg.desktop;
    },
  };
}

function assertPresetInput(id: string, input: WallpaperShaderPresetInput): void {
  if (typeof id !== "string" || id.length === 0) {
    throw new Error(`[wallpaperShaderPresets] preset registered with an empty id`);
  }
  if (!input || typeof input.fragment !== "string" || input.fragment.length === 0) {
    throw new Error(
      `[wallpaperShaderPresets] preset "${id}" registered without a fragment shader`,
    );
  }
}

/**
 * Register (or override) wallpaper shader presets. The record key is the
 * runtime preset id — dual-mode themes register two entries
 * (`"omphalos.dark"`, `"omphalos.light"`); the wallpaper logic layer
 * resolves the mode suffix itself before looking up.
 *
 * Must run before the wallpaper state hydrates for the stored ids to
 * resolve (host boot order: register → `initWallpaper`), same as
 * `registerWallpaperPack`.
 */
export function registerShaderPresets(presets: Record<string, WallpaperShaderPresetInput>): void {
  for (const [id, input] of Object.entries(presets ?? {})) {
    assertPresetInput(id, input);
    shaderPresets.set(id, {
      id,
      fragment: input.fragment,
      ...(input.texture !== undefined && input.texture !== null
        ? { texture: input.texture }
        : {}),
      ...(input.render ? { render: normalizeScaleConfig(input.render) } : {}),
      // Shallow-copied so later host mutation cannot desync the registry
      // (themeDecor holds the same line for its props bag).
      ...(input.overlay ? { overlay: { ...input.overlay } } : {}),
    });
  }
}

/** Resolve a preset id, or `null` when nothing is registered under it —
 *  the value the backdrop's pipeline branch stands down on. */
export function getShaderPreset(id: string): WallpaperShaderPreset | null {
  return shaderPresets.get(id) ?? null;
}

/** Every registered preset id, in registration order — introspection for
 *  hosts and tests; mutation goes through `registerShaderPresets`. */
export function listShaderPresetIds(): string[] {
  return [...shaderPresets.keys()];
}
