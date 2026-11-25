/* GENERATED from the TypeScript source of the same name in this directory. Do not edit by hand. Regenerate with (from packages/vue): pnpm run gen:res-scripts */
;
(function () {
  function dismissLoading() {
    var screen = document.getElementById("loading-screen");
    if (screen) {
      screen.classList.add("fade-out");
      setTimeout(function () { screen.remove(); }, 500);
    }
  }
  window.__loaderDismiss =
    dismissLoading;
})();
