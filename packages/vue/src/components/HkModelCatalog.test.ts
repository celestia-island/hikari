import { describe, expect, it } from "vitest";

import { getModelMeta, registerModelCatalog } from "./HkModelCatalog";

/**
 * The simulated-world roster (integration world_service `agent_models`):
 * every model id a chest card can carry must resolve a context window, or
 * its context ring degrades to the empty "–" state — the "only the sample
 * card shows usage" regression. The builtin catalog is the fallback that
 * keeps unknown-to-nothing lineups legible.
 */
const WORLD_LINEUP = [
  // integration world_service `agent_models` (world_content.json) — the
  // model ids demo cruise cards actually carry today.
  "gpt-5.6-sol-pro",
  "claude-sonnet-5",
  "deepseek-v4-pro",
  "gemini-3.1-flash-lite",
  "gpt-5.5-pro",
  "gemini-2.5-pro",
  "gpt-5.6-luna",
  "deepseek-v4-flash",
  "gemini-3.5-flash",
  "claude-haiku-4-5",
  "qwen3.6:35b-a3b",
  "qwen3.6:27b",
  "gpt-5.4-nano",
];

/** demo db/seed.sql provider lists — every registry spelling, including the
 *  dotted Anthropic aliases, must resolve on its own (exact-match lookup). */
const REGISTRY_LINEUP = [
  "claude-sonnet-5", "claude-fable-5", "claude-opus-4.8-fast", "claude-opus-4.8",
  "claude-opus-4.7", "claude-sonnet-4.6", "claude-haiku-4-5", "claude-haiku-4.5",
  "claude-opus-4.5",
  "gpt-5.6-terra-pro", "gpt-5.6-terra", "gpt-5.6-sol-pro", "gpt-5.6-sol",
  "gpt-5.6-luna-pro", "gpt-5.6-luna", "gpt-5.5-pro", "gpt-5.5", "gpt-5.4",
  "gpt-5.4-mini", "gpt-5.4-nano",
  "gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-3.1-flash-image",
  "gemini-3.1-flash-lite-image", "gemini-3-pro-image", "gemini-2.5-pro",
  "gemini-2.5-flash", "gemini-2.5-flash-lite",
  "deepseek-v4-pro", "deepseek-v4-flash", "deepseek-v3.2",
  "deepseek-v3.1-terminus", "deepseek-chat-v3.1",
  "glm-5.2", "glm-5.1", "glm-5", "glm-5-turbo", "glm-4.7-flashx",
  "glm-4.7-flash", "glm-4.6v",
  "qwen3.6:35b-a3b", "qwen3.6:27b",
];

describe("HkModelCatalog builtin specs", () => {
  it("resolves every world-lineup model id to a positive context window", () => {
    for (const model of WORLD_LINEUP) {
      const meta = getModelMeta(model);
      expect(meta, `${model} resolves`).toBeDefined();
      expect(meta?.contextWindow ?? 0, `${model} window`).toBeGreaterThan(0);
    }
  });

  it("resolves every demo registry spelling, dotted aliases included", () => {
    for (const model of REGISTRY_LINEUP) {
      const meta = getModelMeta(model);
      expect(meta, `${model} resolves`).toBeDefined();
      expect(meta?.contextWindow ?? 0, `${model} window`).toBeGreaterThan(0);
    }
  });

  it("keeps ollama-style colon tags whole (only # splits)", () => {
    expect(getModelMeta("qwen3.6:27b")?.contextWindow).toBe(262_144);
    expect(getModelMeta("qwen3.6:35b-a3b")?.contextWindow).toBe(262_144);
    expect(getModelMeta("qwen3.7:14b")?.contextWindow).toBe(262_144);
  });

  it("still strips a #tag before lookup", () => {
    expect(getModelMeta("deepseek-v4-pro#2")?.contextWindow).toBe(128_000);
    expect(getModelMeta("claude-opus-5#7")?.contextWindow).toBe(200_000);
  });

  it("lets the registered catalog win over the builtin entries", () => {
    registerModelCatalog({ "claude-opus-5": { contextWindow: 999 } });
    expect(getModelMeta("claude-opus-5")?.contextWindow).toBe(999);
  });
});
