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
  "glm-5.3-flash",
  "claude-opus-5",
  "deepseek-v4-pro",
  "deepseek-v4-flash",
  "gemini-3.1-flash-preview",
  "gpt-5.5-pro",
  "gemini-3.1-pro-preview",
  "gpt-5.4",
  "gpt-5.4-nano",
  "claude-haiku-4-5",
  "gemini-3-flash",
  "qwen3.7:14b",
  "qwen3.8:27b",
];

describe("HkModelCatalog builtin specs", () => {
  it("resolves every world-lineup model id to a positive context window", () => {
    for (const model of WORLD_LINEUP) {
      const meta = getModelMeta(model);
      expect(meta, `${model} resolves`).toBeDefined();
      expect(meta?.contextWindow ?? 0, `${model} window`).toBeGreaterThan(0);
    }
  });

  it("keeps ollama-style colon tags whole (only # splits)", () => {
    expect(getModelMeta("qwen3.7:14b")?.contextWindow).toBe(262_144);
    expect(getModelMeta("qwen3.8:27b")?.contextWindow).toBe(262_144);
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
