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
  // src/scripts/fatal-fallback.ts
  var TIMEOUT = 3e4;
  var dismissed = false;
  var lastErrorMsg = "";
  var I18N = {
    en: { title: "Application failed to load", msg: "The application took too long to initialize. This may be a temporary issue.", copy: "Copy error", copied: "Copied", reload: "Reload", blockTitle: "Browser not supported", blockMsg: "Your browser ({browser} {current}) is too old to run this application. Please update to {browser} {min} or later, or switch to a modern browser such as Chrome, Firefox, or Edge." },
    "zh-Hans": { title: "\u5E94\u7528\u52A0\u8F7D\u5931\u8D25", msg: "\u5E94\u7528\u521D\u59CB\u5316\u8D85\u65F6\uFF0C\u8FD9\u53EF\u80FD\u662F\u4E34\u65F6\u6027\u95EE\u9898\u3002", copy: "\u590D\u5236\u9519\u8BEF", copied: "\u5DF2\u590D\u5236", reload: "\u5237\u65B0\u9875\u9762", blockTitle: "\u6D4F\u89C8\u5668\u7248\u672C\u8FC7\u4F4E", blockMsg: "\u60A8\u5F53\u524D\u7684\u6D4F\u89C8\u5668\uFF08{browser} {current}\uFF09\u7248\u672C\u8FC7\u4F4E\uFF0C\u65E0\u6CD5\u8FD0\u884C\u6B64\u5E94\u7528\u3002\u8BF7\u5347\u7EA7\u5230 {browser} {min} \u6216\u66F4\u9AD8\u7248\u672C\uFF0C\u6216\u66F4\u6362\u4E3A Chrome\u3001Firefox\u3001Edge \u7B49\u73B0\u4EE3\u6D4F\u89C8\u5668\u3002" },
    "zh-Hant": { title: "\u61C9\u7528\u7A0B\u5F0F\u8F09\u5165\u5931\u6557", msg: "\u61C9\u7528\u7A0B\u5F0F\u521D\u59CB\u5316\u903E\u6642\uFF0C\u9019\u53EF\u80FD\u662F\u66AB\u6642\u6027\u554F\u984C\u3002", copy: "\u8907\u88FD\u932F\u8AA4", copied: "\u5DF2\u8907\u88FD", reload: "\u91CD\u65B0\u6574\u7406", blockTitle: "\u700F\u89BD\u5668\u7248\u672C\u904E\u4F4E", blockMsg: "\u60A8\u76EE\u524D\u7684\u700F\u89BD\u5668\uFF08{browser} {current}\uFF09\u7248\u672C\u904E\u4F4E\uFF0C\u7121\u6CD5\u57F7\u884C\u6B64\u61C9\u7528\u7A0B\u5F0F\u3002\u8ACB\u5347\u7D1A\u81F3 {browser} {min} \u6216\u66F4\u65B0\u7248\u672C\uFF0C\u6216\u66F4\u63DB\u70BA Chrome\u3001Firefox\u3001Edge \u7B49\u73FE\u4EE3\u700F\u89BD\u5668\u3002" },
    ja: { title: "\u30A2\u30D7\u30EA\u30B1\u30FC\u30B7\u30E7\u30F3\u306E\u8AAD\u307F\u8FBC\u307F\u306B\u5931\u6557\u3057\u307E\u3057\u305F", msg: "\u30A2\u30D7\u30EA\u30B1\u30FC\u30B7\u30E7\u30F3\u306E\u521D\u671F\u5316\u306B\u6642\u9593\u304C\u304B\u304B\u3063\u3066\u3044\u307E\u3059\u3002\u4E00\u6642\u7684\u306A\u554F\u984C\u306E\u53EF\u80FD\u6027\u304C\u3042\u308A\u307E\u3059\u3002", copy: "\u30A8\u30E9\u30FC\u3092\u30B3\u30D4\u30FC", copied: "\u30B3\u30D4\u30FC\u3057\u307E\u3057\u305F", reload: "\u518D\u8AAD\u307F\u8FBC\u307F", blockTitle: "\u30B5\u30DD\u30FC\u30C8\u3055\u308C\u3066\u3044\u306A\u3044\u30D6\u30E9\u30A6\u30B6", blockMsg: "\u304A\u4F7F\u3044\u306E\u30D6\u30E9\u30A6\u30B6\uFF08{browser} {current}\uFF09\u306F\u53E4\u3059\u304E\u3066\u3053\u306E\u30A2\u30D7\u30EA\u30B1\u30FC\u30B7\u30E7\u30F3\u3092\u5B9F\u884C\u3067\u304D\u307E\u305B\u3093\u3002{browser} {min} \u4EE5\u964D\u306B\u66F4\u65B0\u3059\u308B\u304B\u3001Chrome\u3001Firefox\u3001Edge \u306A\u3069\u306E\u30E2\u30C0\u30F3\u30D6\u30E9\u30A6\u30B6\u306B\u5207\u308A\u66FF\u3048\u3066\u304F\u3060\u3055\u3044\u3002" },
    ko: { title: "\uC560\uD50C\uB9AC\uCF00\uC774\uC158\uC744 \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4", msg: "\uCD08\uAE30\uD654 \uC2DC\uAC04\uC774 \uCD08\uACFC\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uC77C\uC2DC\uC801\uC778 \uBB38\uC81C\uC77C \uC218 \uC788\uC2B5\uB2C8\uB2E4.", copy: "\uC624\uB958 \uBCF5\uC0AC", copied: "\uBCF5\uC0AC\uB428", reload: "\uC0C8\uB85C\uACE0\uCE68", blockTitle: "\uC9C0\uC6D0\uB418\uC9C0 \uC54A\uB294 \uBE0C\uB77C\uC6B0\uC800", blockMsg: "\uD604\uC7AC \uBE0C\uB77C\uC6B0\uC800({browser} {current})\uAC00 \uC624\uB798\uB418\uC5B4 \uC774 \uC560\uD50C\uB9AC\uCF00\uC774\uC158\uC744 \uC2E4\uD589\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. {browser} {min} \uC774\uC0C1\uC73C\uB85C \uC5C5\uB370\uC774\uD2B8\uD558\uAC70\uB098 Chrome, Firefox, Edge \uB4F1 \uCD5C\uC2E0 \uBE0C\uB77C\uC6B0\uC800\uB97C \uC0AC\uC6A9\uD558\uC138\uC694." },
    de: { title: "Anwendung konnte nicht geladen werden", msg: "Die Initialisierung dauerte zu lange. Dies k\xF6nnte ein vor\xFCbergehendes Problem sein.", copy: "Fehler kopieren", copied: "Kopiert", reload: "Neu laden", blockTitle: "Browser wird nicht unterst\xFCtzt", blockMsg: "Ihr Browser ({browser} {current}) ist veraltet und kann diese Anwendung nicht ausf\xFChren. Bitte aktualisieren Sie auf {browser} {min} oder neuer, oder wechseln Sie zu einem modernen Browser wie Chrome, Firefox oder Edge." },
    fr: { title: "\xC9chec du chargement de l'application", msg: "L'initialisation a pris trop de temps. Il s'agit peut-\xEAtre d'un probl\xE8me temporaire.", copy: "Copier l'erreur", copied: "Copi\xE9", reload: "Recharger", blockTitle: "Navigateur non pris en charge", blockMsg: "Votre navigateur ({browser} {current}) est trop ancien pour ex\xE9cuter cette application. Veuillez mettre \xE0 jour vers {browser} {min} ou ult\xE9rieur, ou utilisez un navigateur moderne tel que Chrome, Firefox ou Edge." },
    es: { title: "No se pudo cargar la aplicaci\xF3n", msg: "La inicializaci\xF3n tard\xF3 demasiado. Puede ser un problema temporal.", copy: "Copiar error", copied: "Copiado", reload: "Recargar", blockTitle: "Navegador no compatible", blockMsg: "Su navegador ({browser} {current}) es demasiado antiguo para ejecutar esta aplicaci\xF3n. Actualice a {browser} {min} o posterior, o cambie a un navegador moderno como Chrome, Firefox o Edge." },
    pt: { title: "Falha ao carregar o aplicativo", msg: "A inicializa\xE7\xE3o demorou demais. Isso pode ser um problema tempor\xE1rio.", copy: "Copiar erro", copied: "Copiado", reload: "Recarregar", blockTitle: "Navegador incompat\xEDvel", blockMsg: "Seu navegador ({browser} {current}) \xE9 muito antigo para executar este aplicativo. Atualize para {browser} {min} ou superior, ou use um navegador moderno como Chrome, Firefox ou Edge." },
    ar: { title: "\u0641\u0634\u0644 \u062A\u062D\u0645\u064A\u0644 \u0627\u0644\u062A\u0637\u0628\u064A\u0642", msg: "\u0627\u0633\u062A\u063A\u0631\u0642 \u0627\u0644\u062A\u0647\u064A\u0626\u0629 \u0648\u0642\u062A\u064B\u0627 \u0637\u0648\u064A\u0644\u0627\u064B. \u0642\u062F \u062A\u0643\u0648\u0646 \u0647\u0630\u0647 \u0645\u0634\u0643\u0644\u0629 \u0645\u0624\u0642\u062A\u0629.", copy: "\u0646\u0633\u062E \u0627\u0644\u062E\u0637\u0623", copied: "\u062A\u0645 \u0627\u0644\u0646\u0633\u062E", reload: "\u0625\u0639\u0627\u062F\u0629 \u0627\u0644\u062A\u062D\u0645\u064A\u0644", blockTitle: "\u0627\u0644\u0645\u062A\u0635\u0641\u062D \u063A\u064A\u0631 \u0645\u062F\u0639\u0648\u0645", blockMsg: "\u0645\u062A\u0635\u0641\u062D\u0643 ({browser} {current}) \u0642\u062F\u064A\u0645 \u062C\u062F\u0627\u064B \u0648\u0644\u0627 \u064A\u0645\u0643\u0646\u0647 \u062A\u0634\u063A\u064A\u0644 \u0647\u0630\u0627 \u0627\u0644\u062A\u0637\u0628\u064A\u0642. \u064A\u0631\u062C\u0649 \u0627\u0644\u062A\u062D\u062F\u064A\u062B \u0625\u0644\u0649 {browser} {min} \u0623\u0648 \u0623\u062D\u062F\u062B\u060C \u0623\u0648 \u0627\u0644\u062A\u0628\u062F\u064A\u0644 \u0625\u0644\u0649 \u0645\u062A\u0635\u0641\u062D \u062D\u062F\u064A\u062B \u0645\u062B\u0644 Chrome \u0623\u0648 Firefox \u0623\u0648 Edge." },
    ru: { title: "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C \u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u0435", msg: "\u0418\u043D\u0438\u0446\u0438\u0430\u043B\u0438\u0437\u0430\u0446\u0438\u044F \u0437\u0430\u043D\u044F\u043B\u0430 \u0441\u043B\u0438\u0448\u043A\u043E\u043C \u043C\u043D\u043E\u0433\u043E \u0432\u0440\u0435\u043C\u0435\u043D\u0438. \u0412\u043E\u0437\u043C\u043E\u0436\u043D\u043E, \u044D\u0442\u043E \u0432\u0440\u0435\u043C\u0435\u043D\u043D\u0430\u044F \u043F\u0440\u043E\u0431\u043B\u0435\u043C\u0430.", copy: "\u041A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u043E\u0448\u0438\u0431\u043A\u0443", copied: "\u0421\u043A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u043D\u043E", reload: "\u041F\u0435\u0440\u0435\u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C", blockTitle: "\u0411\u0440\u0430\u0443\u0437\u0435\u0440 \u043D\u0435 \u043F\u043E\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0435\u0442\u0441\u044F", blockMsg: "\u0412\u0430\u0448 \u0431\u0440\u0430\u0443\u0437\u0435\u0440 ({browser} {current}) \u0441\u043B\u0438\u0448\u043A\u043E\u043C \u0441\u0442\u0430\u0440\u044B\u0439 \u0434\u043B\u044F \u0437\u0430\u043F\u0443\u0441\u043A\u0430 \u044D\u0442\u043E\u0433\u043E \u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u044F. \u041E\u0431\u043D\u043E\u0432\u0438\u0442\u0435 \u0434\u043E {browser} {min} \u0438\u043B\u0438 \u043D\u043E\u0432\u0435\u0435, \u043B\u0438\u0431\u043E \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439\u0442\u0435 \u0441\u043E\u0432\u0440\u0435\u043C\u0435\u043D\u043D\u044B\u0439 \u0431\u0440\u0430\u0443\u0437\u0435\u0440, \u0442\u0430\u043A\u043E\u0439 \u043A\u0430\u043A Chrome, Firefox \u0438\u043B\u0438 Edge." }
  };
  function detectLocale() {
    const supported = Object.keys(I18N);
    try {
      const stored = localStorage.getItem(storagePrefix() + "locale");
      if (stored && supported.includes(stored)) return stored;
    } catch {
    }
    const osPrefs = window.__CELESTIA_OS_PREFS__;
    if (osPrefs?.locale) {
      const mapped = mapBcp47(osPrefs.locale);
      if (mapped && supported.includes(mapped)) return mapped;
    }
    const nav = navigator.languages || [navigator.language || navigator.userLanguage || "en"];
    for (const langRaw of nav) {
      const lang = langRaw.toLowerCase().replace("_", "-");
      for (const s of supported) if (s.toLowerCase() === lang) return s;
      const base = lang.split("-")[0];
      for (const s of supported) if (s.toLowerCase().split("-")[0] === base) return s;
    }
    return "en";
  }
  function mapBcp47(bcp47) {
    const lower = bcp47.toLowerCase();
    const lang = lower.split("-")[0];
    const region = lower.split("-")[1];
    if (lang === "zh") {
      return region === "tw" || region === "hk" || region === "mo" ? "zh-Hant" : "zh-Hans";
    }
    const direct = {
      en: "en",
      ja: "ja",
      ko: "ko",
      de: "de",
      fr: "fr",
      es: "es",
      pt: "pt",
      ar: "ar",
      ru: "ru"
    };
    return direct[lang] ?? null;
  }
  var currentLocale = "en";
  function applyLocale(loc) {
    currentLocale = loc;
    const t = I18N[loc] || I18N.en;
    const titleEl = document.getElementById("fatal-title");
    const msgEl = document.getElementById("fatal-msg");
    const copyBtn = document.getElementById("fatal-copy");
    const reloadBtn = document.getElementById("fatal-reload");
    if (titleEl) titleEl.textContent = t.title;
    if (msgEl && msgEl.getAttribute("data-default") === "1") msgEl.textContent = t.msg;
    if (copyBtn) copyBtn.textContent = t.copy;
    if (reloadBtn) reloadBtn.textContent = t.reload;
  }
  applyLocale(detectLocale());
  window.__appReady = function() {
    dismissed = true;
  };
  window.__appFatal = function(msg) {
    dismissed = true;
    lastErrorMsg = msg || "";
    if (currentLocale === "en") currentLocale = detectLocale();
    const t = I18N[currentLocale] || I18N.en;
    const el = document.getElementById("fatal-fallback");
    const titleEl = document.getElementById("fatal-title");
    const msgEl = document.getElementById("fatal-msg");
    const copyBtn = document.getElementById("fatal-copy");
    const reloadBtn = document.getElementById("fatal-reload");
    if (titleEl) titleEl.textContent = t.title;
    if (msgEl) {
      msgEl.removeAttribute("data-default");
      msgEl.textContent = msg || "";
    }
    if (copyBtn) copyBtn.textContent = t.copy;
    if (reloadBtn) reloadBtn.textContent = t.reload;
    if (el) el.classList.add("visible");
  };
  window.__appBlock = function(browserName, currentVersion, minVersion) {
    dismissed = true;
    lastErrorMsg = `${browserName} ${currentVersion} (requires >= ${minVersion})`;
    if (currentLocale === "en") currentLocale = detectLocale();
    const t = I18N[currentLocale] || I18N.en;
    const ls = document.getElementById("loading-screen");
    if (ls) ls.style.display = "none";
    const iconEl = document.querySelector("#fatal-fallback .ff-icon");
    if (iconEl) iconEl.textContent = "\u2139";
    const titleEl = document.getElementById("fatal-title");
    const msgEl = document.getElementById("fatal-msg");
    const copyBtn = document.getElementById("fatal-copy");
    const reloadBtn = document.getElementById("fatal-reload");
    if (titleEl) titleEl.textContent = t.blockTitle;
    if (msgEl) {
      msgEl.removeAttribute("data-default");
      msgEl.textContent = t.blockMsg.replace("{browser}", browserName).replace("{current}", String(currentVersion)).replace("{min}", String(minVersion));
    }
    if (copyBtn) copyBtn.textContent = t.copy;
    if (reloadBtn) reloadBtn.textContent = t.reload;
    const el = document.getElementById("fatal-fallback");
    if (el) el.classList.add("visible");
    try {
      window.stop();
    } catch {
    }
  };
  setTimeout(() => {
    if (dismissed) return;
    const app = document.getElementById("app");
    if (!app || !app.children || !app.children.length) {
      applyLocale(detectLocale());
      document.getElementById("fatal-fallback")?.classList.add("visible");
    }
  }, TIMEOUT);
  window.onerror = function(msg) {
    if (!dismissed && msg && typeof msg === "string" && !msg.includes("ChunkLoadError")) {
      window.__appFatal?.(msg);
    }
  };
  window.addEventListener("unhandledrejection", (e) => {
    if (dismissed) return;
    const reason = e.reason;
    const msg = reason && reason.message ? reason.message : String(reason);
    if (!msg.includes("ChunkLoadError")) window.__appFatal?.(msg);
  });
  function showToast(text) {
    const toast = document.getElementById("fatal-toast");
    if (!toast) return;
    toast.textContent = text;
    toast.classList.add("visible");
    setTimeout(() => {
      toast.classList.remove("visible");
    }, 2e3);
  }
  function copyError() {
    const text = lastErrorMsg || document.getElementById("fatal-msg")?.textContent || "";
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    showToast((I18N[currentLocale] || I18N.en).copied);
  }
  document.getElementById("fatal-copy")?.addEventListener("click", copyError);
  document.getElementById("fatal-reload")?.addEventListener("click", () => {
    location.reload();
  });
})();
