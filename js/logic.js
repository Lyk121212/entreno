// Reglas de progresión (doble progresión) y utilidades de fechas. Sin dependencias del DOM: se testean en Node.
const pad = n => String(n).padStart(2, '0');
export const r05 = x => Math.round(x * 2) / 2;
const byFecha = (a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : (a.creado || 0) - (b.creado || 0));

export function isoWeek(s) {
  const [y, m, d] = s.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return t.getUTCFullYear() + '-W' + pad(Math.ceil(((t - y0) / 864e5 + 1) / 7));
}

export function historial(sesiones, exId) {
  return sesiones.slice().sort(byFecha).map(s => ({ fecha: s.fecha, e: (s.ejercicios || []).find(x => x.ejercicio === exId) }))
    .filter(x => x.e && (x.e.sets || []).some(st => st.peso > 0 && st.reps > 0))
    .map(x => ({ fecha: x.fecha, sets: x.e.sets.filter(st => st.peso > 0 && st.reps > 0), nota: x.e.nota || '' }));
}

export function evalSesion(ex, h) {
  const top = Math.max(...h.sets.map(s => s.peso));
  const work = h.sets.filter(s => s.peso === top);
  const minR = Math.min(...work.map(s => s.reps));
  return { top, minR, allTop: work.length >= ex.series && work.every(s => s.reps >= ex.repMax), fail: minR < ex.repMin };
}

export function objetivo(ex, h) {
  if (!h.length) return { peso: null, reps: ex.repMin, motivo: 'Calibración: elige un peso con el que te sobren 2-3 repeticiones', tipo: 'cal' };
  const last = h.at(-1), ev = evalSesion(ex, last);
  const ultima = { peso: ev.top, sets: last.sets, fecha: last.fecha };
  if (/dolor|molest/i.test(last.nota)) return { peso: ev.top, reps: Math.max(ex.repMin, Math.min(ev.minR, ex.repMax)), motivo: 'Mantener: anotaste molestias la última vez. Si sigue, coméntalo con Claude', tipo: 'hold', ultima };
  if (ev.allTop) return { peso: r05(ev.top + (ex.incremento || 2.5)), reps: ex.repMin, motivo: 'Subes peso: completaste todas las series en el tope del rango', tipo: 'up', ultima };
  if (ev.fail && h.length >= 2 && evalSesion(ex, h.at(-2)).fail) return { peso: r05(ev.top * 0.9), reps: ex.repMin, motivo: 'Bajamos un 10 % para volver a sumar series buenas', tipo: 'down', ultima };
  if (ev.fail) return { peso: ev.top, reps: ex.repMin, motivo: 'Mismo peso: intenta llegar al mínimo del rango en todas las series', tipo: 'hold', ultima };
  return { peso: ev.top, reps: Math.min(ex.repMax, ev.minR + 1), motivo: 'Mismo peso: suma una repetición donde puedas', tipo: 'hold', ultima };
}

export function siguientePlantilla(plantillas, sesiones) {
  const ids = Object.keys(plantillas).sort();
  if (!ids.length) return null;
  const last = sesiones.slice().sort(byFecha).at(-1);
  if (!last || !ids.includes(last.plantilla)) return ids[0];
  return ids.at((ids.indexOf(last.plantilla) + 1) % ids.length);
}
