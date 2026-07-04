(function (App) {
  "use strict";

  function EventBus() {
    const listeners = {};
    return {
      on(event, fn) {
        (listeners[event] = listeners[event] || []).push(fn);
        return () => this.off(event, fn);
      },
      off(event, fn) {
        if (!listeners[event]) return;
        listeners[event] = listeners[event].filter((f) => f !== fn);
      },
      emit(event, payload) {
        (listeners[event] || []).slice().forEach((fn) => fn(payload));
      },
    };
  }

  const bus = EventBus();

  const store = {
    fileName: "",
    fileSize: 0,
    fileType: "",
    sheets: [],
    activeSheetIndex: 0,
    headers: [],
    allRows: [],
    filteredRows: [],
    isInitialized: false,
    status: "idle",
    errorInfo: null,
    progress: 0,
    searchTerm: "",
    activeFilters: {},
    sort: { column: null, dir: "asc" },
    visibleColumns: new Set(),
    columnOrder: [],
    view: "list",
    page: 1,
    pageSize: 15,
    trash: [],           // [{_rowId, rowData, sheetName, deletedAt}]
    trashedIds: new Set(),
    settings: {
      rowsPerPage: 15,
      defaultView: "list",
      theme: "dark",
      language: "en",
      importPreferences: { autoDetectHeader: true },
    },
  };

  function set(patch, eventName) {
    Object.assign(store, patch);
    bus.emit("state:change", { patch, store });
    if (eventName) bus.emit(eventName, store);
  }

  function get() { return store; }

  App.bus = bus;
  App.state = { get, set };
})((window.App = window.App || {}));
