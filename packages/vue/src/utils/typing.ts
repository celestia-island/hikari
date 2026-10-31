import type { PropType } from "vue";

/**
 * Declare a complex `props` type while keeping Vue's runtime constructor.
 *
 * Vue's runtime `type` field only accepts constructors and constructor
 * arrays, so a prop carrying a tuple, a `Set<T>`, a nullable union or a
 * function signature cannot be written as a plain assertion: the runtime
 * constructor and `PropType<T>` share no assignable direction. Writing
 * `Array as unknown as PropType<[number, number]>` at every call site
 * spreads a double assertion through the library; this helper keeps that
 * single, justified assertion in one place and documents why it is safe:
 * `ctor` is only ever consumed by Vue as the runtime validator, and the
 * compile-time shape comes from the explicit type argument.
 *
 *     sRange: { type: asPropType<[number, number]>(Array), default: undefined }
 *     min:    { type: asPropType<Date | null>([Date, null]), default: null }
 */
export function asPropType<T>(ctor: unknown): PropType<T> {
  return ctor as PropType<T>;
}

/**
 * View an object through a string index signature.
 *
 * Needed to read/write keys that the compile-time type does not declare on
 * purpose — monkey-patched natives (`History.prototype`), host-installed
 * bridges, and generic record walks. The result keeps `T` so the caller
 * still gets the original members.
 */
export function asIndexable<T extends object>(obj: T): T & Record<string, unknown> {
  return obj as T & Record<string, unknown>;
}

/**
 * `window` as seen with a host-injected extra surface (Tauri, hljs,
 * template globals …). Intersecting keeps `Window`'s own members typed;
 * the extra keys stay optional so the same code also runs in a browser
 * without the host.
 */
export type HostWindow<T extends object> = Window & typeof globalThis & T;
