/**
 * Deliberately type-invalid fixtures.
 *
 * Several runtime guards exist only because JavaScript consumers can hand a
 * component or a parser anything at all: a `"pigeon-post"` strategy, a
 * predicate that returns `"yes"`, an element that is not a canvas. A test
 * that proves those guards fire must therefore build a value the compiler
 * knows is wrong — by construction such a fixture can never satisfy
 * `Partial<T>`, so `fakeAs` is the wrong tool and a local `as unknown as`
 * was what the suite used before.
 *
 * `invalidInput` is the ONE place that assertion lives, and it says out loud
 * what the call site means: "this value is intentionally mistyped; the code
 * under test must reject it". Keep it out of production code.
 *
 *     expect(() => parseConfig(invalidInput<TokenGroupConfig>("nope"))).toThrow();
 */
export function invalidInput<T>(value: unknown): T {
  return value as T;
}
