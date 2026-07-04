(function (App) {
  "use strict";

  const CHUNK_SIZE = 2000;
  const XLSX_LIB_REL_PATH = "libs/xlsx.full.min.js";

  let activeWorker = null;
  let mainThreadCancelled = false;
  let mainThreadXlsxPromise = null;

  function xlsxLibUrl() {
    return new URL(XLSX_LIB_REL_PATH, document.baseURI).href;
  }

  // Lazily injects the locally-hosted XLSX library into the main thread.
  // Used for (a) main-thread parsing fallback when the worker can't import it,
  // and (b) the "Export as XLSX" feature, regardless of how the original file
  // was parsed. Never touches the network — purely local file.
  function ensureMainThreadXLSX() {
    if (window.XLSX) return Promise.resolve();
    if (mainThreadXlsxPromise) return mainThreadXlsxPromise;
    mainThreadXlsxPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = xlsxLibUrl();
      script.onload = () => resolve();
      script.onerror = () => {
        mainThreadXlsxPromise = null;
        reject(new Error("libs/xlsx.full.min.js was not found. Add the SheetJS library there (see libs/README.txt) to enable .xlsx/.xls/.ods support."));
      };
      document.head.appendChild(script);
    });
    return mainThreadXlsxPromise;
  }

  function cancelParsing() {
    mainThreadCancelled = true;
    if (activeWorker) {
      try {
        activeWorker.postMessage({ type: "CANCEL" });
        activeWorker.terminate();
      } catch (e) {}
      activeWorker = null;
    }
  }

  // Structured error classifier --------------------------------------------
  function classifyError(rawMessage, context) {
    const msg = (rawMessage || "").toLowerCase();
    if (context === "unsupported-format") {
      return {
        type: "format",
        message: "This file format isn't supported.",
        suggestion: "Supported formats: " + App.fileEngine.getSupportedExtensions().map((e) => "." + e).join(", "),
      };
    }
    if (msg.includes("password") || msg.includes("encrypt")) {
      return { type: "corruption", message: "This file appears to be password-protected.", suggestion: "Remove the password protection in Excel and re-upload." };
    }
    if (msg.includes("zip") || msg.includes("corrupt") || msg.includes("invalid") || msg.includes("central directory")) {
      return { type: "corruption", message: "This file appears to be corrupted or isn't a valid spreadsheet.", suggestion: "Try re-exporting the file from its original application." };
    }
    if (msg.includes("memory") || msg.includes("alloc")) {
      return { type: "size", message: "This file is too large to process in the browser.", suggestion: "Try splitting the file into smaller sheets, or removing unused columns." };
    }
    return { type: "parsing", message: rawMessage || "An unexpected error occurred while reading the file.", suggestion: "Try re-saving the file in Excel and uploading it again." };
  }

  // Main-thread fallback parsing (chunked via setTimeout so UI stays responsive) ---
  function parseDelimitedMainThread(buffer, delimiter, onProgress, onPartial, onComplete, onError) {
    try {
      const text = new TextDecoder("utf-8").decode(buffer);
      const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
      if (lines.length === 0) return onComplete([]);

      const headers = splitLine(lines[0], delimiter).map((h) => h.trim());
      const total = lines.length - 1;
      let i = 1;
      let buffered = [];

      function step() {
        if (mainThreadCancelled) return;
        const end = Math.min(i + CHUNK_SIZE, lines.length);
        for (; i < end; i++) {
          const values = splitLine(lines[i], delimiter);
          const obj = {};
          headers.forEach((h, idx) => {
            obj[h] = idx < values.length ? values[idx].replace(/^"|"$/g, "") : "";
          });
          buffered.push(obj);
        }
        onPartial(null, buffered);
        buffered = [];
        onProgress(Math.round(((i - 1) / total) * 100));
        if (i < lines.length) {
          setTimeout(step, 0);
        } else {
          onComplete([{ name: "Sheet1", headers }]);
        }
      }
      step();
    } catch (err) {
      onError(err.message);
    }
  }

  function splitLine(line, delimiter) {
    const values = [];
    let current = "";
    let insideQuotes = false;
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') insideQuotes = !insideQuotes;
      else if (char === delimiter && !insideQuotes) {
        values.push(current.trim());
        current = "";
      } else current += char;
    }
    values.push(current.trim());
    return values;
  }

  function parseWorkbookMainThread(buffer, onProgress, onPartial, onComplete, onError) {
    if (typeof window.XLSX === "undefined") {
      onError("XLSX engine not loaded. Make sure libs/xlsx.full.min.js exists.");
      return;
    }
    try {
      const data = new Uint8Array(buffer);
      const workbook = window.XLSX.read(data, { type: "array", cellDates: true });
      const sheetSummaries = [];
      const failedSheets = [];

      workbook.SheetNames.forEach((name) => {
        try {
          const ws = workbook.Sheets[name];
          if (!ws || !ws["!ref"]) return;
          let aoa;
          try {
            aoa = window.XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false, blankrows: false });
          } catch (fmtErr) {
            aoa = window.XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: true, blankrows: false });
          }
          const { headers, rows } = aoaToHeadersRows(aoa);
          if (headers.length === 0) return;
          sheetSummaries.push({ name, headers });
          onPartial(name, rows);
          onProgress(100, name);
        } catch (sheetErr) {
          failedSheets.push(name);
        }
      });

      if (sheetSummaries.length === 0) {
        onError("No sheet in this workbook could be read." + (failedSheets.length ? " Failed: " + failedSheets.join(", ") : ""));
        return;
      }
      onComplete(sheetSummaries, failedSheets);
    } catch (err) {
      onError(err.message);
    }
  }

  function aoaToHeadersRows(aoa) {
    if (!aoa || aoa.length === 0) return { headers: [], rows: [] };
    const scanLimit = Math.min(aoa.length, 25);
    let headerRowIdx = -1,
      bestFilled = -1;
    for (let i = 0; i < scanLimit; i++) {
      const row = aoa[i];
      if (!row) continue;
      const filled = row.filter((c) => c !== undefined && String(c).trim() !== "").length;
      if (filled === 0) continue;
      if (headerRowIdx === -1) headerRowIdx = i;
      if (filled > bestFilled) {
        bestFilled = filled;
        headerRowIdx = i;
      }
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
      if (seen[name] != null) {
        seen[name]++;
        name = name + " (" + seen[name] + ")";
      } else seen[name] = 0;
      headers.push(name);
    }

    const rows = [];
    for (let r = headerRowIdx + 1; r < aoa.length; r++) {
      const line = aoa[r] || [];
      if (line.every((c) => c === undefined || String(c).trim() === "")) continue;
      const obj = {};
      headers.forEach((h, idx) => {
        const v = line[idx];
        obj[h] = v == null ? "" : String(v);
      });
      rows.push(obj);
    }
    return { headers, rows };
  }

  // Public entry point -------------------------------------------------------
  // Returns a promise that resolves to { sheets: [{name, headers, rows}], failedSheets, usedWorker }
  function parse(file, callbacks) {
    callbacks = callbacks || {};
    const onProgress = callbacks.onProgress || function () {};
    const onSheetMeta = callbacks.onSheetMeta || function () {};

    mainThreadCancelled = false;
    const { ext, config } = App.fileEngine.detectFileType(file);

    if (!config) {
      return Promise.reject(classifyError(null, "unsupported-format"));
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(classifyError("File could not be read from disk.", "parsing"));
      reader.onload = (e) => {
        const buffer = e.target.result;
        const sheetsAccumulator = {}; // name -> rows[]

        function finalize(sheetSummaries, failedSheets, usedWorker) {
          const sheets = sheetSummaries.map((s) => ({
            name: s.name,
            headers: s.headers,
            rows: sheetsAccumulator[s.name] || [],
          }));
          resolve({ sheets, failedSheets: failedSheets || [], usedWorker, ext, formatMeta: config });
        }

        function onPartial(sheetName, rows) {
          const key = sheetName || "Sheet1";
          if (!sheetsAccumulator[key]) sheetsAccumulator[key] = [];
          sheetsAccumulator[key] = sheetsAccumulator[key].concat(rows);
        }

        const canUseWorker = typeof Worker !== "undefined";

        if (canUseWorker) {
          try {
            const worker = App.workerFactory.createWorker();
            activeWorker = worker;
            let fallenBack = false;

            worker.onmessage = (ev) => {
              const msg = ev.data;
              if (msg.type === "PROGRESS_UPDATE") {
                onProgress(msg.progress, msg.sheetName);
              } else if (msg.type === "PARTIAL_RESULT") {
                onPartial(msg.sheetName, msg.rows);
              } else if (msg.type === "COMPLETE") {
                worker.terminate();
                activeWorker = null;
                if (config.kind === "delimited") {
                  finalize(msg.sheets, [], true);
                } else {
                  // worker only sends sheet summaries (name+headers); rows already accumulated
                  finalize(msg.sheets, msg.failedSheets, true);
                }
              } else if (msg.type === "CANCELLED") {
                worker.terminate();
                activeWorker = null;
                reject({ type: "cancelled", message: "Parsing was cancelled.", suggestion: "" });
              } else if (msg.type === "IMPORT_FAILED") {
                // Worker couldn't importScripts the XLSX lib (common under file://) — fall back.
                if (fallenBack) return;
                fallenBack = true;
                worker.terminate();
                activeWorker = null;
                console.warn("Worker XLSX import failed, falling back to main thread:", msg.message);
                runMainThreadFallback();
              } else if (msg.type === "ERROR") {
                worker.terminate();
                activeWorker = null;
                reject(classifyError(msg.message, "parsing"));
              }
            };

            worker.onerror = (err) => {
              if (fallenBack) return;
              fallenBack = true;
              try {
                worker.terminate();
              } catch (e) {}
              activeWorker = null;
              console.warn("Worker crashed, falling back to main thread:", err.message);
              runMainThreadFallback();
            };

            worker.postMessage({
              type: "INIT_PARSE",
              fileBuffer: buffer,
              fileType: config.kind,
              delimiter: config.delimiter,
              chunkSize: CHUNK_SIZE,
              sheetIndex: null,
              xlsxLibUrl: xlsxLibUrl(),
            });
            // Intentionally NOT using a transfer list here: transferring would detach
            // `buffer` from the main thread, making fallback parsing impossible if the
            // worker later fails (e.g. IMPORT_FAILED under file://). The structured-clone
            // cost is acceptable for the safety it buys.
            return;
          } catch (workerInitErr) {
            console.warn("Worker creation failed, using main thread:", workerInitErr.message);
          }
        }

        runMainThreadFallback();

        function runMainThreadFallback() {
          if (config.kind === "delimited") {
            parseDelimitedMainThread(
              buffer,
              config.delimiter,
              onProgress,
              onPartial,
              (sheetSummaries) => finalize(sheetSummaries, [], false),
              (msg) => reject(classifyError(msg, "parsing"))
            );
          } else {
            ensureMainThreadXLSX()
              .then(() => {
                parseWorkbookMainThread(
                  buffer,
                  onProgress,
                  onPartial,
                  (sheetSummaries, failedSheets) => finalize(sheetSummaries, failedSheets, false),
                  (msg) => reject(classifyError(msg, "parsing"))
                );
              })
              .catch((libErr) => reject(classifyError(libErr.message, "format")));
          }
        }
      };

      reader.readAsArrayBuffer(file);
    });
  }

  App.parser = { parse, cancelParsing, classifyError, ensureMainThreadXLSX };
})((window.App = window.App || {}));
