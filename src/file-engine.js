(function (App) {
  "use strict";

  const parsers = {}; // extension -> { kind, delimiter?, label, gradient }

  function registerParser(extension, config) {
    parsers[extension.toLowerCase()] = config;
  }

  function detectFileType(file) {
    const m = /\.([a-z0-9]+)$/i.exec(file.name || "");
    const ext = m ? m[1].toLowerCase() : "";
    return { ext, config: parsers[ext] || null };
  }

  function getSupportedExtensions() {
    return Object.keys(parsers);
  }

  function getFormatMeta(ext) {
    return parsers[ext] || null;
  }

  // Default plugins ------------------------------------------------------
  registerParser("csv", { kind: "delimited", delimiter: ",", label: "CSV", gradient: ["#10b981", "#059669"] });
  registerParser("tsv", { kind: "delimited", delimiter: "\t", label: "TSV", gradient: ["#0ea5e9", "#0284c7"] });
  registerParser("xlsx", { kind: "workbook", label: "XLSX", gradient: ["#22c55e", "#16a34a"] });
  registerParser("xlsm", { kind: "workbook", label: "XLSM", gradient: ["#22c55e", "#15803d"] });
  registerParser("xls", { kind: "workbook", label: "XLS", gradient: ["#16a34a", "#166534"] });
  registerParser("xlsb", { kind: "workbook", label: "XLSB", gradient: ["#65a30d", "#4d7c0f"] });
  registerParser("ods", { kind: "workbook", label: "ODS", gradient: ["#f97316", "#c2410c"] });
  registerParser("xml", { kind: "workbook", label: "XML", gradient: ["#f59e0b", "#b45309"] });

  App.fileEngine = { registerParser, detectFileType, getSupportedExtensions, getFormatMeta };
})((window.App = window.App || {}));
