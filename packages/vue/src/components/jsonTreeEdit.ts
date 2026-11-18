/**
 * jsonTreeEdit.ts — pure, immutable edit operations behind HkJsonTree's
 * opt-in editing mode.
 *
 * Every operation takes the CURRENT root value plus a `JsonPath` and
 * returns a NEW root; the input (and every container not on the edited
 * spine) is never written — untouched branches are shared by reference,
 * which is what keeps re-emitting large payloads cheap. All three are
 * deliberately standalone (no Vue, no component state) so they unit-test
 * without a DOM and hosts can reuse them for their own toolbar flows.
 *
 * Guards follow the "unchanged, not throw" convention of the viewer:
 * a path that does not resolve (missing key, dead index, walking THROUGH
 * a leaf, removing the root) returns the input root untouched. A guard
 * failure must never corrupt the host's value — the caller just re-renders
 * the same tree.
 */

/** A location inside a JSON tree: object keys and array indices,
 * root-first. `[]` names the root itself. */
export type JsonPath = (string | number)[];

/** Canonical, collision-free key for a path. Object keys may contain any
 *  characters (including separators and quotes), so a delimiter join is
 *  not safe — JSON encoding is. This is the string HkJsonTree stamps on
 *  rows (`data-jt-node`) and keys its editable-mode expansion set with. */
export function jsonPathKey(path: JsonPath): string {
  return JSON.stringify(path);
}

/** The value at `path`, or `undefined` when the path does not resolve.
 *  Module-internal read helper for the component's menu/editor decisions
 *  (object member vs array element); deliberately not package API. */
export function jsonValueAtPath(root: unknown, path: JsonPath): unknown {
  let node: unknown = root;
  for (const seg of path) {
    const next = childOf(node, seg);
    if (next === undefined) return undefined;
    node = next;
  }
  return node;
}

/** Whether the container at `path` is an array (`[]` = the root itself). */
export function jsonIsArrayAt(root: unknown, path: JsonPath): boolean {
  return Array.isArray(jsonValueAtPath(root, path));
}

/** Array-index view of a path segment: `null` when the segment is not a
 *  whole in-bounds index for the given array. */
function normalizeIndex(arr: unknown[], seg: string | number): number | null {
  const idx = typeof seg === "number" ? seg : Number(seg);
  if (!Number.isInteger(idx) || idx < 0 || idx >= arr.length) return null;
  return idx;
}

/** The child of `node` at `seg`, or `undefined` when the segment does not
 *  resolve (missing key / dead index / `node` is not a container). */
function childOf(node: unknown, seg: string | number): unknown {
  if (node === null || typeof node !== "object") return undefined;
  if (Array.isArray(node)) {
    const idx = normalizeIndex(node, seg);
    return idx === null ? undefined : node[idx];
  }
  const key = String(seg);
  const obj = node as Record<string, unknown>;
  return key in obj ? obj[key] : undefined;
}

/** Write `value` into the cloned container at `seg`. The caller has
 *  already verified the slot exists, so this cannot fail silently. */
function writeChild(
  copy: Record<string, unknown> | unknown[],
  seg: string | number,
  value: unknown,
): void {
  if (Array.isArray(copy)) {
    const idx = normalizeIndex(copy, seg);
    if (idx !== null) copy[idx] = value;
    return;
  }
  copy[String(seg)] = value;
}

/**
 * Walk `parentPath` from `root`, verifying every segment, then rebuild the
 * spine with clones (root → innermost container) and hand the INNERMOST
 * clone to `apply`. `apply` mutates that clone in place and answers whether
 * it succeeded; a `false` (or a dead path) aborts with the ORIGINAL root so
 * the caller can return it untouched. Untouched branches stay shared.
 */
function applyAtContainer(
  root: unknown,
  parentPath: JsonPath,
  apply: (container: Record<string, unknown> | unknown[]) => boolean,
): { root: unknown; ok: boolean } {
  const chain: unknown[] = [root];
  let node: unknown = root;
  for (const seg of parentPath) {
    const next = childOf(node, seg);
    if (next === undefined) return { root, ok: false };
    chain.push(next);
    node = next;
  }
  // The target itself must BE a container — inserting into a leaf would
  // otherwise invent an object around it.
  const target = chain[chain.length - 1]!;
  if (target === null || typeof target !== "object") return { root, ok: false };
  let carried: unknown;
  for (let i = chain.length - 1; i >= 0; i--) {
    const original = chain[i]!;
    const copy: Record<string, unknown> | unknown[] = Array.isArray(original)
      ? (original as unknown[]).slice()
      : { ...(original as Record<string, unknown>) };
    if (i === chain.length - 1) {
      if (!apply(copy)) return { root, ok: false };
    } else {
      writeChild(copy, parentPath[i]!, carried);
    }
    carried = copy;
  }
  return { root: carried, ok: true };
}

/**
 * Same spine-rebuild as `applyAtContainer`, but for operations that target
 * the MEMBER at the final segment of `path` (set / remove): the innermost
 * chain entry is the parent container, and `apply` receives it together
 * with the final segment. The member must already exist — creation is
 * `jsonInsertChildAt`'s job, and a strict guard keeps a typo'd path from
 * silently growing the tree.
 */
function applyAtMember(
  root: unknown,
  path: JsonPath,
  apply: (parent: Record<string, unknown> | unknown[], seg: string | number) => boolean,
): { root: unknown; ok: boolean } {
  if (path.length === 0) return { root, ok: false };
  const seg = path[path.length - 1]!;
  const parentPath = path.slice(0, -1);
  const chain: unknown[] = [root];
  let node: unknown = root;
  for (const s of parentPath) {
    const next = childOf(node, s);
    if (next === undefined) return { root, ok: false };
    chain.push(next);
    node = next;
  }
  const parent = chain[chain.length - 1]!;
  if (parent === null || typeof parent !== "object") return { root, ok: false };
  if (childOf(parent, seg) === undefined) return { root, ok: false };
  let carried: unknown;
  for (let i = chain.length - 1; i >= 0; i--) {
    const original = chain[i]!;
    const copy: Record<string, unknown> | unknown[] = Array.isArray(original)
      ? (original as unknown[]).slice()
      : { ...(original as Record<string, unknown>) };
    if (i === chain.length - 1) {
      if (!apply(copy, seg)) return { root, ok: false };
    } else {
      writeChild(copy, parentPath[i]!, carried);
    }
    carried = copy;
  }
  return { root: carried, ok: true };
}

/**
 * Replace the value at `path` with `value`, returning the new root. An
 * empty path replaces the root itself. The location must already exist
 * (editing an existing node); anything else returns the root unchanged.
 */
export function jsonSetAtPath(root: unknown, path: JsonPath, value: unknown): unknown {
  if (path.length === 0) return value;
  const { root: next, ok } = applyAtMember(root, path, (parent, seg) => {
    writeChild(parent, seg, value);
    return true;
  });
  return ok ? next : root;
}

/**
 * Insert `value` as a child of the container at `path`:
 *  - object → under `keyOrIndex` (String()'d). An existing key is
 *    REPLACED — the editor's rename/insert flows depend on overwrite
 *    semantics, and a JSON object cannot hold duplicate keys anyway.
 *  - array → at `keyOrIndex` clamped to `[0, length]`, so passing the
 *    array's length appends (the tree's insert menu always does).
 * The container must exist and BE a container; otherwise unchanged.
 */
export function jsonInsertChildAt(
  root: unknown,
  path: JsonPath,
  keyOrIndex: string | number,
  value: unknown,
): unknown {
  const { root: next, ok } = applyAtContainer(root, path, (container) => {
    if (Array.isArray(container)) {
      const idx = typeof keyOrIndex === "number" ? keyOrIndex : Number(keyOrIndex);
      if (!Number.isInteger(idx) || idx < 0) return false;
      container.splice(Math.min(idx, container.length), 0, value);
      return true;
    }
    container[String(keyOrIndex)] = value;
    return true;
  });
  return ok ? next : root;
}

/**
 * Remove the node at `path`, returning the new root. Array removal splices
 * (later siblings reindex, exactly like `JSON.stringify` output reads).
 * The root itself (`[]`) cannot be removed — the menu never offers it and
 * the operation answers the root unchanged.
 */
export function jsonRemoveAtPath(root: unknown, path: JsonPath): unknown {
  const { root: next, ok } = applyAtMember(root, path, (parent, seg) => {
    if (Array.isArray(parent)) {
      const idx = normalizeIndex(parent, seg);
      if (idx === null) return false;
      parent.splice(idx, 1);
      return true;
    }
    delete parent[String(seg)];
    return true;
  });
  return ok ? next : root;
}
