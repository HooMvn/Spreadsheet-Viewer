(function (App) {
  "use strict";

  const KEYS = {
    favorites: "spreadsheet-viewer:favorites",
    trash: "spreadsheet-viewer:trash",
    settings: "spreadsheet-viewer:settings",
    theme: "spreadsheet-viewer:theme",
    language: "spreadsheet-viewer:language",
  };

  function safeGet(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function safeSet(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.warn("Storage write failed:", e.message);
      return false;
    }
  }

  const Storage = {
    loadAll() {
      localStorage.clear();
      return {
        favorites: safeGet(KEYS.favorites, []),
        trash: safeGet(KEYS.trash, []),
        settings: safeGet(KEYS.settings, null),
        theme: safeGet(KEYS.theme, "dark"),
        language: safeGet(KEYS.language, "en"),
      };
    },
    saveFavorites(list) {
      safeSet(KEYS.favorites, list);
    },
    saveTrash(list) {
      safeSet(KEYS.trash, list);
    },
    saveSettings(settings) {
      safeSet(KEYS.settings, settings);
    },
    saveTheme(theme) {
      safeSet(KEYS.theme, theme);
    },
    saveLanguage(lang) {
      safeSet(KEYS.language, lang);
    },
  };

  App.storage = Storage;
})((window.App = window.App || {}));
