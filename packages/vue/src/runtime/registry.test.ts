import { describe, expect, it } from "vitest";

import {
  getHkRuntimeEntry,
  hkRuntimeSnapshot,
  listHkRuntime,
  readHkRuntime,
  reportHkRuntime,
  useHkRegistry,
  writeHkRuntime,
} from "./registry";

/**
 * Core registry contract tests (the "context of contexts"):
 * - report is an idempotent upsert while active: facets refresh, but
 *   registeredAt and the pulse history survive a re-report
 * - dispose marks the entry disposed and drops its facets; the record
 *   stays listed for post-mortem debugging
 * - a re-report AFTER dispose starts a fresh lifetime; stale handles
 *   from the previous lifetime can neither pulse nor dispose the new one
 * - pulse bumps pulses/lastActiveAt and shallow-merges meta
 * - read/write facets: cross-context access, unknown ids, throwing
 *   facets and unknown op types all degrade without throwing
 * - list/snapshot are stable-ordered plain clones
 */

describe("reportHkRuntime", () => {
  it("registers an active entry with kind, description and meta", () => {
    const h = reportHkRuntime("test.core.basic", {
      kind: "hook",
      description: "a test hook",
      meta: { flavor: "mint" },
    });
    expect(h.id).toBe("test.core.basic");
    const entry = getHkRuntimeEntry("test.core.basic");
    expect(entry).toBeDefined();
    expect(entry!.status).toBe("active");
    expect(entry!.kind).toBe("hook");
    expect(entry!.description).toBe("a test hook");
    expect(entry!.meta).toEqual({ flavor: "mint" });
    expect(entry!.pulses).toBe(0);
    expect(entry!.registeredAt).toBeGreaterThan(0);
    h.dispose();
  });

  it("re-report while active keeps the lifetime (registeredAt, pulses) and refreshes facets", () => {
    const first = reportHkRuntime("test.core.upsert", {
      kind: "context",
      meta: { v: 1 },
      read: () => ({ v: 1 }),
    });
    first.pulse();
    first.pulse();
    const before = getHkRuntimeEntry("test.core.upsert")!;
    const registeredAt = before.registeredAt;

    const second = reportHkRuntime("test.core.upsert", {
      kind: "context",
      description: "refreshed",
      meta: { v: 2 },
      read: () => ({ v: 2 }),
    });
    const after = getHkRuntimeEntry("test.core.upsert")!;
    expect(after.registeredAt).toBe(registeredAt);
    expect(after.pulses).toBe(2);
    expect(readHkRuntime("test.core.upsert")).toEqual({ v: 2 });
    // Both handles address the SAME live entry.
    second.pulse();
    expect(getHkRuntimeEntry("test.core.upsert")!.pulses).toBe(3);
    first.dispose();
    expect(getHkRuntimeEntry("test.core.upsert")!.status).toBe("disposed");
  });

  it("dispose drops the facets but keeps the record listed for debugging", () => {
    const h = reportHkRuntime("test.core.dispose", {
      kind: "hook",
      meta: { a: 1 },
      read: () => ({ a: 1 }),
      write: () => undefined,
    });
    h.dispose();
    const entry = getHkRuntimeEntry("test.core.dispose")!;
    expect(entry.status).toBe("disposed");
    // Record survives; facets do not.
    expect(listHkRuntime().some((e) => e.id === "test.core.dispose" && e.status === "disposed")).toBe(true);
    expect(readHkRuntime("test.core.dispose")).toBeUndefined();
    expect(writeHkRuntime("test.core.dispose", { type: "x" })).toBe(false);
    // Idempotent: disposing twice is safe.
    h.dispose();
    expect(entry.status).toBe("disposed");
  });

  it("late pulses from a disposed lifetime are no-ops", () => {
    const h = reportHkRuntime("test.core.latePulse", { kind: "hook" });
    h.pulse();
    h.dispose();
    h.pulse(); // a subsystem tearing down asynchronously must not resurrect
    const entry = getHkRuntimeEntry("test.core.latePulse")!;
    expect(entry.status).toBe("disposed");
    expect(entry.pulses).toBe(1);
  });

  it("re-report after dispose starts a fresh lifetime; stale handles cannot touch it", async () => {
    const stale = reportHkRuntime("test.core.rebirth", {
      kind: "hook",
      read: () => ({ gen: 1 }),
    });
    stale.pulse();
    stale.dispose();

    const fresh = reportHkRuntime("test.core.rebirth", {
      kind: "hook",
      read: () => ({ gen: 2 }),
    });
    const entry = getHkRuntimeEntry("test.core.rebirth")!;
    expect(entry.status).toBe("active");
    expect(entry.pulses).toBe(0);
    expect(readHkRuntime("test.core.rebirth")).toEqual({ gen: 2 });

    stale.pulse(); // previous epoch — must be ignored
    expect(entry.pulses).toBe(0);
    stale.dispose(); // previous epoch — must not kill the fresh entry
    expect(entry.status).toBe("active");
    fresh.dispose();
  });
});

describe("pulse", () => {
  it("bumps pulses, refreshes lastActiveAt and shallow-merges meta", async () => {
    const h = reportHkRuntime("test.core.pulse", {
      kind: "bus",
      meta: { count: 0, extra: "keep" },
    });
    // getHkRuntimeEntry returns a LIVE readonly view — capture scalars,
    // not the proxy, for before/after comparisons.
    const before = getHkRuntimeEntry("test.core.pulse")!;
    const pulsesBefore = before.pulses;
    const lastActiveBefore = before.lastActiveAt;
    await new Promise((r) => setTimeout(r, 2));
    h.pulse({ count: 1 });
    const after = getHkRuntimeEntry("test.core.pulse")!;
    expect(after.pulses).toBe(pulsesBefore + 1);
    expect(after.lastActiveAt).toBeGreaterThan(lastActiveBefore);
    expect(after.meta).toEqual({ count: 1, extra: "keep" });
    h.dispose();
  });

  it("setMeta merges without counting a pulse", () => {
    const h = reportHkRuntime("test.core.setMeta", { kind: "bus", meta: { a: 1 } });
    h.setMeta({ b: 2 });
    const entry = getHkRuntimeEntry("test.core.setMeta")!;
    expect(entry.meta).toEqual({ a: 1, b: 2 });
    expect(entry.pulses).toBe(0);
    h.dispose();
  });
});

describe("cross-context read/write", () => {
  it("reads a live facet and returns undefined for unknown ids", () => {
    expect(readHkRuntime("test.core.neverRegistered")).toBeUndefined();
    const h = reportHkRuntime("test.core.read", {
      kind: "context",
      read: () => ({ now: Date.now() >= 0 }),
    });
    expect(readHkRuntime("test.core.read")).toEqual({ now: true });
    h.dispose();
  });

  it("a throwing read facet degrades to undefined instead of crashing", () => {
    const h = reportHkRuntime("test.core.badRead", {
      kind: "context",
      read: () => {
        throw new Error("boom");
      },
    });
    expect(readHkRuntime("test.core.badRead")).toBeUndefined();
    h.dispose();
  });

  it("applies write ops and reports false for unknown ids / missing facets / rejected ops", () => {
    expect(writeHkRuntime("test.core.unknown", { type: "x" })).toBe(false);
    let calls: string[] = [];
    const h = reportHkRuntime("test.core.write", {
      kind: "plugin",
      write: (op) => {
        if (op.type === "go") {
          calls.push("go");
          return;
        }
        throw new Error(`unknown op ${op.type}`);
      },
    });
    expect(writeHkRuntime("test.core.write", { type: "go" })).toBe(true);
    expect(calls).toEqual(["go"]);
    expect(writeHkRuntime("test.core.write", { type: "nope" })).toBe(false);
    expect(calls).toEqual(["go"]);
    h.dispose();
    // disposed → no facet anymore
    expect(writeHkRuntime("test.core.write", { type: "go" })).toBe(false);
    calls = [];
  });
});

describe("list / snapshot", () => {
  it("lists plain, stable-ordered clones that do not alias live state", () => {
    const h1 = reportHkRuntime("test.core.listA", { kind: "hook" });
    const h2 = reportHkRuntime("test.core.listB", { kind: "bus" });
    const ids = listHkRuntime().map((e) => e.id);
    expect(ids.indexOf("test.core.listA")).toBeLessThan(ids.indexOf("test.core.listB"));
    const clone = listHkRuntime().find((e) => e.id === "test.core.listA")!;
    h1.pulse();
    expect(clone.pulses).toBe(0); // clone, not the reactive state
    expect(getHkRuntimeEntry("test.core.listA")!.pulses).toBe(1);
    h1.dispose();
    h2.dispose();
  });

  it("snapshot embeds the live read facet under `state`", () => {
    const h = reportHkRuntime("test.core.snap", {
      kind: "context",
      meta: { locale: "en" },
      read: () => ({ deep: { live: true } }),
    });
    const snap = hkRuntimeSnapshot();
    const entry = snap.entries.find((e) => e.id === "test.core.snap");
    expect(entry).toBeDefined();
    expect(entry!.meta).toEqual({ locale: "en" });
    expect(entry!.state).toEqual({ deep: { live: true } });
    expect(snap.generatedAt).toBeGreaterThan(0);
    h.dispose();
  });

  it("snapshot stays JSON-serializable", () => {
    const h = reportHkRuntime("test.core.json", {
      kind: "hook",
      meta: { n: 1, s: "x", b: true, arr: [1, 2] },
      read: () => ({ ok: 1 }),
    });
    expect(() => JSON.stringify(hkRuntimeSnapshot())).not.toThrow();
    h.dispose();
  });
});

describe("useHkRegistry", () => {
  it("exposes a reactive entries computed plus the plain accessors", () => {
    const h = reportHkRuntime("test.core.vue", { kind: "context" });
    const { entries, read, write, snapshot } = useHkRegistry();
    expect(entries.value.some((e) => e.id === "test.core.vue")).toBe(true);
    expect(read("test.core.vue")).toBeUndefined(); // no read facet declared
    expect(write("test.core.vue", { type: "x" })).toBe(false);
    expect(snapshot().entries.some((e) => e.id === "test.core.vue")).toBe(true);
    h.dispose();
  });

  it("the entries computed sees BRAND-NEW registrations (structural version)", () => {
    const { entries } = useHkRegistry();
    const before = entries.value.some((e) => e.id === "test.core.lateArrival");
    expect(before).toBe(false);
    const h = reportHkRuntime("test.core.lateArrival", { kind: "hook" });
    // The computed must invalidate on the structural change itself —
    // before this fix it only tracked already-known reactive states, so
    // a debug panel missed first-time registrations until something
    // pulsed.
    expect(entries.value.some((e) => e.id === "test.core.lateArrival")).toBe(true);
    h.dispose();
    expect(entries.value.find((e) => e.id === "test.core.lateArrival")?.status).toBe("disposed");
  });

  it("lists entries in true registration order (sequence, not clock)", () => {
    const h1 = reportHkRuntime("test.core.seqZ", { kind: "hook" });
    const h2 = reportHkRuntime("test.core.seqA", { kind: "hook" });
    const ids = listHkRuntime().map((e) => e.id);
    // seqZ registered FIRST — must stay first even though it sorts after
    // seqA alphabetically (same-millisecond installs used to invert).
    expect(ids.indexOf("test.core.seqZ")).toBeLessThan(ids.indexOf("test.core.seqA"));
    h1.dispose();
    h2.dispose();
  });
});
