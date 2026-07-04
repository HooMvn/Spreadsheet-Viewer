(function (App) {
  "use strict";

  const ROW_H   = 32;
  const COL_H   = 34;
  const RN_W    = 52;
  const DEF_W   = 140;
  const MIN_W   = 60;
  const SCAN    = 5;

  function colLetter(n) {
    let s = "", i = n + 1;
    while (i > 0) { s = String.fromCharCode(64 + ((i-1)%26+1)) + s; i = Math.floor((i-1)/26); }
    return s;
  }
  function esc(v) {
    if (v == null) return "";
    return String(v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }

  /* ─────────────────────────────────────────────────────────────────
     Layout  (nothing scrollable except .g-scroll):

       .g-root  (flex-col, 100%)
         .g-head  (flex-row, 34px fixed)
           .g-corner   (RN_W px)
           .g-col-clip (flex:1, overflow:hidden)  ← synced horizontally
             .g-col-inner
         .g-data  (flex-row, flex:1, min-height:0, overflow:hidden)
           .g-rn-col  (RN_W px, overflow:hidden)  ← OUTSIDE scroll
             .g-rn-inner (position:relative)       ← translated vertically
           .g-scroll  (flex:1, overflow:auto)      ← THE only scrollable
             .g-canvas (position:relative)         ← sized to full content
               .g-cell ...
  ───────────────────────────────────────────────────────────────── */

  function Grid(host) {
    this.host     = host;
    this.headers  = [];
    this.rows     = [];
    this.widths   = [];
    this.sel      = { r:-1, c:-1 };
    this._sTop    = 0;
    this._sLeft   = 0;
    this._build();
  }

  Grid.prototype._build = function () {
    this.host.innerHTML =
      `<div class="g-root">
         <div class="g-head">
           <div class="g-corner"></div>
           <div class="g-col-clip"><div class="g-col-inner"></div></div>
         </div>
         <div class="g-data">
           <div class="g-rn-col"><div class="g-rn-inner"></div></div>
           <div class="g-scroll"><div class="g-canvas"></div></div>
         </div>
       </div>`;

    this._colClip  = this.host.querySelector(".g-col-clip");
    this._colInner = this.host.querySelector(".g-col-inner");
    this._rnInner  = this.host.querySelector(".g-rn-inner");
    this._scroll   = this.host.querySelector(".g-scroll");
    this._canvas   = this.host.querySelector(".g-canvas");

    this._scroll.addEventListener("scroll", this._onScroll.bind(this), { passive:true });
  };

  Grid.prototype.setData = function (headers, rows) {
    this.headers = headers;
    this.rows    = rows;
    this.widths  = headers.map(() => DEF_W);
    this.sel     = { r:-1, c:-1 };
    this._sTop   = 0;
    this._sLeft  = 0;
    this._scroll.scrollTop  = 0;
    this._scroll.scrollLeft = 0;
    this._renderColHeaders();
    this._size();
    this._renderRows();
  };

  Grid.prototype._totalW = function () { return this.widths.reduce((a,b)=>a+b,0); };

  /* ── Column headers ── */
  Grid.prototype._renderColHeaders = function () {
    const W = this._totalW();
    this._colInner.style.cssText = `position:relative;width:${W}px;height:${COL_H}px;`;
    let x = 0, html = "";
    this.headers.forEach((h, i) => {
      const w = this.widths[i];
      html += `<div class="g-ch" style="left:${x}px;width:${w}px" title="${esc(h)}">
        <span class="g-ch-l">${colLetter(i)}</span>
        <span class="g-ch-n">${esc(h)}</span>
        <span class="g-ch-r" data-ri="${i}"></span>
      </div>`;
      x += w;
    });
    this._colInner.innerHTML = html;
    this._wireResize();
  };

  Grid.prototype._wireResize = function () {
    this._colInner.querySelectorAll(".g-ch-r").forEach(el => {
      el.addEventListener("mousedown", e => {
        e.preventDefault();
        const ci = +el.dataset.ri, x0 = e.clientX, w0 = this.widths[ci];
        const mv = ev => { this.widths[ci] = Math.max(MIN_W, w0 + ev.clientX - x0); this._renderColHeaders(); this._size(); this._renderRows(); };
        const up = () => { document.removeEventListener("mousemove",mv); document.removeEventListener("mouseup",up); };
        document.addEventListener("mousemove",mv);
        document.addEventListener("mouseup",up);
      });
    });
  };

  /* ── Size the canvas (scroll area) ── */
  Grid.prototype._size = function () {
    const W = this._totalW(), H = this.rows.length * ROW_H;
    this._canvas.style.cssText = `position:relative;width:${W}px;height:${H}px;`;
    this._rnInner.style.cssText = `position:relative;height:${H}px;`;
  };

  /* ── Scroll handler ── */
  Grid.prototype._onScroll = function () {
    this._sTop  = this._scroll.scrollTop;
    this._sLeft = this._scroll.scrollLeft;
    // Sync col-header horizontal position
    this._colClip.scrollLeft = this._sLeft;
    // Sync row-number column vertical position (translate, NOT scroll)
    this._rnInner.style.transform = `translateY(${-this._sTop}px)`;
    this._renderRows();
  };

  /* ── Virtual row rendering ── */
  Grid.prototype._renderRows = function () {
    const vpH   = this._scroll.clientHeight || 500;
    const first = Math.max(0, Math.floor(this._sTop / ROW_H) - SCAN);
    const last  = Math.min(this.rows.length, first + Math.ceil(vpH / ROW_H) + SCAN*2);

    let rnHtml = "", cellHtml = "";
    for (let r = first; r < last; r++) {
      const y = r * ROW_H;
      const row = this.rows[r];
      rnHtml += `<div class="g-rn" style="top:${y}px;height:${ROW_H}px">${r+1}</div>`;
      let x = 0;
      for (let c = 0; c < this.headers.length; c++) {
        const w = this.widths[c];
        const v = row ? row[this.headers[c]] : "";
        const sel = (this.sel.r===r && this.sel.c===c) ? " g-sel" : "";
        cellHtml += `<div class="g-cell${sel}" style="left:${x}px;top:${y}px;width:${w}px;height:${ROW_H}px" data-r="${r}" data-c="${c}">${esc(v)}</div>`;
        x += w;
      }
    }
    this._rnInner.innerHTML  = rnHtml;
    this._canvas.innerHTML   = cellHtml;
    this._wireCells();
  };

  Grid.prototype._wireCells = function () {
    this._canvas.querySelectorAll(".g-cell").forEach(el => {
      el.addEventListener("click", () => {
        this.sel = { r:+el.dataset.r, c:+el.dataset.c };
        this._renderRows();
      });
    });
  };

  App.Grid = Grid;
})((window.App = window.App || {}));
