// entreno v1.1.1
// Esquema de la hoja de Google y conversión filas <-> estado de la app.
// Una pestaña por colección; la primera columna es siempre "id". Debe coincidir con HOJAS en apps-script/Code.gs.
import { CATALOGO } from './catalogo.js';

export const HOJAS = {
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
export const MODOS = ['kg', 'corporal', 'tiempo'];
export const CAT = Object.fromEntries(CATALOGO.map(c => [c.id, c]));

const num = v => { if (v === '' || v == null) return null; const n = Number(String(v).replace(',', '.')); return isNaN(n) ? null : n; };
const str = v => (v == null ? '' : String(v).trim());
const bool = v => !(v === false || /^(false|no|0)$/i.test(String(v).trim()));
const fecha = v => { const s = str(v); const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); return m ? m[1] + '-' + m[2].padStart(2, '0') + '-' + m[3].padStart(2, '0') : s; };

/** Ejercicio completo: lo de la hoja manda; lo que falte sale del catálogo; si no está en ninguno, valores por defecto. */
export function normEjercicio(r = {}, id = r.id) {
  const c = CAT[id] || {};
  const pick = (k, d) => { const v = r[k]; return v === undefined || v === null || str(v) === '' ? (c[k] ?? d) : v; };
  const modo = MODOS.includes(str(pick('modo', 'kg'))) ? str(pick('modo', 'kg')) : 'kg';
  const series = Math.max(1, Math.min(10, Math.round(num(pick('series', 3)) || 3)));
  let repMin = Math.max(1, Math.round(num(pick('repMin', 8)) || 8)), repMax = Math.max(1, Math.round(num(pick('repMax', 12)) || 12));
  if (repMin > repMax) [repMin, repMax] = [repMax, repMin];
  const inc = num(pick('incremento', modo === 'kg' ? 2.5 : 0));
  return { id: str(id), nombre: str(pick('nombre', '')) || str(id), grupo: str(pick('grupo', '')), musculo: str(pick('musculo', '')), modo,
    series, repMin, repMax, incremento: inc == null || inc < 0 ? (modo === 'kg' ? 2.5 : 0) : inc,
    activo: r.activo === undefined || str(r.activo) === '' ? true : bool(r.activo), notas: str(pick('notas', '')),
    foto: c.fotos ? str(id) : '', enHoja: !!str(r.id), propio: !CAT[id] };
}

/* ---------- filas de la hoja -> estado de la app ---------- */
export function filasAEstado(d) {
  d = d || {};
  const ejercicios = [];
  const vistos = new Set();
  (d.ejercicios || []).forEach(r => { const id = str(r.id); if (id && !vistos.has(id)) { vistos.add(id); ejercicios.push(normEjercicio(r, id)); } });
  const plantillas = {};
  (d.plantillas || []).forEach(r => {
    const id = str(r.id); if (!id) return;
    plantillas[id] = { id, nombre: str(r.nombre) || id, ejercicios: str(r.ejercicios).split(/[,;\n]/).map(s => s.trim()).filter(Boolean) };
  });
  const plan = {};
  (d.plan_semanal || []).filter(r => str(r.semana)).forEach(r => {
    const w = str(r.semana);
    const p = plan[w] = plan[w] || { id: w, nota: '', dias: [] };
    if (!p.nota && str(r.nota)) p.nota = str(r.nota);
    if (str(r.fecha)) p.dias.push({ id: str(r.id), fecha: fecha(r.fecha), hora: str(r.hora), tipo: str(r.tipo) || 'gimnasio', plantilla: str(r.plantilla), detalle: str(r.detalle), nota: str(r.nota) });
  });
  const revisiones = (d.revisiones || []).filter(r => str(r.id) || str(r.semana)).map(r => ({
    id: str(r.id || r.semana), semana: str(r.semana), resumen: str(r.resumen), ajustes: str(r.ajustes), plan_siguiente: str(r.plan_siguiente) }));
  const porSesion = {};
  (d.series || []).filter(r => str(r.sesion)).forEach(r => {
    const s = porSesion[str(r.sesion)] = porSesion[str(r.sesion)] || { orden: [], ej: {} };
    const k = str(r.ejercicio);
    if (!s.ej[k]) { s.ej[k] = { ejercicio: k, nombre: str(r.nombre), sets: [], _n: [], objetivo: { peso: num(r.obj_peso), reps: num(r.obj_reps) }, nota: '' }; s.orden.push(k); }
    const e = s.ej[k];
    if (str(r.nota) && !e.nota) e.nota = str(r.nota);
    const peso = num(r.peso), reps = num(r.reps);
    if (reps > 0) { e.sets.push({ peso: peso == null ? 0 : peso, reps }); e._n.push(num(r.serie) || e.sets.length); }
  });
  const sesiones = (d.sesiones || []).filter(r => str(r.id)).map(r => {
    const s = porSesion[str(r.id)] || { orden: [], ej: {} };
    const ex = s.orden.map(k => {
      const e = s.ej[k];
      const idx = e.sets.map((_, i) => i).sort((a, b) => e._n[a] - e._n[b]);
      return { ejercicio: e.ejercicio, nombre: e.nombre, sets: idx.map(i => e.sets[i]), objetivo: e.objetivo, nota: e.nota };
    });
    return { id: str(r.id), fecha: fecha(r.fecha), plantilla: str(r.plantilla), nombre: str(r.nombre), nota: str(r.nota), creado: num(r.creado) || 0, ejercicios: ex };
  });
  const carreras = (d.carreras || []).filter(r => str(r.id) && num(r.km) > 0).map(r => {
    let seg = num(r.segundos);
    if (!(seg > 0)) seg = tiempoASeg(r.tiempo);
    return { id: str(r.id), fecha: fecha(r.fecha), km: num(r.km), segundos: seg || 0, tipo: str(r.tipo) || 'suave', sensacion: num(r.sensacion), nota: str(r.nota), creado: num(r.creado) || 0 };
  }).filter(c => c.segundos > 0);
  const movilidad = (d.movilidad || []).filter(r => str(r.fecha) || str(r.id)).map(r => ({ id: str(r.id || r.fecha), fecha: fecha(r.fecha || r.id), creado: num(r.creado) || 0 }));
  const deportes = (d.deportes || []).filter(r => str(r.id) && str(r.deporte)).map(r => ({
    id: str(r.id), fecha: fecha(r.fecha), deporte: str(r.deporte), minutos: num(r.minutos), sensacion: num(r.sensacion), nota: str(r.nota), creado: num(r.creado) || 0 }));
  return { ejercicios, plantillas, plan, revisiones, sesiones, carreras, movilidad, deportes };
}

export function tiempoASeg(v) {
  v = String(v ?? '').trim(); if (!v) return NaN;
  if (v.includes(':')) {
    const p = v.split(':').map(x => x.trim() === '' ? NaN : Number(x));
    if (p.some(isNaN) || p.length > 3 || p.slice(1).some(x => x >= 60) || p.some(x => x < 0)) return NaN;
    return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1];
  }
  const n = num(v); return n == null || n < 0 ? NaN : n * 60;
}
export function segATiempo(sec) {
  sec = Math.round(sec); const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
  const p = n => String(n).padStart(2, '0');
  return h ? h + ':' + p(m) + ':' + p(s) : m + ':' + p(s);
}

/* ---------- objetos de la app -> operaciones sobre la hoja ---------- */
export function opsSesion(s) {
  const ops = [
    { op: 'put', hoja: 'sesiones', fila: { id: s.id, fecha: s.fecha, plantilla: s.plantilla || '', nombre: s.nombre || '', nota: s.nota || '', creado: s.creado } },
    { op: 'delWhere', hoja: 'series', campo: 'sesion', valor: s.id },
  ];
  (s.ejercicios || []).forEach(e => {
    const base = { sesion: s.id, fecha: s.fecha, ejercicio: e.ejercicio, nombre: e.nombre, obj_peso: e.objetivo?.peso ?? '', obj_reps: e.objetivo?.reps ?? '', nota: e.nota || '' };
    if (!e.sets.length) ops.push({ op: 'put', hoja: 'series', fila: { ...base, id: s.id + '.' + e.ejercicio + '.0', serie: '', peso: '', reps: '' } });
    e.sets.forEach((st, i) => ops.push({ op: 'put', hoja: 'series', fila: { ...base, id: s.id + '.' + e.ejercicio + '.' + (i + 1), serie: i + 1, peso: st.peso ?? 0, reps: st.reps } }));
  });
  return ops;
}
export const opsBorrarSesion = id => [{ op: 'del', hoja: 'sesiones', id }, { op: 'delWhere', hoja: 'series', campo: 'sesion', valor: id }];
export const opsCarrera = c => [{ op: 'put', hoja: 'carreras', fila: { id: c.id, fecha: c.fecha, km: c.km, tiempo: segATiempo(c.segundos), segundos: c.segundos, ritmo: segATiempo(c.segundos / c.km), tipo: c.tipo, sensacion: c.sensacion ?? '', nota: c.nota || '', creado: c.creado } }];
export const opsDeporte = d => [{ op: 'put', hoja: 'deportes', fila: { id: d.id, fecha: d.fecha, deporte: d.deporte, minutos: d.minutos ?? '', sensacion: d.sensacion ?? '', nota: d.nota || '', creado: d.creado } }];
export const opsMovilidad = m => [{ op: 'put', hoja: 'movilidad', fila: { id: m.id, fecha: m.fecha, creado: m.creado } }];
export const opsBorrar = (hoja, id) => [{ op: 'del', hoja, id }];
export const opsEjercicio = e => [{ op: 'put', hoja: 'ejercicios', fila: { id: e.id, nombre: e.nombre, grupo: e.grupo || '', musculo: e.musculo || '', modo: e.modo || 'kg', series: e.series, repMin: e.repMin, repMax: e.repMax, incremento: e.incremento, activo: e.activo !== false, notas: e.notas || '' } }];
export const opsPlantilla = p => [{ op: 'put', hoja: 'plantillas', fila: { id: p.id, nombre: p.nombre, ejercicios: (p.ejercicios || []).join(', ') } }];

/* ---------- aplicar operaciones a filas (cola local pendiente) ---------- */
export function aplicarOps(filas, ops) {
  for (const o of ops) {
    const arr = filas[o.hoja] = filas[o.hoja] || [];
    if (o.op === 'put') { const i = arr.findIndex(r => String(r.id) === String(o.fila.id)); if (i >= 0) arr[i] = { ...arr[i], ...o.fila }; else arr.push({ ...o.fila }); }
    else if (o.op === 'del') { filas[o.hoja] = arr.filter(r => String(r.id) !== String(o.id)); }
    else if (o.op === 'delWhere') { filas[o.hoja] = arr.filter(r => String(r[o.campo]) !== String(o.valor)); }
  }
  return filas;
}
