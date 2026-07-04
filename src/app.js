(function (App) {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const state = App.state;
  const F = App.filters;
  const R = App.renderer;

  const DOM = {
    fileUpload: $("fileUpload"), fileName: $("fileName"), fileMeta: $("fileMeta"), fileBadge: $("fileBadge"),
    searchInput: $("searchInput"),
    resultsGrid: $("resultsGrid"), spreadsheetGridHost: $("spreadsheetGridHost"),
    overviewPanel: $("overviewPanel"), contentArea: $("contentArea"),
    loadingState: $("loadingState"), loadingSubtitle: $("loadingSubtitle"),
    progressBarFill: $("progressBarFill"), skeletonList: $("skeletonList"),
    errorState: $("errorState"), errorTitle: $("errorTitle"), errorMessage: $("errorMessage"),
    errorSuggestion: $("errorSuggestion"), errorTypeBadge: $("errorTypeBadge"),
    resetErrorBtn: $("resetErrorBtn"), errorIcon: $("errorIcon"),
    emptyState: $("emptyState"), resetEmptyBtn: $("resetEmptyBtn"),
    importState: $("importState"), dropzone: $("dropzone"), loadSampleBtn: $("loadSampleBtn"),
    sheetTabsBar: $("sheetTabsBar"),
    activeFiltersBar: $("activeFiltersBar"), activePills: $("activePills"), clearFiltersBtn: $("clearFiltersBtn"),
    paginationBar: $("paginationBar"), pgSummary: $("pgSummary"), pgControls: $("pgControls"),
    viewSwitch: $("viewSwitch"),
    rightPanel: $("rightPanel"), collapsePanelBtn: $("collapsePanelBtn"),
    columnsBtn: $("columnsBtn"), columnSearch: $("columnSearch"),
    columnList: $("columnList"), resetColumnsBtn: $("resetColumnsBtn"),
    columnsCount: $("columnsCount"), panelColumnsCount: $("panelColumnsCount"),
    summaryList: $("summaryList"), typesWrap: $("typesWrap"),
    filterBtn: $("filterBtn"), filterPanel: $("filterPanel"), filterCount: $("filterCount"),
    sortBtn: $("sortBtn"), sortPanel: $("sortPanel"), sortLabel: $("sortLabel"),
    exportBtn: $("exportBtn"), exportPanel: $("exportPanel"),
    exportCsvBtn: $("exportCsvBtn"), exportXlsxBtn: $("exportXlsxBtn"), exportClipboardBtn: $("exportClipboardBtn"),
    themeToggle: $("themeToggle"), themeLabel: $("themeLabel"),
    langToggle: $("langToggle"), langLabel: $("langLabel"),
    hamburgerBtn: $("hamburgerBtn"), drawerCloseBtn: $("drawerCloseBtn"),
    drawerBackdrop: $("drawerBackdrop"), sidebar: $("sidebar"),
    mobileSearchBtn: $("mobileSearchBtn"),
    // Settings modal
    settingsModal: $("settingsModal"), settingsBackdrop: $("settingsBackdrop"),
    openSettingsBtn: $("openSettingsBtn"), closeSettingsBtn: $("closeSettingsBtn"),
    saveSettingsBtn: $("saveSettingsBtn"), cancelSettingsBtn: $("cancelSettingsBtn"),
    settingRowsPerPage: $("settingRowsPerPage"), settingDefaultView: $("settingDefaultView"),
    settingAutoHeader: $("settingAutoHeader"),
    // Trash modal
    trashModal: $("trashModal"), trashBackdrop: $("trashBackdrop"),
    openTrashBtn: $("openTrashBtn"), closeTrashBtn: $("closeTrashBtn"),
    trashTableBody: $("trashTableBody"), trashTableHead: $("trashTableHead"),
    trashEmpty: $("trashEmpty"), trashActions: $("trashActions"),
    selectAllTrashBtn: $("selectAllTrashBtn"), recoverSelectedBtn: $("recoverSelectedBtn"),
    deleteSelectedBtn: $("deleteSelectedBtn"), trashCount: $("trashCount"),
    confirmBackdrop: $("confirmBackdrop"), confirmDialog: $("confirmDialog"),
    confirmTitle: $("confirmTitle"), confirmMsg: $("confirmMsg"),
    confirmCancelBtn: $("confirmCancelBtn"), confirmDeleteBtn: $("confirmDeleteBtn"),
  };

  let grid = null;
  const TYPE_COLORS = { Text:"#6d5bf6", Number:"#34d399", URL:"#a855f7", Date:"#fbbf24", Other:"#60a5fa" };
  const ERROR_ICONS = { format:"📄", corruption:"💥", size:"📦", parsing:"⚠️", cancelled:"⏹️" };

  // ===================================================================
  // ROW ID ASSIGNMENT
  // ===================================================================
  let _rowIdCounter = 0;
  function assignRowIds(rows) {
    rows.forEach((r) => { if (!r._rowId) r._rowId = "r" + (++_rowIdCounter); });
  }

  // ===================================================================
  // FILE LOADING
  // ===================================================================
  function handleFileSelected(file) {
  const s = state.get();
  showLoading(0);
  App.filters.resetCache(file.name);

  App.parser.parse(file, { onProgress: (pct) => updateProgress(pct) })
    .then((result) => {

      // پاک کردن Trash فایل قبلی
      state.set({
        trash: [],
        trashedIds: new Set()
      });
      App.storage.saveTrash([]);
      updateTrashCount();

      if (result.failedSheets && result.failedSheets.length) {
        App.toast.error(`${result.failedSheets.length} sheet(s) skipped: ${result.failedSheets.join(", ")}`);
      }

      state.set({
        fileName: file.name,
        fileSize: file.size,
        fileType: result.ext,
        sheets: result.sheets,
        activeSheetIndex: 0
      });

      activateSheet(0);
      hideLoading();
      App.toast.success(`Loaded "${file.name}"`);
      DOM.exportBtn.disabled = false;
    })
    .catch((errInfo) => {
      hideLoading();
      if (errInfo && errInfo.type === "cancelled") return;
      showError(errInfo);
    });
}

  function activateSheet(index) {
    const s = state.get();
    const sheet = s.sheets[index];
    if (!sheet) return;
    assignRowIds(sheet.rows);

    const primary = F.getPrimaryColumn(sheet.headers);
    const columnOrder = [primary, ...sheet.headers.filter((h) => h !== primary && h !== "_rowId")];
    const visibleColumns = new Set(columnOrder.slice(0, 11));

    state.set({
      activeSheetIndex: index, headers: sheet.headers, allRows: sheet.rows,
      isInitialized: true, activeFilters: {}, searchTerm: "", sort: { column: null, dir: "asc" },
      page: 1, columnOrder, visibleColumns: visibleColumns.size ? visibleColumns : new Set(columnOrder),
    });
    DOM.searchInput.value = "";
    renderFileHeader();
    renderSheetTabs();
    renderColumnsPanel();
    renderFilterPanel();
    renderSortPanel();
    applyFiltersAndRender();
  }

  function renderFileHeader() {
    const s = state.get();
    DOM.fileName.textContent = s.fileName || App.i18n.t("noFileLoaded", s.settings.language);
    const sheetPart = s.sheets.length > 1 ? ` · ${s.sheets.length} sheets` : "";
    const activeCount = s.allRows.filter((r) => !s.trashedIds.has(r._rowId)).length;
    DOM.fileMeta.textContent = s.fileName
      ? `${activeCount.toLocaleString()} rows · ${s.headers.filter(h=>h!=="_rowId").length} columns · ${R.formatBytes(s.fileSize)}${sheetPart}`
      : App.i18n.t("fileMetaDefault", s.settings.language);
    const meta = App.fileEngine.getFormatMeta(s.fileType);
    if (meta) {
      DOM.fileBadge.textContent = meta.label;
      DOM.fileBadge.style.background = `linear-gradient(135deg,${meta.gradient[0]},${meta.gradient[1]})`;
    } else {
      DOM.fileBadge.textContent = "—";
      DOM.fileBadge.style.background = "var(--bg-surface-2)";
    }
  }

  // ===================================================================
  // SHEET TABS
  // ===================================================================
  function renderSheetTabs() {
    const s = state.get();
    if (s.sheets.length <= 1) { DOM.sheetTabsBar.classList.add("hidden"); DOM.sheetTabsBar.innerHTML = ""; return; }
    DOM.sheetTabsBar.classList.remove("hidden");
    DOM.sheetTabsBar.innerHTML = s.sheets.map((sh, i) =>
      `<button class="sheet-tab ${i === s.activeSheetIndex ? "active" : ""}" data-sheet-idx="${i}" type="button">
        <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2.5" width="14" height="13" rx="1.2"/><path d="M2 7h14M7 2.5V15.5"/></svg>
        ${R.escapeHtml(sh.name)} <span class="sheet-row-count">${sh.rows.length.toLocaleString()}</span>
      </button>`
    ).join("");
    DOM.sheetTabsBar.querySelectorAll("[data-sheet-idx]").forEach((btn) => {
      btn.addEventListener("click", () => { F.resetCache(state.get().fileName + btn.dataset.sheetIdx); activateSheet(parseInt(btn.dataset.sheetIdx,10)); });
    });
  }

  // ===================================================================
  // LOADING / ERROR
  // ===================================================================
  function showLoading(pct) {
    hideAllStates();
    DOM.loadingState.classList.remove("hidden");
    DOM.skeletonList.innerHTML = R.renderSkeleton(8);
    updateProgress(pct || 0);
  }
  function updateProgress(pct) { DOM.progressBarFill.style.width = Math.max(2, Math.min(100, pct)) + "%"; }
  function hideLoading() { DOM.loadingState.classList.add("hidden"); }

  function showError(info) {
    hideAllStates();
    const lang = state.get().settings.language;
    DOM.errorTypeBadge.textContent = App.i18n.t("err" + (info.type ? info.type[0].toUpperCase() + info.type.slice(1) : "Parsing"), lang);
    DOM.errorIcon.textContent = ERROR_ICONS[info.type] || "⚠️";
    DOM.errorMessage.textContent = info.message || "Something went wrong.";
    DOM.errorSuggestion.textContent = info.suggestion || "";
    DOM.errorState.classList.remove("hidden");
  }

  function hideAllStates() {
    ["importState","errorState","emptyState","loadingState","resultsGrid","spreadsheetGridHost","overviewPanel","paginationBar"]
      .forEach((id) => { const el = $(id); if (el) el.classList.add("hidden"); });
    if (DOM.contentArea) DOM.contentArea.classList.remove("mode-grid");
  }

  // ===================================================================
  // CUSTOM CONFIRM DIALOG (replaces browser confirm())
  // ===================================================================
  let _confirmResolve = null;

  function showConfirm(title, msg) {
    return new Promise((resolve) => {
      _confirmResolve = resolve;
      DOM.confirmTitle.textContent = title || "Delete forever?";
      DOM.confirmMsg.textContent   = msg   || "This cannot be undone.";
      DOM.confirmBackdrop.classList.remove("hidden");
      DOM.confirmDialog.classList.remove("hidden");
      DOM.confirmDeleteBtn.focus();
    });
  }

  function closeConfirm(result) {
    DOM.confirmBackdrop.classList.add("hidden");
    DOM.confirmDialog.classList.add("hidden");
    if (_confirmResolve) { _confirmResolve(result); _confirmResolve = null; }
  }

  // ===================================================================
  // TRASH FUNCTIONALITY
  // ===================================================================
  function addToTrash(rowId) {
    const s = state.get();
    const row = s.allRows.find((r) => r._rowId === rowId);
    if (!row) return;
    const sheet = s.sheets[s.activeSheetIndex];
    const trashItem = { _rowId: rowId, rowData: { ...row }, sheetName: sheet ? sheet.name : "", deletedAt: Date.now() };
    const newTrash = [...s.trash, trashItem];
    const newTrashedIds = new Set([...s.trashedIds, rowId]);
    state.set({ trash: newTrash, trashedIds: newTrashedIds, page: 1 });
    App.storage.saveTrash(newTrash);
    updateTrashCount();
    applyFiltersAndRender();
    renderFileHeader();
    App.toast.info("Row moved to trash");
  }

  function recoverFromTrash(rowIds) {
    const s = state.get();
    const idSet = new Set(rowIds);
    const newTrash = s.trash.filter((t) => !idSet.has(t._rowId));
    const newTrashedIds = new Set(s.trashedIds);
    idSet.forEach((id) => newTrashedIds.delete(id));
    state.set({ trash: newTrash, trashedIds: newTrashedIds });
    App.storage.saveTrash(newTrash);
    updateTrashCount();
    applyFiltersAndRender();
    renderFileHeader();
    renderTrashModalContent();
    App.toast.success(`${rowIds.length} row(s) recovered`);
  }

  function deleteForeverFromTrash(rowIds) {
    const s = state.get();
    const idSet = new Set(rowIds);
    const newTrash = s.trash.filter((t) => !idSet.has(t._rowId));
    state.set({ trash: newTrash });
    App.storage.saveTrash(newTrash);
    updateTrashCount();
    renderTrashModalContent();
    App.toast.info(`${rowIds.length} row(s) permanently deleted`);
  }

  function updateTrashCount() {
    const count = state.get().trash.length;
    if (DOM.trashCount) {
      DOM.trashCount.textContent = count;
      DOM.trashCount.classList.toggle("hidden", count === 0);
    }
  }

  // ===================================================================
  // FILTER / SORT / COLUMNS PANELS
  // ===================================================================
  function renderFilterPanel() {
    const s = state.get();
    const cols = F.getCategoricalColumns(s.headers, s.allRows);
    if (cols.length === 0) { DOM.filterPanel.innerHTML = `<div class="dd-col-title">No filterable columns</div>`; return; }
    DOM.filterPanel.innerHTML = cols.map((col) => {
      const values = Array.from(new Set(s.allRows.map((r) => (r[col] || "").trim()).filter(Boolean))).sort();
      const active = s.activeFilters[col] || new Set();
      return `<div class="dd-section"><div class="dd-col-title">${R.escapeHtml(col)}</div>
        ${values.map((v) => `<label class="dd-option"><input type="checkbox" data-col="${R.escapeHtml(col)}" data-val="${R.escapeHtml(v)}" ${active.has(v) ? "checked" : ""}><span>${R.escapeHtml(v)}</span></label>`).join("")}
      </div>`;
    }).join("");
    DOM.filterPanel.querySelectorAll("input[type=checkbox]").forEach((cb) => {
      cb.addEventListener("change", function () {
        const s2 = state.get();
        const filters = { ...s2.activeFilters };
        const col = this.dataset.col;
        if (!filters[col]) filters[col] = new Set();
        if (this.checked) filters[col].add(this.dataset.val);
        else filters[col].delete(this.dataset.val);
        if (filters[col].size === 0) delete filters[col];
        state.set({ activeFilters: filters, page: 1 });
        applyFiltersAndRender();
      });
    });
  }

  function renderSortPanel() {
    const s = state.get();
    const visibleHeaders = s.headers.filter((h) => h !== "_rowId");
    DOM.sortPanel.innerHTML = `<div class="dd-col-title">Sort by</div>
      ${visibleHeaders.map((c) => `<div class="dd-radio-row ${s.sort.column === c ? "active" : ""}" data-col="${R.escapeHtml(c)}"><span>${R.escapeHtml(c)}</span></div>`).join("")}
      ${s.sort.column ? `<div class="dd-section">
        <div class="dd-radio-row ${s.sort.dir === "asc" ? "active" : ""}" data-dir="asc"><span>Ascending ↑</span></div>
        <div class="dd-radio-row ${s.sort.dir === "desc" ? "active" : ""}" data-dir="desc"><span>Descending ↓</span></div>
        <div class="dd-radio-row" data-clear="1"><span style="color:var(--text-muted)">Clear sort</span></div>
      </div>` : ""}`;
    DOM.sortPanel.querySelectorAll("[data-col]").forEach((el) => {
      el.addEventListener("click", function () { state.set({ sort: { column: this.dataset.col, dir: state.get().sort.dir || "asc" } }); renderSortPanel(); applyFiltersAndRender(); });
    });
    DOM.sortPanel.querySelectorAll("[data-dir]").forEach((el) => {
      el.addEventListener("click", function () { state.set({ sort: { column: state.get().sort.column, dir: this.dataset.dir } }); renderSortPanel(); applyFiltersAndRender(); closeAllDropdowns(); });
    });
    const clearEl = DOM.sortPanel.querySelector("[data-clear]");
    if (clearEl) clearEl.addEventListener("click", () => { state.set({ sort: { column: null, dir: "asc" } }); renderSortPanel(); applyFiltersAndRender(); closeAllDropdowns(); });
    DOM.sortLabel.textContent = state.get().sort.column ? `${state.get().sort.column} ${state.get().sort.dir === "asc" ? "↑" : "↓"}` : "";
  }

  function renderColumnsPanel(filterText) {
    const s = state.get();
    const primary = F.getPrimaryColumn(s.headers);
    const term = F.normalize(filterText || "");
    const cols = s.columnOrder.filter((c) => c !== "_rowId" && (!term || F.normalize(c).includes(term)));
    DOM.columnList.innerHTML = cols.map((col) => `
      <label class="column-row">
        <input type="checkbox" data-col="${R.escapeHtml(col)}" ${s.visibleColumns.has(col) ? "checked" : ""} ${col === primary ? "disabled checked" : ""}>
        <span class="col-name">${R.escapeHtml(col)}</span>
        ${col === primary ? `<span class="primary-tag">Primary</span>` : ""}
      </label>`).join("");
    DOM.columnList.querySelectorAll("input[type=checkbox]:not(:disabled)").forEach((cb) => {
      cb.addEventListener("change", function () {
        const s2 = state.get();
        const vc = new Set(s2.visibleColumns);
        if (this.checked) vc.add(this.dataset.col); else vc.delete(this.dataset.col);
        state.set({ visibleColumns: vc });
        updateColumnCounts();
        applyFiltersAndRender();
      });
    });
    updateColumnCounts();
  }

  function updateColumnCounts() {
    const n = state.get().visibleColumns.size;
    if (DOM.columnsCount) DOM.columnsCount.textContent = n;
    if (DOM.panelColumnsCount) DOM.panelColumnsCount.textContent = n;
  }

  // ===================================================================
  // FILTER PIPELINE + RENDER
  // ===================================================================
  const debouncedSearch = F.debounce((term) => {
    state.set({ searchTerm: term, page: 1 });
    applyFiltersAndRender();
  }, 320);

  function applyFiltersAndRender() {
    const s = state.get();
    const filtered = F.applyPipeline(s.allRows, {
      searchTerm: s.searchTerm, activeFilters: s.activeFilters, sort: s.sort,
      trashedIds: s.trashedIds, headers: s.headers,
    });
    state.set({ filteredRows: filtered });
    renderActivePills();
    render();
  }

  function renderActivePills() {
    const s = state.get();
    const entries = Object.entries(s.activeFilters).filter(([, set]) => set.size > 0);
    DOM.filterCount.textContent = entries.length;
    DOM.filterCount.classList.toggle("hidden", entries.length === 0);
    if (entries.length === 0) { DOM.activeFiltersBar.classList.add("hidden"); DOM.activePills.innerHTML = ""; return; }
    DOM.activeFiltersBar.classList.remove("hidden");
    DOM.activePills.innerHTML = entries.map(([col, set]) =>
      `<span class="filter-pill">${R.escapeHtml(col)} is ${R.escapeHtml(Array.from(set).join(", "))}<button data-clear-col="${R.escapeHtml(col)}">✕</button></span>`
    ).join("");
    DOM.activePills.querySelectorAll("[data-clear-col]").forEach((btn) => {
      btn.addEventListener("click", function () {
        const s2 = state.get();
        const filters = { ...s2.activeFilters };
        delete filters[this.dataset.clearCol];
        state.set({ activeFilters: filters, page: 1 });
        renderFilterPanel();
        applyFiltersAndRender();
      });
    });
  }

  function render() {
    const s = state.get();
    DOM.loadingState.classList.add("hidden");
    DOM.errorState.classList.add("hidden");

    if (!s.isInitialized || s.allRows.length === 0) {
      hideAllStates();
      DOM.importState.classList.remove("hidden");
      return;
    }
    DOM.importState.classList.add("hidden");

    if (s.filteredRows.length === 0) {
      hideAllStates();
      DOM.emptyState.classList.remove("hidden");
      return;
    }
    DOM.emptyState.classList.add("hidden");

    if (s.view === "overview") {
      hideAllStates();
      DOM.overviewPanel.classList.remove("hidden");
      DOM.overviewPanel.innerHTML = R.renderOverview(s);
      renderRightPanel();
      return;
    }

    if (s.view === "grid") {
      hideAllStates();
      DOM.contentArea.classList.add("mode-grid");
      DOM.spreadsheetGridHost.classList.remove("hidden");
      const visibleCols = s.columnOrder.filter((c) => s.visibleColumns.has(c) && c !== "_rowId");
      // Always recreate grid when data or view changes to avoid stale state
      grid = new App.Grid(DOM.spreadsheetGridHost);
      grid.setData(visibleCols, s.filteredRows);
      renderRightPanel();
      return;
    }

    // Not grid view — remove grid mode class
    DOM.contentArea.classList.remove("mode-grid");

    DOM.overviewPanel.classList.add("hidden");
    DOM.spreadsheetGridHost.classList.add("hidden");
    DOM.resultsGrid.classList.remove("hidden");
    DOM.resultsGrid.className = "grid view-" + s.view;

    const pageRows = paginate(s.filteredRows);
    const visibleCols = s.columnOrder.filter((c) => s.visibleColumns.has(c) && c !== "_rowId");
    const term = s.searchTerm;

    if (s.view === "list") DOM.resultsGrid.innerHTML = pageRows.map((r) => R.renderListRow(r, s.headers, visibleCols, term)).join("");
    else if (s.view === "cards") DOM.resultsGrid.innerHTML = pageRows.map((r) => R.renderCard(r, s.headers, visibleCols, term)).join("");
    else if (s.view === "table") DOM.resultsGrid.innerHTML = R.renderTable(pageRows, visibleCols, term);

    renderPagination();
    renderRightPanel();

    // Delegation for trash buttons
    DOM.resultsGrid.querySelectorAll(".row-trash-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => { e.stopPropagation(); addToTrash(btn.dataset.rowId); });
    });
  }

  function paginate(rows) {
    const s = state.get();
    const totalPages = Math.max(1, Math.ceil(rows.length / s.pageSize));
    const page = Math.min(s.page, totalPages);
    if (page !== s.page) state.set({ page });
    const start = (page - 1) * s.pageSize;
    return rows.slice(start, start + s.pageSize);
  }

  function renderPagination() {
    const s = state.get();
    const total = s.filteredRows.length;
    const totalPages = Math.max(1, Math.ceil(total / s.pageSize));
    DOM.paginationBar.classList.remove("hidden");
    const start = (s.page - 1) * s.pageSize + 1;
    const end = Math.min(total, s.page * s.pageSize);
    DOM.pgSummary.textContent = `Showing ${start}–${end} of ${total.toLocaleString()}`;

    let buttons = `<button class="pg-btn" data-pg="prev" ${s.page === 1 ? "disabled" : ""}><svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4l-5 5 5 5"/></svg></button>`;
    const pages = new Set([1, totalPages]);
    for (let i = s.page - 1; i <= s.page + 1; i++) if (i > 1 && i < totalPages) pages.add(i);
    let prev = 0;
    Array.from(pages).sort((a,b)=>a-b).forEach((pg) => {
      if (pg - prev > 1) buttons += `<span class="pg-dots">…</span>`;
      buttons += `<button class="pg-btn ${pg === s.page ? "active" : ""}" data-pg="${pg}">${pg}</button>`;
      prev = pg;
    });
    buttons += `<button class="pg-btn" data-pg="next" ${s.page === totalPages ? "disabled" : ""}><svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 4l5 5-5 5"/></svg></button>`;
    DOM.pgControls.innerHTML = buttons;
    DOM.pgControls.querySelectorAll("[data-pg]").forEach((btn) => {
      btn.addEventListener("click", function () {
        const v = this.dataset.pg;
        let page = s.page;
        if (v === "prev") page = Math.max(1, s.page - 1);
        else if (v === "next") page = Math.min(totalPages, s.page + 1);
        else page = parseInt(v, 10);
        state.set({ page });
        render();
        DOM.contentArea && DOM.contentArea.scrollTo({ top: 0, behavior: "smooth" });
      });
    });
  }

  function renderRightPanel() {
    const s = state.get();
    const activeRows = s.allRows.filter((r) => !s.trashedIds.has(r._rowId));
    DOM.summaryList.innerHTML = `
      <div class="summary-row"><span>Total Rows</span><span>${activeRows.length.toLocaleString()}</span></div>
      <div class="summary-row"><span>Total Columns</span><span>${s.headers.filter(h=>h!=="_rowId").length}</span></div>
      <div class="summary-row"><span>Filtered Rows</span><span>${s.filteredRows.length.toLocaleString()}</span></div>
      <div class="summary-row"><span>In Trash</span><span>${s.trash.length}</span></div>
      <div class="summary-row"><span>File Size</span><span>${R.formatBytes(s.fileSize)}</span></div>
      <div class="summary-row"><span>Visible Cols</span><span>${s.visibleColumns.size}</span></div>`;

    const typeCounts = { Text:0, Number:0, URL:0, Date:0, Other:0 };
    s.headers.filter(h=>h!=="_rowId").forEach((h) => {
      if (F.isLinkField(h)) typeCounts.URL++;
      else if (F.isDateField(h)) typeCounts.Date++;
      else if (F.isNumericField(h, s.allRows)) typeCounts.Number++;
      else typeCounts.Text++;
    });
    const entries = Object.entries(typeCounts).filter(([,v]) => v > 0);
    const total = entries.reduce((a,[,v]) => a+v, 0) || 1;
    let offset = 0, r = 16, circ = 2 * Math.PI * r;
    const segs = entries.map(([label, count]) => {
      const len = (count/total) * circ;
      const seg = `<circle cx="20" cy="20" r="${r}" fill="none" stroke="${TYPE_COLORS[label]}" stroke-width="7" stroke-dasharray="${len} ${circ-len}" stroke-dashoffset="${-offset}" transform="rotate(-90 20 20)"/>`;
      offset += len; return seg;
    }).join("");
    DOM.typesWrap.innerHTML = `<svg width="64" height="64" viewBox="0 0 40 40">${segs}</svg>
      <div class="types-legend">${entries.map(([l,c]) => `<div class="types-legend-row"><span class="types-legend-dot" style="background:${TYPE_COLORS[l]}"></span><span class="lbl">${l}</span><span class="val">${c} (${Math.round((c/total)*100)}%)</span></div>`).join("")}</div>`;
  }

  // ===================================================================
  // SETTINGS MODAL
  // ===================================================================
  let pendingSettings = null;

  function openSettingsModal() {
    const s = state.get();
    // Clone current settings into temp state
    pendingSettings = { ...s.settings };
    DOM.settingRowsPerPage.value = String(s.settings.rowsPerPage);
    DOM.settingDefaultView.value = s.settings.defaultView;
    DOM.settingAutoHeader.checked = !!s.settings.importPreferences.autoDetectHeader;
    DOM.settingsModal.classList.remove("hidden");
    DOM.settingsBackdrop.classList.remove("hidden");
  }

  function closeSettingsModal() {
    DOM.settingsModal.classList.add("hidden");
    DOM.settingsBackdrop.classList.add("hidden");
    pendingSettings = null;
  }

  function saveSettings() {
    const s = state.get();
    const newPageSize = parseInt(DOM.settingRowsPerPage.value, 10);
    const newView = DOM.settingDefaultView.value;
    const newAutoHeader = DOM.settingAutoHeader.checked;
    const newSettings = {
      ...s.settings,
      rowsPerPage: newPageSize,
      defaultView: newView,
      importPreferences: { ...s.settings.importPreferences, autoDetectHeader: newAutoHeader },
    };
    state.set({ settings: newSettings, pageSize: newPageSize, view: newView, page: 1 });
    App.storage.saveSettings(newSettings);
    // Update view switch UI
    DOM.viewSwitch.querySelectorAll(".view-btn").forEach((b) => b.classList.toggle("active", b.dataset.view === newView));
    closeSettingsModal();
    if (s.isInitialized) applyFiltersAndRender();
    App.toast.success("Settings saved");
  }

  // ===================================================================
  // TRASH MODAL
  // ===================================================================
  function openTrashModal() {
    DOM.trashModal.classList.remove("hidden");
    DOM.trashBackdrop.classList.remove("hidden");
    renderTrashModalContent();
  }

  function closeTrashModal() {
    DOM.trashModal.classList.add("hidden");
    DOM.trashBackdrop.classList.add("hidden");
  }

  function renderTrashModalContent() {
    const s = state.get();
    const lang = s.settings.language;

    if (s.trash.length === 0) {
      DOM.trashEmpty.classList.remove("hidden");
      DOM.trashActions.classList.add("hidden");
      const tableWrap = $("trashTableWrap");
      if (tableWrap) tableWrap.classList.add("hidden");
      return;
    }
    DOM.trashEmpty.classList.add("hidden");
    DOM.trashActions.classList.remove("hidden");
    const tableWrap = $("trashTableWrap");
    if (tableWrap) tableWrap.classList.remove("hidden");

    // Detect primary column from the first trash item
    const sampleRow = s.trash[0].rowData;
    const allCols = Object.keys(sampleRow).filter((k) => k !== "_rowId");
    const primary = F.getPrimaryColumn(allCols.length ? allCols : ["name"]);

    // Pick one secondary column (first short non-primary value)
    const secondary = allCols.find((c) => c !== primary && !F.isLinkField(c)) || null;

    DOM.trashTableHead.innerHTML = `<tr>
      <th class="trash-check-col"></th>
      <th class="trash-col-primary">${R.escapeHtml(primary)}</th>
      ${secondary ? `<th class="trash-col-secondary">${R.escapeHtml(secondary)}</th>` : ""}
      <th class="trash-col-date">Deleted</th>
      <th class="trash-col-actions"></th>
    </tr>`;

    DOM.trashTableBody.innerHTML = s.trash.map((item) => {
      const primaryVal = (item.rowData[primary] || "").trim();
      const secondaryVal = secondary ? (item.rowData[secondary] || "").trim() : "";
      const when = new Date(item.deletedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

      return `<tr data-trash-id="${R.escapeHtml(item._rowId)}">
        <td class="trash-check-col"><input type="checkbox" class="trash-row-cb" value="${R.escapeHtml(item._rowId)}"></td>
        <td class="trash-col-primary">
          <div class="trash-primary-val" title="${R.escapeHtml(primaryVal)}">${R.escapeHtml(primaryVal) || "<em>—</em>"}</div>
        </td>
        ${secondary ? `<td class="trash-col-secondary"><div class="trash-secondary-val" title="${R.escapeHtml(secondaryVal)}">${R.escapeHtml(secondaryVal)}</div></td>` : ""}
        <td class="trash-col-date">${R.escapeHtml(when)}</td>
        <td class="trash-col-actions">
          <div class="trash-action-btns">
            <button class="trash-recover-one" data-id="${R.escapeHtml(item._rowId)}" title="Recover">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M2 8a6 6 0 1 0 1.5-3.9"/><path d="M2 4v4h4"/></svg>
              ${App.i18n.t("btnRecover", lang)}
            </button>
            <button class="trash-delete-one" data-id="${R.escapeHtml(item._rowId)}" title="Delete forever">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M3 4h10M6 4V3h4v1M4 4l.5 8a1.5 1.5 0 0 0 1.5 1.5h4A1.5 1.5 0 0 0 11.5 12L12 4"/></svg>
            </button>
          </div>
        </td>
      </tr>`;
    }).join("");

    // Wire the static "Select all" checkbox
    if (DOM.selectAllTrashBtn) {
      DOM.selectAllTrashBtn.checked = false;
      DOM.selectAllTrashBtn.onchange = function () {
        DOM.trashTableBody.querySelectorAll(".trash-row-cb").forEach((cb) => { cb.checked = this.checked; });
      };
    }

    DOM.trashTableBody.querySelectorAll(".trash-recover-one").forEach((btn) => {
      btn.addEventListener("click", () => recoverFromTrash([btn.dataset.id]));
    });
    DOM.trashTableBody.querySelectorAll(".trash-delete-one").forEach((btn) => {
      btn.addEventListener("click", () => {
        showConfirm(
          App.i18n.t("trashConfirmDelete", s.settings.language),
          "This row will be permanently removed."
        ).then((ok) => { if (ok) deleteForeverFromTrash([btn.dataset.id]); });
      });
    });
  }

  function getSelectedTrashIds() {
    return Array.from(DOM.trashTableBody.querySelectorAll(".trash-row-cb:checked")).map((cb) => cb.value);
  }

  // ===================================================================
  // SAMPLE FILE
  // ===================================================================
  function loadSampleFile() {
    const headers = ["Product", "Category", "Quantity", "Unit Price", "Total", "Status"];
    const cats = ["Electronics","Office","Furniture","Software","Hardware"];
    const statuses = ["In Stock","Low Stock","Out of Stock","Backordered"];
    let csv = headers.join(",") + "\n";
    for (let i = 1; i <= 60; i++) {
      const qty = 1 + (i % 12);
      const price = (10 + i * 3.5).toFixed(2);
      const total = (qty * price).toFixed(2);
      csv += `Product ${i},${cats[i%cats.length]},${qty},${price},${total},${statuses[i%statuses.length]}\n`;
    }
    const file = new File([csv], "sample-inventory.csv", { type: "text/csv" });
    handleFileSelected(file);
  }

  // ===================================================================
  // DROPDOWNS
  // ===================================================================
  function closeAllDropdowns() {
    document.querySelectorAll(".dd-panel.open").forEach((p) => p.classList.remove("open"));
    document.querySelectorAll(".btn-tool.open").forEach((b) => b.classList.remove("open"));
  }
  function toggleDropdown(btn, panel) {
    const isOpen = panel.classList.contains("open");
    closeAllDropdowns();
    if (!isOpen) { panel.classList.add("open"); btn.classList.add("open"); }
  }

  // ===================================================================
  // THEME / LANGUAGE
  // ===================================================================
  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    const s = state.get();
    DOM.themeLabel.textContent = App.i18n.t(theme === "dark" ? "themeDark" : "themeLight", s.settings.language);
    App.storage.saveTheme(theme);
    s.settings.theme = theme;
    state.set({ settings: s.settings });
  }

  function applyLanguage(lang) {
    App.i18n.apply(lang);
    App.storage.saveLanguage(lang);
    const s = state.get();
    s.settings.language = lang;
    state.set({ settings: s.settings });
    renderFileHeader();
    if (s.isInitialized) { renderFilterPanel(); renderSortPanel(); renderColumnsPanel(); render(); }
  }

  // ===================================================================
  // EVENTS
  // ===================================================================
  function setupEvents() {
    DOM.fileUpload.addEventListener("change", function () {
      const file = this.files[0];
      if (!file) return;
      handleFileSelected(file);
      this.value = "";
    });

    // Drag & drop
    ["dragenter","dragover"].forEach((evt) => DOM.dropzone.addEventListener(evt, (e) => { e.preventDefault(); DOM.dropzone.classList.add("dragover"); }));
    ["dragleave","drop"].forEach((evt) => DOM.dropzone.addEventListener(evt, (e) => { e.preventDefault(); DOM.dropzone.classList.remove("dragover"); }));
    DOM.dropzone.addEventListener("drop", (e) => { const f = e.dataTransfer.files[0]; if (f) handleFileSelected(f); });
    DOM.dropzone.addEventListener("click", (e) => { if (!e.target.closest("label,button")) DOM.fileUpload.click(); });

    DOM.loadSampleBtn.addEventListener("click", loadSampleFile);
    DOM.resetErrorBtn.addEventListener("click", () => render());
    DOM.resetEmptyBtn.addEventListener("click", () => {
      state.set({ searchTerm: "", activeFilters: {}, page: 1 });
      DOM.searchInput.value = "";
      renderFilterPanel();
      applyFiltersAndRender();
    });
    DOM.clearFiltersBtn.addEventListener("click", () => {
      state.set({ searchTerm: "", activeFilters: {}, page: 1 });
      DOM.searchInput.value = "";
      renderFilterPanel();
      applyFiltersAndRender();
    });

    DOM.searchInput.addEventListener("input", function () { debouncedSearch(this.value); });

    DOM.filterBtn.addEventListener("click", (e) => { e.stopPropagation(); toggleDropdown(DOM.filterBtn, DOM.filterPanel); });
    DOM.sortBtn.addEventListener("click", (e) => { e.stopPropagation(); toggleDropdown(DOM.sortBtn, DOM.sortPanel); });
    DOM.exportBtn.addEventListener("click", (e) => { e.stopPropagation(); if (!DOM.exportBtn.disabled) toggleDropdown(DOM.exportBtn, DOM.exportPanel); });
    document.addEventListener("click", (e) => { if (!e.target.closest(".dd-wrap")) closeAllDropdowns(); });

    DOM.viewSwitch.addEventListener("click", (e) => {
      const btn = e.target.closest(".view-btn");
      if (!btn) return;
      state.set({ view: btn.dataset.view, page: 1 });
      DOM.viewSwitch.querySelectorAll(".view-btn").forEach((b) => b.classList.toggle("active", b === btn));
      if (btn.dataset.view !== "grid") grid = null; // reset grid on view switch
      render();
    });

    DOM.columnsBtn.addEventListener("click", () => { DOM.rightPanel.classList.remove("collapsed"); });
    DOM.columnSearch.addEventListener("input", function () { renderColumnsPanel(this.value); });
    DOM.resetColumnsBtn.addEventListener("click", () => {
      const s = state.get();
      state.set({ visibleColumns: new Set(s.columnOrder.filter(c=>c!=="_rowId")) });
      renderColumnsPanel(DOM.columnSearch.value);
      applyFiltersAndRender();
    });

    // Export
    DOM.exportCsvBtn.addEventListener("click", () => {
      const s = state.get();
      const cols = s.columnOrder.filter((c) => s.visibleColumns.has(c) && c !== "_rowId");
      App.exporter.exportCSV(cols, s.filteredRows, (s.fileName || "export").replace(/\.[^.]+$/,"") + "-export.csv");
      App.toast.success("CSV export started");
      closeAllDropdowns();
    });
    DOM.exportXlsxBtn.addEventListener("click", () => {
      const s = state.get();
      const cols = s.columnOrder.filter((c) => s.visibleColumns.has(c) && c !== "_rowId");
      App.exporter.exportXLSX(cols, s.filteredRows, (s.fileName || "export").replace(/\.[^.]+$/,"") + "-export.xlsx").then((ok) => { if (ok) App.toast.success("XLSX export started"); });
      closeAllDropdowns();
    });
    DOM.exportClipboardBtn.addEventListener("click", () => {
      const s = state.get();
      const cols = s.columnOrder.filter((c) => s.visibleColumns.has(c) && c !== "_rowId");
      App.exporter.copyToClipboard(cols, s.filteredRows).then(() => App.toast.success("Copied to clipboard"));
      closeAllDropdowns();
    });

    // Custom confirm dialog
    DOM.confirmDeleteBtn.addEventListener("click", () => closeConfirm(true));
    DOM.confirmCancelBtn.addEventListener("click", () => closeConfirm(false));
    DOM.confirmBackdrop.addEventListener("click", () => closeConfirm(false));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !DOM.confirmDialog.classList.contains("hidden")) {
        e.stopPropagation();
        closeConfirm(false);
      }
    });
    DOM.closeSettingsBtn.addEventListener("click", closeSettingsModal);
    DOM.cancelSettingsBtn.addEventListener("click", closeSettingsModal);
    DOM.saveSettingsBtn.addEventListener("click", saveSettings);
    DOM.settingsBackdrop.addEventListener("click", closeSettingsModal);

    // Trash modal
    DOM.openTrashBtn.addEventListener("click", (e) => { e.preventDefault(); openTrashModal(); closeMobileDrawer(); });
    DOM.closeTrashBtn.addEventListener("click", closeTrashModal);
    DOM.trashBackdrop.addEventListener("click", closeTrashModal);
    DOM.recoverSelectedBtn.addEventListener("click", () => {
      const ids = getSelectedTrashIds();
      if (ids.length === 0) { App.toast.info("Select rows to recover first"); return; }
      recoverFromTrash(ids);
    });
    DOM.deleteSelectedBtn.addEventListener("click", () => {
      const ids = getSelectedTrashIds();
      if (ids.length === 0) { App.toast.info("Select rows to delete first"); return; }
      const s = state.get();
      showConfirm(
        App.i18n.t("trashConfirmDelete", s.settings.language),
        ids.length + " row(s) will be permanently removed."
      ).then((ok) => { if (ok) deleteForeverFromTrash(ids); });
    });

    // Sidebar nav
    document.querySelectorAll("[data-nav]").forEach((el) => {
      el.addEventListener("click", function (e) {
        const nav = this.dataset.nav;
        if (nav === "upload" || nav === "dashboard") return;
        e.preventDefault();
        if (nav === "trash") openTrashModal();
        if (nav === "settings") openSettingsModal();
        closeMobileDrawer();
      });
    });
    document.querySelectorAll("[data-bn]").forEach((el) => {
      el.addEventListener("click", function () {
        const nav = this.dataset.bn;
        document.querySelectorAll(".bn-item").forEach((b) => b.classList.remove("active"));
        this.classList.add("active");
        if (nav === "trash") openTrashModal();
        else if (nav === "settings") openSettingsModal();
      });
    });

    // Mobile drawer
    DOM.hamburgerBtn.addEventListener("click", openMobileDrawer);
    DOM.drawerCloseBtn.addEventListener("click", closeMobileDrawer);
    DOM.drawerBackdrop.addEventListener("click", closeMobileDrawer);
    DOM.mobileSearchBtn.addEventListener("click", () => DOM.searchInput.focus());

    // Theme / Language
    DOM.themeToggle.addEventListener("click", () => applyTheme(document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark"));
    DOM.langToggle.addEventListener("click", () => applyLanguage(state.get().settings.language === "fa" ? "en" : "fa"));

    // Keyboard shortcuts
    App.shortcuts.init({
      onUpload: () => DOM.fileUpload.click(),
      onSearchFocus: () => DOM.searchInput.focus(),
      onEscape: () => { closeAllDropdowns(); closeSettingsModal(); closeTrashModal(); closeMobileDrawer(); DOM.searchInput.blur(); },
    });

    App.bus.on("state:change", () => {
      const s = state.get();
      if (DOM.exportBtn) DOM.exportBtn.disabled = !s.isInitialized || s.allRows.length === 0;
    });
  }

  function openMobileDrawer() { DOM.sidebar.classList.add("open"); DOM.drawerBackdrop.classList.add("show"); }
  function closeMobileDrawer() { DOM.sidebar.classList.remove("open"); DOM.drawerBackdrop.classList.remove("show"); }

  // ===================================================================
  // INIT
  // ===================================================================
  function init() {
    const persisted = App.storage.loadAll();
    const s = state.get();
    if (persisted.settings) Object.assign(s.settings, persisted.settings);
    // Ensure rowsPerPage is one of the valid options (guard against stale localStorage)
    const validPageSizes = [15, 30, 60, 120];
    if (!validPageSizes.includes(s.settings.rowsPerPage)) {
      s.settings.rowsPerPage = 15;
    }
    s.settings.theme = persisted.theme || s.settings.theme;
    s.settings.language = persisted.language || s.settings.language;
    s.pageSize = s.settings.rowsPerPage || 15;
    s.view = s.settings.defaultView || "list";

    // Load trash from storage
    const storedTrash = persisted.trash || [];
    s.trash = storedTrash;
    s.trashedIds = new Set(storedTrash.map((t) => t._rowId));
    state.set(s);

    // Init settings form
    DOM.settingRowsPerPage.value = String(s.settings.rowsPerPage);
    DOM.settingDefaultView.value = s.settings.defaultView;
    DOM.settingAutoHeader.checked = !!s.settings.importPreferences.autoDetectHeader;
    DOM.viewSwitch.querySelectorAll(".view-btn").forEach((b) => b.classList.toggle("active", b.dataset.view === s.view));

    applyTheme(s.settings.theme);
    applyLanguage(s.settings.language);
    updateTrashCount();

    setupEvents();
    render();
  }

  document.addEventListener("DOMContentLoaded", init);
})((window.App = window.App || {}));
