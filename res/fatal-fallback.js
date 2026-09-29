"use strict";
(() => {
  function storagePrefix() {
    try {
      if (typeof localStorage !== "undefined") {
        if (localStorage.getItem("shittim-locale") !== null) return "shittim-";
        if (localStorage.getItem("arona-locale") !== null) return "arona-";
      }
    } catch {}
    return "celestia-";
  }
  // Shared boot-failure landing — the surface a host paints when the app
  // bundle never mounts. It runs with NO framework, NO app bundle and NO
  // second network round-trip: its only inputs are the host skeleton in
  // index.html and the loader palette theme-loader.js already published.
  //
  // Skeleton contract (the host half — every lookup here is guarded, so an
  // older skeleton keeps working and simply loses the parts it lacks):
  //   #fatal-fallback        overlay root, shown with class "visible"
  //   #fatal-title           localized REASON headline
  //   #fatal-msg             localized explanation (`data-default="1"`
  //                          marks the pre-boot placeholder copy)
  //   #fatal-details-label   label above the raw payload pane
  //   #fatal-json            the raw error payload, as JSON text
  //   #fatal-copy / #fatal-reload / #fatal-toast   actions + feedback
  //   #fatal-fallback .ff-icon   the tone disc; its textContent is swapped
  //                          for the info glyph on the browser-block reason
  //   #app                   read (never written) for the mount state —
  //                          "did the SPA render?" gates the onerror hook
  //   #loading-screen        hidden on the browser-block reason
  // Renaming any of these costs that part of the landing silently, so a
  // host that re-vendors its skeleton should keep the ids verbatim.
  //
  // Host-facing hooks: `window.__appFatal(msg, detail?)` (the host's own
  // fatal path — `detail` is an optional { name, message, stack } shape),
  // `window.__appReady()` (mount succeeded; stand the overlay down) and
  // `window.__appBlock(browser, version, minVersion)`.
  //
  // The DATA half lives here: every failure is classified into a REASON
  // (timeout / chunk / error / browser), the reason selects the localized
  // headline and explanation, and the raw payload — message, stack, boot
  // diagnostics — is serialized into the JSON pane, so whoever is staring
  // at a dead panel can tell WHY without opening devtools. The skeleton
  // mirrors hikari's HkErrorLanding card (tone icon disc on top, headline,
  // explanation, raw-details pane, actions) so a boot failure and an
  // in-app error landing read as one surface.
  var TIMEOUT = 3e4;
  var dismissed = false;
  var lastPayload = null;
  // First error captured before the app mounted. A chunk miss during boot
  // is recoverable (the host's lazy-load policy retries in place, then
  // reloads once), so it is RECORDED rather than raised on sight; when the
  // watchdog finally gives up, the recorded cause — not the generic
  // timeout — is what gets reported.
  var pendingCause = null;
  var bootStartedAt = Date.now();
  var I18N = {
    en: { errorTitle: "Application failed to load", errorDesc: "An uncaught error interrupted the boot. The raw details below may identify the cause.", timeoutTitle: "Application initialization timed out", timeoutDesc: "The application did not finish initializing within {seconds} seconds. This may be a temporary issue.", chunkTitle: "Application resources failed to load", chunkDesc: "Part of the frontend bundle could not be fetched \u2014 usually a tab left open across a redeploy. Reloading the page restores it.", rawDetails: "Raw error details", copy: "Copy error", copied: "Copied", copyFailed: "Copy failed", reload: "Reload", blockTitle: "Browser not supported", blockMsg: "Your browser ({browser} {current}) is too old to run this application. Please update to {browser} {min} or later, or switch to a modern browser such as Chrome, Firefox, or Edge." },
    "zh-Hans": { errorTitle: "\u5E94\u7528\u52A0\u8F7D\u5931\u8D25", errorDesc: "\u542F\u52A8\u8FC7\u7A0B\u4E2D\u51FA\u73B0\u672A\u6355\u83B7\u7684\u9519\u8BEF\uFF0C\u4E0B\u65B9\u539F\u59CB\u9519\u8BEF\u8BE6\u60C5\u53EF\u80FD\u6709\u52A9\u4E8E\u5B9A\u4F4D\u539F\u56E0\u3002", timeoutTitle: "\u5E94\u7528\u521D\u59CB\u5316\u8D85\u65F6", timeoutDesc: "\u5E94\u7528\u5728 {seconds} \u79D2\u5185\u6CA1\u6709\u5B8C\u6210\u521D\u59CB\u5316\uFF0C\u8FD9\u53EF\u80FD\u662F\u4E34\u65F6\u6027\u95EE\u9898\u3002", chunkTitle: "\u5E94\u7528\u8D44\u6E90\u52A0\u8F7D\u5931\u8D25", chunkDesc: "\u90E8\u5206\u524D\u7AEF\u8D44\u6E90\u672A\u80FD\u52A0\u8F7D\uFF0C\u901A\u5E38\u662F\u9875\u9762\u4ECD\u505C\u7559\u5728\u65E7\u7248\u672C\uFF08\u91CD\u65B0\u90E8\u7F72\u540E\u672A\u5237\u65B0\uFF09\u2014\u2014\u5237\u65B0\u9875\u9762\u5373\u53EF\u6062\u590D\u3002", rawDetails: "\u539F\u59CB\u9519\u8BEF\u8BE6\u60C5", copy: "\u590D\u5236\u9519\u8BEF", copied: "\u5DF2\u590D\u5236", copyFailed: "\u590D\u5236\u5931\u8D25", reload: "\u5237\u65B0\u9875\u9762", blockTitle: "\u6D4F\u89C8\u5668\u7248\u672C\u8FC7\u4F4E", blockMsg: "\u60A8\u5F53\u524D\u7684\u6D4F\u89C8\u5668\uFF08{browser} {current}\uFF09\u7248\u672C\u8FC7\u4F4E\uFF0C\u65E0\u6CD5\u8FD0\u884C\u6B64\u5E94\u7528\u3002\u8BF7\u5347\u7EA7\u5230 {browser} {min} \u6216\u66F4\u9AD8\u7248\u672C\uFF0C\u6216\u66F4\u6362\u4E3A Chrome\u3001Firefox\u3001Edge \u7B49\u73B0\u4EE3\u6D4F\u89C8\u5668\u3002" },
    "zh-Hant": { errorTitle: "\u61C9\u7528\u7A0B\u5F0F\u8F09\u5165\u5931\u6557", errorDesc: "\u555F\u52D5\u904E\u7A0B\u4E2D\u51FA\u73FE\u672A\u6355\u7372\u7684\u932F\u8AA4\uFF0C\u4E0B\u65B9\u539F\u59CB\u932F\u8AA4\u8A73\u60C5\u53EF\u80FD\u6709\u52A9\u65BC\u5B9A\u4F4D\u539F\u56E0\u3002", timeoutTitle: "\u61C9\u7528\u7A0B\u5F0F\u521D\u59CB\u5316\u903E\u6642", timeoutDesc: "\u61C9\u7528\u7A0B\u5F0F\u5728 {seconds} \u79D2\u5167\u6C92\u6709\u5B8C\u6210\u521D\u59CB\u5316\uFF0C\u9019\u53EF\u80FD\u662F\u66AB\u6642\u6027\u554F\u984C\u3002", chunkTitle: "\u61C9\u7528\u7A0B\u5F0F\u8CC7\u6E90\u8F09\u5165\u5931\u6557", chunkDesc: "\u90E8\u5206\u524D\u7AEF\u8CC7\u6E90\u672A\u80FD\u8F09\u5165\uFF0C\u901A\u5E38\u662F\u9801\u9762\u4ECD\u505C\u7559\u5728\u820A\u7248\u672C\uFF08\u91CD\u65B0\u90E8\u7F72\u5F8C\u672A\u91CD\u65B0\u6574\u7406\uFF09\u2014\u2014\u91CD\u65B0\u6574\u7406\u9801\u9762\u5373\u53EF\u6062\u5FA9\u3002", rawDetails: "\u539F\u59CB\u932F\u8AA4\u8A73\u60C5", copy: "\u8907\u88FD\u932F\u8AA4", copied: "\u5DF2\u8907\u88FD", copyFailed: "\u8907\u88FD\u5931\u6557", reload: "\u91CD\u65B0\u6574\u7406", blockTitle: "\u700F\u89BD\u5668\u7248\u672C\u904E\u4F4E", blockMsg: "\u60A8\u76EE\u524D\u7684\u700F\u89BD\u5668\uFF08{browser} {current}\uFF09\u7248\u672C\u904E\u4F4E\uFF0C\u7121\u6CD5\u57F7\u884C\u6B64\u61C9\u7528\u7A0B\u5F0F\u3002\u8ACB\u5347\u7D1A\u81F3 {browser} {min} \u6216\u66F4\u65B0\u7248\u672C\uFF0C\u6216\u66F4\u63DB\u70BA Chrome\u3001Firefox\u3001Edge \u7B49\u73FE\u4EE3\u700F\u89BD\u5668\u3002" },
    ja: { errorTitle: "\u30A2\u30D7\u30EA\u30B1\u30FC\u30B7\u30E7\u30F3\u306E\u8AAD\u307F\u8FBC\u307F\u306B\u5931\u6557\u3057\u307E\u3057\u305F", errorDesc: "\u8D77\u52D5\u4E2D\u306B\u6355\u6349\u3055\u308C\u306A\u3044\u30A8\u30E9\u30FC\u304C\u767A\u751F\u3057\u307E\u3057\u305F\u3002\u4E0B\u90E8\u306E\u539F\u6587\u306E\u8A73\u7D30\u304C\u539F\u56E0\u306E\u7279\u5B9A\u306B\u5F79\u7ACB\u3064\u5834\u5408\u304C\u3042\u308A\u307E\u3059\u3002", timeoutTitle: "\u30A2\u30D7\u30EA\u30B1\u30FC\u30B7\u30E7\u30F3\u306E\u521D\u671F\u5316\u304C\u30BF\u30A4\u30E0\u30A2\u30A6\u30C8\u3057\u307E\u3057\u305F", timeoutDesc: "{seconds} \u79D2\u4EE5\u5185\u306B\u521D\u671F\u5316\u304C\u5B8C\u4E86\u3057\u307E\u305B\u3093\u3067\u3057\u305F\u3002\u4E00\u6642\u7684\u306A\u554F\u984C\u306E\u53EF\u80FD\u6027\u304C\u3042\u308A\u307E\u3059\u3002", chunkTitle: "\u30A2\u30D7\u30EA\u30B1\u30FC\u30B7\u30E7\u30F3\u306E\u30EA\u30BD\u30FC\u30B9\u3092\u8AAD\u307F\u8FBC\u3081\u307E\u305B\u3093\u3067\u3057\u305F", chunkDesc: "\u4E00\u90E8\u306E\u30D5\u30ED\u30F3\u30C8\u30A8\u30F3\u30C9\u30D5\u30A1\u30A4\u30EB\u3092\u53D6\u5F97\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002\u591A\u304F\u306E\u5834\u5408\u3001\u518D\u30C7\u30D7\u30ED\u30A4\u3092\u307E\u305F\u3044\u3067\u958B\u3044\u305F\u307E\u307E\u306E\u30BF\u30D6\u304C\u539F\u56E0\u3067\u3059\u3002\u30DA\u30FC\u30B8\u3092\u518D\u8AAD\u307F\u8FBC\u307F\u3059\u308B\u3068\u5FA9\u65E7\u3057\u307E\u3059\u3002", rawDetails: "\u30A8\u30E9\u30FC\u306E\u8A73\u7D30\uFF08\u539F\u6587\uFF09", copy: "\u30A8\u30E9\u30FC\u3092\u30B3\u30D4\u30FC", copied: "\u30B3\u30D4\u30FC\u3057\u307E\u3057\u305F", copyFailed: "\u30B3\u30D4\u30FC\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F", reload: "\u518D\u8AAD\u307F\u8FBC\u307F", blockTitle: "\u30B5\u30DD\u30FC\u30C8\u3055\u308C\u3066\u3044\u306A\u3044\u30D6\u30E9\u30A6\u30B6", blockMsg: "\u304A\u4F7F\u3044\u306E\u30D6\u30E9\u30A6\u30B6\uFF08{browser} {current}\uFF09\u306F\u53E4\u3059\u304E\u3066\u3053\u306E\u30A2\u30D7\u30EA\u30B1\u30FC\u30B7\u30E7\u30F3\u3092\u5B9F\u884C\u3067\u304D\u307E\u305B\u3093\u3002{browser} {min} \u4EE5\u964D\u306B\u66F4\u65B0\u3059\u308B\u304B\u3001Chrome\u3001Firefox\u3001Edge \u306A\u3069\u306E\u30E2\u30C0\u30F3\u30D6\u30E9\u30A6\u30B6\u306B\u5207\u308A\u66FF\u3048\u3066\u304F\u3060\u3055\u3044\u3002" },
    ko: { errorTitle: "\uC560\uD50C\uB9AC\uCF00\uC774\uC158\uC744 \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4", errorDesc: "\uC2DC\uC791 \uC911 \uCC98\uB9AC\uB418\uC9C0 \uC54A\uC740 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4. \uC544\uB798 \uC6D0\uBCF8 \uC624\uB958 \uC138\uBD80 \uC815\uBCF4\uAC00 \uC6D0\uC778 \uD30C\uC545\uC5D0 \uB3C4\uC6C0\uC774 \uB420 \uC218 \uC788\uC2B5\uB2C8\uB2E4.", timeoutTitle: "\uC560\uD50C\uB9AC\uCF00\uC774\uC158 \uCD08\uAE30\uD654 \uC2DC\uAC04 \uCD08\uACFC", timeoutDesc: "{seconds}\uCD08 \uC548\uC5D0 \uCD08\uAE30\uD654\uB97C \uB9C8\uCE58\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. \uC77C\uC2DC\uC801\uC778 \uBB38\uC81C\uC77C \uC218 \uC788\uC2B5\uB2C8\uB2E4.", chunkTitle: "\uC560\uD50C\uB9AC\uCF00\uC774\uC158 \uB9AC\uC18C\uC2A4\uB97C \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4", chunkDesc: "\uC77C\uBD80 \uD504\uB7F0\uD2B8\uC5D4\uB4DC \uB9AC\uC18C\uC2A4\uB97C \uAC00\uC838\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. \uBCF4\uD1B5 \uC7AC\uBC30\uD3EC \uC774\uD6C4\uC5D0\uB3C4 \uC5F4\uB824 \uC788\uB358 \uD0ED\uC774 \uC6D0\uC778\uC774\uBA70, \uD398\uC774\uC9C0\uB97C \uC0C8\uB85C \uACE0\uCE58\uBA74 \uBCF5\uAD6C\uB429\uB2C8\uB2E4.", rawDetails: "\uC6D0\uBCF8 \uC624\uB958 \uC138\uBD80 \uC815\uBCF4", copy: "\uC624\uB958 \uBCF5\uC0AC", copied: "\uBCF5\uC0AC\uB428", copyFailed: "\uBCF5\uC0AC\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4", reload: "\uC0C8\uB85C\uACE0\uCE68", blockTitle: "\uC9C0\uC6D0\uB418\uC9C0 \uC54A\uB294 \uBE0C\uB77C\uC6B0\uC800", blockMsg: "\uD604\uC7AC \uBE0C\uB77C\uC6B0\uC800({browser} {current})\uAC00 \uC624\uB798\uB418\uC5B4 \uC774 \uC560\uD50C\uB9AC\uCF00\uC774\uC158\uC744 \uC2E4\uD589\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. {browser} {min} \uC774\uC0C1\uC73C\uB85C \uC5C5\uB370\uC774\uD2B8\uD558\uAC70\uB098 Chrome, Firefox, Edge \uB4F1 \uCD5C\uC2E0 \uBE0C\uB77C\uC6B0\uC800\uB97C \uC0AC\uC6A9\uD558\uC138\uC694." },
    de: { errorTitle: "Anwendung konnte nicht geladen werden", errorDesc: "Ein nicht abgefangener Fehler hat den Start unterbrochen. Die Originaldetails unten k\xF6nnen die Ursache eingrenzen.", timeoutTitle: "Zeit\xFCberschreitung bei der Initialisierung", timeoutDesc: "Die Anwendung hat die Initialisierung nicht innerhalb von {seconds} Sekunden abgeschlossen. Dies kann ein vor\xFCbergehendes Problem sein.", chunkTitle: "Anwendungsressourcen konnten nicht geladen werden", chunkDesc: "Ein Teil des Frontend-Bundles konnte nicht geladen werden \u2014 meist ein Tab, der \xFCber ein Redeployment hinweg offen blieb. Ein Neuladen der Seite behebt das.", rawDetails: "Fehlerdetails im Original", copy: "Fehler kopieren", copied: "Kopiert", copyFailed: "Kopieren fehlgeschlagen", reload: "Neu laden", blockTitle: "Browser wird nicht unterst\xFCtzt", blockMsg: "Ihr Browser ({browser} {current}) ist veraltet und kann diese Anwendung nicht ausf\xFChren. Bitte aktualisieren Sie auf {browser} {min} oder neuer, oder wechseln Sie zu einem modernen Browser wie Chrome, Firefox oder Edge." },
    fr: { errorTitle: "\xC9chec du chargement de l'application", errorDesc: "Une erreur non intercept\xE9e a interrompu le d\xE9marrage. Les d\xE9tails bruts ci-dessous peuvent aider \xE0 identifier la cause.", timeoutTitle: "D\xE9lai d'initialisation d\xE9pass\xE9", timeoutDesc: "L'application n'a pas termin\xE9 son initialisation en {seconds} secondes. Il s'agit peut-\xEAtre d'un probl\xE8me temporaire.", chunkTitle: "\xC9chec du chargement des ressources de l'application", chunkDesc: "Une partie du bundle frontend n'a pas pu \xEAtre r\xE9cup\xE9r\xE9e \u2014 souvent un onglet rest\xE9 ouvert pendant un red\xE9ploiement. Rechargez la page pour r\xE9tablir la situation.", rawDetails: "D\xE9tails bruts de l'erreur", copy: "Copier l'erreur", copied: "Copi\xE9", copyFailed: "\xC9chec de la copie", reload: "Recharger", blockTitle: "Navigateur non pris en charge", blockMsg: "Votre navigateur ({browser} {current}) est trop ancien pour ex\xE9cuter cette application. Veuillez mettre \xE0 jour vers {browser} {min} ou ult\xE9rieur, ou utilisez un navigateur moderne tel que Chrome, Firefox ou Edge." },
    es: { errorTitle: "No se pudo cargar la aplicaci\xF3n", errorDesc: "Un error no controlado interrumpi\xF3 el arranque. Los detalles originales de abajo pueden ayudar a identificar la causa.", timeoutTitle: "Se agot\xF3 el tiempo de inicializaci\xF3n", timeoutDesc: "La aplicaci\xF3n no termin\xF3 de inicializarse en {seconds} segundos. Puede ser un problema temporal.", chunkTitle: "No se pudieron cargar los recursos de la aplicaci\xF3n", chunkDesc: "No se pudo obtener parte del bundle del frontend; suele ser una pesta\xF1a abierta durante un redespliegue. Recargar la p\xE1gina lo soluciona.", rawDetails: "Detalles del error original", copy: "Copiar error", copied: "Copiado", copyFailed: "No se pudo copiar", reload: "Recargar", blockTitle: "Navegador no compatible", blockMsg: "Su navegador ({browser} {current}) es demasiado antiguo para ejecutar esta aplicaci\xF3n. Actualice a {browser} {min} o posterior, o cambie a un navegador moderno como Chrome, Firefox o Edge." },
    pt: { errorTitle: "Falha ao carregar o aplicativo", errorDesc: "Um erro n\xE3o tratado interrompeu a inicializa\xE7\xE3o. Os detalhes originais abaixo podem ajudar a identificar a causa.", timeoutTitle: "Tempo de inicializa\xE7\xE3o esgotado", timeoutDesc: "O aplicativo n\xE3o concluiu a inicializa\xE7\xE3o em {seconds} segundos. Pode ser um problema tempor\xE1rio.", chunkTitle: "Falha ao carregar os recursos do aplicativo", chunkDesc: "Parte do bundle do frontend n\xE3o p\xF4de ser obtida \u2014 geralmente uma aba aberta durante uma reimplanta\xE7\xE3o. Recarregar a p\xE1gina resolve.", rawDetails: "Detalhes do erro original", copy: "Copiar erro", copied: "Copiado", copyFailed: "Falha ao copiar", reload: "Recarregar", blockTitle: "Navegador incompat\xEDvel", blockMsg: "Seu navegador ({browser} {current}) \xE9 muito antigo para executar este aplicativo. Atualize para {browser} {min} ou superior, ou use um navegador moderno como Chrome, Firefox ou Edge." },
    ar: { errorTitle: "\u0641\u0634\u0644 \u062A\u062D\u0645\u064A\u0644 \u0627\u0644\u062A\u0637\u0628\u064A\u0642", errorDesc: "\u0642\u0627\u0637\u0639 \u062E\u0637\u0623 \u063A\u064A\u0631 \u0645\u0639\u0627\u0644\u064E\u062C \u0639\u0645\u0644\u064A\u0629 \u0628\u062F\u0621 \u0627\u0644\u062A\u0634\u063A\u064A\u0644. \u0642\u062F \u062A\u0633\u0627\u0639\u062F \u0627\u0644\u062A\u0641\u0627\u0635\u064A\u0644 \u0627\u0644\u0623\u0635\u0644\u064A\u0629 \u0623\u062F\u0646\u0627\u0647 \u0641\u064A \u062A\u062D\u062F\u064A\u062F \u0627\u0644\u0633\u0628\u0628.", timeoutTitle: "\u0627\u0646\u062A\u0647\u062A \u0645\u0647\u0644\u0629 \u062A\u0647\u064A\u0626\u0629 \u0627\u0644\u062A\u0637\u0628\u064A\u0642", timeoutDesc: "\u0644\u0645 \u064A\u064F\u0643\u0645\u0644 \u0627\u0644\u062A\u0637\u0628\u064A\u0642 \u0627\u0644\u062A\u0647\u064A\u0626\u0629 \u062E\u0644\u0627\u0644 {seconds} \u062B\u0627\u0646\u064A\u0629. \u0642\u062F \u062A\u0643\u0648\u0646 \u0647\u0630\u0647 \u0645\u0634\u0643\u0644\u0629 \u0645\u0624\u0642\u062A\u0629.", chunkTitle: "\u0641\u0634\u0644 \u062A\u062D\u0645\u064A\u0644 \u0645\u0648\u0627\u0631\u062F \u0627\u0644\u062A\u0637\u0628\u064A\u0642", chunkDesc: "\u062A\u0639\u0630\u0651\u0631 \u062C\u0644\u0628 \u062C\u0632\u0621 \u0645\u0646 \u062D\u0632\u0645\u0629 \u0627\u0644\u0648\u0627\u062C\u0647\u0629 \u0627\u0644\u0623\u0645\u0627\u0645\u064A\u0629 \u2014 \u063A\u0627\u0644\u0628\u064B\u0627 \u0628\u0633\u0628\u0628 \u062A\u0628\u0648\u064A\u0628 \u0628\u0642\u064A \u0645\u0641\u062A\u0648\u062D\u064B\u0627 \u0623\u062B\u0646\u0627\u0621 \u0625\u0639\u0627\u062F\u0629 \u0627\u0644\u0646\u0634\u0631. \u0625\u0639\u0627\u062F\u0629 \u062A\u062D\u0645\u064A\u0644 \u0627\u0644\u0635\u0641\u062D\u0629 \u062A\u0633\u062A\u0639\u064A\u062F\u0647.", rawDetails: "\u062A\u0641\u0627\u0635\u064A\u0644 \u0627\u0644\u062E\u0637\u0623 \u0627\u0644\u0623\u0635\u0644\u064A\u0629", copy: "\u0646\u0633\u062E \u0627\u0644\u062E\u0637\u0623", copied: "\u062A\u0645 \u0627\u0644\u0646\u0633\u062E", copyFailed: "\u062A\u0639\u0630\u0651\u0631 \u0627\u0644\u0646\u0633\u062E", reload: "\u0625\u0639\u0627\u062F\u0629 \u0627\u0644\u062A\u062D\u0645\u064A\u0644", blockTitle: "\u0627\u0644\u0645\u062A\u0635\u0641\u062D \u063A\u064A\u0631 \u0645\u062F\u0639\u0648\u0645", blockMsg: "\u0645\u062A\u0635\u0641\u062D\u0643 ({browser} {current}) \u0642\u062F\u064A\u0645 \u062C\u062F\u0627\u064B \u0648\u0644\u0627 \u064A\u0645\u0643\u0646\u0647 \u062A\u0634\u063A\u064A\u0644 \u0647\u0630\u0627 \u0627\u0644\u062A\u0637\u0628\u064A\u0642. \u064A\u0631\u062C\u0649 \u0627\u0644\u062A\u062D\u062F\u064A\u062B \u0625\u0644\u0649 {browser} {min} \u0623\u0648 \u0623\u062D\u062F\u062B\u060C \u0623\u0648 \u0627\u0644\u062A\u0628\u062F\u064A\u0644 \u0625\u0644\u0649 \u0645\u062A\u0635\u0641\u062D \u062D\u062F\u064A\u062B \u0645\u062B\u0644 Chrome \u0623\u0648 Firefox \u0623\u0648 Edge." },
    ru: { errorTitle: "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C \u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u0435", errorDesc: "\u041D\u0435\u043E\u0431\u0440\u0430\u0431\u043E\u0442\u0430\u043D\u043D\u0430\u044F \u043E\u0448\u0438\u0431\u043A\u0430 \u043F\u0440\u0435\u0440\u0432\u0430\u043B\u0430 \u0437\u0430\u043F\u0443\u0441\u043A. \u0418\u0441\u0445\u043E\u0434\u043D\u044B\u0435 \u0434\u0435\u0442\u0430\u043B\u0438 \u043D\u0438\u0436\u0435 \u043F\u043E\u043C\u043E\u0433\u0443\u0442 \u043E\u043F\u0440\u0435\u0434\u0435\u043B\u0438\u0442\u044C \u043F\u0440\u0438\u0447\u0438\u043D\u0443.", timeoutTitle: "\u0412\u0440\u0435\u043C\u044F \u0438\u043D\u0438\u0446\u0438\u0430\u043B\u0438\u0437\u0430\u0446\u0438\u0438 \u0438\u0441\u0442\u0435\u043A\u043B\u043E", timeoutDesc: "\u041F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u0435 \u043D\u0435 \u0437\u0430\u0432\u0435\u0440\u0448\u0438\u043B\u043E \u0438\u043D\u0438\u0446\u0438\u0430\u043B\u0438\u0437\u0430\u0446\u0438\u044E \u0437\u0430 {seconds} \u0441\u0435\u043A\u0443\u043D\u0434. \u0412\u043E\u0437\u043C\u043E\u0436\u043D\u043E, \u044D\u0442\u043E \u0432\u0440\u0435\u043C\u0435\u043D\u043D\u0430\u044F \u043F\u0440\u043E\u0431\u043B\u0435\u043C\u0430.", chunkTitle: "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C \u0440\u0435\u0441\u0443\u0440\u0441\u044B \u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u044F", chunkDesc: "\u0427\u0430\u0441\u0442\u044C \u0444\u0440\u043E\u043D\u0442\u0435\u043D\u0434-\u0431\u0430\u043D\u0434\u043B\u0430 \u043D\u0435 \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u043B\u0430\u0441\u044C \u2014 \u043E\u0431\u044B\u0447\u043D\u043E \u044D\u0442\u043E \u0432\u043A\u043B\u0430\u0434\u043A\u0430, \u043E\u0441\u0442\u0430\u0432\u0448\u0430\u044F\u0441\u044F \u043E\u0442\u043A\u0440\u044B\u0442\u043E\u0439 \u043F\u043E\u0441\u043B\u0435 \u043F\u0435\u0440\u0435\u0440\u0430\u0437\u0432\u0451\u0440\u0442\u044B\u0432\u0430\u043D\u0438\u044F. \u041F\u0435\u0440\u0435\u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0430 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u044B \u0432\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442 \u0435\u0451.", rawDetails: "\u0418\u0441\u0445\u043E\u0434\u043D\u044B\u0435 \u0434\u0435\u0442\u0430\u043B\u0438 \u043E\u0448\u0438\u0431\u043A\u0438", copy: "\u041A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u043E\u0448\u0438\u0431\u043A\u0443", copied: "\u0421\u043A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u043D\u043E", copyFailed: "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0441\u043A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u0442\u044C", reload: "\u041F\u0435\u0440\u0435\u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C", blockTitle: "\u0411\u0440\u0430\u0443\u0437\u0435\u0440 \u043D\u0435 \u043F\u043E\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0435\u0442\u0441\u044F", blockMsg: "\u0412\u0430\u0448 \u0431\u0440\u0430\u0443\u0437\u0435\u0440 ({browser} {current}) \u0441\u043B\u0438\u0448\u043A\u043E\u043C \u0441\u0442\u0430\u0440\u044B\u0439 \u0434\u043B\u044F \u0437\u0430\u043F\u0443\u0441\u043A\u0430 \u044D\u0442\u043E\u0433\u043E \u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u044F. \u041E\u0431\u043D\u043E\u0432\u0438\u0442\u0435 \u0434\u043E {browser} {min} \u0438\u043B\u0438 \u043D\u043E\u0432\u0435\u0435, \u043B\u0438\u0431\u043E \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439\u0442\u0435 \u0441\u043E\u0432\u0440\u0435\u043C\u0435\u043D\u043D\u044B\u0439 \u0431\u0440\u0430\u0443\u0437\u0435\u0440, \u0442\u0430\u043A\u043E\u0439 \u043A\u0430\u043A Chrome, Firefox \u0438\u043B\u0438 Edge." }
  };
  // reason -> I18N key prefix (blockTitle / blockMsg are the long-standing
  // names for the browser-compatibility surface; every other reason reads
  // <prefix>Title / <prefix>Desc).
  var REASON_PREFIX = { timeout: "timeout", chunk: "chunk", browser: "block", error: "error" };
  function detectLocale() {
    const supported = Object.keys(I18N);
    try {
      const stored = localStorage.getItem(storagePrefix() + "locale");
      if (stored && supported.includes(stored)) return stored;
    } catch {
    }
    // The desktop shell publishes this global; a non-string `locale` (or a
    // throwing getter) must degrade to the navigator languages rather than
    // aborting the whole script — losing the only failure surface there is.
    const osLocale = safe(function () {
      const osPrefs = window.__CELESTIA_OS_PREFS__;
      return osPrefs && typeof osPrefs.locale === "string" ? osPrefs.locale : null;
    }, null);
    if (osLocale) {
      const mapped = mapBcp47(osLocale);
      if (mapped && supported.includes(mapped)) return mapped;
    }
    // The navigator fallback is hostile-input territory too: `languages` is
    // spec'd as a frozen array of strings, but the loop below runs at module
    // scope — one non-string entry would abort the whole script and take the
    // card, the hooks AND the browser-block abort with it.
    const nav = safe(function () {
      var list = navigator.languages || [navigator.language || navigator.userLanguage || "en"];
      var out = [];
      for (var i = 0; i < list.length; i++) {
        if (typeof list[i] === "string") out.push(list[i]);
      }
      return out.length ? out : ["en"];
    }, ["en"]);
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
  function strings() {
    return I18N[currentLocale] || I18N.en;
  }
  function reasonText(t, reason, suffix) {
    var prefix = REASON_PREFIX[reason] || "error";
    return t[prefix + suffix] ?? t["error" + suffix] ?? "";
  }
  /** Best-effort wrapper: this surface reports failures, so its own
   *  diagnostics must never throw on top of an already broken page. */
  function safe(fn, fallback) {
    try {
      return fn();
    } catch {
      return fallback;
    }
  }
  /** Has the SPA rendered? This read decides whether the card is allowed to
   *  appear at all, at four sites (payload, watchdog, both capture hooks). */
  function appHasChildren() {
    return safe(function () {
      var app = byId("app");
      return !!(app && app.children && app.children.length);
    }, false);
  }

  /** Guarded `getElementById`: even the lookup can be made to throw, and a
   *  module-scope throw here costs the whole landing (hooks and all). */
  function byId(id) {
    return safe(function () {
      return document.getElementById(id);
    }, null);
  }
  // The payload is offered to the operator as "copy this into the bug
  // report", so credential-shaped text must not ride along: the value of
  // `token=` / `api_key=` (case-insensitive, up to the next delimiter) is
  // masked. Same rule as the app's utils/connectionError.ts
  // (`redactConnectionSecrets`) and the backend's redact_credential_query,
  // so every family surface masks identically — and idempotently.
  var CREDENTIAL_QUERY = /(?:token|api_key)=([^&)\]}"' \n\t]*)/gi;
  // Beyond the family rule: this payload is SERIALIZED JSON and offered for
  // pasting, so credential-shaped data also arrives as `"key": "value"` and
  // as header text inside a message. Same mask, same intent.
  var CREDENTIAL_KEY = /("(?:token|api_key|apikey|api-key|access_token|refresh_token|password|secret|authorization|cookie)"\s*:\s*")([^"]*)(")/gi;
  var CREDENTIAL_HEADER = /\b(Authorization|Cookie|Proxy-Authorization)\s*:\s*([^\n"']+)/gi;
  function mask(value) {
    return value ? "\u25CF\u25CF\u25CF" : value;
  }
  function redact(text) {
    return String(text)
      .replace(CREDENTIAL_QUERY, function (match, value) {
        return value ? match.slice(0, match.length - value.length) + mask(value) : match;
      })
      .replace(CREDENTIAL_KEY, function (_match, head, value, tail) {
        return head + mask(value) + tail;
      })
      .replace(CREDENTIAL_HEADER, function (_match, header, value) {
        return header + ": " + mask(value);
      });
  }
  function absoluteUrl(src) {
    return safe(function () {
      return new URL(src, location.href).href;
    }, src);
  }
  function shortUrl(url) {
    return safe(function () {
      var u = new URL(url, location.href);
      return u.pathname + u.search;
    }, safe(function () {
      // The fallback is evaluated EAGERLY (it is a call argument), so it
      // needs its own guard: `String(url)` throws on a hostile toString.
      return String(url);
    }, ""));
  }
  /** Every JS/CSS resource the browser has finished fetching, keyed by
   *  absolute URL. A <script src> WITH an entry here completed its fetch —
   *  successfully or not (the status says which); one WITHOUT an entry
   *  never completed, which is exactly what a boot hang looks like. */
  function resourceIndex() {
    var map = {};
    safe(function () {
      var list = performance.getEntriesByType("resource") || [];
      for (var i = 0; i < list.length; i++) {
        var e = list[i];
        if (!e || typeof e.name !== "string") continue;
        if (!/\.(js|mjs|css)(\?|$)/.test(e.name)) continue;
        map[e.name] = {
          ms: Math.round(e.duration || 0),
          status: typeof e.responseStatus === "number" && e.responseStatus > 0 ? e.responseStatus : null
        };
      }
    });
    return map;
  }
  function bootScripts(index) {
    var out = [];
    safe(function () {
      var nodes = document.querySelectorAll("script[src]");
      for (var i = 0; i < nodes.length && out.length < 12; i++) {
        var raw = nodes[i].getAttribute("src") || "";
        if (!raw) continue;
        var hit = index[absoluteUrl(raw)];
        // "pending" = no timing entry at all (never finished fetching);
        // "failed" = fetched, but the server refused it (a 404 on the entry
        // chunk IS the stale-deploy signature); "loaded" = fetched fine.
        var state = "pending";
        if (hit) state = hit.status !== null && hit.status >= 400 ? "failed" : "loaded";
        out.push({ src: raw, state: state, ms: hit ? hit.ms : null, status: hit ? hit.status : null });
      }
    });
    return out;
  }
  function failedResources(index) {
    var out = [];
    for (var url in index) {
      if (!Object.prototype.hasOwnProperty.call(index, url)) continue;
      if (index[url].status !== null && index[url].status >= 400) {
        out.push({ src: shortUrl(url), status: index[url].status });
        if (out.length >= 12) break;
      }
    }
    return out;
  }
  function errorInfo(err) {
    if (err === null || err === undefined) return null;
    return safe(function () {
      if (typeof err === "object") {
        var info = {
          name: typeof err.name === "string" && err.name ? err.name : "Error",
          message: typeof err.message === "string" ? err.message : String(err.message ?? "")
        };
        if (typeof err.stack === "string" && err.stack) info.stack = err.stack;
        return info;
      }
      return { name: typeof err, message: String(err) };
    }, null);
  }
  /** Hard cap on any single free-text field. The payload is rendered in a
   *  fixed-height pane and offered for pasting, so a runaway message or a
   *  host-supplied `detail` must not be able to blow either up. */
  var TEXT_LIMIT = 4e3;
  function cap(text, limit) {
    // Coercion is hostile-input territory too: a thrown `toString` must not
    // cost the operator the card (which is why `present()` raises first).
    var s = safe(function () {
      return String(text);
    }, "");
    return s.length > limit ? s.slice(0, limit) + "\u2026" : s;
  }
  function buildPayload(reason, message, error) {
    var index = resourceIndex();
    var payload = {
      reason: reason,
      message: cap(message || "", TEXT_LIMIT),
      capturedAt: safe(function () {
        return new Date().toISOString();
      }, ""),
      elapsedMs: Date.now() - bootStartedAt,
      timeoutMs: TIMEOUT,
      readyState: safe(function () {
        return document.readyState;
      }, ""),
      appMounted: appHasChildren(),
      locale: currentLocale,
      // Every read here is guarded, and the value is coerced to a string:
      // the payload is collected while the page is already failing, and one
      // un-stringifiable field (a BigInt hash) would otherwise cost the whole
      // JSON — pane and clipboard alike.
      buildHash: safe(function () {
        var hash = window.__PANEL_BUILD_HASH__;
        return typeof hash === "string" && hash ? hash : null;
      }, null),
      href: safe(function () {
        return String(location.href);
      }, "")
    };
    var failed = failedResources(index);
    if (failed.length) payload.failedResources = failed;
    payload.bootScripts = bootScripts(index);
    if (error) {
      // Caps live here, not only at capture: `__appFatal(msg, detail)` lets
      // a host hand in its own detail object verbatim, and EVERY string it
      // carries lands in the pane and in the pasted payload — not just
      // message/stack. Non-primitives are flattened to a capped JSON text
      // so a huge nested object cannot do it either.
      var detail = {};
      // Enumerating the keys is itself hostile-input territory (a Proxy may
      // throw from ownKeys/has/getOwnPropertyDescriptor), so the key list is
      // collected under a guard, and so is each read.
      var keys = safe(function () {
        var own = [];
        for (var key in error) {
          if (Object.prototype.hasOwnProperty.call(error, key)) own.push(key);
        }
        return own;
      }, []);
      for (var i = 0; i < keys.length; i++) {
        var name = keys[i];
        var value = safe(function () {
          return error[name];
        }, undefined);
        if (typeof value === "string") {
          detail[name] = cap(value, TEXT_LIMIT);
        } else if (value === null || typeof value === "number" || typeof value === "boolean") {
          detail[name] = value;
        } else {
          detail[name] = cap(safe(function () {
            return JSON.stringify(value);
          }, ""), TEXT_LIMIT);
        }
      }
      payload.error = detail;
    }
    return payload;
  }
  function serialize(payload) {
    var text = safe(function () {
      return JSON.stringify(payload, null, 2);
    }, "");
    return redact(text);
  }
  function paintJson(payload) {
    var pre = byId("fatal-json");
    if (!pre) return;
    // textContent, never innerHTML: the payload carries attacker-influenced
    // text (server messages, module URLs) and this pane must not become an
    // XSS sink on a page that is already failing.
    // Every field is a capped primitive by construction, so the payload
    // always serializes — the pane has no blank state left to guard.
    pre.textContent = serialize(payload);
  }
  /** Raise the landing for `reason`: localized headline + explanation from
   *  the reason table, the raw payload in the JSON pane, and the actions
   *  relabelled for the active locale. */
  function present(reason, message, error, overrides) {
    const t = strings();
    var title = overrides && overrides.title ? overrides.title : reasonText(t, reason, "Title");
    var desc = overrides && overrides.desc ? overrides.desc : reasonText(t, reason, "Desc");
    if (reason === "timeout") desc = desc.replace("{seconds}", String(Math.round(TIMEOUT / 1e3)));
    dismissed = true;
    // Raise FIRST and on its own: every later write is cosmetic next to the
    // card existing. A hostile or frozen DOM must not be able to cost the
    // operator the surface itself (the file's own rule: diagnostics never
    // throw on top of an already broken page).
    safe(function () {
      var el = byId("fatal-fallback");
      if (!el) return;
      // The browser-block reason paints the disc AND the wash in the info
      // tone via this class; every other reason owns the error tone, so a
      // later failure cannot inherit the upgrade screen's visuals.
      if (reason !== "browser") el.classList.remove("is-info");
      el.classList.add("visible");
    });
    // Then the labels, each inside the same guard.
    safe(function () {
      // The card owns the document language while it is the only thing on
      // the page; the locale can resolve AFTER boot (a stored preference
      // written later), so it is re-published on every present().
      document.documentElement.lang = currentLocale;
      var titleEl = byId("fatal-title");
      var msgEl = byId("fatal-msg");
      var labelEl = byId("fatal-details-label");
      var copyBtn = byId("fatal-copy");
      var reloadBtn = byId("fatal-reload");
      if (titleEl) titleEl.textContent = title;
      if (msgEl) {
        msgEl.removeAttribute("data-default");
        msgEl.textContent = desc;
      }
      if (labelEl) labelEl.textContent = t.rawDetails;
      if (copyBtn) copyBtn.textContent = t.copy;
      if (reloadBtn) reloadBtn.textContent = t.reload;
    });
    lastPayload = safe(function () {
      return buildPayload(reason, message, error);
    }, null);
    // The pane write is DOM work too: an unwritable #fatal-json must not
    // throw out of __appFatal (the card is already up, the payload is not).
    if (lastPayload) {
      safe(function () {
        paintJson(lastPayload);
      });
    }
  }
  /** Record a pre-mount error WITHOUT raising the overlay: the host's own
   *  lazy-load policy may still heal it (retry in place, then one bounded
   *  reload), and covering a page that is about to recover is worse than
   *  waiting. The watchdog reports this cause if the app never mounts. */
  function remember(reason, message, error) {
    if (pendingCause || dismissed) return;
    pendingCause = { reason: reason, message: message, error: error };
  }
  function applyLocale(loc) {
    currentLocale = loc;
    // The pre-boot card is the only thing on the page while the app is
    // missing, so it owns the document language until the app sets its own.
    // `dir` is deliberately NOT set: the SPA never sets it, so flipping the
    // document to RTL from here would reach layouts nothing has tested.
    safe(function () {
      document.documentElement.lang = loc;
    });
    const t = strings();
    const titleEl = byId("fatal-title");
    const msgEl = byId("fatal-msg");
    const labelEl = byId("fatal-details-label");
    const copyBtn = byId("fatal-copy");
    const reloadBtn = byId("fatal-reload");
    safe(function () {
      if (titleEl) titleEl.textContent = t.errorTitle;
      if (msgEl && msgEl.getAttribute("data-default") === "1") msgEl.textContent = t.errorDesc;
      if (labelEl) labelEl.textContent = t.rawDetails;
      if (copyBtn) copyBtn.textContent = t.copy;
      if (reloadBtn) reloadBtn.textContent = t.reload;
    });
  }
  // Chunk-miss signatures across browsers — the same families the host's
  // own lazy-load recovery recognizes. A bundle that could not be fetched
  // is a RESOURCE failure, not a script bug, and gets its own headline.
  var CHUNK_MISS = /ChunkLoadError|Loading chunk [^ ]+ failed|Loading CSS chunk|Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS/i;
  function reasonOf(message) {
    var text = safe(function () {
      return String(message || "");
    }, "");
    return CHUNK_MISS.test(text) ? "chunk" : "error";
  }
  applyLocale(detectLocale());
  window.__appReady = function() {
    dismissed = true;
    // The overlay may have been raised before the app finished booting
    // (slow first paint past TIMEOUT, or a pre-mount runtime error such
    // as a WebSocket frame crash). Nothing ever removed it, so a
    // successfully-mounted app stayed frozen behind a full-screen,
    // z-100000 blocker and every click landed on the overlay. Ready
    // means ready: pull the overlay back down.
    safe(function () {
      byId("fatal-fallback")?.classList.remove("visible");
    });
  };
  window.__appFatal = function(msg, detail) {
    // Default English is only a placeholder: resolve the real locale the
    // first time a failure actually has to be shown (localStorage may be
    // seeded after this script ran).
    if (currentLocale === "en") currentLocale = detectLocale();
    present(reasonOf(msg), msg || "", detail || null);
  };
  window.__appBlock = function(browserName, currentVersion, minVersion) {
    // Abort FIRST: this is the only call that stops a bundle the rejected
    // browser cannot run, and the check runs from a classic <script> during
    // parse — before the module entry. `__appReady()` (fired on a
    // successful mount) stands the overlay down, so nothing may throw ahead
    // of the abort, or the operator is left on a shell that cannot work.
    try {
      window.stop();
    } catch {
    }
    if (currentLocale === "en") currentLocale = detectLocale();
    const t = strings();
    const ls = byId("loading-screen");
    safe(function () {
      if (ls && ls.style) ls.style.display = "none";
    });
    // Info severity, not error: hikari's landing repaints the disc AND the
    // card wash for its `info` variant, so the class carries both (and swaps
    // the glyph in CSS) — no inline styles, and nothing the script has to
    // undo later.
    safe(function () {
      byId("fatal-fallback")?.classList.add("is-info");
    });
    // The three arguments are host-supplied: coerce them inside guards so a
    // hostile value cannot cost the operator the card (the abort above has
    // already landed, which is the part that must never be skipped).
    var text = function (value) {
      return safe(function () {
        return String(value);
      }, "");
    };
    var browserText = text(browserName);
    var currentText = text(currentVersion);
    var minText = text(minVersion);
    var summary = safe(function () {
      return `${browserText} ${currentText} (requires >= ${minText})`;
    }, "");
    var fill = function (template) {
      // Every occurrence, and always with a string: a hostile argument
      // degrades its own field instead of leaving `{browser}` on the card.
      return template
        .split("{browser}").join(browserText)
        .split("{current}").join(currentText)
        .split("{min}").join(minText);
    };
    present("browser", summary, {
      name: "UnsupportedBrowser",
      message: `${browserText} ${currentText}`,
      required: minText
    }, { title: t.blockTitle, desc: fill(t.blockMsg) });
  };
  setTimeout(() => {
    if (dismissed) return;
    if (!appHasChildren()) {
      applyLocale(detectLocale());
      // A captured cause beats the symptom: report WHAT failed before the
      // watchdog expired, not merely that time ran out.
      if (pendingCause) {
        present(pendingCause.reason, pendingCause.message, pendingCause.error);
      } else {
        // No error was captured, but the payload may already know better: a
        // boot script that FETCHED and was refused (404 on the entry chunk,
        // the stale-tab-after-redeploy signature) never reaches window.onerror,
        // and calling that a timeout hides the one actionable fact there is.
        var failed = failedResources(resourceIndex());
        present(failed.length ? "chunk" : "timeout", failed.length ? failed[0].src + " -> HTTP " + failed[0].status : "", null);
      }
    }
  }, TIMEOUT);
  window.onerror = function(msg, source, lineno, colno, error) {
    // The overlay is a BOOT-failure surface. Once the app has rendered,
    // a stray runtime error (e.g. a WebSocket frame that crashes a
    // transport handler) must not freeze the whole page behind the
    // blocker — the app is alive and can keep serving the operator.
    if (appHasChildren()) return;
    if (dismissed || !msg || typeof msg !== "string") return;
    var info = errorInfo(error) || { name: "Error", message: msg };
    if (source) {
      info.source = shortUrl(source);
      if (lineno !== undefined) info.line = lineno;
      if (colno !== undefined) info.column = colno;
    }
    if (reasonOf(msg) === "chunk") {
      // Recoverable class: record it and let the host's lazy-load policy
      // try before a full-screen blocker takes the page over.
      remember("chunk", msg, info);
      return;
    }
    safe(function () {
      window.__appFatal?.(msg, info);
    });
  };
  window.addEventListener("unhandledrejection", (e) => {
    if (dismissed) return;
    if (appHasChildren()) return;
    // Reading the event property can itself throw (hostile accessor).
    var reason = safe(function () {
      return e.reason;
    }, null);
    var msg = safe(function () {
      return reason && reason.message ? String(reason.message) : String(reason);
    }, "");
    var info = errorInfo(reason) || { name: "UnhandledRejection", message: msg };
    if (reasonOf(msg) === "chunk") {
      remember("chunk", msg, info);
      return;
    }
    safe(function () {
      window.__appFatal?.(msg, info);
    });
  });
  function showToast(text) {
    safe(function () {
      const toast = byId("fatal-toast");
      if (!toast) return;
      toast.textContent = text;
      toast.classList.add("visible");
      setTimeout(() => {
        safe(function () {
          toast.classList.remove("visible");
        });
      }, 2e3);
    });
  }
  /** The legacy selection trick, kept for browsers without the async
   *  clipboard API and as the fallback when it refuses (insecure context,
   *  permission denied). Returns whether the copy actually happened. */
  function legacyCopy(text) {
    return safe(function () {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      var ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok !== false;
    }, false);
  }
  function copyError() {
    // The payload — not the clamped DOM copy — is what belongs in a bug
    // report: message, stack, failed resources, boot state.
    // The payload always serializes (capped primitives), so the localized
    // paragraph is only the pre-payload fallback.
    // No payload (a host calling copy before any failure) falls back to the
    // localized explanation — a string from the table, not a DOM read.
    var text = lastPayload ? serialize(lastPayload) : strings().errorDesc;
    var api = safe(function () {
      return navigator.clipboard;
    }, null);
    // Even reaching for `writeText` can throw (hostile accessor), and so can
    // inspecting the returned thenable: both stay inside guards so the click
    // always ends in a toast.
    var writeText = safe(function () {
      return api && typeof api.writeText === "function" ? api.writeText : null;
    }, null);
    if (writeText) {
      var pending = safe(function () {
        // Called on its owner: a WebIDL method brand-checks its receiver,
        // so the detached form throws "Illegal invocation" in every engine
        // and would silently kill the whole async clipboard path.
        return api.writeText(text);
      }, null);
      var attachable = safe(function () {
        return !!pending && typeof pending.then === "function";
      }, false);
      if (attachable) {
        // Attaching to a hostile thenable must not cost the click handler
        // its fallback: a throw here just falls through to legacyCopy.
        var attached = safe(function () {
          pending.then(
            function () {
              showToast(strings().copied);
            },
            function () {
              showToast(legacyCopy(text) ? strings().copied : strings().copyFailed);
            }
          );
          return true;
        }, false);
        if (attached) return;
      }
    }
    showToast(legacyCopy(text) ? strings().copied : strings().copyFailed);
  }
  function bindActions() {
    safe(function () {
      byId("fatal-copy")?.addEventListener("click", copyError);
    });
    safe(function () {
      byId("fatal-reload")?.addEventListener("click", () => {
        // A sandboxed frame can refuse the navigation; the card stays usable.
        safe(function () {
          location.reload();
        });
      });
    });
  }
  // A host may vendor this file in <head>, before the card markup exists —
  // binding then would leave both buttons dead, so the attempt is repeated
  // once the document has parsed.
  bindActions();
  if (!byId("fatal-copy")) {
    document.addEventListener("DOMContentLoaded", bindActions);
  }
})();
