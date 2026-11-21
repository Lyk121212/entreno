// entreno v1.1.1
// Sesión de gimnasio en curso (borrador): se crea desde una rutina o vacía y se modifica libremente.
// Funciones puras: reciben el borrador y devuelven uno nuevo. El guardado en localStorage lo hace la app.
import { serieValida, historial, objetivo } from './logic.js';

export const CLAVE = 'entreno-sesion-v2';
const clone = o => JSON.parse(JSON.stringify(o));
const item = (ej, n) => ({ ej: ej.id, n: Math.max(1, ej.series || 3), sets: [], nota: '' });

export function desdePlantilla(tpl, getEj, fecha) {
  const items = (tpl.ejercicios || []).map(getEj).filter(e => e && e.activo !== false).map(e => item(e));
  return { v: 2, id: null, creado: null, fecha, plantilla: tpl.id, nombre: tpl.nombre || tpl.id, items, nota: '', tocada: false, manual: false };
}
export const vacia = fecha => ({ v: 2, id: null, creado: null, fecha, plantilla: '', nombre: 'Sesión libre', items: [], nota: '', tocada: false, manual: true });

export function desdeSesion(ses, getEj) {
  const items = (ses.ejercicios || []).map(e => {
    const ej = getEj(e.ejercicio);
    return { ej: e.ejercicio, n: Math.max(1, e.sets.length || (ej ? ej.series : 1)), sets: e.sets.map(s => ({ peso: s.peso, reps: s.reps })), nota: e.nota || '' };
  });
  return { v: 2, id: ses.id, creado: ses.creado || Date.now(), fecha: ses.fecha, plantilla: ses.plantilla || '', nombre: ses.nombre || 'Sesión', items, nota: ses.nota || '', tocada: true, manual: true };
}

export function valido(d) {
  return !!d && d.v === 2 && Array.isArray(d.items) && typeof d.fecha === 'string' && d.items.every(i => i && typeof i.ej === 'string' && Array.isArray(i.sets));
}

/* ---- modificaciones ---- */
const mod = (d, f) => { const x = clone(d); f(x); x.tocada = true; return x; };
export const anadir = (d, ej) => d.items.some(i => i.ej === ej.id) ? d : mod(d, x => x.items.push(item(ej)));
export const quitar = (d, idx) => mod(d, x => x.items.splice(idx, 1));
export const mover = (d, idx, delta) => mod(d, x => { const j = idx + delta; if (j < 0 || j >= x.items.length) return; [x.items[idx], x.items[j]] = [x.items[j], x.items[idx]]; });
export const masSerie = (d, idx) => mod(d, x => { x.items[idx].n = Math.min(10, x.items[idx].n + 1); });
export const menosSerie = (d, idx) => mod(d, x => { const it = x.items[idx]; if (it.n <= 1) return; it.n -= 1; it.sets = it.sets.slice(0, it.n); });
export const ponerSet = (d, idx, i, campo, valor) => mod(d, x => { const it = x.items[idx]; while (it.sets.length <= i) it.sets.push({}); it.sets[i] = { ...it.sets[i], [campo]: valor }; });
export const ponerSetCompleto = (d, idx, i, set) => mod(d, x => { const it = x.items[idx]; while (it.sets.length <= i) it.sets.push({}); it.sets[i] = set; });
export const ponerNota = (d, idx, nota) => mod(d, x => { x.items[idx].nota = nota; });
export const ponerNotaSesion = (d, nota) => mod(d, x => { x.nota = nota; });
export const ponerFecha = (d, fecha) => mod(d, x => { x.fecha = fecha; });

export function tieneDatos(d) {
  return !!d && (d.items.some(i => i.sets.some(s => s && s.reps > 0) || (i.nota || '').trim()) || (d.nota || '').trim().length > 0);
}
export function difiereDePlantilla(d, tpl) {
  const lista = d.items.map(i => i.ej);
  if (!tpl) return lista.length > 0;
  return lista.join('|') !== (tpl.ejercicios || []).join('|');
}

/** Convierte el borrador en una sesión guardable. Devuelve null si no hay ninguna serie válida. */
export function aSesion(d, getEj, sesiones, ahora = Date.now(), nuevoId = () => 's-' + ahora.toString(36)) {
  const otras = sesiones.filter(s => s.id !== d.id);
  const ejercicios = d.items.map(it => {
    const ej = getEj(it.ej); if (!ej) return null;
    const sets = it.sets.filter(s => serieValida({ peso: s?.peso ?? (ej.modo === 'kg' ? null : 0), reps: s?.reps }, ej.modo))
      .map(s => ({ peso: s.peso ?? 0, reps: s.reps }));
    if (!sets.length && !(it.nota || '').trim()) return null;
    const o = objetivo(ej, historial(otras.filter(s => s.fecha <= d.fecha), ej.id, ej.modo));
    return { ejercicio: ej.id, nombre: ej.nombre, sets, objetivo: { peso: o.peso, reps: o.reps }, nota: (it.nota || '').trim() };
  }).filter(Boolean);
  if (!ejercicios.some(e => e.sets.length)) return null;
  return { id: d.id || nuevoId(), fecha: d.fecha, plantilla: d.plantilla || '', nombre: d.nombre || 'Sesión libre', nota: (d.nota || '').trim(), creado: d.creado || ahora, ejercicios };
}
