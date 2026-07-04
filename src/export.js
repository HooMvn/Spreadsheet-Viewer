(function (App) {
  "use strict";

  function rowsToCSV(headers, rows) {
    const esc = (v) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const lines = [headers.map(esc).join(",")];
    rows.forEach((row) => lines.push(headers.map((h) => esc(row[h])).join(",")));
    return "\uFEFF" + lines.join("\r\n"); // BOM keeps Persian/Arabic/non-Latin text intact in Excel
  }

  function downloadBlob(content, fileName, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function exportCSV(headers, rows, fileName) {
    const csv = rowsToCSV(headers, rows);
    downloadBlob(csv, fileName || "export.csv", "text/csv;charset=utf-8");
  }

  function exportXLSX(headers, rows, fileName) {
    const run = () => {
      const aoa = [headers, ...rows.map((r) => headers.map((h) => r[h]))];
      const ws = window.XLSX.utils.aoa_to_sheet(aoa);
      const wb = window.XLSX.utils.book_new();
      window.XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
      window.XLSX.writeFile(wb, fileName || "export.xlsx");
    };

    if (window.XLSX) {
      run();
      return Promise.resolve(true);
    }
    return App.parser
      .ensureMainThreadXLSX()
      .then(() => {
        run();
        return true;
      })
      .catch((err) => {
        App.toast.error(err.message);
        return false;
      });
  }

  function copyToClipboard(headers, rows) {
    const tsvLines = [headers.join("\t")];
    rows.forEach((row) => tsvLines.push(headers.map((h) => (row[h] == null ? "" : row[h])).join("\t")));
    const text = tsvLines.join("\n");
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    // Fallback for non-secure contexts (file:// has no Clipboard API access in some browsers)
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
    } finally {
      ta.remove();
    }
    return Promise.resolve();
  }

  App.exporter = { exportCSV, exportXLSX, copyToClipboard, rowsToCSV };
})((window.App = window.App || {}));
