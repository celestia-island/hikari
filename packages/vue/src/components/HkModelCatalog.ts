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
  "glm-5.3-flash": {
    contextWindow: 128_000, maxOutput: 32_000,
    pricing: { in: 0.5, out: 2 },
    vision: false, reasoning: true, tools: true,
  },
  "gpt-5.5-pro": {
    contextWindow: 400_000, maxOutput: 100_000,
    pricing: { in: 10, out: 50, cached: 1 },
    vision: true, reasoning: true, tools: true,
  },
  "gpt-5.4": {
    contextWindow: 400_000, maxOutput: 64_000,
    pricing: { in: 2.5, out: 15, cached: 0.25 },
    vision: true, reasoning: true, tools: true,
  },
  "gpt-5.4-nano": {
    contextWindow: 400_000, maxOutput: 16_000,
    pricing: { in: 0.2, out: 1.2, cached: 0.05 },
    vision: false, reasoning: false, tools: true,
  },
  "claude-opus-5": {
    contextWindow: 200_000, maxOutput: 64_000,
    pricing: { in: 5, out: 25, cached: 0.5 },
    vision: true, reasoning: true, tools: true,
  },
  "claude-haiku-4-5": {
    contextWindow: 200_000, maxOutput: 32_000,
    pricing: { in: 0.8, out: 4, cached: 0.08 },
    vision: false, reasoning: false, tools: true,
  },
  "gemini-3.1-pro-preview": {
    contextWindow: 1_000_000, maxOutput: 64_000,
    pricing: { in: 5, out: 30 },
    vision: true, reasoning: true, tools: true,
  },
  "gemini-3.1-flash-preview": {
    contextWindow: 1_000_000, maxOutput: 64_000,
    pricing: { in: 1.5, out: 10 },
    vision: true, reasoning: true, tools: true,
  },
  "gemini-3-flash": {
    contextWindow: 1_000_000, maxOutput: 32_000,
    pricing: { in: 1.5, out: 9 },
    vision: true, reasoning: false, tools: true,
  },
  "qwen3.7:14b": {
    contextWindow: 262_144, maxOutput: 32_768,
    vision: false, reasoning: true, tools: true,
  },
  "qwen3.8:27b": {
    contextWindow: 262_144, maxOutput: 32_768,
    vision: false, reasoning: true, tools: true,
  },

  // ── Demo registry generation (integration db/seed.sql provider lists +
  // world_service agent_models). Every id a demo card can carry must
  // resolve here, or its context ring degrades to the empty "–" state.
  // Anthropic — dotted ids are the registry's own spellings, kept as
  // first-class entries so exact-match lookup never misses.
  "claude-sonnet-5": {
    contextWindow: 200_000, maxOutput: 64_000,
    pricing: { in: 3, out: 15, cached: 0.3 },
    vision: true, reasoning: true, tools: true,
  },
  "claude-fable-5": {
    contextWindow: 200_000, maxOutput: 32_000,
    pricing: { in: 3, out: 15 },
    vision: true, reasoning: false, tools: true,
  },
  "claude-opus-4.8": {
    contextWindow: 200_000, maxOutput: 64_000,
    pricing: { in: 5, out: 25, cached: 0.5 },
    vision: true, reasoning: true, tools: true,
  },
  "claude-opus-4.8-fast": {
    contextWindow: 200_000, maxOutput: 32_000,
    pricing: { in: 3, out: 15, cached: 0.5 },
    vision: true, reasoning: true, tools: true,
  },
  "claude-opus-4.7": {
    contextWindow: 200_000, maxOutput: 32_000,
    pricing: { in: 5, out: 25, cached: 0.5 },
    vision: true, reasoning: true, tools: true,
  },
  "claude-opus-4.5": {
    contextWindow: 200_000, maxOutput: 32_000,
    pricing: { in: 5, out: 25 },
    vision: true, reasoning: true, tools: true,
  },
  "claude-sonnet-4.6": {
    contextWindow: 200_000, maxOutput: 32_000,
    pricing: { in: 3, out: 15, cached: 0.3 },
    vision: true, reasoning: false, tools: true,
  },
  "claude-haiku-4.5": {
    contextWindow: 200_000, maxOutput: 32_000,
    pricing: { in: 0.8, out: 4, cached: 0.08 },
    vision: false, reasoning: false, tools: true,
  },
  // OpenAI — the 5.6 terra/sol/luna tiers.
  "gpt-5.6-terra-pro": {
    contextWindow: 400_000, maxOutput: 100_000,
    pricing: { in: 12, out: 60, cached: 1.2 },
    vision: true, reasoning: true, tools: true,
  },
  "gpt-5.6-terra": {
    contextWindow: 400_000, maxOutput: 64_000,
    pricing: { in: 6, out: 30, cached: 0.6 },
    vision: true, reasoning: true, tools: true,
  },
  "gpt-5.6-sol-pro": {
    contextWindow: 400_000, maxOutput: 100_000,
    pricing: { in: 10, out: 50, cached: 1 },
    vision: true, reasoning: true, tools: true,
  },
  "gpt-5.6-sol": {
    contextWindow: 400_000, maxOutput: 64_000,
    pricing: { in: 5, out: 30, cached: 0.5 },
    vision: true, reasoning: true, tools: true,
  },
  "gpt-5.6-luna-pro": {
    contextWindow: 400_000, maxOutput: 64_000,
    pricing: { in: 4, out: 20, cached: 0.4 },
    vision: true, reasoning: true, tools: true,
  },
  "gpt-5.6-luna": {
    contextWindow: 400_000, maxOutput: 32_000,
    pricing: { in: 1.5, out: 10, cached: 0.15 },
    vision: true, reasoning: true, tools: true,
  },
  "gpt-5.4-mini": {
    contextWindow: 400_000, maxOutput: 32_000,
    pricing: { in: 1.1, out: 4.4, cached: 0.11 },
    vision: false, reasoning: false, tools: true,
  },
  // Google — 3.1 image variants and the 2.5 series.
  "gemini-3.1-flash-lite": {
    contextWindow: 1_000_000, maxOutput: 32_000,
    pricing: { in: 0.5, out: 3 },
    vision: true, reasoning: false, tools: true,
  },
  "gemini-3.1-flash-image": {
    contextWindow: 1_000_000, maxOutput: 32_000,
    pricing: { in: 1.5, out: 9 },
    vision: true, reasoning: false, tools: true,
  },
  "gemini-3.1-flash-lite-image": {
    contextWindow: 1_000_000, maxOutput: 32_000,
    pricing: { in: 0.5, out: 3 },
    vision: true, reasoning: false, tools: true,
  },
  "gemini-3-pro-image": {
    contextWindow: 1_000_000, maxOutput: 64_000,
    pricing: { in: 5, out: 30 },
    vision: true, reasoning: true, tools: true,
  },
  "gemini-2.5-pro": {
    contextWindow: 1_000_000, maxOutput: 64_000,
    pricing: { in: 1.25, out: 10 },
    vision: true, reasoning: true, tools: true,
  },
  "gemini-2.5-flash": {
    contextWindow: 1_000_000, maxOutput: 64_000,
    pricing: { in: 0.3, out: 2.5 },
    vision: true, reasoning: false, tools: true,
  },
  "gemini-2.5-flash-lite": {
    contextWindow: 1_000_000, maxOutput: 64_000,
    pricing: { in: 0.1, out: 0.4 },
    vision: true, reasoning: false, tools: true,
  },
  // DeepSeek — the v3 line the registry still serves.
  "deepseek-v3.2": {
    contextWindow: 128_000, maxOutput: 8_000,
    pricing: { in: 0.3, out: 1.2 },
    vision: false, reasoning: true, tools: true,
  },
  "deepseek-v3.1-terminus": {
    contextWindow: 128_000, maxOutput: 8_000,
    pricing: { in: 0.3, out: 1.2 },
    vision: false, reasoning: true, tools: true,
  },
  "deepseek-chat-v3.1": {
    contextWindow: 128_000, maxOutput: 8_000,
    pricing: { in: 0.3, out: 1.2 },
    vision: false, reasoning: false, tools: true,
  },
  // Zhipu GLM — the 5.x / 4.7 line.
  "glm-5.2": {
    contextWindow: 200_000, maxOutput: 32_000,
    pricing: { in: 1, out: 4 },
    vision: false, reasoning: true, tools: true,
  },
  "glm-5.1": {
    contextWindow: 128_000, maxOutput: 32_000,
    pricing: { in: 0.8, out: 3 },
    vision: false, reasoning: true, tools: true,
  },
  "glm-5": {
    contextWindow: 128_000, maxOutput: 32_000,
    pricing: { in: 0.7, out: 2.8 },
    vision: false, reasoning: true, tools: true,
  },
  "glm-5-turbo": {
    contextWindow: 128_000, maxOutput: 16_000,
    pricing: { in: 0.3, out: 1.2 },
    vision: false, reasoning: false, tools: true,
  },
  "glm-4.7-flashx": {
    contextWindow: 128_000, maxOutput: 16_000,
    pricing: { in: 0.2, out: 0.8 },
    vision: false, reasoning: false, tools: true,
  },
  "glm-4.7-flash": {
    contextWindow: 128_000, maxOutput: 8_000,
    pricing: { in: 0.1, out: 0.4 },
    vision: false, reasoning: false, tools: true,
  },
  "glm-4.6v": {
    contextWindow: 128_000, maxOutput: 16_000,
    pricing: { in: 0.6, out: 2.4 },
    vision: true, reasoning: false, tools: true,
  },
  // Ollama local — the qwen3.6 GGUF lineup.
  "qwen3.6:35b-a3b": {
    contextWindow: 262_144, maxOutput: 32_768,
    vision: false, reasoning: true, tools: true,
  },
  "qwen3.6:27b": {
    contextWindow: 262_144, maxOutput: 32_768,
    vision: false, reasoning: true, tools: true,
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
