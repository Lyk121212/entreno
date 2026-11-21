// Esquema de la hoja de Google: una pestaña por colección, la primera columna es siempre "id".
// Debe coincidir con HOJAS en apps-script/Code.gs.
export const HOJAS = {
  ejercicios:   ['id', 'nombre', 'grupo', 'series', 'repMin', 'repMax', 'incremento', 'activo', 'notas'],
  plantillas:   ['id', 'nombre', 'ejercicios'],
  plan_semanal: ['id', 'semana', 'fecha', 'hora', 'tipo', 'plantilla', 'detalle', 'objetivo', 'nota'],
  revisiones:   ['id', 'semana', 'resumen', 'ajustes', 'plan_siguiente'],
  sesiones:     ['id', 'fecha', 'plantilla', 'nombre', 'nota', 'creado'],
  series:       ['id', 'sesion', 'fecha', 'ejercicio', 'nombre', 'serie', 'peso', 'reps', 'obj_peso', 'obj_reps', 'nota'],
  carreras:     ['id', 'fecha', 'km', 'tiempo', 'segundos', 'ritmo', 'tipo', 'sensacion', 'nota', 'creado'],
  movilidad:    ['id', 'fecha', 'creado'],
};

const num = v => { if (v === '' || v == null) return null; const n = Number(String(v).replace(',', '.')); return isNaN(n) ? null : n; };
const str = v => (v == null ? '' : String(v));
const bool = v => !(v === false || /^(false|no|0)$/i.test(String(v).trim()));

/* ---------- filas de la hoja -> estado de la app ---------- */
export function filasAEstado(d) {
  const ejercicios = (d.ejercicios || []).filter(r => r.id).map(r => ({
    id: str(r.id), nombre: str(r.nombre) || str(r.id), grupo: str(r.grupo),
    series: num(r.series) || 3, repMin: num(r.repMin) || 8, repMax: num(r.repMax) || 12,
    incremento: num(r.incremento) || 2.5, activo: bool(r.activo), notas: str(r.notas),
  }));
  const plantillas = {};
  (d.plantillas || []).filter(r => r.id).forEach(r => {
    plantillas[str(r.id)] = { id: str(r.id), nombre: str(r.nombre) || str(r.id),
      ejercicios: str(r.ejercicios).split(/[,;\n]/).map(s => s.trim()).filter(Boolean) };
  });
  const plan = {};
  (d.plan_semanal || []).filter(r => r.semana).forEach(r => {
    const w = str(r.semana);
    const p = plan[w] = plan[w] || { id: w, objetivo: null, nota: '', dias: [] };
    const obj = num(r.objetivo); if (obj) p.objetivo = Math.max(p.objetivo || 0, obj);
    if (!p.nota && str(r.nota)) p.nota = str(r.nota);
    if (str(r.fecha)) p.dias.push({ id: str(r.id), fecha: str(r.fecha), hora: str(r.hora), tipo: str(r.tipo) || 'gimnasio', plantilla: str(r.plantilla), detalle: str(r.detalle) });
  });
  const revisiones = (d.revisiones || []).filter(r => r.id || r.semana).map(r => ({
    id: str(r.id || r.semana), semana: str(r.semana), resumen: str(r.resumen), ajustes: str(r.ajustes), plan_siguiente: str(r.plan_siguiente) }));
  const porSesion = {};
  (d.series || []).filter(r => r.sesion).forEach(r => {
    const s = porSesion[r.sesion] = porSesion[r.sesion] || {};
    const k = str(r.ejercicio);
    const e = s[k] = s[k] || { ejercicio: k, nombre: str(r.nombre), sets: [], objetivo: { peso: num(r.obj_peso), reps: num(r.obj_reps) }, nota: '', _orden: [] };
    if (str(r.nota) && !e.nota) e.nota = str(r.nota);
    const peso = num(r.peso), reps = num(r.reps);
    if (peso > 0 && reps > 0) { e.sets.push({ peso, reps }); e._orden.push(num(r.serie) || e.sets.length); }
  });
  const sesiones = (d.sesiones || []).filter(r => r.id).map(r => {
    const ex = Object.values(porSesion[r.id] || {}).map(e => {
      const idx = e.sets.map((s, i) => i).sort((a, b) => e._orden[a] - e._orden[b]);
      return { ejercicio: e.ejercicio, nombre: e.nombre, sets: idx.map(i => e.sets[i]), objetivo: e.objetivo, nota: e.nota };
    });
    return { id: str(r.id), fecha: str(r.fecha), plantilla: str(r.plantilla), nombre: str(r.nombre), nota: str(r.nota), creado: num(r.creado) || 0, ejercicios: ex };
  });
  const carreras = (d.carreras || []).filter(r => r.id && num(r.km) > 0).map(r => {
    const km = num(r.km);
    let seg = num(r.segundos);
    if (!(seg > 0)) seg = tiempoASeg(r.tiempo);
    return { id: str(r.id), fecha: str(r.fecha), km, segundos: seg || 0, tipo: str(r.tipo) || 'suave', sensacion: num(r.sensacion), nota: str(r.nota), creado: num(r.creado) || 0 };
  }).filter(c => c.segundos > 0);
  const movilidad = (d.movilidad || []).filter(r => r.fecha || r.id).map(r => ({ id: str(r.id || r.fecha), fecha: str(r.fecha || r.id), creado: num(r.creado) || 0 }));
  return { ejercicios, plantillas, plan, revisiones, sesiones, carreras, movilidad };
}

export function tiempoASeg(v) {
  v = String(v ?? '').trim(); if (!v) return NaN;
  if (v.includes(':')) { const p = v.split(':').map(Number); if (p.some(isNaN)) return NaN; return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1]; }
  const n = num(v); return n == null ? NaN : n * 60;
}
export function segATiempo(sec) {
  sec = Math.round(sec); const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
  const p = n => String(n).padStart(2, '0');
  return h ? h + ':' + p(m) + ':' + p(s) : m + ':' + p(s);
}

/* ---------- objetos de la app -> operaciones sobre la hoja ---------- */
export function opsSesion(s) {
  const ops = [
    { op: 'put', hoja: 'sesiones', fila: { id: s.id, fecha: s.fecha, plantilla: s.plantilla, nombre: s.nombre, nota: s.nota || '', creado: s.creado } },
    { op: 'delWhere', hoja: 'series', campo: 'sesion', valor: s.id },
  ];
  (s.ejercicios || []).forEach(e => {
    const base = { sesion: s.id, fecha: s.fecha, ejercicio: e.ejercicio, nombre: e.nombre, obj_peso: e.objetivo?.peso ?? '', obj_reps: e.objetivo?.reps ?? '', nota: e.nota || '' };
    if (!e.sets.length) ops.push({ op: 'put', hoja: 'series', fila: { ...base, id: s.id + '.' + e.ejercicio + '.0', serie: '', peso: '', reps: '' } });
    e.sets.forEach((st, i) => ops.push({ op: 'put', hoja: 'series', fila: { ...base, id: s.id + '.' + e.ejercicio + '.' + (i + 1), serie: i + 1, peso: st.peso, reps: st.reps } }));
  });
  return ops;
}
export const opsBorrarSesion = id => [{ op: 'del', hoja: 'sesiones', id }, { op: 'delWhere', hoja: 'series', campo: 'sesion', valor: id }];
export const opsCarrera = c => [{ op: 'put', hoja: 'carreras', fila: { id: c.id, fecha: c.fecha, km: c.km, tiempo: segATiempo(c.segundos), segundos: c.segundos, ritmo: segATiempo(c.segundos / c.km), tipo: c.tipo, sensacion: c.sensacion ?? '', nota: c.nota || '', creado: c.creado } }];
export const opsMovilidad = m => [{ op: 'put', hoja: 'movilidad', fila: { id: m.id, fecha: m.fecha, creado: m.creado } }];
export const opsEjercicio = e => [{ op: 'put', hoja: 'ejercicios', fila: { id: e.id, nombre: e.nombre, grupo: e.grupo, series: e.series, repMin: e.repMin, repMax: e.repMax, incremento: e.incremento, activo: e.activo !== false, notas: e.notas || '' } }];

/* ---------- aplicar operaciones a filas (para la cola local pendiente) ---------- */
export function aplicarOps(filas, ops) {
  for (const o of ops) {
    const arr = filas[o.hoja] = filas[o.hoja] || [];
    if (o.op === 'put') { const i = arr.findIndex(r => String(r.id) === String(o.fila.id)); if (i >= 0) arr[i] = { ...arr[i], ...o.fila }; else arr.push({ ...o.fila }); }
    else if (o.op === 'del') { filas[o.hoja] = arr.filter(r => String(r.id) !== String(o.id)); }
    else if (o.op === 'delWhere') { filas[o.hoja] = arr.filter(r => String(r[o.campo]) !== String(o.valor)); }
  }
  return filas;
}
