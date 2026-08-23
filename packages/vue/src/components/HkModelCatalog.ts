/**
 * Model-spec catalog for the HkModelTag hover card.
 * (Upstreamed from shittim-chest's plana-legacy layer.)
 *
 * The catalog is a plain `Record<modelId, HModelMeta>` map. hikari ships
 * a small built-in set of plausible specs as a read-only fallback;
 * services (arona, shittim-chest) provide their own live data via `meta`
 * props or `registerModelCatalog`.
 */

export interface HModelPricing {
  /** USD per 1M input tokens */
  in?: number;
  /** USD per 1M output tokens */
  out?: number;
  /** USD per 1M cached input tokens */
  cached?: number;
}

export interface HModelMeta {
  /** Max input context window (tokens) */
  contextWindow?: number;
  /** Max output tokens */
  maxOutput?: number;
  pricing?: HModelPricing;
  /** Multimodal: accepts image input */
  vision?: boolean;
  /** Extended / deep thinking (reasoning) */
  reasoning?: boolean;
  /** Tool / function calling */
  tools?: boolean;
}

export type HModelCatalog = Record<string, HModelMeta>;

const BUILTIN_CATALOG: HModelCatalog = {
  "deepseek-v4-pro": {
    contextWindow: 128_000, maxOutput: 64_000,
    pricing: { in: 1, out: 5 },
    vision: false, reasoning: true, tools: true,
  },
  "deepseek-v4-flash": {
    contextWindow: 64_000, maxOutput: 8_000,
    pricing: { in: 0.1, out: 0.3 },
    vision: false, reasoning: false, tools: true,
  },
  "gpt-5.5": {
    contextWindow: 400_000, maxOutput: 64_000,
    pricing: { in: 5, out: 30, cached: 0.5 },
    vision: true, reasoning: true, tools: true,
  },
  "claude-sonnet-4-6": {
    contextWindow: 200_000, maxOutput: 32_000,
    pricing: { in: 3, out: 15, cached: 0.3 },
    vision: true, reasoning: false, tools: true,
  },
  "gemini-3.5-flash": {
    contextWindow: 1_000_000, maxOutput: 32_000,
    pricing: { in: 1.5, out: 9, cached: 0.15 },
    vision: true, reasoning: false, tools: true,
  },
  "qwen3.7-max": {
    contextWindow: 256_000, maxOutput: 32_000,
    pricing: { in: 2, out: 8 },
    vision: true, reasoning: true, tools: true,
  },
};

/**
 * Global registry merged over the built-in catalog. Services call this at
 * startup (or import time) to inject their own live model specs without
 * changing component code.
 */
let extraCatalog: HModelCatalog = {};

export function registerModelCatalog(entries: HModelCatalog): void {
  extraCatalog = { ...extraCatalog, ...entries };
}

/**
 * Split a model id of the form `name#tag` into the base name and the
 * trailing tag (e.g. a provider/instance number). Models without a `#`
 * return an empty tag.
 */
export function splitModelId(model: string): { base: string; tag: string } {
  const idx = model.lastIndexOf("#");
  if (idx < 0) return { base: model, tag: "" };
  return { base: model.slice(0, idx), tag: model.slice(idx + 1) };
}

/**
 * Look up model metadata by id (tag-stripped). Undefined when unknown.
 * An optional per-call `catalog` overrides the global registry.
 */
export function getModelMeta(model: string, catalog?: HModelCatalog): HModelMeta | undefined {
  const base = splitModelId(model).base;
  return catalog?.[base] ?? extraCatalog[base] ?? BUILTIN_CATALOG[base];
}
