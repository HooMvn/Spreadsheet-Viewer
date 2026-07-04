(function (App) {
  "use strict";

  // This string becomes the actual Worker script via Blob + ObjectURL.
  // Keeping it inline (instead of a separate worker.js loaded by src=)
  // avoids the "cross-origin worker" restriction Chrome enforces under file://.
  //
  // NOTE on offline/file:// reality: importScripts() inside a worker behaves
  // inconsistently across browsers when the host page is opened via file://.
  // If it fails, this worker posts an IMPORT_FAILED message and the main
  // thread (parser.js) falls back to chunked main-thread parsing instead of
  // silently breaking.
  const WORKER_SOURCE = `
    let xlsxReady = false;

    self.onmessage = function (e) {
      const msg = e.data;

      if (msg.type === "CANCEL") { cancelled = true; return; }

      if (msg.type !== "INIT_PARSE") return;
      cancelled = false;

      const { fileBuffer, fileType, chunkSize, sheetIndex, xlsxLibUrl } = msg;

      try {
        if (fileType === "delimited") {
          parseDelimitedInWorker(fileBuffer, msg.delimiter, chunkSize);
          return;
        }

        if (!xlsxReady) {
          try {
            importScripts(xlsxLibUrl);
            xlsxReady = typeof XLSX !== "undefined";
          } catch (impErr) {
            self.postMessage({ type: "IMPORT_FAILED", message: impErr.message });
            return;
          }
        }
        if (!xlsxReady) {
          self.postMessage({ type: "IMPORT_FAILED", message: "XLSX engine unavailable in worker scope." });
          return;
        }
        parseWorkbookInWorker(fileBuffer, chunkSize, sheetIndex);
      } catch (err) {
        self.postMessage({ type: "ERROR", message: err.message });
      }
    };

    let cancelled = false;

    function parseDelimitedInWorker(buffer, delimiter, chunkSize) {
      const text = new TextDecoder("utf-8").decode(buffer);
      const lines = text.split(/\\r?\\n/).filter((l) => l.trim() !== "");
      if (lines.length === 0) {
        self.postMessage({ type: "COMPLETE", sheets: [] });
        return;
      }
      const headers = splitLine(lines[0], delimiter).map((h) => h.trim());
      const rows = [];
      const total = lines.length - 1;

      for (let i = 1; i < lines.length; i++) {
        if (cancelled) { self.postMessage({ type: "CANCELLED" }); return; }
        const values = splitLine(lines[i], delimiter);
        const obj = {};
        headers.forEach((h, idx) => {
          obj[h] = idx < values.length ? values[idx].replace(/^"|"$/g, "") : "";
        });
        rows.push(obj);

        if (i % chunkSize === 0) {
          self.postMessage({ type: "PROGRESS_UPDATE", progress: Math.round((i / total) * 100) });
          self.postMessage({ type: "PARTIAL_RESULT", rows: rows.splice(0, rows.length) });
        }
      }
      if (rows.length) self.postMessage({ type: "PARTIAL_RESULT", rows });
      self.postMessage({ type: "COMPLETE", sheets: [{ name: "Sheet1", headers }] });
    }

    function splitLine(line, delimiter) {
      const values = [];
      let current = "";
      let insideQuotes = false;
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '"') insideQuotes = !insideQuotes;
        else if (char === delimiter && !insideQuotes) { values.push(current.trim()); current = ""; }
        else current += char;
      }
      values.push(current.trim());
      return values;
    }

    function parseWorkbookInWorker(buffer, chunkSize, onlySheetIndex) {
      if (typeof XLSX === "undefined") {
        self.postMessage({ type: "ERROR", message: "XLSX engine not available inside worker." });
        return;
      }
      const data = new Uint8Array(buffer);
      const workbook = XLSX.read(data, { type: "array", cellDates: true });
      const sheetNames = workbook.SheetNames;
      const failedSheets = [];
      const sheetSummaries = [];

      sheetNames.forEach((name, sIdx) => {
        if (cancelled) return;
        if (onlySheetIndex != null && sIdx !== onlySheetIndex) return;

        try {
          const ws = workbook.Sheets[name];
          if (!ws || !ws["!ref"]) return;

          let aoa;
          try {
            aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false, blankrows: false });
          } catch (fmtErr) {
            aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: true, blankrows: false });
          }

          const { headers, rows } = aoaToHeadersRows(aoa);
          if (headers.length === 0) return;

          sheetSummaries.push({ name, headers });
          const total = rows.length;
          let buffered = [];
          for (let r = 0; r < rows.length; r++) {
            if (cancelled) { self.postMessage({ type: "CANCELLED" }); return; }
            buffered.push(rows[r]);
            if (buffered.length >= chunkSize || r === rows.length - 1) {
              self.postMessage({ type: "PARTIAL_RESULT", sheetName: name, rows: buffered });
              self.postMessage({ type: "PROGRESS_UPDATE", progress: Math.round(((r + 1) / total) * 100), sheetName: name });
              buffered = [];
            }
          }
        } catch (sheetErr) {
          failedSheets.push(name);
        }
      });

      if (sheetSummaries.length === 0) {
        self.postMessage({ type: "ERROR", message: "No sheet in this workbook could be read." + (failedSheets.length ? " Failed: " + failedSheets.join(", ") : "") });
        return;
      }

      self.postMessage({ type: "COMPLETE", sheets: sheetSummaries, failedSheets });
    }

    function aoaToHeadersRows(aoa) {
      if (!aoa || aoa.length === 0) return { headers: [], rows: [] };
      const scanLimit = Math.min(aoa.length, 25);
      let headerRowIdx = -1, bestFilled = -1;
      for (let i = 0; i < scanLimit; i++) {
        const row = aoa[i];
        if (!row) continue;
        const filled = row.filter((c) => c !== undefined && String(c).trim() !== "").length;
        if (filled === 0) continue;
        if (headerRowIdx === -1) headerRowIdx = i;
        if (filled > bestFilled) { bestFilled = filled; headerRowIdx = i; }
      }
      if (headerRowIdx === -1) return { headers: [], rows: [] };

      const rawHeader = aoa[headerRowIdx] || [];
      const width = aoa.reduce((max, row) => Math.max(max, row ? row.length : 0), rawHeader.length);
      const headers = [];
      const seen = {};
      for (let i = 0; i < width; i++) {
        const v = rawHeader[i];
        let name = v == null ? "" : String(v).trim();
        if (!name) name = "Column " + (i + 1);
        if (seen[name] != null) { seen[name]++; name = name + " (" + seen[name] + ")"; }
        else seen[name] = 0;
        headers.push(name);
      }

      const rows = [];
      for (let r = headerRowIdx + 1; r < aoa.length; r++) {
        const line = aoa[r] || [];
        if (line.every((c) => c === undefined || String(c).trim() === "")) continue;
        const obj = {};
        headers.forEach((h, idx) => { const v = line[idx]; obj[h] = v == null ? "" : String(v); });
        rows.push(obj);
      }
      return { headers, rows };
    }
  `;

  let cachedWorkerUrl = null;

  function createWorker() {
    if (!cachedWorkerUrl) {
      const blob = new Blob([WORKER_SOURCE], { type: "application/javascript" });
      cachedWorkerUrl = URL.createObjectURL(blob);
    }
    return new Worker(cachedWorkerUrl);
  }

  App.workerFactory = { createWorker };
})((window.App = window.App || {}));
