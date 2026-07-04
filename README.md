## 📊 Spreadsheet Viewer

A modern, fast, and lightweight spreadsheet viewer built with vanilla JavaScript. It allows users to open Excel and CSV files directly in the browser without requiring any backend.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![JavaScript](https://img.shields.io/badge/JavaScript-Vanilla-yellow)
![Status](https://img.shields.io/badge/status-active-success)

---

## ✨ Features

- 📂 Open Excel (.xlsx, .xls) and CSV files
- ⚡ Client-side processing (no server required)
- 🔍 Instant search across spreadsheet data
- 🎯 Column filtering
- ↕️ Sorting support
- 📑 Multiple worksheet tabs
- 📊 Spreadsheet/Grid view
- 📤 Export filtered data
  - CSV
  - Excel
  - Clipboard
- 🌙 Dark / Light mode
- 🌐 Multi-language support
- 📱 Responsive design
- 🗑 Trash management
- ⚙ Configurable settings
- 💾 Local storage for preferences

---

## 📁 Project Structure

```
Spreadsheet Viewer V2/
│
├── index.html
├── style.css
│
├── libs/
│   └── xlsx.full.min.js
│
├── src/
│   ├── app.js
│   ├── export.js
│   ├── file-engine.js
│   ├── filters.js
│   ├── grid.js
│   ├── i18n.js
│   ├── parser.js
│   ├── renderer.js
│   ├── shortcuts.js
│   ├── state.js
│   ├── storage.js
│   ├── toast.js
│   └── worker-source.js
│
└── README.md
```

---

## 🚀 Getting Started

### Clone Repository

```bash
git clone https://github.com/yourusername/spreadsheet-viewer.git
```

### Open the project

Simply open:

```
index.html
```

or serve the project using a local web server.

Example:

```bash
npx serve
```

or

```bash
python -m http.server
```

---

## 📦 Dependencies

The project only depends on:

- SheetJS (xlsx)

No frameworks are required.

---

## 📖 Supported Formats

- XLSX
- XLS
- CSV

---

## 🛠 Main Modules

| Module | Description |
|----------|-------------|
| app.js | Main application controller |
| parser.js | Spreadsheet parsing |
| file-engine.js | File loading engine |
| grid.js | Spreadsheet rendering |
| renderer.js | UI rendering |
| filters.js | Filtering system |
| export.js | Export utilities |
| storage.js | LocalStorage management |
| shortcuts.js | Keyboard shortcuts |
| state.js | Global application state |
| toast.js | Notification system |
| i18n.js | Internationalization |
| worker-source.js | Background processing |

---

## 🎨 UI Features

- Responsive sidebar
- Mobile drawer
- Search toolbar
- Pagination
- Column manager
- Filter panel
- Sort panel
- Export panel
- Settings dialog
- Trash dialog
- Loading states
- Error states
- Empty states

---

## 🌙 Themes

- Light Mode
- Dark Mode

Theme preference is stored automatically.

---

## 🌐 Localization

Supports multilingual interface through the `i18n.js` module.

New languages can be added easily.

---

## 📤 Export Options

Filtered data can be exported as:

- CSV
- Excel (.xlsx)
- Clipboard

---

## ⌨ Keyboard Shortcuts

The application includes built-in keyboard shortcuts for faster navigation and searching.

---

## 💾 Data Privacy

All spreadsheet processing happens locally inside the browser.

No files are uploaded to any server.

---

## 📱 Browser Support

- Chrome
- Edge
- Firefox
- Safari

Latest versions are recommended.

---

## Future Improvements

- PDF export
- Charts
- Formula evaluation
- Pivot tables
- Frozen rows/columns
- Conditional formatting
- Virtual scrolling
- Drag & Drop improvements

---

## 🤝 Contributing

Pull requests are welcome.

For major changes, please open an issue first to discuss what you would like to change.

---

## 📄 License

This project is released under the MIT License.

---

## 👨‍💻 Author

Developed with ❤️ using Vanilla JavaScript and SheetJS.
