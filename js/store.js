// Datos locales (IndexedDB) + cola de cambios pendientes + sincronización con el Apps Script.
import { aplicarOps, filasAEstado } from './schema.js';
import { SEED } from './seed.js';

const DB_NAME = 'entreno', STORE = 'kv';
let dbp = null;
function idb() {
  if (!dbp) dbp = new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return dbp;
}
async function get(k) { const db = await idb(); return new Promise((res, rej) => { const q = db.transaction(STORE).objectStore(STORE).get(k); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); }
async function set(k, v) { const db = await idb(); return new Promise((res, rej) => { const t = db.transaction(STORE, 'readwrite'); t.objectStore(STORE).put(v, k); t.oncomplete = () => res(); t.onerror = () => rej(t.error); }); }

const clone = o => JSON.parse(JSON.stringify(o));

export function createStore({ fetchFn = (...a) => fetch(...a), onChange = () => {} } = {}) {
  const st = { filas: null, cola: [], config: null, ultimaSync: null, sincronizando: false, error: '' };
  let colaSeq = 0;

  const estado = () => filasAEstado(st.filas);
  const emit = () => onChange(estado(), info());
  const info = () => ({ configurado: !!(st.config && st.config.url), pendientes: st.cola.length, ultimaSync: st.ultimaSync, sincronizando: st.sincronizando, error: st.error });

  async function cargar() {
    st.filas = (await get('filas')) || clone(SEED);
    st.cola = (await get('cola')) || [];
    st.config = (await get('config')) || null;
    st.ultimaSync = (await get('ultimaSync')) || null;
    colaSeq = st.cola.reduce((m, o) => Math.max(m, o.seq || 0), 0);
    emit();
  }

  async function escribir(ops) {
    aplicarOps(st.filas, ops);
    ops.forEach(o => st.cola.push({ ...o, seq: ++colaSeq }));
    await set('filas', st.filas);
    await set('cola', st.cola);
    emit();
    sincronizarPronto();
  }

  async function setConfig(cfg) {
    st.config = cfg && cfg.url ? { url: String(cfg.url).trim(), token: String(cfg.token || '').trim() } : null;
    await set('config', st.config);
    st.error = '';
    emit();
    if (st.config) return sincronizar();
  }

  async function llamar(params, body) {
    const u = new URL(st.config.url);
    Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v));
    const opts = body ? { method: 'POST', body: JSON.stringify(body), redirect: 'follow' } : { redirect: 'follow' };
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const t = ctrl && setTimeout(() => ctrl.abort(), 30000);
    try {
      const r = await fetchFn(u.toString(), ctrl ? { ...opts, signal: ctrl.signal } : opts);
      const txt = await r.text();
      let j; try { j = JSON.parse(txt); } catch (e) { throw new Error('Respuesta rara del servidor. ¿Implementaste el Apps Script con acceso "Cualquier usuario"?'); }
      if (!j.ok) throw new Error(j.error === 'token' ? 'La clave no coincide con la del Apps Script' : (j.error || 'Error del servidor'));
      return j;
    } finally { if (t) clearTimeout(t); }
  }

  let enCurso = null, otraVez = false;
  function sincronizar() {
    if (!st.config || !st.config.url) return Promise.resolve(false);
    if (enCurso) { otraVez = true; return enCurso; }
    enCurso = (async () => {
      st.sincronizando = true; emit();
      try {
        // 1) subir cambios pendientes
        if (st.cola.length) {
          const lote = st.cola.slice();
          await llamar({}, { token: st.config.token, ops: lote.map(({ seq, ...o }) => o) });
          const hasta = lote[lote.length - 1].seq;
          st.cola = st.cola.filter(o => o.seq > hasta);
          await set('cola', st.cola);
        }
        // 2) bajar la hoja entera (es la fuente de verdad) y reaplicar lo que siga pendiente
        const j = await llamar({ a: 'pull', token: st.config.token });
        const filas = j.data || {};
        // hoja recién creada y vacía: se le sube la rutina inicial
        if (!(filas.ejercicios || []).length && !(filas.plantillas || []).length) {
          const semilla = [...SEED.ejercicios.map(f => ({ op: 'put', hoja: 'ejercicios', fila: f })), ...SEED.plantillas.map(f => ({ op: 'put', hoja: 'plantillas', fila: f }))];
          semilla.forEach(o => st.cola.push({ ...o, seq: ++colaSeq }));
          await set('cola', st.cola);
          otraVez = true;
        }
        aplicarOps(filas, st.cola);
        st.filas = filas;
        st.ultimaSync = Date.now();
        st.error = '';
        await set('filas', st.filas);
        await set('ultimaSync', st.ultimaSync);
        return true;
      } catch (e) {
        st.error = (e && e.name === 'AbortError') ? 'Sin respuesta del servidor' : (navigator.onLine === false ? 'Sin conexión: se sincronizará al volver' : (e.message || 'Error al sincronizar'));
        return false;
      } finally {
        st.sincronizando = false; enCurso = null; emit();
        if (otraVez) { otraVez = false; setTimeout(sincronizar, 0); }
      }
    })();
    return enCurso;
  }
  let timer = null;
  function sincronizarPronto() { clearTimeout(timer); timer = setTimeout(sincronizar, 800); }

  return { cargar, escribir, sincronizar, setConfig, estado, info, get config() { return st.config; } };
}
