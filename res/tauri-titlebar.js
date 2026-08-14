"use strict";
(() => {
  function storagePrefix() {
    try {
      if (typeof localStorage !== "undefined") {
        if (localStorage.getItem("shittim-locale") !== null) return "shittim-";
        if (localStorage.getItem("arona-locale") !== null) return "arona-";
      }
    } catch (_) {}
    return "celestia-";
  }
  // src/scripts/tauri-titlebar.ts
  // Self-guard: exit silently in a plain (non-Tauri) browser. Using `return`
  // instead of `throw` avoids triggering fatal-fallback.ts's window.onerror
  // handler (which would show the "Application failed to load" overlay).
  if (typeof window === "undefined") return;
  if (!("__TAURI_INTERNALS__" in window)) return;
  if (!__TAURI__?.window) return;
  var win = __TAURI__.window.getCurrentWindow();
  var BAR_HEIGHT = 32;
  function resolveDarkMode() {
    const htmlMode = document.documentElement.getAttribute("data-mode");
    if (htmlMode === "dark") return true;
    if (htmlMode === "light") return false;
    const stored = localStorage.getItem(storagePrefix() + "theme-mode");
    if (stored === "dark") return true;
    if (stored === "light") return false;
    const isDay = resolveSolarDay();
    if (isDay !== null) return !isDay;
    return typeof matchMedia !== "undefined" && matchMedia("(prefers-color-scheme: dark)").matches;
  }
  function resolveSolarDay() {
    const geoRaw = localStorage.getItem(storagePrefix() + "geolocation");
    if (!geoRaw) return null;
    try {
      const geo = JSON.parse(geoRaw);
      if (typeof geo.lat !== "number" || typeof geo.lng !== "number") return null;
      return solarAltitude(geo.lat, geo.lng, /* @__PURE__ */ new Date()) > 6;
    } catch {
      return null;
    }
  }
  function solarAltitude(latDeg, lngDeg, date) {
    const rad = Math.PI / 180;
    const lat = latDeg * rad;
    const dayOfYear = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 864e5);
    const decl = 23.45 * rad * Math.sin(2 * Math.PI * (284 + dayOfYear) / 365);
    const utcMin = date.getUTCHours() * 60 + date.getUTCMinutes();
    const solarTime = utcMin / 60 + lngDeg / 15;
    const hourAngle = 15 * rad * (solarTime - 12);
    return Math.asin(
      Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(hourAngle)
    ) / rad;
  }
  var style = document.createElement("style");
  style.id = "tauri-titlebar-style";
  style.textContent = `
#tauri-titlebar{
  --tb-bg: rgba(24,24,27,0.55);
  --tb-border: rgba(255,255,255,0.06);
  --tb-fg: rgba(255,255,255,0.55);
  --tb-fg-strong: rgba(255,255,255,0.95);
  --tb-hover: rgba(255,255,255,0.10);
  --tb-active: rgba(255,255,255,0.16);
  --tb-focus: rgba(124,106,239,0.6);
}
#tauri-titlebar[data-theme-mode="light"]{
  --tb-bg: rgba(255,255,255,0.72);
  --tb-border: rgba(0,0,0,0.08);
  --tb-fg: rgba(0,0,0,0.55);
  --tb-fg-strong: rgba(0,0,0,0.88);
  --tb-hover: rgba(0,0,0,0.06);
  --tb-active: rgba(0,0,0,0.10);
}
#tauri-titlebar{
  position:fixed;top:0;left:0;right:0;height:${BAR_HEIGHT}px;
  display:flex;align-items:center;z-index:var(--z-titlebar,100001);user-select:none;
  background:var(--tb-bg);backdrop-filter:blur(16px);
  border-bottom:1px solid var(--tb-border);
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
  -webkit-app-region:drag;app-region:drag;
}
#tauri-titlebar-right{
  -webkit-app-region:no-drag;app-region:no-drag;
  display:flex;align-items:center;height:100%;
}
#tauri-titlebar-title{
  font-size:11px;font-weight:600;letter-spacing:0.02em;
  color:var(--tb-fg);padding-left:12px;white-space:nowrap;
}
#tauri-titlebar-spacer{flex:1}
.tauri-caption-btn{
  width:46px;height:${BAR_HEIGHT}px;border:none;background:transparent;
  color:var(--tb-fg);cursor:pointer;display:flex;align-items:center;
  justify-content:center;transition:background-color .12s ease,color .12s ease;
  outline:none;
}
.tauri-caption-btn:hover{background:var(--tb-hover);color:var(--tb-fg-strong)}
.tauri-caption-btn:active{background:var(--tb-active)}
.tauri-caption-btn--close:hover{background:#e81123;color:#fff}
.tauri-caption-btn--close:active{background:#f1707a;color:#fff}
.tauri-caption-btn:focus-visible{outline:2px solid var(--tb-focus);outline-offset:-2px}
html,body{margin:0!important;padding:0!important;overflow:hidden!important}
#app{position:absolute!important;top:${BAR_HEIGHT}px!important;left:0!important;right:0!important;bottom:0!important;width:100%!important;height:auto!important;overflow:hidden!important}
`;
  document.head.appendChild(style);
  var MIN_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><path d="M5 12h14"/></svg>';
  var MAX_SVG = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>';
  var RESTORE_SVG = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><rect x="3" y="8" width="13" height="13" rx="2"/><path d="M8 8V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-3"/></svg>';
  var CLOSE_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  var bar = document.createElement("div");
  bar.id = "tauri-titlebar";
  bar.innerHTML = [
    '<span id="tauri-titlebar-title">Shittim Chest</span>',
    '<span id="tauri-titlebar-spacer"></span>',
    '<div id="tauri-titlebar-right">',
    `<button type="button" class="tauri-caption-btn" data-act="minimize" title="Minimize" aria-label="Minimize">${MIN_SVG}</button>`,
    `<button type="button" class="tauri-caption-btn" data-act="toggle" title="Maximize" aria-label="Maximize">${MAX_SVG}</button>`,
    `<button type="button" class="tauri-caption-btn tauri-caption-btn--close" data-act="close" title="Close" aria-label="Close">${CLOSE_SVG}</button>`,
    "</div>"
  ].join("");
  document.body.appendChild(bar);
  function applyTitlebarTheme() {
    bar.setAttribute("data-theme-mode", resolveDarkMode() ? "dark" : "light");
  }
  applyTitlebarTheme();
  var themeObserver = new MutationObserver(applyTitlebarTheme);
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-mode", "data-theme"]
  });
  window.addEventListener("storage", (e) => {
    if (e.key === storagePrefix() + "theme-mode" || e.key === storagePrefix() + "theme") {
      applyTitlebarTheme();
    }
  });
  if (typeof matchMedia !== "undefined") {
    matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTitlebarTheme);
  }
  var titleEl = document.getElementById("tauri-titlebar-title");
  if (titleEl) {
    const updateTitle = () => {
      titleEl.textContent = document.title || "Shittim Chest";
    };
    updateTitle();
    const titleNode = document.querySelector("title");
    if (titleNode) {
      const mo = new MutationObserver(updateTitle);
      mo.observe(titleNode, { childList: true, characterData: true, subtree: true });
    }
  }
  function refreshMaximized() {
    const btn = bar.querySelector('[data-act="toggle"]');
    if (!btn) return;
    win.isMaximized().then((max) => {
      btn.innerHTML = max ? RESTORE_SVG : MAX_SVG;
      btn.title = max ? "Restore" : "Maximize";
      btn.setAttribute("aria-label", max ? "Restore" : "Maximize");
    }).catch(() => {
    });
  }
  refreshMaximized();
  win.onResized(() => refreshMaximized()).catch(() => {
  });
  bar.addEventListener("dblclick", (e) => {
    if (e.target?.closest?.(".tauri-caption-btn")) return;
    win.toggleMaximize().catch(() => {
    });
  });
  bar.querySelector("#tauri-titlebar-right")?.addEventListener("click", (e) => {
    const btn = e.target?.closest?.(".tauri-caption-btn");
    if (!btn) return;
    const act = btn.getAttribute("data-act");
    if (act === "minimize") win.minimize().catch(() => {
    });
    else if (act === "toggle") win.toggleMaximize().catch(() => {
    });
    else if (act === "close") win.close().catch(() => {
    });
  });
})();
