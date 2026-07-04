(function (App) {
  "use strict";

  function init(handlers) {
    document.addEventListener("keydown", (e) => {
      const cmd = e.metaKey || e.ctrlKey;

      if (cmd && (e.key === "o" || e.key === "O")) {
        e.preventDefault();
        handlers.onUpload && handlers.onUpload();
        return;
      }
      if (cmd && (e.key === "f" || e.key === "F")) {
        e.preventDefault();
        handlers.onSearchFocus && handlers.onSearchFocus();
        return;
      }
      if (cmd && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        handlers.onSearchFocus && handlers.onSearchFocus();
        return;
      }
      if (e.key === "Escape") {
        handlers.onEscape && handlers.onEscape();
      }
    });
  }

  App.shortcuts = { init };
})((window.App = window.App || {}));
