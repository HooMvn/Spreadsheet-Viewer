(function (App) {
  "use strict";

  let toastEl = null;
  let hideTimer = null;

  function ensureEl() {
    if (toastEl) return toastEl;
    toastEl = document.createElement("div");
    toastEl.className = "toast";
    toastEl.setAttribute("role", "status");
    document.body.appendChild(toastEl);
    return toastEl;
  }

  function show(message, variant) {
    const el = ensureEl();
    el.textContent = message;
    el.className = "toast show" + (variant ? " toast-" + variant : "");
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => el.classList.remove("show"), 3200);
  }

  App.toast = {
    success: (msg) => show(msg, "success"),
    error: (msg) => show(msg, "error"),
    info: (msg) => show(msg, "info"),
  };
})((window.App = window.App || {}));
