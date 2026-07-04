(function (App) {
  "use strict";

  const F = App.filters;

  function escapeHtml(str) {
    if (str == null) return "";
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // Highlight matching term in text — safe: escapes HTML, wraps match in <mark>
  function highlightText(rawText, searchTerm) {
    const text = String(rawText == null ? "" : rawText);
    if (!searchTerm) return escapeHtml(text);
    const term = searchTerm.toLowerCase();
    const lowerText = text.toLowerCase();
    const parts = [];
    let last = 0;
    let idx = lowerText.indexOf(term);
    while (idx !== -1) {
      parts.push(escapeHtml(text.slice(last, idx)));
      parts.push('<mark class="sh">' + escapeHtml(text.slice(idx, idx + term.length)) + "</mark>");
      last = idx + term.length;
      idx = lowerText.indexOf(term, last);
    }
    parts.push(escapeHtml(text.slice(last)));
    return parts.join("");
  }

  function formatBytes(bytes) {
    if (!bytes) return "0 KB";
    const kb = bytes / 1024;
    if (kb < 1024) return kb.toFixed(1) + " KB";
    return (kb / 1024).toFixed(1) + " MB";
  }

  const BRAND_COLORS = [
    ["#6d5bf6","#5b4cf0"], ["#f97316","#ea580c"], ["#10b981","#059669"],
    ["#3b82f6","#2563eb"], ["#ec4899","#db2777"], ["#f59e0b","#d97706"],
    ["#06b6d4","#0891b2"], ["#8b5cf6","#7c3aed"],
  ];
  const CAT_COLORS = [
    {bg:"rgba(109,91,246,.15)",color:"#a78bfa"},
    {bg:"rgba(16,185,129,.15)",color:"#34d399"},
    {bg:"rgba(59,130,246,.15)",color:"#60a5fa"},
    {bg:"rgba(245,158,11,.15)",color:"#fbbf24"},
    {bg:"rgba(236,72,153,.15)",color:"#f472b6"},
    {bg:"rgba(6,182,212,.15)",color:"#22d3ee"},
  ];

  function brandFor(name) {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
    return BRAND_COLORS[h % BRAND_COLORS.length];
  }

  function catColor(val) {
    let h = 0;
    for (let i = 0; i < val.length; i++) h = (h * 31 + val.charCodeAt(i)) >>> 0;
    return CAT_COLORS[h % CAT_COLORS.length];
  }

  // ---- TRASH ICON ----
  function trashIconBtn(rowId) {
    return `<button class="row-trash-btn" data-row-id="${escapeHtml(rowId)}" title="Move to trash" tabindex="-1">
      <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.6">
        <path d="M3.5 5h11M7 5V3.7c0-.4.3-.7.7-.7h2.6c.4 0 .7.3.7.7V5M4.5 5l.6 9c0 .8.7 1.5 1.5 1.5h4.8c.8 0 1.5-.7 1.5-1.5l.6-9"/>
      </svg>
    </button>`;
  }

  // ---- LIST VIEW ----
  function renderListRow(row, headers, visibleCols, searchTerm) {
    const primary = F.getPrimaryColumn(headers);
    const name = row[primary] || "Unnamed";
    const [c1, c2] = brandFor(name);
    const fields = visibleCols.filter((c) => c !== primary && c !== "_rowId").slice(0, 4);
    const linkCol = headers.find((h) => F.isLinkField(h));

    const midHtml = fields.map((key) => {
      const val = (row[key] || "").trim();
      if (!val || F.isLinkField(key)) return "";
      return `<div class="row-field">
        <div class="row-field-label">${escapeHtml(key)}</div>
        <div class="row-field-value">${highlightText(val, searchTerm)}</div>
      </div>`;
    }).join("");

    const linkVal = linkCol ? (row[linkCol] || "").trim() : "";

    return `<div class="row-card" data-row-id="${escapeHtml(row._rowId)}">
      <div class="row-icon" style="background:linear-gradient(135deg,${c1},${c2})">${escapeHtml(name.slice(0,2).toUpperCase())}</div>
      <div class="row-primary">
        <div class="row-name">${highlightText(name, searchTerm)}</div>
        <div class="row-desc">${escapeHtml(firstDesc(row, headers, primary))}</div>
      </div>
      <div class="row-mid">${midHtml}</div>
      <div class="row-actions">
        ${linkVal ? `<a class="row-link-btn" href="${escapeHtml(linkVal)}" target="_blank" rel="noopener noreferrer" title="Open link">
          <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M7 11l6-6M9 4h5v5"/><path d="M13 10v3a1.5 1.5 0 01-1.5 1.5h-6A1.5 1.5 0 014 13V7a1.5 1.5 0 011.5-1.5h3"/></svg>
        </a>` : ""}
        ${trashIconBtn(row._rowId)}
      </div>
    </div>`;
  }

  function firstDesc(row, headers, primaryCol) {
    for (const key of headers) {
      if (key === primaryCol || key === "_rowId" || F.isLinkField(key)) continue;
      const v = (row[key] || "").trim();
      if (v && v.length > 8 && !/^\d+$/.test(v)) return v;
    }
    return "";
  }

  // ---- CARDS VIEW (redesigned) ----
  function renderCard(row, headers, visibleCols, searchTerm) {
    const primary = F.getPrimaryColumn(headers);
    const name = row[primary] || "Unnamed";
    const [c1, c2] = brandFor(name);

    // Separate tag-like cols (short values) from content cols
    const tagCols = visibleCols.filter((h) => {
      if (h === primary || h === "_rowId" || F.isLinkField(h)) return false;
      const vals = [row[h]].filter(Boolean);
      return vals.length > 0 && String(vals[0]).length < 30;
    }).slice(0, 3);

    const linkCol = headers.find((h) => F.isLinkField(h));
    const linkVal = linkCol ? (row[linkCol] || "").trim() : "";

    const contentCols = visibleCols.filter((h) => h !== primary && h !== "_rowId" && !F.isLinkField(h) && !tagCols.includes(h)).slice(0, 4);

    const tagsHtml = tagCols.map((col) => {
      const val = (row[col] || "").trim();
      if (!val) return "";
      const cc = catColor(col + val);
      return `<span class="card-tag" style="background:${cc.bg};color:${cc.color}">${highlightText(val, searchTerm)}</span>`;
    }).join("");

    const fieldsHtml = contentCols.map((col) => {
      const val = (row[col] || "").trim();
      if (!val) return "";
      return `<div class="card-field-row">
        <span class="card-field-key">${escapeHtml(col)}</span>
        <span class="card-field-val">${highlightText(val, searchTerm)}</span>
      </div>`;
    }).join("");

    return `<div class="tool-card" data-row-id="${escapeHtml(row._rowId)}">
      <div class="card-header" style="background:linear-gradient(135deg,${c1}22,${c2}11);border-bottom:2px solid ${c1}33">
        <div class="card-avatar" style="background:linear-gradient(135deg,${c1},${c2})">${escapeHtml(name.slice(0,2).toUpperCase())}</div>
        <div class="card-title-wrap">
          <div class="card-title">${highlightText(name, searchTerm)}</div>
          ${tagsHtml ? `<div class="card-tags">${tagsHtml}</div>` : ""}
        </div>
        <button class="card-trash-btn row-trash-btn" data-row-id="${escapeHtml(row._rowId)}" title="Move to trash">
          <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.6">
            <path d="M3.5 5h11M7 5V3.7c0-.4.3-.7.7-.7h2.6c.4 0 .7.3.7.7V5M4.5 5l.6 9c0 .8.7 1.5 1.5 1.5h4.8c.8 0 1.5-.7 1.5-1.5l.6-9"/>
          </svg>
        </button>
      </div>
      <div class="card-body">
        ${fieldsHtml || '<span class="card-empty-note">No additional fields</span>'}
      </div>
      ${linkVal ? `<div class="card-footer">
        <a class="card-link-btn" href="${escapeHtml(linkVal)}" target="_blank" rel="noopener noreferrer">
          <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M6 12L12 6M8 5L5 8M10 13L13 10"/></svg>
          Visit
        </a>
      </div>` : ""}
    </div>`;
  }

  // ---- TABLE VIEW ----
  function renderTable(rows, visibleCols, searchTerm) {
    const cols = visibleCols.filter((c) => c !== "_rowId");
    const thead = `<thead><tr>
      <th class="sticky-col th-rownum">#</th>
      ${cols.map((c) => `<th>${escapeHtml(c)}</th>`).join("")}
      <th class="th-actions"></th>
    </tr></thead>`;
    const tbody = rows.map((row, i) => {
      const tds = cols.map((c) => {
        const v = (row[c] || "").trim();
        const html = F.isLinkField(c) && v ? `<a href="${escapeHtml(v)}" target="_blank" rel="noopener noreferrer">${highlightText(v, searchTerm)}</a>` : highlightText(v, searchTerm);
        return `<td title="${escapeHtml(v)}">${html}</td>`;
      }).join("");
      return `<tr data-row-id="${escapeHtml(row._rowId)}">
        <td class="sticky-col row-index">${i + 1}</td>
        ${tds}
        <td class="td-actions">${trashIconBtn(row._rowId)}</td>
      </tr>`;
    }).join("");
    return `<div class="table-wrap"><table class="data-table">${thead}<tbody>${tbody}</tbody></table></div>`;
  }

  // ---- OVERVIEW VIEW ----
  function renderOverview(s) {
    const total = s.allRows.filter((r) => !s.trashedIds.has(r._rowId)).length;
    const filtered = s.filteredRows.length;
    const cols = s.headers.filter((h) => h !== "_rowId").length;
    let html = `
      <div class="overview-card"><div class="ov-num">${total.toLocaleString()}</div><div class="ov-label">Total Rows</div></div>
      <div class="overview-card"><div class="ov-num">${cols}</div><div class="ov-label">Total Columns</div></div>
      <div class="overview-card"><div class="ov-num">${filtered.toLocaleString()}</div><div class="ov-label">Filtered Rows</div></div>
      <div class="overview-card"><div class="ov-num">${formatBytes(s.fileSize)}</div><div class="ov-label">File Size</div></div>`;

    const catCols = F.getCategoricalColumns(s.headers, s.allRows).slice(0, 3);
    catCols.forEach((col) => {
      const counts = {};
      s.allRows.filter((r) => !s.trashedIds.has(r._rowId)).forEach((r) => {
        const v = (r[col] || "").trim();
        if (v) counts[v] = (counts[v] || 0) + 1;
      });
      const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6);
      const max = entries[0]?.[1] || 1;
      html += `<div class="overview-card full">
        <div class="ov-label" style="margin-bottom:10px;font-weight:700;text-transform:uppercase;font-size:11px;">${escapeHtml(col)} breakdown</div>
        <div class="ov-bars">${entries.map(([label, count]) => `
          <div class="ov-bar-row">
            <span>${escapeHtml(label)}</span>
            <div class="ov-bar-track"><div class="ov-bar-fill" style="width:${(count/max)*100}%"></div></div>
            <span style="text-align:right;color:var(--text-secondary)">${count}</span>
          </div>`).join("")}
        </div>
      </div>`;
    });
    return html;
  }

  // ---- SKELETON ----
  function renderSkeleton(n) {
    let h = "";
    for (let i = 0; i < n; i++) {
      h += `<div class="skeleton-row"><div class="skeleton-block sk-icon"></div><div class="skeleton-block sk-text-lg"></div><div class="skeleton-block sk-text-sm"></div><div class="skeleton-block sk-text-sm"></div></div>`;
    }
    return h;
  }

  App.renderer = { renderListRow, renderCard, renderTable, renderOverview, renderSkeleton, escapeHtml, formatBytes, brandFor, highlightText };
})((window.App = window.App || {}));
