import { describe, expect, it } from "vitest";

import {
  jsonInsertChildAt,
  jsonPathKey,
  jsonRemoveAtPath,
  jsonSetAtPath,
} from "./jsonTreeEdit";

/**
 * The pure edit ops are the whole correctness story of the editable tree:
 * the component emits whatever they return, so every guard here is a
 * data-integrity guard for hosts. Immutability is proven with deep-frozen
 * inputs (a strict-mode write into a frozen object THROWS, so a mutating
 * implementation cannot pass by accident), and the guards are proven with
 * "input returned unchanged" identity checks.
 */

/** Recursively freeze a plain value; returns it (frozen in place). */
function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value as object)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

describe("jsonPathKey", () => {
  it("encodes paths unambiguously, hostile keys included", () => {
    expect(jsonPathKey([])).toBe("[]");
    expect(jsonPathKey(["a", 0])).toBe('["a",0]');
    // A delimiter join would collide these two; JSON encoding must not.
    expect(jsonPathKey(["x,y"])).not.toBe(jsonPathKey(["x", "y"]));
    expect(jsonPathKey(['"'])).toBe('["\\""]');
  });
});

describe("jsonSetAtPath", () => {
  it("sets a nested object member and returns a new root", () => {
    const root = deepFreeze({ a: { b: 1 }, keep: { x: [1, 2] } });
    const next = jsonSetAtPath(root, ["a", "b"], 42) as typeof root;
    expect(next.a.b).toBe(42);
    expect(next.keep).toBe(root.keep); // untouched branch shared, not cloned
  });

  it("replaces an array element by index", () => {
    const root = deepFreeze({ list: [1, 2, 3] });
    const next = jsonSetAtPath(root, ["list", 1], "two") as typeof root;
    expect(next.list).toEqual([1, "two", 3]);
  });

  it("replaces the whole root for the empty path", () => {
    const root = deepFreeze({ a: 1 });
    expect(jsonSetAtPath(root, [], [9])).toEqual([9]);
  });

  it("changes the type of the target (leaf ↔ container)", () => {
    const root = deepFreeze({ a: { deep: 1 } });
    const next = jsonSetAtPath(root, ["a"], "flat") as typeof root;
    expect(next).toEqual({ a: "flat" });
  });

  it("returns the input untouched for a non-existent location", () => {
    const root = deepFreeze({ a: { b: 1 } });
    expect(jsonSetAtPath(root, ["missing"], 1)).toBe(root);
    expect(jsonSetAtPath(root, ["a", "b", "c"], 1)).toBe(root); // through a leaf
    expect(jsonSetAtPath(root, ["a", 5], 1)).toBe(root); // dead index in an object path
  });

  it("keeps sibling arrays and objects reference-identical", () => {
    const root = { outer: { inner: [1, 2] }, other: { v: 1 } };
    const next = jsonSetAtPath(root, ["outer", "inner", 0], 99) as typeof root;
    expect(next.other).toBe(root.other);
    expect(next).not.toBe(root);
    expect(next.outer).not.toBe(root.outer);
    expect(root.outer.inner).toEqual([1, 2]); // input spine NOT mutated
  });
});

describe("jsonInsertChildAt", () => {
  it("inserts a new key into an object", () => {
    const root = deepFreeze({ a: { x: 1 } });
    const next = jsonInsertChildAt(root, ["a"], "y", "") as typeof root;
    expect(next.a).toEqual({ x: 1, y: "" });
  });

  it("replaces an existing object key (JSON has no duplicate keys)", () => {
    const root = deepFreeze({ a: { x: 1 } });
    const next = jsonInsertChildAt(root, ["a"], "x", 2) as typeof root;
    expect(next.a).toEqual({ x: 2 });
  });

  it("appends to an array when the index is the length", () => {
    const root = deepFreeze({ list: ["a"] });
    const next = jsonInsertChildAt(root, ["list"], 1, "b") as typeof root;
    expect(next.list).toEqual(["a", "b"]);
  });

  it("clamps an out-of-range array index to append, rejects negatives", () => {
    const root = deepFreeze({ list: ["a"] });
    expect((jsonInsertChildAt(root, ["list"], 99, "b") as typeof root).list).toEqual(["a", "b"]);
    expect(jsonInsertChildAt(root, ["list"], -1, "b")).toBe(root);
    expect(jsonInsertChildAt(root, ["list"], 0.5, "b")).toBe(root);
  });

  it("inserts into the root container for the empty path", () => {
    const root = deepFreeze({ a: 1 });
    const next = jsonInsertChildAt(root, [], "b", null) as typeof root;
    expect(next).toEqual({ a: 1, b: null });
  });

  it("returns the input untouched when the target is not a container", () => {
    const root = deepFreeze({ a: { b: 1 } });
    expect(jsonInsertChildAt(root, ["a", "b"], "k", 1)).toBe(root);
    expect(jsonInsertChildAt(root, ["missing"], "k", 1)).toBe(root);
  });
});

describe("jsonRemoveAtPath", () => {
  it("removes an object key", () => {
    const root = deepFreeze({ a: { b: 1, c: 2 } });
    const next = jsonRemoveAtPath(root, ["a", "b"]) as typeof root;
    expect(next.a).toEqual({ c: 2 });
  });

  it("splices an array element and reindexes the tail", () => {
    const root = deepFreeze({ list: [1, 2, 3] });
    const next = jsonRemoveAtPath(root, ["list", 0]) as typeof root;
    expect(next.list).toEqual([2, 3]);
  });

  it("refuses to remove the root or a non-existent node", () => {
    const root = deepFreeze({ a: { b: 1 } });
    expect(jsonRemoveAtPath(root, [])).toBe(root);
    expect(jsonRemoveAtPath(root, ["a", "zzz"])).toBe(root);
    expect(jsonRemoveAtPath(root, ["missing", "deep"])).toBe(root);
  });
});

describe("hostile keys (prototype hygiene)", () => {
  it("inserts __proto__ as an opaque OWN key (object value form)", () => {
    const root = deepFreeze({ a: 1 });
    const payload = { polluted: true };
    const next = jsonInsertChildAt(root, [], "__proto__", payload) as Record<string, unknown>;
    // The own key exists (assignment semantics would have produced none)…
    expect(Object.prototype.hasOwnProperty.call(next, "__proto__")).toBe(true);
    expect(next["__proto__"]).toBe(payload);
    // …and the clone's prototype must be untouched: assignment would have
    // silently swapped it to `payload`.
    expect(Object.getPrototypeOf(next)).toBe(Object.prototype);
    expect(next.a).toBe(1);
  });

  it("inserts __proto__ as an opaque OWN key (primitive value form)", () => {
    const next = jsonInsertChildAt({ a: 1 }, [], "__proto__", 42) as Record<string, unknown>;
    expect(Object.prototype.hasOwnProperty.call(next, "__proto__")).toBe(true);
    // Primitive assignment through the setter is a silent no-op — define
    // semantics must still land the own key.
    expect(next["__proto__"]).toBe(42);
    expect(Object.getPrototypeOf(next)).toBe(Object.prototype);
  });

  it("keeps rename composite content when the new key is __proto__", () => {
    // The editor's rename flow is insert(newKey, value) + remove(oldKey);
    // `a` must not vanish just because its new name is __proto__.
    const root = deepFreeze({ a: { deep: true }, b: 2 });
    let next = jsonInsertChildAt(root, [], "__proto__", { deep: true }) as Record<string, unknown>;
    next = jsonRemoveAtPath(next, ["a"]) as Record<string, unknown>;
    expect(Object.prototype.hasOwnProperty.call(next, "__proto__")).toBe(true);
    expect(next["__proto__"]).toEqual({ deep: true });
    expect(Object.getPrototypeOf(next)).toBe(Object.prototype);
    expect(next.b).toBe(2);
    expect(Object.keys(next)).toEqual(["b", "__proto__"]); // a is gone
  });

  it("resolves through an own __proto__ created by JSON.parse", () => {
    // JSON.parse is the one producer that makes __proto__ an own data
    // property; ops must treat it like any opaque member, including
    // navigating INTO it.
    const root = deepFreeze(JSON.parse('{"__proto__":{"x":1},"keep":true}') as object);
    const next = jsonSetAtPath(root, ["__proto__", "x"], 2) as Record<string, unknown>;
    expect((next["__proto__"] as Record<string, unknown>).x).toBe(2);
    expect(next.keep).toBe(true);
    expect(Object.getPrototypeOf(next)).toBe(Object.prototype);
    const replaced = jsonSetAtPath(root, ["__proto__"], "flat") as Record<string, unknown>;
    expect(replaced["__proto__"]).toBe("flat");
    expect(Object.getPrototypeOf(replaced)).toBe(Object.prototype);
  });

  it("treats inherited names (constructor, toString) as missing members", () => {
    const root = deepFreeze({ a: 1 });
    // `in` would answer true for both; own-key resolution must reject
    // them like any other missing key — unchanged root, same reference.
    expect(jsonSetAtPath(root, ["constructor"], 1)).toBe(root);
    expect(jsonSetAtPath(root, ["toString"], "x")).toBe(root);
    expect(jsonRemoveAtPath(root, ["toString"])).toBe(root);
    expect(jsonInsertChildAt(root, ["toString"], "k", 1)).toBe(root);
  });
});

describe("normalizeIndex hardening", () => {
  const root = deepFreeze({ list: ["a", "b"] });

  it("accepts canonical integer segments only", () => {
    expect((jsonSetAtPath(root, ["list", "1"], "z") as typeof root).list).toEqual(["a", "z"]);
  });

  it("rejects non-canonical string forms from smuggling an index", () => {
    // Number("") === 0 would make an empty segment into index 0; "1.0"
    // and friends coerce to valid integers but are nobody's stored path.
    // All three ops share the CANONICAL_INDEX gate — set, insert AND
    // remove must each answer the original root, same reference.
    for (const hostile of ["", "1.0", "01", " 1", "+1", "-0", "1e0"]) {
      expect(jsonSetAtPath(root, ["list", hostile], "z"), JSON.stringify(hostile)).toBe(root);
      expect(jsonInsertChildAt(root, ["list"], hostile, "z")).toBe(root);
      expect(jsonRemoveAtPath(root, ["list", hostile]), JSON.stringify(hostile)).toBe(root);
    }
  });

  it("still rejects plain dead numeric indexes", () => {
    expect(jsonSetAtPath(root, ["list", 5], "z")).toBe(root);
    expect(jsonSetAtPath(root, ["list", -1], "z")).toBe(root);
    expect(jsonSetAtPath(root, ["list", 1.5], "z")).toBe(root);
  });
});

describe("immutability", () => {
  it("never writes into a deep-frozen input on any op", () => {
    // A strict-mode mutation of a frozen object throws — so running all
    // three ops against frozen trees proves the "no mutation of the
    // input" contract structurally, not just by value comparison.
    const root = deepFreeze({
      obj: { k: "v", nested: { n: 1 } },
      arr: [{ deep: true }, 2, 3],
    });
    expect(() => jsonSetAtPath(root, ["obj", "k"], "v2")).not.toThrow();
    expect(() => jsonInsertChildAt(root, ["arr"], 3, "x")).not.toThrow();
    expect(() => jsonRemoveAtPath(root, ["obj", "nested"])).not.toThrow();
    expect(root).toEqual({
      obj: { k: "v", nested: { n: 1 } },
      arr: [{ deep: true }, 2, 3],
    });
  });

  it("shares untouched subtrees between the old and new root", () => {
    const shared = { deep: { value: [1, 2, 3] } };
    const root = { keep: shared, edit: { a: 1 } };
    const next = jsonSetAtPath(root, ["edit", "a"], 2) as typeof root;
    expect(next.keep).toBe(shared);
    expect((next.keep as typeof shared).deep).toBe(shared.deep);
  });
});
