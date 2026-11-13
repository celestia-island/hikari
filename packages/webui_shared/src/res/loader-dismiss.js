;(function () {
  function dismissLoading() {
    var screen = document.getElementById("loading-screen");
    if (screen) {
      screen.classList.add("fade-out");
      setTimeout(function () { screen.remove(); }, 500);
    }
  }

  window.__loaderDismiss = dismissLoading;
})();
