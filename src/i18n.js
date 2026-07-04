(function (App) {
  "use strict";

  const DICTS = {
    en: {
      brandName: "Spreadsheet Viewer",
      navDashboard: "Dashboard", navUpload: "Upload File", navTrash: "Trash", navSettings: "Settings",
      themeDark: "Dark", themeLight: "Light",
      noFileLoaded: "No file loaded", fileMetaDefault: "Upload a spreadsheet to get started",
      btnExport: "Export", exportCsv: "Export filtered (CSV)", exportXlsx: "Export filtered (XLSX)", exportClipboard: "Copy to clipboard",
      btnUploadFile: "Upload File", searchPlaceholder: "Search across all columns...",
      btnFilter: "Filter", btnSort: "Sort", btnColumns: "Columns",
      viewList: "List", viewCards: "Cards", viewTable: "Table", viewGrid: "Grid", viewOverview: "Overview",
      btnClearAll: "Clear all", loadingSubtitle: "Reading sheets and detecting column types",
      btnTryAnother: "Try another file", emptyTitle: "No rows found", emptySubtitle: "Try adjusting your search or filters",
      btnResetFilters: "Reset filters", onboardTitle: "Drop your spreadsheet here",
      onboardSubtitle: "or click to browse your files", btnChooseFile: "Choose File",
      onboardMaxSize: "Recommended max size: ~50MB per file",
      onboardSample: "Try a sample file",
      settingsTitle: "Settings", settingsRowsPerPage: "Rows per page", settingsDefaultView: "Default view",
      settingsAutoHeader: "Auto-detect header row", btnSaveSettings: "Save Settings", btnCancel: "Cancel",
      trashTitle: "Trash", trashEmpty: "Trash is empty.", btnRecover: "Recover", btnDeleteForever: "Delete Forever",
      btnSelectAll: "Select All", btnRecoverSelected: "Recover", btnDeleteSelected: "Delete",
      panelColumns: "Columns", columnSearchPlaceholder: "Search columns...", btnResetColumns: "Reset to default",
      panelSummary: "Summary", panelTypes: "Detected Types",
      langSwitchLabel: "English",
      errFormat: "Unsupported format", errCorruption: "File corrupted", errSize: "File too large", errParsing: "Couldn't read file",
      trashConfirmDelete: "Delete forever? This cannot be undone.",
    },
    fa: {
      brandName: "نمایشگر صفحه‌گسترده",
      navDashboard: "داشبورد", navUpload: "آپلود فایل", navTrash: "سطل زباله", navSettings: "تنظیمات",
      themeDark: "تیره", themeLight: "روشن",
      noFileLoaded: "فایلی بارگذاری نشده", fileMetaDefault: "برای شروع یک صفحه‌گسترده آپلود کنید",
      btnExport: "خروجی", exportCsv: "خروجی فیلترشده (CSV)", exportXlsx: "خروجی فیلترشده (XLSX)", exportClipboard: "کپی در کلیپ‌بورد",
      btnUploadFile: "آپلود فایل", searchPlaceholder: "جستجو در همه ستون‌ها...",
      btnFilter: "فیلتر", btnSort: "مرتب‌سازی", btnColumns: "ستون‌ها",
      viewList: "لیست", viewCards: "کارت", viewTable: "جدول", viewGrid: "شبکه", viewOverview: "نمای کلی",
      btnClearAll: "پاک‌کردن همه", loadingSubtitle: "در حال خواندن شیت‌ها و تشخیص نوع ستون‌ها",
      btnTryAnother: "فایل دیگری امتحان کنید", emptyTitle: "ردیفی یافت نشد", emptySubtitle: "جستجو یا فیلترها را تغییر دهید",
      btnResetFilters: "بازنشانی فیلترها", onboardTitle: "فایل خود را اینجا رها کنید",
      onboardSubtitle: "یا برای انتخاب فایل کلیک کنید", btnChooseFile: "انتخاب فایل",
      onboardMaxSize: "حداکثر حجم پیشنهادی: حدود ۵۰ مگابایت",
      onboardSample: "یک فایل نمونه امتحان کنید",
      settingsTitle: "تنظیمات", settingsRowsPerPage: "تعداد ردیف در هر صفحه", settingsDefaultView: "نمای پیش‌فرض",
      settingsAutoHeader: "تشخیص خودکار ردیف هدر", btnSaveSettings: "ذخیره تنظیمات", btnCancel: "انصراف",
      trashTitle: "سطل زباله", trashEmpty: "سطل زباله خالی است.", btnRecover: "بازیابی", btnDeleteForever: "حذف همیشگی",
      btnSelectAll: "انتخاب همه", btnRecoverSelected: "بازیابی", btnDeleteSelected: "حذف",
      panelColumns: "ستون‌ها", columnSearchPlaceholder: "جستجوی ستون...", btnResetColumns: "بازنشانی به پیش‌فرض",
      panelSummary: "خلاصه", panelTypes: "نوع‌های شناسایی‌شده",
      langSwitchLabel: "فارسی",
      errFormat: "فرمت پشتیبانی‌نشده", errCorruption: "فایل خراب است", errSize: "حجم فایل زیاد است", errParsing: "خواندن فایل ممکن نشد",
      trashConfirmDelete: "حذف همیشگی؟ این عمل قابل بازگشت نیست.",
    },
  };

  function t(key, lang) {
    const dict = DICTS[lang] || DICTS.en;
    return dict[key] || DICTS.en[key] || key;
  }

  function apply(lang) {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "fa" ? "rtl" : "ltr";
    document.documentElement.setAttribute("data-lang", lang);
    document.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t(el.getAttribute("data-i18n"), lang); });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => { el.setAttribute("placeholder", t(el.getAttribute("data-i18n-placeholder"), lang)); });
    const langLabel = document.getElementById("langLabel");
    if (langLabel) langLabel.textContent = t("langSwitchLabel", lang);
  }

  App.i18n = { t, apply, DICTS };
})((window.App = window.App || {}));
