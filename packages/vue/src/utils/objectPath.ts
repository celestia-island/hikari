/** Deep merge following RFC 7396 semantics: plain objects merge
 *  recursively, anything else replaces. `null` in `patch` deletes. */
export function deepMerge<T extends Record<string, unknown>>(base: T, patch: unknown): T {
  if (!isPlainObject(patch)) return patch as T;
  if (!isPlainObject(base)) base = {} as T;
  const out: Record<string, unknown> = { ...base };
  for (const key of Object.keys(patch as Record<string, unknown>)) {
    const v = (patch as Record<string, unknown>)[key];
    if (v === null) {
      delete out[key];
    } else if (isPlainObject(v) && isPlainObject(out[key])) {
      out[key] = deepMerge(out[key] as Record<string, unknown>, v);
    } else {
      out[key] = v;
    }
  }
  return out as T;
}

export function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v) &&
    (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);
}

/** Read a dot-separated path (e.g. "a.b.c") from a nested object. */
export function getPath(obj: unknown, path: string): unknown {
  let cur: unknown = obj;
  for (const seg of path.split(".")) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[seg];
  }
  return cur;
}

/** Write a dot-separated path into a nested object (mutating, creating
 *  intermediate plain objects). */
export function setPath<T extends Record<string, unknown>>(obj: T, path: string, value: unknown): T {
  const segs = path.split(".");
  let cur: Record<string, unknown> = obj;
  for (let i = 0; i < segs.length - 1; i++) {
    const seg = segs[i];
    if (!isPlainObject(cur[seg])) cur[seg] = {};
    cur = cur[seg] as Record<string, unknown>;
  }
  cur[segs[segs.length - 1]] = value;
  return obj;
}

/** Remove a dot-separated path from a nested object (mutating). */
export function delPath(obj: Record<string, unknown>, path: string): void {
  const segs = path.split(".");
  let cur: Record<string, unknown> = obj;
  for (let i = 0; i < segs.length - 1; i++) {
    const next = cur[segs[i]];
    if (!isPlainObject(next)) return;
    cur = next;
  }
  delete cur[segs[segs.length - 1]];
}
