import { describe, expect, it } from "vitest";
import { nextTick, ref } from "vue";

import { useImage } from "./useImage";

describe("useImage", () => {
  it("starts empty for null, undefined, and empty-string sources", () => {
    for (const source of [null, undefined, ""]) {
      const image = useImage(source);
      expect(image.src.value).toBe("");
      expect(image.status.value).toBe("empty");
      expect(image.key.value).toBe("empty#0");
    }
  });

  it("enters loading for a real source and resolves to loaded on onLoad", () => {
    const image = useImage("https://example.com/a.png");
    expect(image.src.value).toBe("https://example.com/a.png");
    expect(image.status.value).toBe("loading");
    image.onLoad();
    expect(image.status.value).toBe("loaded");
  });

  it("marks error when the request fails while loading", () => {
    const image = useImage("https://example.com/a.png");
    image.onError();
    expect(image.status.value).toBe("error");
  });

  it("ignores a stale onError arriving after the image loaded", () => {
    const image = useImage("https://example.com/a.png");
    image.onLoad();
    // A superseded request may still emit an error — it must not clobber.
    image.onError();
    expect(image.status.value).toBe("loaded");
  });

  it("does not resurrect from error via a stale onLoad", () => {
    const image = useImage("https://example.com/a.png");
    image.onError();
    image.onLoad();
    expect(image.status.value).toBe("error");
  });

  it("retry() bumps the key and re-enters loading, and is a no-op without a source", () => {
    const image = useImage("https://example.com/a.png");
    expect(image.key.value).toBe("https://example.com/a.png#0");
    image.onLoad();
    image.retry();
    expect(image.status.value).toBe("loading");
    expect(image.key.value).toBe("https://example.com/a.png#1");
    image.retry();
    expect(image.key.value).toBe("https://example.com/a.png#2");

    // No source → retry must not fabricate a request.
    const empty = useImage(null);
    empty.retry();
    expect(empty.status.value).toBe("empty");
    expect(empty.key.value).toBe("empty#0");
  });

  it("resets the attempt counter and status when the source changes", async () => {
    const source = ref<string | null>("https://example.com/a.png");
    // Getter form exercises the MaybeRefOrGetter contract.
    const image = useImage(() => source.value);
    image.onLoad();
    image.retry();
    expect(image.key.value).toBe("https://example.com/a.png#1");

    source.value = "https://example.com/b.png";
    await nextTick();
    expect(image.src.value).toBe("https://example.com/b.png");
    expect(image.status.value).toBe("loading");
    expect(image.key.value).toBe("https://example.com/b.png#0");
  });

  it("returns to empty when the source is cleared", async () => {
    const source = ref<string | null>("https://example.com/a.png");
    const image = useImage(source);
    image.onLoad();
    source.value = null;
    await nextTick();
    expect(image.src.value).toBe("");
    expect(image.status.value).toBe("empty");
    // retry stays a no-op with no source.
    image.retry();
    expect(image.status.value).toBe("empty");
  });
});
