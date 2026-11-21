// Simulador mínimo de Apps Script + Google Sheets para ejecutar apps-script/Code.gs en Node.
import fs from 'node:fs';
import vm from 'node:vm';

class Sheet {
  constructor(name) { this.name = name; this.cells = []; this.maxR = 1000; this.maxC = 26; }
  getLastRow() { for (let r = this.cells.length - 1; r >= 0; r--) if ((this.cells[r] || []).some(v => v !== '' && v != null)) return r + 1; return 0; }
  getLastColumn() { let m = 0; this.cells.forEach(row => { (row || []).forEach((v, c) => { if (v !== '' && v != null) m = Math.max(m, c + 1); }); }); return m; }
  getMaxRows() { return this.maxR; } getMaxColumns() { return this.maxC; }
  insertRowsAfter(_, n) { this.maxR += n; } insertColumnsAfter(_, n) { this.maxC += n; }
  setFrozenRows() {}
  getRange(r, c, nr = 1, nc = 1) {
    if (r + nr - 1 > this.maxR || c + nc - 1 > this.maxC) throw new Error(`Rango fuera de la hoja ${this.name}: ${r},${c},${nr},${nc}`);
    const sh = this;
    const R = {
      getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => { const v = (sh.cells[r - 1 + i] || [])[c - 1 + j]; return v == null ? '' : v; })),
      setValues: vals => {
        if (vals.length !== nr || vals.some(x => x.length !== nc)) throw new Error('setValues: dimensiones incorrectas');
        vals.forEach((row, i) => row.forEach((v, j) => { (sh.cells[r - 1 + i] = sh.cells[r - 1 + i] || [])[c - 1 + j] = v; })); return R;
      },
      clearContent: () => { for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) if (sh.cells[r - 1 + i]) sh.cells[r - 1 + i][c - 1 + j] = ''; return R; },
      setNumberFormat: () => R, setFontWeight: () => R,
    };
    return R;
  }
}
export class Spreadsheet {
  constructor() { this.sheets = {}; }
  getSheetByName(n) { return this.sheets[n] || null; }
  insertSheet(n) { return (this.sheets[n] = new Sheet(n)); }
  // ayudas para los tests
  tabla(n) { const sh = this.sheets[n]; if (!sh) return []; const lr = sh.getLastRow(), lc = sh.getLastColumn(); if (!lr) return []; const v = sh.getRange(1, 1, lr, lc).getValues(); return v.slice(1).filter(r => r.some(x => x !== '')).map(r => Object.fromEntries(v[0].map((k, i) => [k, r[i]]))); }
  poner(n, cab, filas) { const sh = this.sheets[n] || this.insertSheet(n); sh.cells = [cab, ...filas.map(f => cab.map(k => f[k] ?? ''))]; }
}

export function cargarGas({ token = 'test-token', ss = new Spreadsheet() } = {}) {
  let code = fs.readFileSync(new URL('../apps-script/Code.gs', import.meta.url), 'utf8').replace('__TOKEN__', token);
  const ctx = {
    SpreadsheetApp: { getActiveSpreadsheet: () => ss, flush: () => {} },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: t => ({ setMimeType: () => ({ text: t }), text: t }) },
    LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) },
    Session: { getScriptTimeZone: () => 'Europe/Madrid' },
    Utilities: { formatDate: (d, tz, f) => f === 'HH:mm' ? String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') : d.toISOString().slice(0, 10) },
    Logger: { log: () => {} },
    console, JSON, Date, String, Object, Array, Math, Error,
  };
  vm.createContext(ctx);
  vm.runInContext(code + '\n;this.__api={doGet,doPost,probar};', ctx);
  const api = ctx.__api;
  return {
    ss,
    get: params => JSON.parse(api.doGet({ parameter: params }).text),
    post: body => JSON.parse(api.doPost({ postData: { contents: typeof body === 'string' ? body : JSON.stringify(body) } }).text),
  };
}
