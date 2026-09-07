// Transition-class repair kit — the enter-side counterpart of HkModal's
// leave watchdog.
//
// A Vue <Transition> flips enter-from → enter-to through rAF and waits on
// transitionend. When rAF starves (occluded/backgrounded webview — the
// same pathology the leave watchdog in HkModal bounds), the enter classes
// FREEZE on the element: the layer keeps `*-enter-from` (opacity: 0,
// translateY(100%), …) while the surface is logically open. The modal's
// scrim then stays invisible with the panel floating above it, and the
// eventual close flashes the resurrected curtain at full opacity — the
// 2026-09 mobile "black rectangle" report (the leave pair
// leave-from → leave-to snaps the scrim to opacity: 1 before fading).
//
// Two primitives:
//   stripTransitionClasses — remove every `name-*` transition class so the
//     element snaps to its resting state (no fade — this is a repair
//     path, the animation already failed).
//   armTransitionClassWatchdog — bounded safety net: if the element still
//     carries `name-enter-*` classes once the budget lapses (larger than
//     any themed duration), strip them. Normal enters disarm it; a
//     completed enter is a no-op (the classes are already gone).

/** The exact set of classes Vue's <Transition name=…> stamps on an
 *  element — matched precisely so a hand-written class that merely
 *  starts with the name (e.g. `name-v2`) is never touched. */
const TRANSITION_CLASS_SUFFIXES = [
  "-enter-from",
  "-enter-active",
  "-enter-to",
  "-leave-from",
  "-leave-active",
  "-leave-to",
] as const;

function transitionClassesOf(el: HTMLElement, name: string): string[] {
  const names = TRANSITION_CLASS_SUFFIXES.map((suffix) => `${name}${suffix}`);
  return Array.from(el.classList).filter((cls) => names.includes(cls));
}

/** Strip all `name-*` transition classes off `el`, snapping it to its
 *  resting (non-transition) state. Safe on class-less elements. */
export function stripTransitionClasses(el: HTMLElement, name: string): void {
  for (const cls of transitionClassesOf(el, name)) el.classList.remove(cls);
}

/**
 * Bound a stuck transition: if the element still carries ANY `name-*`
 * transition class after `budgetMs` while the surface is open (the enter
 * never finalized — or an interrupted leave left its pair behind — rAF
 * starvation), strip them so the layer renders in its open state instead
 * of staying frozen at a from/to pair. The budget is larger than any
 * themed CSS duration, so a legitimate animation never sees the strip.
 *
 * `isStillOpen` gates the repair: once the surface closed, the leave owns
 * the element and a late strip must not fight it.
 *
 * @returns the disarm function (call on after-enter / enter-cancelled /
 *   close / unmount).
 */
export function armTransitionClassWatchdog(
  el: HTMLElement,
  name: string,
  isStillOpen: () => boolean,
  budgetMs = 600,
): () => void {
  const timer = setTimeout(() => {
    if (!isStillOpen()) return;
    if (transitionClassesOf(el, name).length > 0) {
      stripTransitionClasses(el, name);
    }
  }, budgetMs);
  return () => clearTimeout(timer);
}
