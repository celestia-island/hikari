/*
 * loader-dismiss — the pre-paint loading screen's dismiss handle.
 *
 * This file is the SOURCE. `res/loader-dismiss.js` beside it is the build
 * output (`pnpm run gen:res-scripts`), and the `.js` is what every consumer
 * loads with a bare `<script src>` before any framework exists.
 *
 * Authored as a classic script, not a module: it is concatenated into a page
 * that has no module graph yet, so it declares its one global and nothing
 * else. The IIFE keeps `dismissLoading` off the page's scope.
 */
;(function (): void {
  /** Fade the host's `#loading-screen` out, then drop it from the tree. */
  function dismissLoading(): void {
    var screen: HTMLElement | null = document.getElementById("loading-screen");
    if (screen) {
      screen.classList.add("fade-out");
      setTimeout(function (): void { screen!.remove(); }, 500);
    }
  }

  (window as Window & { __loaderDismiss?: () => void }).__loaderDismiss =
    dismissLoading;
})();
