(function (App) {
  "use strict";

  function debounce(fn, wait) {
    let t;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  function normalize(v) {
    return String(v == null ? "" : v).trim().toLowerCase();
  }

  let cache = { sheetKey: null, numericFields: {}, categoricalColumns: null, primaryColumn: null };

  function resetCache(sheetKey) {
    cache = { sheetKey, numericFields: {}, categoricalColumns: null, primaryColumn: null };
  }

  function getPrimaryColumn(headers) {
    if (cache.primaryColumn) return cache.primaryColumn;
    const lower = headers.map((h) => h.toLowerCase());
    const candidates = ["tool", "name", "title", "product", "item", "نام", "عنوان"];
    for (const c of candidates) {
      const idx = lower.indexOf(c);
      if (idx !== -1) { cache.primaryColumn = headers[idx]; return cache.primaryColumn; }
    }
    cache.primaryColumn = headers[0];
    return cache.primaryColumn;
  }

  function isLinkField(key) { return /link|url|website/i.test(key); }
  function isDateField(key) { return /date|created|updated|modified|timestamp|تاریخ/i.test(key); }

  function isNumericField(key, allRows) {
    if (cache.numericFields[key] !== undefined) return cache.numericFields[key];
    let result;
    if (/difficulty|priority|rating|score|count|number|rank|level|years?|قیمت|مبلغ|تعداد|درصد/i.test(key)) {
      result = true;
    } else {
      const vals = (allRows || []).slice(0, 30).map((r) => r[key]).filter((v) => v && String(v).trim() !== "");
      result = vals.length > 0 && vals.every((v) => !isNaN(parseFloat(v)) && isFinite(v));
    }
    cache.numericFields[key] = result;
    return result;
  }

  function getCategoricalColumns(headers, allRows) {
    if (cache.categoricalColumns) return cache.categoricalColumns;
    const primary = getPrimaryColumn(headers);
    cache.categoricalColumns = headers.filter((h) => {
      if (h === primary || h === "_rowId") return false;
      if (isLinkField(h)) return false;
      const values = new Set((allRows || []).map((r) => (r[h] || "").trim()).filter(Boolean));
      return values.size > 0 && values.size <= 30;
    });
    return cache.categoricalColumns;
  }

  // Priority score for search — higher = more relevant
  function searchScore(row, primaryCol, term) {
    const primaryVal = normalize(row[primaryCol] || "");
    if (primaryVal === term) return 100;
    if (primaryVal.startsWith(term)) return 80;
    if (primaryVal.includes(term)) return 60;
    for (const [key, val] of Object.entries(row)) {
      if (key === "_rowId" || key === primaryCol) continue;
      const v = normalize(String(val == null ? "" : val));
      if (v.startsWith(term)) return 40;
      if (v.includes(term)) return 20;
    }
    return 0;
  }

  function applyPipeline(allRows, opts) {
    const search = normalize(opts.searchTerm);
    const trashedIds = opts.trashedIds || new Set();
    const primary = getPrimaryColumn(opts.headers || []);

    let rows = allRows.filter((row) => {
      if (trashedIds.has(row._rowId)) return false;

      if (search) {
        const rowStr = Object.entries(row)
          .filter(([k]) => k !== "_rowId")
          .map(([, v]) => String(v == null ? "" : v))
          .join(" ")
          .toLowerCase();
        if (!rowStr.includes(search)) return false;
      }

      for (const [col, valSet] of Object.entries(opts.activeFilters || {})) {
        if (valSet.size === 0) continue;
        if (!valSet.has((row[col] || "").trim())) return false;
      }
      return true;
    });

    if (search) {
      // Priority sort: exact > starts-with-primary > contains-primary > other fields
      rows = rows.slice().sort((a, b) => searchScore(b, primary, search) - searchScore(a, primary, search));
    } else if (opts.sort && opts.sort.column) {
      const col = opts.sort.column;
      const numeric = isNumericField(col, allRows);
      rows = rows.slice().sort((a, b) => {
        let av = a[col] || "", bv = b[col] || "";
        if (numeric) { av = parseFloat(av) || 0; bv = parseFloat(bv) || 0; return opts.sort.dir === "asc" ? av - bv : bv - av; }
        av = normalize(av); bv = normalize(bv);
        if (av < bv) return opts.sort.dir === "asc" ? -1 : 1;
        if (av > bv) return opts.sort.dir === "asc" ? 1 : -1;
        return 0;
      });
    }

    return rows;
  }

  App.filters = { debounce, normalize, resetCache, getPrimaryColumn, isLinkField, isDateField, isNumericField, getCategoricalColumns, applyPipeline };
})((window.App = window.App || {}));
