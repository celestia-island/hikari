import { afterEach, describe, expect, it, vi } from "vitest";

import {
  BACK_GUARD_DEPTH,
  BACK_GUARD_MARKER,
  __backListenerActive,
  __registeredBackGuards,
  createBackGuard,
} from "./backStack";

/** Wait until pred() holds (history navigation settles asynchronously). */
async function until(pred: () => boolean, ms = 500): Promise<void> {
  const deadline = Date.now() + ms;
  while (!pred() && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

/** Let deferred flushes + queued traversals commit (macrotask depth). */
async function settle(): Promise<void> {
  for (let i = 0; i < 6; i++) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

afterEach(async () => {
  window.history.replaceState(null, "");
  await settle();
  window.history.replaceState(null, "");
});

describe("createBackGuard", () => {
  it("pushes a marked entry and consumes one user back for a single window", async () => {
    const onBack = vi.fn();
    const g = createBackGuard({ onBack });
    const before = window.history.state;

    g.push();
    expect(g.entries).toBe(1);
    expect((window.history.state as Record<string, unknown>)[BACK_GUARD_MARKER]).toBe(g.id);
    expect((window.history.state as Record<string, unknown>)[BACK_GUARD_DEPTH]).toBe(0);
    expect(before).toBeNull();

    // User back gesture: lands on the page base — window collapses.
    window.history.back();
    await until(() => onBack.mock.calls.length > 0);
    expect(onBack).toHaveBeenCalledWith(null);
    expect(g.entries).toBe(0);
    g.destroy();
  });

  it("dispatches multi-level backs with the landed depth", async () => {
    const onBack = vi.fn();
    const g = createBackGuard({ onBack });
    g.push(); // root, depth 0
    g.push(); // level 1
    expect(g.entries).toBe(2);

    window.history.back(); // → root entry
    await until(() => onBack.mock.calls.length > 0);
    expect(onBack).toHaveBeenLastCalledWith(0);
    expect(g.entries).toBe(1);

    window.history.back(); // → base
    await until(() => onBack.mock.calls.length > 1);
    expect(onBack).toHaveBeenLastCalledWith(null);
    expect(g.entries).toBe(0);
    g.destroy();
  });

  it("release rewinds owned entries without firing onBack (programmatic close)", async () => {
    const onBack = vi.fn();
    const g = createBackGuard({ onBack });
    g.push();
    g.push();

    g.release();
    await until(() => g.entries === 0);
    // traversal landed on the base entry, suppressed
    await until(() => window.history.state === null);
    expect(onBack).not.toHaveBeenCalled();
    g.destroy();
  });

  it("pop removes one level with a suppressed back", async () => {
    const onBack = vi.fn();
    const g = createBackGuard({ onBack });
    g.push();
    g.push();

    g.pop();
    await until(() => (window.history.state as Record<string, unknown>)?.[BACK_GUARD_DEPTH] === 0);
    expect(onBack).not.toHaveBeenCalled();
    expect(g.entries).toBe(1);
    g.destroy();
  });

  it("gives the topmost window priority over an earlier one", async () => {
    const onBackA = vi.fn();
    const onBackB = vi.fn();
    const a = createBackGuard({ onBack: onBackA });
    const b = createBackGuard({ onBack: onBackB });

    a.push(); // menu root
    a.push(); // menu level 1
    b.push(); // modal above the menu

    // User back from the modal: lands on the menu's level-1 entry, but
    // the TOPMOST window (b) must consume the gesture — not the menu.
    window.history.back();
    await until(() => onBackB.mock.calls.length > 0);
    expect(onBackB).toHaveBeenCalledWith(null);
    expect(onBackB).toHaveBeenCalledTimes(1);
    expect(onBackA).not.toHaveBeenCalled();
    expect(b.entries).toBe(0);
    expect(a.entries).toBe(2); // menu untouched, still owns its levels

    // Next back closes one menu level.
    window.history.back();
    await until(() => onBackA.mock.calls.length > 0);
    expect(onBackA).toHaveBeenLastCalledWith(0);
    a.destroy();
    b.destroy();
  });

  it("dispatches by OPEN order, not mount order (regression)", async () => {
    // Both guards exist (mounted) long before either opens; b opens
    // first, a opens second — a is the topmost window.
    const onBackA = vi.fn();
    const onBackB = vi.fn();
    const a = createBackGuard({ onBack: onBackA }); // mounted first
    const b = createBackGuard({ onBack: onBackB }); // mounted second

    b.push(); // b opens first
    a.push(); // a opens second — visually on top

    window.history.back();
    await until(() => onBackA.mock.calls.length > 0);
    expect(onBackA).toHaveBeenCalledTimes(1);
    expect(onBackB).not.toHaveBeenCalled();
    expect(a.entries).toBe(0);
    expect(b.entries).toBe(1);
    a.destroy();
    b.destroy();
  });

  it("unwinds every guard when several windows close in the same tick", async () => {
    // The modal-stack breadcrumb's jump back closes each layer stacked
    // above the chosen one, and the owners all release their entries
    // inside the same tick. Every one of them must still rewind: a
    // stranded marker stays in the session history and silently swallows
    // the user's next Back press.
    const onBackA = vi.fn();
    const onBackB = vi.fn();
    const a = createBackGuard({ onBack: onBackA });
    const b = createBackGuard({ onBack: onBackB });

    a.push(); // window opened first (bottom layer)
    b.push(); // window opened second (top layer)

    b.release(); // jump back: top layer closes first …
    a.release(); // … then the bottom one, same tick

    await settle();
    expect(a.entries).toBe(0);
    expect(b.entries).toBe(0);
    expect(onBackA).not.toHaveBeenCalled();
    expect(onBackB).not.toHaveBeenCalled();
    // Page base: no marker left owning live history.
    expect(window.history.state).toBeNull();
    a.destroy();
    b.destroy();
  });

  it("unwinds a three-window chain released top-down (breadcrumb jump)", async () => {
    // The strip's jump back closes everything above the chosen layer,
    // highest first, inside one tick. Every one of the three markers must
    // rewind: one flush issues one traversal, and the two below it are
    // DEFERRED (not abandoned) for the flushes their landings re-arm.
    const onBacks = [vi.fn(), vi.fn(), vi.fn()];
    const gs = onBacks.map((onBack) => createBackGuard({ onBack }));
    gs.forEach((g) => g.push());
    expect(window.history.state).not.toBeNull();

    gs[2].release(); // top
    gs[1].release(); // middle
    gs[0].release(); // bottom

    await settle();
    expect(gs.map((g) => g.entries)).toEqual([0, 0, 0]);
    onBacks.forEach((fn) => expect(fn).not.toHaveBeenCalled());
    // Page base — nothing left owning live history.
    expect(window.history.state).toBeNull();
    gs.forEach((g) => g.destroy());
  });

  it("unwinds a three-window chain released bottom-up (closeAll order)", async () => {
    // useOverlay.closeAll() walks its registry in open order, so the
    // BOTTOM window asks first — its claim must survive on the queue while
    // the two above it traverse, or it strands behind them.
    const onBacks = [vi.fn(), vi.fn(), vi.fn()];
    const gs = onBacks.map((onBack) => createBackGuard({ onBack }));
    gs.forEach((g) => g.push());

    gs[0].release();
    gs[1].release();
    gs[2].release();

    await settle();
    expect(gs.map((g) => g.entries)).toEqual([0, 0, 0]);
    onBacks.forEach((fn) => expect(fn).not.toHaveBeenCalled());
    expect(window.history.state).toBeNull();
    gs.forEach((g) => g.destroy());
  });

  it("rewinds a destroyed guard queued behind a later traversal", async () => {
    // A surface unmounted while its rewind waited: the record is out of
    // `guards`, so the QUEUE is its only home — and the flush must still
    // reach it once the landings arrive, or its marker keeps the current
    // history entry and eats a Back press.
    const onBackA = vi.fn();
    const onBackC = vi.fn();
    const a = createBackGuard({ onBack: onBackA });
    const b = createBackGuard({ onBack: vi.fn() });
    const c = createBackGuard({ onBack: onBackC });
    a.push();
    b.push();
    c.push();

    c.release(); // top window closes
    b.destroy(); // middle one unmounts before the flush runs
    a.release(); // bottom closes too

    await settle();
    expect(a.entries).toBe(0);
    expect(c.entries).toBe(0);
    expect(onBackA).not.toHaveBeenCalled();
    expect(onBackC).not.toHaveBeenCalled();
    expect(window.history.state).toBeNull();
    a.destroy();
    c.destroy();
  });

  it("unwinds a whole teardown chain (every guard destroyed in one tick)", async () => {
    // An app unmounting with several windows open destroys its guards in
    // one tick, in DOM order — bottom-up. Each destroyed guard rewinds
    // through the queue (its record is out of `guards`), and the chain must
    // still reach the page base: a marker left as the live entry swallows
    // the next Back press.
    const gs = [vi.fn(), vi.fn(), vi.fn()].map((onBack) => createBackGuard({ onBack }));
    gs.forEach((g) => g.push());
    gs.forEach((g) => g.destroy());

    await settle();
    expect(window.history.state).toBeNull();
    expect(__registeredBackGuards()).toBe(0);
    expect(__backListenerActive()).toBe(false);
  });

  it("does not judge ownership while a traversal is still in flight", async () => {
    // The window above is destroyed (its own synchronous rewind is on its
    // way) while the window below has already given up its entry. A flush
    // that judged ownership at that instant sees the TOP still owned by the
    // dying guard and would abandon the live claim below it — stranding
    // that marker. The flush must wait for the landing instead.
    const onBackA = vi.fn();
    const a = createBackGuard({ onBack: onBackA });
    const b = createBackGuard({ onBack: vi.fn() });
    a.push();
    b.push();

    a.release(); // bottom: queued (top is not ours yet)
    b.destroy(); // top: rewinds synchronously, traversal still in flight

    await settle();
    expect(a.entries).toBe(0);
    expect(onBackA).not.toHaveBeenCalled();
    expect(window.history.state).toBeNull();
    a.destroy();
  });

  it("close A then open B in the same tick never fires a spurious back into B", async () => {
    // The classic pattern: select a menu leaf → closeAll() → a modal
    // opens synchronously. A's rewind must not compute from a history
    // top that B's push already replaced.
    const onBackA = vi.fn();
    const onBackB = vi.fn();
    const a = createBackGuard({ onBack: onBackA });
    const b = createBackGuard({ onBack: onBackB });

    a.push();
    a.push();
    a.release(); // queued rewind (deferred)
    b.push(); // same tick: B opens above A's entries

    await settle();
    // A dropped its claim without traversing (B owns the top now).
    expect(a.entries).toBe(0);
    expect(b.entries).toBe(1);
    // B must NOT have received a spurious onBack from A's stale rewind.
    expect(onBackB).not.toHaveBeenCalled();
    expect(onBackA).not.toHaveBeenCalled();

    // The user's next back closes B (window-first), wherever it lands.
    window.history.back();
    await until(() => onBackB.mock.calls.length > 0);
    expect(onBackB).toHaveBeenCalledTimes(1);
    a.destroy();
    b.destroy();
  });

  it("normalizes a same-tick release-then-push to exactly one entry (N1)", async () => {
    // HkMenu's normalizer: a desktop→mobile flip releases the desktop
    // residue (deferred rewind) and pushes a fresh root in the SAME
    // tick. The rewind claim must survive the push, or the stale entry
    // strands and one back turns into two.
    const onBack = vi.fn();
    const g = createBackGuard({ onBack });

    g.push(); // mobile root
    g.release(); // desktop flip: rewind deferred
    g.push(); // back to mobile, same tick

    await settle();
    expect(g.entries).toBe(1);
    expect((window.history.state as Record<string, unknown>)[BACK_GUARD_DEPTH]).toBe(0);

    // One back closes the menu entirely — not two.
    window.history.back();
    await until(() => onBack.mock.calls.length > 0);
    expect(onBack).toHaveBeenCalledWith(null);
    expect(g.entries).toBe(0);
    g.destroy();
  });

  it("unmounting while a traversal is in flight never swallows the next real gesture", async () => {
    // B1 regression: listener teardown with a stale suppression must
    // reset the expectation, or the FIRST genuine back of the next
    // window gets silently eaten.
    const onBackA = vi.fn();
    const a = createBackGuard({ onBack: onBackA });
    a.push();
    a.release(); // rewind queued; traversal in flight
    a.destroy(); // unmount before it lands

    // Whatever happens, the counters must not leak into the next guard.
    await settle();
    const onBackB = vi.fn();
    const b = createBackGuard({ onBack: onBackB });
    b.push();

    window.history.back(); // genuine user gesture
    await until(() => onBackB.mock.calls.length > 0, 800);
    expect(onBackB).toHaveBeenCalledTimes(1);
    b.destroy();
  });

  it("releases a spent marker when a forward gesture lands on it while closed", async () => {
    const onBack = vi.fn();
    const g = createBackGuard({ onBack });
    g.push();
    g.release();
    await until(() => window.history.state === null);

    // Forward onto the spent entry: the service de-marks it.
    window.history.forward();
    await until(() => window.history.state === null);
    expect(
      (window.history.state as Record<string, unknown> | null)?.[BACK_GUARD_MARKER],
    ).toBeUndefined();
    g.destroy();
  });

  it("leaves a foreign history top untouched when releasing beneath it", async () => {
    const onBack = vi.fn();
    const g = createBackGuard({ onBack });
    g.push();

    // A router pushes above our entry.
    window.history.pushState({ router: true }, "");
    expect(g.ownsCurrent()).toBe(false);

    g.release();
    await settle();
    expect(g.entries).toBe(0);
    // The foreign entry's state is NOT damaged.
    expect((window.history.state as Record<string, unknown>).router).toBe(true);
    g.destroy();
  });

  it("forgets its claim and de-marks the current entry without traversing", async () => {
    const onBack = vi.fn();
    const g = createBackGuard({ onBack });
    g.push();

    g.forget();
    expect(g.entries).toBe(0);
    expect(window.history.state).toBeNull(); // marker replaced in place
    // No traversal was scheduled — history length unchanged.
    const len = window.history.length;
    await settle();
    expect(window.history.length).toBe(len);
    g.destroy();
  });

  it("abandon cancels a pending release rewind so a later async navigation survives", async () => {
    const onBack = vi.fn();
    const g = createBackGuard({ onBack });
    g.push();
    // Menu closes: release() queues the deferred rewind...
    g.release();
    // ...but the leaf's select handler abandons the claim in the same
    // tick, because it starts an async router navigation that will only
    // commit its pushState AFTER the flush macrotask has run.
    g.abandon();
    await settle();
    expect(g.entries).toBe(0);
    // No traversal fired: the marker entry is still current.
    expect((window.history.state as Record<string, unknown>)[BACK_GUARD_MARKER]).toBe(g.id);
    const len = window.history.length;
    // The async navigation finally commits on top of the marker.
    window.history.pushState({ router: true }, "");
    await settle();
    expect(window.history.length).toBe(len + 1);
    expect((window.history.state as Record<string, unknown>).router).toBe(true);
    // The guard never fired a back and its claim is gone.
    expect(onBack).not.toHaveBeenCalled();
    g.destroy();
  });

  it("abandon skips the flush entirely for multi-level claims", async () => {
    const onBack = vi.fn();
    const g = createBackGuard({ onBack });
    g.push();
    g.push();

    g.abandon();
    expect(g.entries).toBe(0);
    const len = window.history.length;
    await settle();
    // No go(-2): history untouched, current entry keeps its marker depth.
    expect(window.history.length).toBe(len);
    expect((window.history.state as Record<string, unknown>)[BACK_GUARD_DEPTH]).toBe(1);
    expect(onBack).not.toHaveBeenCalled();
    g.destroy();
  });

  it("abandon after release retracts the queued claim (same-tick leaf select)", async () => {
    const onBack = vi.fn();
    const g = createBackGuard({ onBack });
    g.push();
    g.release(); // close → rewind queued
    g.abandon(); // select handler cancels it before the flush macrotask
    await settle();
    const st = window.history.state as Record<string, unknown> | null;
    expect(st?.[BACK_GUARD_MARKER]).toBe(g.id);
    expect(onBack).not.toHaveBeenCalled();
    g.destroy();
  });

  it("drops the module listener once every guard is gone, and re-adds it later", async () => {
    expect(__backListenerActive()).toBe(false);
    const g = createBackGuard({ onBack: vi.fn() });
    expect(__backListenerActive()).toBe(true);
    g.destroy();
    expect(__backListenerActive()).toBe(false);
    expect(__registeredBackGuards()).toBe(0);
  });
});
