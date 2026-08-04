export const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** All focusable elements inside a container (excluding tabindex=-1). */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}

/** Focus the first autofocus/focusable element, falling back to the container. */
export function focusFirst(container: HTMLElement): void {
  const autofocus = container.querySelector<HTMLElement>("[autofocus]");
  const focusable = container.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
  (autofocus || focusable || container).focus();
}

/** Keep Tab/Shift+Tab cycling inside the container (modal focus trap). */
export function trapFocus(container: HTMLElement, event: KeyboardEvent): void {
  const focusable = getFocusableElements(container);
  if (focusable.length === 0) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey) {
    if (document.activeElement === first) {
      event.preventDefault();
      last.focus();
    }
  } else {
    if (document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
}

/** Scroll an element into view by selector (optional options). */
export function scrollToElement(selector: string, opts?: ScrollIntoViewOptions): void {
  const el = document.querySelector(selector) as HTMLElement | null;
  el?.scrollIntoView(opts ?? { block: "nearest" });
}
