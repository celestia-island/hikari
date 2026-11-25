/*
 * browser-check — refuse to boot on a browser below hikari's support floor.
 *
 * This file is the SOURCE. `res/browser-check.js` beside it is the build
 * output (`pnpm run gen:res-scripts`); the `.js` is what a host page loads
 * with a bare `<script src>` before any framework exists, so this stays a
 * classic script: no imports, no exports, one IIFE.
 *
 * It does not paint anything itself. When the detected browser is below the
 * floor it calls the host's `window.__appBlock(name, version, min)` — that is
 * the boot-failure surface (hikari's `boot-recovery` plugin, or a host's own
 * landing page). Without a `__appBlock`, an unsupported browser simply sees
 * whatever the app does, which is why every consumer wiring this file also
 * wires a block handler.
 *
 * THE FLOORS ARE A SUPPORT CONTRACT, not a suggestion. They must keep the
 * family's build targets runnable: shittim-chest's vite `build.target` is
 * pinned to exactly the engines this table names, so raising a floor here
 * without raising it there ships an app to a browser it cannot run.
 */
;(function (): void {
  /** Minimum major version per engine. Safari/iOS compare as decimals. */
  var MIN_VERSIONS: Record<string, number> = {
    chrome: 100,
    edge: 100,
    firefox: 100,
    safari: 15.4,
    ios: 15.4,
    opera: 86,
    samsung: 17
  };

  /** The name a human reads in the block message. */
  var BROWSER_NAMES: Record<string, string> = {
    chrome: "Chrome",
    edge: "Edge",
    firefox: "Firefox",
    safari: "Safari",
    ios: "Safari (iOS)",
    opera: "Opera",
    samsung: "Samsung Internet"
  };

  /** What the user-agent string said, or null when it names no engine we know. */
  interface Detected {
    browser: string;
    version: number;
  }

  function detect(): Detected | null {
    var ua = navigator.userAgent || "";

    var isIOS = /iPad|iPhone|iPod/.test(ua);
    if (!isIOS && navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) {
      isIOS = true;
    }

    if (isIOS) {
      var m: RegExpMatchArray | null =
        ua.match(/Version\/(\d+(?:\.\d+)?)/) || ua.match(/OS (\d+(?:_\d+)?)/);
      if (m) return { browser: "ios", version: parseFloat(m[1].replace("_", ".")) };
      return null;
    }

    m = ua.match(/SamsungBrowser\/(\d+)/);
    if (m) return { browser: "samsung", version: parseFloat(m[1]) };

    m = ua.match(/OPR\/(\d+)/);
    if (m) return { browser: "opera", version: parseFloat(m[1]) };

    m = ua.match(/Edg\w*\/(\d+)/);
    if (m) return { browser: "edge", version: parseFloat(m[1]) };

    m = ua.match(/Firefox\/(\d+)/);
    if (m) return { browser: "firefox", version: parseFloat(m[1]) };

    m = ua.match(/Chrome\/(\d+)/);
    if (m) return { browser: "chrome", version: parseFloat(m[1]) };

    m = ua.match(/Version\/(\d+(?:\.\d+)?)/);
    if (m && /Safari\//.test(ua)) return { browser: "safari", version: parseFloat(m[1]) };

    return null;
  }

  var info = detect();
  if (!info) return;

  var min = MIN_VERSIONS[info.browser];
  if (min === undefined) return;

  if (info.version >= min) return;

  if (typeof window.__appBlock === "function") {
    window.__appBlock(BROWSER_NAMES[info.browser] || info.browser, info.version, min);
  }
})();
