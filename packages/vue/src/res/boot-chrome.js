"use strict";
/*
 * hikari boot chrome — the window caption strip that exists BEFORE the app does.
 *
 * WHY THIS FILE EXISTS (field report 2026-10-28): a Tauri shell runs with
 * `decorations: false`, so the OS paints no title bar. The in-app chrome is a
 * Vue component (HkTitleBar / HkWindowControls), which means the window has no
 * usable controls until the bundle has been fetched, parsed and mounted — and
 * if that bundle throws, hangs on a slow chunk or never mounts at all, the user
 * is left with a frameless window that cannot be moved, minimised or CLOSED.
 *
 * This script is the first thing the document runs: a classic <script src>
 * injected at the top of <body> by hikari's `bootChromePlugin`. It draws a
 * minimal caption bar from the very first frame, wires the three window
 * buttons straight to the shell, and stays out of the way until the Vue chrome
 * claims the window (`hk:chrome-claim`) — after which it fades out and removes
 * itself. No bundler, no framework, no network, no dependency.
 *
 * HOST GATES
 *   - Only inside a Tauri webview (`__TAURI_INTERNALS__` in window). A plain
 *     browser gets NOTHING: no element, no <style>, no `window.HkBootChrome`.
 *   - Double-inclusion is a no-op (the bar id is the sentinel).
 *
 * CONFIGURATION (host CSP is usually `script-src 'self'`, so inline config
 * scripts are not an option — configuration rides the script TAG itself and is
 * read from `document.currentScript.dataset`):
 *   data-hk-title    application name shown on the left (default: document.title)
 *   data-hk-hang-ms  watchdog delay in ms before the reload affordance appears
 *                    (default 20000; a non-positive/invalid value = default)
 *   data-hk-height   bar height in px (default 32, clamped to 20..64)
 *
 * HOST API — `window.HkBootChrome`:
 *   setStatus(text)  replace the status text (e.g. "connecting…")
 *   dismiss()        remove the bar now (host takes over without claiming)
 *   isActive()       is the bar still mounted / still owning the top edge?
 *   ready            Promise<boolean> — true once a window driver is wired,
 *                    false when the shell API never showed up (or the bar was
 *                    dismissed first). Await it to know whether the three
 *                    buttons actually work.
 *
 * LIFECYCLE — `document.documentElement[data-hk-boot-chrome]`:
 *   "active"   bar mounted, waiting for the app to claim the window
 *   "claimed"  the app claimed it (or the host dismissed it); bar is going away
 *   "hung"     boot watchdog fired: the app never claimed inside `hangMs`; the
 *              bar keeps the close button and grows a reload button
 * `document.documentElement.style["--hk-boot-chrome-h"]` publishes the bar
 * height so the host can offset its own content; it is removed with the bar.
 *
 * BUTTON WIRING (fault tolerant, retried — this is the point of the file):
 *   1. `__TAURI__.window.getCurrentWindow()` (the documented JS API; present
 *      when the host enables `withGlobalTauri`), else
 *   2. `__TAURI_INTERNALS__.invoke("plugin:window|<cmd>")` — the IPC surface
 *      every Tauri 2 webview has. Commands (verified against Tauri 2.12): the
 *      window is taken from the IPC context, so `minimize`, `toggle_maximize`,
 *      `is_maximized` and `close` take no required arguments.
 *   THIS ORDER AND THESE COMMAND NAMES ARE A MIRROR of
 *   `src/runtime/windowChrome.ts` (`resolveWindowApi` + `WINDOW_IPC`). This is
 *   a classic script and cannot import TS; `src/res/bootChrome.test.ts` asserts
 *   the command names match WINDOW_IPC, so changing one side fails the suite.
 *   Change both — the Vue components must keep working when only the IPC path
 *   is available (the 2026-10-28 boot where `__TAURI__` was late).
 *   3. neither ready → probe every 100 ms for up to 5 s, then DEGRADE
 *      VISIBLY: the buttons go `disabled` and the status reads "window
 *      controls unavailable". Silent no-op buttons are the bug this file fixes.
 *
 * FAILURE RULE: everything here runs on a page that is already booting, so
 * every shell/library touch is guarded; but a failure is always REPORTED on
 * the bar itself — never swallowed into a dead-looking row of buttons.
 */
(function () {
  var doc = document;
  var root = doc.documentElement;
  if (!root) return;

  // ---------------------------------------------------------------- host gates
  // A plain browser (or a non-Tauri shell) keeps its own chrome: do nothing at
  // all, not even a hidden element — an empty fixed strip would eat clicks.
  if (!("__TAURI_INTERNALS__" in window)) return;
  // A second copy of this file must not stack a second bar. The tag itself is
  // the sentinel: it exists before anything else this script does.
  if (doc.getElementById("hk-boot-chrome")) return;

  // -------------------------------------------------------------- configuration
  var HANG_MS_DEFAULT = 20000;
  var HEIGHT_DEFAULT = 32;
  var HEIGHT_MIN = 20;
  var HEIGHT_MAX = 64;
  var RETRY_EVERY_MS = 100;
  var RETRY_BUDGET_MS = 5000;
  var FADE_MS = 160; // < 200ms: the claim handoff must not delay the app.

  var currentScript = doc.currentScript;
  var cfg = (currentScript && currentScript.dataset) || {};
  var barHeight = intOption(cfg.hkHeight, HEIGHT_MIN, HEIGHT_MAX) || HEIGHT_DEFAULT;
  var hangMs = intOption(cfg.hkHangMs, 1, 3600000) || HANG_MS_DEFAULT;
  var appTitle =
    typeof cfg.hkTitle === "string" && cfg.hkTitle
      ? cfg.hkTitle
      : safe(function () {
          return typeof doc.title === "string" ? doc.title : "";
        }, "");

  /** Parse a positive integer option; null when absent/invalid/out of range. */
  function intOption(raw, min, max) {
    if (raw === undefined || raw === null || raw === "") return null;
    var value = parseInt(raw, 10);
    if (!isFinite(value) || value < min || value > max) return null;
    return value;
  }

  /** Best-effort call: never let a hostile/frozen page cost us the bar. */
  function safe(fn, fallback) {
    try {
      return fn();
    } catch (err) {
      return fallback;
    }
  }

  function noop() {}

  // --------------------------------------------------------------------- copy
  // The bar is chrome, so it follows the same locale sources the rest of the
  // boot skeleton uses (fatal-fallback.js / theme-loader.js): the app-prefixed
  // stored locale first, then the OS preference the shell publishes, then the
  // navigator list. Unknown locales fall back to English — the two Chinese
  // scripts are carried because they are the loader's largest audience, and
  // every other locale already reads the English skeleton if it is missing a
  // string there.
  var I18N = {
    en: {
      bar: "Window",
      loading: "Loading\u2026",
      longLoading: "Still loading\u2026",
      unavailable: "Window controls unavailable",
      reload: "Reload",
      minimize: "Minimize",
      maximize: "Maximize",
      restore: "Restore",
      close: "Close",
    },
    "zh-Hans": {
      bar: "\u7a97\u53e3",
      loading: "\u6b63\u5728\u52a0\u8f7d\u2026",
      longLoading: "\u52a0\u8f7d\u65f6\u95f4\u8f83\u957f",
      unavailable: "\u7a97\u53e3\u63a7\u5236\u4e0d\u53ef\u7528",
      reload: "\u91cd\u65b0\u52a0\u8f7d",
      minimize: "\u6700\u5c0f\u5316",
      maximize: "\u6700\u5927\u5316",
      restore: "\u8fd8\u539f",
      close: "\u5173\u95ed",
    },
    "zh-Hant": {
      bar: "\u8996\u7a97",
      loading: "\u6b63\u5728\u8f09\u5165\u2026",
      longLoading: "\u8f09\u5165\u6642\u9593\u8f03\u9577",
      unavailable: "\u8996\u7a97\u63a7\u5236\u4e0d\u53ef\u7528",
      reload: "\u91cd\u65b0\u8f09\u5165",
      minimize: "\u6700\u5c0f\u5316",
      maximize: "\u6700\u5927\u5316",
      restore: "\u9084\u539f",
      close: "\u95dc\u9589",
    },
  };
  var SUPPORTED_LOCALES = ["en", "zh-Hans", "zh-Hant"];

  function storagePrefix() {
    try {
      if (typeof localStorage !== "undefined") {
        if (localStorage.getItem("shittim-locale") !== null) return "shittim-";
        if (localStorage.getItem("arona-locale") !== null) return "arona-";
      }
    } catch (err) {}
    return "celestia-";
  }

  /** BCP 47 → hikari locale id, for the ids this table carries. */
  function mapLocale(bcp47) {
    if (typeof bcp47 !== "string" || !bcp47) return null;
    var lower = bcp47.toLowerCase().replace("_", "-");
    var lang = lower.split("-")[0];
    var region = lower.split("-")[1];
    if (lang === "zh") {
      return region === "tw" || region === "hk" || region === "mo"
        ? "zh-Hant"
        : "zh-Hans";
    }
    return lang === "en" ? "en" : null;
  }

  function detectLocale() {
    var stored = safe(function () {
      return localStorage.getItem(storagePrefix() + "locale");
    }, null);
    if (typeof stored === "string" && SUPPORTED_LOCALES.indexOf(stored) >= 0) {
      return stored;
    }
    var osLocale = safe(function () {
      var prefs = window.__CELESTIA_OS_PREFS__;
      return prefs && typeof prefs.locale === "string" ? prefs.locale : null;
    }, null);
    var mappedOs = mapLocale(osLocale);
    if (mappedOs) return mappedOs;
    var languages = safe(function () {
      var list = navigator.languages || [navigator.language || "en"];
      var out = [];
      for (var i = 0; i < list.length; i++) {
        if (typeof list[i] === "string") out.push(list[i]);
      }
      return out;
    }, []);
    for (var i = 0; i < languages.length; i++) {
      var mapped = mapLocale(languages[i]);
      if (mapped) return mapped;
    }
    return "en";
  }

  var locale = detectLocale();
  function t() {
    return I18N[locale] || I18N.en;
  }

  // ------------------------------------------------------------------ the bar
  var SVG_NS = "http://www.w3.org/2000/svg";
  var MINIMIZE_SHAPES = [["path", { d: "M5 12h14" }]];
  var MAXIMIZE_SHAPES = [["rect", { x: "4", y: "4", width: "16", height: "16", rx: "2" }]];
  var RESTORE_SHAPES = [
    ["rect", { x: "3", y: "8", width: "13", height: "13", rx: "2" }],
    ["path", { d: "M8 8V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-3" }],
  ];
  var CLOSE_SHAPES = [["path", { d: "M6 6l12 12M18 6L6 18" }]];
  var RELOAD_SHAPES = [
    ["path", { d: "M20.5 12a8.5 8.5 0 1 1-2.5-6" }],
    ["path", { d: "M20.5 3.5v5h-5" }],
  ];

  /** Build an inline SVG from `[tagName, attributes]` pairs — no innerHTML, so
   *  this keeps working under `require-trusted-types-for 'script'`. */
  function icon(size, shapes) {
    var svg = doc.createElementNS(SVG_NS, "svg");
    svg.setAttribute("width", String(size));
    svg.setAttribute("height", String(size));
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.75");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    for (var i = 0; i < shapes.length; i++) {
      var node = doc.createElementNS(SVG_NS, shapes[i][0]);
      var attrs = shapes[i][1];
      for (var key in attrs) {
        if (Object.prototype.hasOwnProperty.call(attrs, key)) {
          node.setAttribute(key, attrs[key]);
        }
      }
      svg.appendChild(node);
    }
    return svg;
  }

  function makeButton(act, label, glyph) {
    var button = doc.createElement("button");
    button.type = "button";
    button.id = "hk-boot-chrome-" + act;
    button.setAttribute("data-act", act);
    button.setAttribute("title", label);
    button.setAttribute("aria-label", label);
    // Nothing is wired until a driver exists: a dead-looking button that
    // silently does nothing is the exact failure mode this file removes.
    button.disabled = true;
    button.setAttribute("aria-disabled", "true");
    if (glyph) button.appendChild(glyph);
    return button;
  }

  var strings = t();

  var bar = doc.createElement("div");
  bar.id = "hk-boot-chrome";
  bar.setAttribute("role", "banner");
  bar.setAttribute("aria-label", strings.bar);
  // Tauri's built-in drag handler keys off THIS attribute on the event target;
  // `-webkit-app-region` in the stylesheet only covers the WKWebView path.
  bar.setAttribute("data-tauri-drag-region", "");
  bar.setAttribute("data-hk-available", "0");

  var titleWrap = doc.createElement("div");
  titleWrap.id = "hk-boot-chrome-title";
  titleWrap.setAttribute("data-tauri-drag-region", "");

  if (appTitle) {
    var appName = doc.createElement("span");
    appName.id = "hk-boot-chrome-app";
    appName.setAttribute("data-tauri-drag-region", "");
    appName.textContent = appTitle;
    titleWrap.appendChild(appName);
  }

  var statusEl = doc.createElement("span");
  statusEl.id = "hk-boot-chrome-status";
  statusEl.setAttribute("role", "status");
  statusEl.setAttribute("data-tauri-drag-region", "");
  statusEl.textContent = strings.loading;
  titleWrap.appendChild(statusEl);

  var actions = doc.createElement("div");
  actions.id = "hk-boot-chrome-actions";

  var minimizeBtn = makeButton("minimize", strings.minimize, icon(14, MINIMIZE_SHAPES));
  var maximizeBtn = makeButton("maximize", strings.maximize, icon(12, MAXIMIZE_SHAPES));
  var closeBtn = makeButton("close", strings.close, icon(14, CLOSE_SHAPES));
  actions.appendChild(minimizeBtn);
  actions.appendChild(maximizeBtn);
  actions.appendChild(closeBtn);

  bar.appendChild(titleWrap);
  bar.appendChild(actions);

  // The bar must not depend on hikari's stylesheet, which has not loaded yet:
  // it carries its own <style>. The `--loader-*` custom properties published
  // by theme-loader.js win when present (same palette as the loading screen);
  // `[data-mode]` is the fallback for hosts that skipped that script.
  var style = doc.createElement("style");
  style.id = "hk-boot-chrome-style";
  style.textContent = [
    "#hk-boot-chrome{" +
      "--hkbc-bg:#27272a;" +
      "--hkbc-fg:#e0e0e0;" +
      "--hkbc-muted:#9ca3af;" +
      "--hkbc-border:rgba(255,255,255,0.08);" +
      "--hkbc-hover:rgba(255,255,255,0.10);" +
      "--hkbc-active:rgba(255,255,255,0.16);" +
      "--hkbc-focus:rgb(var(--loader-r,136),var(--loader-g,192),var(--loader-b,208));" +
      "position:fixed;top:0;left:0;right:0;" +
      "height:" + barHeight + "px;box-sizing:border-box;" +
      "display:flex;align-items:center;gap:10px;padding:0 0 0 12px;" +
      "z-index:100001;" +
      "background:var(--loader-card-bg,var(--hkbc-bg));" +
      "color:var(--loader-fg,var(--hkbc-fg));" +
      "border-bottom:1px solid var(--loader-card-border,var(--hkbc-border));" +
      "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;" +
      "font-size:11px;font-weight:600;letter-spacing:0.02em;" +
      "user-select:none;-webkit-user-select:none;" +
      "-webkit-app-region:drag;app-region:drag;" +
      "transition:opacity " + FADE_MS + "ms ease;" +
      "}",
    "#hk-boot-chrome[data-mode='light']{" +
      "--hkbc-bg:#ffffff;--hkbc-fg:#1a1a1a;--hkbc-muted:#666666;" +
      "--hkbc-border:rgba(0,0,0,0.10);--hkbc-hover:rgba(0,0,0,0.06);" +
      "--hkbc-active:rgba(0,0,0,0.10);" +
      "}",
    "#hk-boot-chrome-title{" +
      "display:flex;align-items:center;gap:8px;min-width:0;flex:1 1 auto;" +
      "white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" +
      "}",
    "#hk-boot-chrome-app,#hk-boot-chrome-status{overflow:hidden;text-overflow:ellipsis;}",
    "#hk-boot-chrome-status{color:var(--loader-fg-muted,var(--hkbc-muted));font-weight:500;letter-spacing:0;}",
    "#hk-boot-chrome-actions{" +
      "margin-left:auto;display:flex;align-items:center;height:100%;flex:0 0 auto;" +
      "-webkit-app-region:no-drag;app-region:no-drag;" +
      "}",
    "#hk-boot-chrome-actions button{" +
      "width:46px;height:100%;border:0;background:transparent;color:inherit;" +
      "font:inherit;cursor:pointer;display:flex;align-items:center;justify-content:center;" +
      "transition:background-color .12s ease,color .12s ease;outline:none;" +
      "}",
    "#hk-boot-chrome-actions button:hover:not(:disabled){background:var(--hkbc-hover);}",
    "#hk-boot-chrome-actions button:active:not(:disabled){background:var(--hkbc-active);}",
    "#hk-boot-chrome-actions button:focus-visible{outline:2px solid var(--hkbc-focus);outline-offset:-2px;}",
    "#hk-boot-chrome-actions button:disabled{opacity:.45;cursor:default;}",
    "#hk-boot-chrome-actions button[data-act='close']:hover:not(:disabled){background:#e81123;color:#fff;}",
    "#hk-boot-chrome-actions button[data-act='close']:active:not(:disabled){background:#f1707a;color:#fff;}",
    "#hk-boot-chrome-actions button[data-act='reload']{width:auto;padding:0 12px;font-size:11px;}",
    "@media (prefers-reduced-motion: reduce){#hk-boot-chrome{transition:none;}}",
  ].join("\n");

  safe(function () {
    (doc.head || root).appendChild(style);
  }, undefined);

  // Publish the bar height so the host can keep its own content below it.
  safe(function () {
    root.style.setProperty("--hk-boot-chrome-h", barHeight + "px");
  }, undefined);
  root.setAttribute("data-hk-boot-chrome", "active");

  var mounted = false;
  function mount() {
    if (mounted) return;
    mounted = true;
    safe(function () {
      (doc.body || root).appendChild(bar);
    }, undefined);
  }

  // ------------------------------------------------------------------ theming
  var darkQuery = safe(function () {
    return typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-color-scheme: dark)")
      : null;
  }, null);

  function resolveMode() {
    var declared = safe(function () {
      return String(root.getAttribute("data-mode") || "").toLowerCase();
    }, "");
    if (declared === "light" || declared === "dark") return declared;
    return darkQuery && darkQuery.matches ? "dark" : "light";
  }

  function applyMode() {
    safe(function () {
      bar.setAttribute("data-mode", resolveMode());
    }, undefined);
  }

  applyMode();

  var modeObserver = safe(function () {
    var observer = new MutationObserver(applyMode);
    observer.observe(root, { attributes: true, attributeFilter: ["data-mode"] });
    return observer;
  }, null);

  safe(function () {
    if (darkQuery && typeof darkQuery.addEventListener === "function") {
      darkQuery.addEventListener("change", applyMode);
    }
  }, undefined);

  // ------------------------------------------------------------- window driver
  // Two wiring paths, probed in order; a driver is a tiny normalized facade so
  // the rest of the file never cares which one answered.
  var driver = null;

  function currentWindowApi() {
    return safe(function () {
      var api = window.__TAURI__ && window.__TAURI__.window;
      var get = api && api.getCurrentWindow;
      if (typeof get !== "function") return null;
      var win = get.call(api);
      if (
        win &&
        typeof win.minimize === "function" &&
        typeof win.toggleMaximize === "function" &&
        typeof win.close === "function"
      ) {
        return win;
      }
      return null;
    }, null);
  }

  function invokeApi() {
    return safe(function () {
      var internals = window.__TAURI_INTERNALS__;
      if (!internals || typeof internals.invoke !== "function") return null;
      return internals.invoke.bind(internals);
    }, null);
  }

  /** Call a shell method that may return a promise, a scalar or throw. */
  function attempt(fn) {
    try {
      var out = fn();
      return out && typeof out.then === "function" ? out : Promise.resolve(out);
    } catch (err) {
      return Promise.reject(err);
    }
  }

  function buildDriver() {
    var win = currentWindowApi();
    if (win) {
      return {
        kind: "window",
        minimize: function () {
          return attempt(function () {
            return win.minimize();
          });
        },
        toggleMaximize: function () {
          return attempt(function () {
            return win.toggleMaximize();
          });
        },
        isMaximized: function () {
          return attempt(function () {
            return typeof win.isMaximized === "function" ? win.isMaximized() : false;
          });
        },
        close: function () {
          return attempt(function () {
            return win.close();
          });
        },
      };
    }
    var invoke = invokeApi();
    if (!invoke) return null;
    // Tauri 2.12: the window is resolved from the IPC context, so these commands
    // take no required arguments (`{}` keeps the IPC serializer happy).
    return {
      kind: "invoke",
      minimize: function () {
        return attempt(function () {
          return invoke("plugin:window|minimize", {});
        });
      },
      toggleMaximize: function () {
        return attempt(function () {
          return invoke("plugin:window|toggle_maximize", {});
        });
      },
      isMaximized: function () {
        return attempt(function () {
          return invoke("plugin:window|is_maximized", {});
        });
      },
      close: function () {
        return attempt(function () {
          return invoke("plugin:window|close", {});
        });
      },
    };
  }

  function setControlsEnabled(enabled) {
    var buttons = [minimizeBtn, maximizeBtn, closeBtn];
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].disabled = !enabled;
      if (enabled) buttons[i].removeAttribute("aria-disabled");
      else buttons[i].setAttribute("aria-disabled", "true");
    }
    bar.setAttribute("data-hk-available", enabled ? "1" : "0");
  }

  // A settle-once promise: hosts may await `HkBootChrome.ready` to know whether
  // the controls are real before deciding to draw their own.
  var settleReady = (function () {
    var resolve = null;
    var promise = new Promise(function (done) {
      resolve = done;
    });
    return {
      promise: promise,
      settle: function (value) {
        if (!resolve) return;
        var fn = resolve;
        resolve = null;
        fn(value);
      },
    };
  })();

  var retryTimer = 0;
  var retryAttempts = 0;

  function setMaximized(next) {
    var maximized = !!next;
    var label = maximized ? t().restore : t().maximize;
    maximizeBtn.setAttribute("title", label);
    maximizeBtn.setAttribute("aria-label", label);
    while (maximizeBtn.firstChild) maximizeBtn.removeChild(maximizeBtn.firstChild);
    maximizeBtn.appendChild(
      maximized ? icon(13, RESTORE_SHAPES) : icon(12, MAXIMIZE_SHAPES)
    );
  }

  function refreshMaximized() {
    if (!driver) return;
    ignore(
      driver.isMaximized().then(
        function (value) {
          setMaximized(!!value);
        },
        noop
      )
    );
  }

  /** Attach a no-op rejection handler so a dead shell cannot surface as an
   *  unhandled rejection on a page that is already struggling to boot. */
  function ignore(promise) {
    try {
      if (promise && typeof promise.then === "function") {
        promise.then(undefined, noop);
      }
    } catch (err) {}
  }

  function connect() {
    var found = buildDriver();
    if (!found) return false;
    driver = found;
    bar.setAttribute("data-hk-driver", found.kind);
    setControlsEnabled(true);
    settleReady.settle(true);
    refreshMaximized();
    return true;
  }

  function degrade() {
    driver = null;
    bar.setAttribute("data-hk-driver", "none");
    setControlsEnabled(false);
    // Visible failure, not silence: the text is what tells the user (and the
    // next developer) that the shell API never arrived.
    setStatusText(t().unavailable);
    settleReady.settle(false);
  }

  function retry() {
    retryTimer = 0;
    if (destroyed) return;
    if (connect()) return;
    retryAttempts++;
    if (retryAttempts * RETRY_EVERY_MS >= RETRY_BUDGET_MS) {
      degrade();
      return;
    }
    retryTimer = setTimeout(retry, RETRY_EVERY_MS);
  }

  // ------------------------------------------------------------------- actions
  function setStatusText(text) {
    safe(function () {
      statusEl.textContent = text;
    }, undefined);
  }

  var reloadBtn = null;

  function ensureReloadButton() {
    if (reloadBtn) return reloadBtn;
    var button = makeButton("reload", t().reload, null);
    button.appendChild(icon(13, RELOAD_SHAPES));
    var label = doc.createElement("span");
    label.textContent = t().reload;
    label.style.marginLeft = "6px";
    button.appendChild(label);
    // Reload never depends on the shell API — it is a plain navigation, so it
    // stays enabled even when the window controls degraded.
    button.disabled = false;
    button.removeAttribute("aria-disabled");
    actions.insertBefore(button, actions.firstChild);
    reloadBtn = button;
    return button;
  }

  function reload() {
    safe(function () {
      window.location.reload();
    }, undefined);
  }

  safe(function () {
    actions.addEventListener("click", function (event) {
      var target = event && event.target;
      var button =
        target && typeof target.closest === "function"
          ? target.closest("button[data-act]")
          : null;
      if (!button || button.disabled) return;
      var act = button.getAttribute("data-act");
      if (act === "reload") {
        reload();
        return;
      }
      // Buttons are only enabled once a driver exists, so this is defensive.
      if (!driver) return;
      if (act === "minimize") {
        ignore(driver.minimize());
      } else if (act === "maximize") {
        ignore(
          driver.toggleMaximize().then(
            function () {
              refreshMaximized();
            },
            function () {
              refreshMaximized();
            }
          )
        );
      } else if (act === "close") {
        ignore(driver.close());
      }
    });
  }, undefined);

  var onWindowResize = function () {
    refreshMaximized();
  };

  safe(function () {
    window.addEventListener("resize", onWindowResize);
  }, undefined);

  // ---------------------------------------------------------- lifecycle / handoff
  var destroyed = false;
  var hangTimer = 0;

  function teardown() {
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = 0;
    }
    if (hangTimer) {
      clearTimeout(hangTimer);
      hangTimer = 0;
    }
    if (modeObserver) {
      safe(function () {
        modeObserver.disconnect();
      }, undefined);
    }
    safe(function () {
      if (darkQuery && typeof darkQuery.removeEventListener === "function") {
        darkQuery.removeEventListener("change", applyMode);
      }
    }, undefined);
    safe(function () {
      window.removeEventListener("hk:chrome-claim", onClaim);
      window.removeEventListener("resize", onWindowResize);
    }, undefined);
    settleReady.settle(false);
    safe(function () {
      root.style.removeProperty("--hk-boot-chrome-h");
    }, undefined);
  }

  function remove() {
    if (destroyed) return;
    destroyed = true;
    teardown();
    // Fade out; pointer-events drop immediately so the app underneath is
    // clickable during the fade, and the node is gone well inside 200ms.
    safe(function () {
      bar.style.opacity = "0";
      bar.style.pointerEvents = "none";
    }, undefined);
    setTimeout(function () {
      safe(function () {
        if (bar.parentNode) bar.parentNode.removeChild(bar);
      }, undefined);
    }, FADE_MS);
  }

  function onClaim() {
    if (destroyed) return;
    root.setAttribute("data-hk-boot-chrome", "claimed");
    remove();
  }

  safe(function () {
    window.addEventListener("hk:chrome-claim", onClaim);
  }, undefined);

  // ------------------------------------------------------------------ watchdog
  // If the app never claims the window, the user still needs a way out: after
  // `hangMs` the status says so and a reload button appears. The close button
  // is never removed by this path — closing must stay possible, always.
  hangTimer = setTimeout(function () {
    hangTimer = 0;
    if (destroyed) return;
    root.setAttribute("data-hk-boot-chrome", "hung");
    setStatusText(t().longLoading);
    ensureReloadButton();
  }, hangMs);

  // ---------------------------------------------------------------- public API
  var api = {
    setStatus: function (text) {
      if (destroyed) return;
      setStatusText(text);
    },
    dismiss: function () {
      remove();
    },
    isActive: function () {
      return !destroyed;
    },
    ready: settleReady.promise,
  };

  safe(function () {
    window.HkBootChrome = api;
  }, undefined);

  // ------------------------------------------------------------------- start-up
  if (doc.body) mount();
  else
    safe(function () {
      doc.addEventListener("DOMContentLoaded", mount, { once: true });
    }, undefined);

  retry();
})();
