/**
 * Typed test doubles.
 *
 * A test that stands in for a browser/lib object only implements the slice
 * the component actually touches — a `CanvasRenderingContext2D` double has
 * `fillRect` but not the other 40 members, a THREE light double has
 * `intensity` but no scene graph. The honest way to say that is "this value
 * is shaped like a partial, used as the full type", which is what
 * {@link fakeAs} expresses. The alternative used across the suite was
 * `x as unknown as T` at every call site, which deleted every check —
 * including typos in the very key names the test relies on.
 *
 * Prefer implementing a short interface for real (`class FakeResizeObserver
 * implements ResizeObserver`) — observers have two or three methods and a
 * real class also catches the "test forgot to stub a method" mistake.
 *
 *     const ctx = fakeAs<CanvasRenderingContext2D>({ fillRect: vi.fn() });
 *     const light = fakeAs<THREE.DirectionalLight>({ intensity: 2 });
 */

/**
 * Use a partial object double where the full library type is expected.
 *
 * The argument must be assignable to `Partial<T>`, so an unknown or
 * misspelled member is a compile error instead of being passed through —
 * this is what makes the helper stricter than the double cast it replaces.
 * Functions use {@link fakeFn} instead: a call signature has no properties
 * to keep optional, so folding both shapes into one signature would have
 * let any function through unchecked.
 */
export function fakeAs<T>(partial: Partial<T>): T {
  return partial as T;
}

/**
 * Use a function double where a library function type is expected.
 *
 * Kept separate from {@link fakeAs} on purpose. This helper can check the
 * RETURN type (`impl` must agree with `T`'s result) but cannot verify the
 * parameter list when `T` is overloaded — `Parameters<T>` resolves only the
 * last overload, which is the wrong one for e.g. `createImageData`. So a
 * function double is the one case where the assertion is unchecked:
 * document the reason at the call site.
 */
export function fakeFn<T extends (...args: never[]) => unknown>(
  impl: (...args: never[]) => ReturnType<T>,
): T {
  return impl as T;
}
