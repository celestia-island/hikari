;(function () {
  var MIN_VERSIONS = {
    chrome: 100,
    edge: 100,
    firefox: 100,
    safari: 15.4,
    ios: 15.4,
    opera: 86,
    samsung: 17
  };

  var BROWSER_NAMES = {
    chrome: "Chrome",
    edge: "Edge",
    firefox: "Firefox",
    safari: "Safari",
    ios: "Safari (iOS)",
    opera: "Opera",
    samsung: "Samsung Internet"
  };

  function detect() {
    var ua = navigator.userAgent || "";

    var isIOS = /iPad|iPhone|iPod/.test(ua);
    if (!isIOS && navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) {
      isIOS = true;
    }

    if (isIOS) {
      var m = ua.match(/Version\/(\d+(?:\.\d+)?)/) || ua.match(/OS (\d+(?:_\d+)?)/);
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
