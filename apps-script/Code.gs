/**
 * Entreno de Luis: puente entre la app (PWA) y esta hoja de Google.
 * Se pega en Extensiones > Apps Script de la hoja y se implementa como "Aplicación web".
 *   GET  ?a=pull&token=...           -> devuelve todas las pestañas como JSON
 *   POST {token, ops:[...]} (texto)  -> aplica cambios: put (crear/actualizar por id), del, delWhere
 * La primera columna de cada pestaña es "id". Se pueden añadir columnas: la app ignora las que no conoce.
 * Pestañas nuevas: si llega un cambio para una pestaña que no existe (nombre en minúsculas, p. ej. "deportes"),
 * se crea sola. Así la app puede crecer sin volver a desplegar este script.
 */
const VERSION_GS = 3;
const TOKEN = '__TOKEN__'; // clave compartida con la app. Cámbiala aquí y en Ajustes de la app si se filtra.

const HOJAS = {
  ejercicios:   ['id', 'nombre', 'grupo', 'musculo', 'modo', 'series', 'repMin', 'repMax', 'incremento', 'activo', 'notas'],
  plantillas:   ['id', 'nombre', 'ejercicios'],
  plan_semanal: ['id', 'semana', 'fecha', 'hora', 'tipo', 'plantilla', 'detalle', 'objetivo', 'nota'],
  revisiones:   ['id', 'semana', 'resumen', 'ajustes', 'plan_siguiente'],
  sesiones:     ['id', 'fecha', 'plantilla', 'nombre', 'nota', 'creado'],
  series:       ['id', 'sesion', 'fecha', 'ejercicio', 'nombre', 'serie', 'peso', 'reps', 'obj_peso', 'obj_reps', 'nota'],
  carreras:     ['id', 'fecha', 'km', 'tiempo', 'segundos', 'ritmo', 'tipo', 'sensacion', 'nota', 'creado'],
  movilidad:    ['id', 'fecha', 'creado'],
  deportes:     ['id', 'fecha', 'deporte', 'minutos', 'sensacion', 'nota', 'creado'],
};
const NOMBRE_VALIDO = /^[a-z][a-z0-9_]{0,30}$/;
const COLUMNA_VALIDA = /^[A-Za-z_][A-Za-z0-9_]{0,40}$/;

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.token !== TOKEN) return json_({ ok: false, error: 'token' });
  if (p.a === 'ping') return json_({ ok: true, version: VERSION_GS, hora: new Date().toISOString() });
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  asegurarHojas_(ss);
  const data = {};
  ss.getSheets().forEach(sh => { const n = sh.getName(); if (NOMBRE_VALIDO.test(n)) data[n] = leer_(sh).objetos; });
  return json_({ ok: true, version: VERSION_GS, data: data, hora: new Date().toISOString() });
}

function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'JSON no válido' }); }
  if (!body || body.token !== TOKEN) return json_({ ok: false, error: 'token' });
  const ops = Array.isArray(body.ops) ? body.ops : [];
  const lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    asegurarHojas_(ss);
    const tablas = {};
    const tabla = n => {
      if (typeof n !== 'string' || !NOMBRE_VALIDO.test(n)) throw new Error('nombre de pestaña no válido: ' + n);
      if (!tablas[n]) { const sh = ss.getSheetByName(n) || crearHoja_(ss, n, ['id']); const t = leer_(sh); tablas[n] = { sh: sh, cab: t.cab, filas: t.filas, n0: t.nRaw, cambiada: false }; }
      return tablas[n];
    };
    const ignoradas = [];
    ops.forEach((o, i) => {
      try {
        if (!o || typeof o !== 'object') throw new Error('operación vacía');
        const t = tabla(o.hoja);
        if (o.op === 'put') {
          const f = (o.fila && typeof o.fila === 'object') ? o.fila : {};
          if (f.id === undefined || f.id === null || f.id === '') throw new Error('fila sin id');
          const malas = Object.keys(f).filter(k => !COLUMNA_VALIDA.test(k));
          if (malas.length) throw new Error('columna no válida: ' + malas[0]);
          Object.keys(f).forEach(k => { if (t.cab.indexOf(k) < 0) { t.cab.push(k); t.filas.forEach(r => r.push('')); } });
          let r = t.filas.find(x => String(x[0]) === String(f.id));
          if (!r) { r = t.cab.map(() => ''); t.filas.push(r); }
          t.cab.forEach((k, j) => { if (k in f) r[j] = f[k] === null || f[k] === undefined ? '' : f[k]; });
          t.cambiada = true;
        } else if (o.op === 'del') {
          const antes = t.filas.length;
          t.filas = t.filas.filter(x => String(x[0]) !== String(o.id));
          t.cambiada = t.cambiada || t.filas.length !== antes;
        } else if (o.op === 'delWhere') {
          const j = t.cab.indexOf(o.campo);
          if (j < 0) return;
          const antes = t.filas.length;
          t.filas = t.filas.filter(x => String(x[j]) !== String(o.valor));
          t.cambiada = t.cambiada || t.filas.length !== antes;
        } else throw new Error('operación desconocida: ' + o.op);
      } catch (err) { ignoradas.push({ i: i, error: String(err && err.message || err) }); }
    });
    Object.keys(tablas).forEach(n => { if (tablas[n].cambiada) escribir_(tablas[n]); });
    SpreadsheetApp.flush();
    return json_({ ok: true, aplicadas: ops.length - ignoradas.length, ignoradas: ignoradas });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  } finally {
    lock.releaseLock();
  }
}

/* ---------- utilidades ---------- */
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function crearHoja_(ss, n, cab) {
  const sh = ss.insertSheet(n);
  if (sh.getMaxColumns() < cab.length + 4) sh.insertColumnsAfter(sh.getMaxColumns(), cab.length + 4 - sh.getMaxColumns());
  sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).setNumberFormat('@');
  sh.getRange(1, 1, 1, cab.length).setValues([cab]).setFontWeight('bold');
  sh.setFrozenRows(1);
  return sh;
}

function asegurarHojas_(ss) {
  Object.keys(HOJAS).forEach(n => {
    let sh = ss.getSheetByName(n);
    if (!sh) { crearHoja_(ss, n, HOJAS[n]); return; }
    const lastCol = sh.getLastColumn();
    const cab = lastCol ? sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String) : [];
    const faltan = HOJAS[n].filter(k => cab.indexOf(k) < 0);
    if (faltan.length) sh.getRange(1, cab.length + 1, 1, faltan.length).setValues([faltan]).setFontWeight('bold');
  });
}

function norm_(v) {
  if (v instanceof Date) {
    const tz = Session.getScriptTimeZone();
    return v.getFullYear() < 1901 ? Utilities.formatDate(v, tz, 'HH:mm') : Utilities.formatDate(v, tz, 'yyyy-MM-dd');
  }
  return v;
}

function leer_(sh) {
  const lr = sh.getLastRow(), lc = sh.getLastColumn();
  if (!lr || !lc) return { cab: [], filas: [], objetos: [], nRaw: 0 };
  const v = sh.getRange(1, 1, lr, lc).getValues();
  let cab = v[0].map(c => String(c).trim());
  while (cab.length && !cab[cab.length - 1]) cab.pop();
  const filas = v.slice(1).map(r => r.slice(0, cab.length).map(norm_)).filter(r => r.some(c => c !== ''));
  const objetos = filas.map(r => { const o = {}; cab.forEach((k, i) => { if (k) o[k] = r[i]; }); return o; });
  return { cab: cab, filas: filas, objetos: objetos, nRaw: lr - 1 };
}

function escribir_(t) {
  const sh = t.sh, nc = t.cab.length;
  if (sh.getMaxColumns() < nc) sh.insertColumnsAfter(sh.getMaxColumns(), nc - sh.getMaxColumns());
  sh.getRange(1, 1, 1, nc).setValues([t.cab]).setFontWeight('bold');
  const viejas = Math.max(t.n0, t.filas.length);
  if (sh.getMaxRows() < t.filas.length + 1) sh.insertRowsAfter(sh.getMaxRows(), t.filas.length + 1 - sh.getMaxRows());
  if (viejas) sh.getRange(2, 1, viejas, nc).clearContent();
  if (t.filas.length) {
    const rango = sh.getRange(2, 1, t.filas.length, nc);
    rango.setNumberFormat('@');
    rango.setValues(t.filas.map(r => { const x = r.slice(0, nc); while (x.length < nc) x.push(''); return x.map(c => (typeof c === 'number' || typeof c === 'boolean') ? String(c) : c); }));
  }
}

/** Ejecútala una vez desde el editor si quieres comprobar que todo está bien (crea las pestañas que falten). */
function probar() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  asegurarHojas_(ss);
  Logger.log('Pestañas listas: ' + Object.keys(HOJAS).join(', '));
}
