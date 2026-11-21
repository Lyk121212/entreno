// Reglas de progresión, recuento semanal y elección de sesión. Sin DOM: se testea en Node.
const pad = n => String(n).padStart(2, '0');
export const r05 = x => Math.round(x * 2) / 2;
const byFecha = (a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : (a.creado || 0) - (b.creado || 0));

export function isoWeek(s) {
  const [y, m, d] = String(s).split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return t.getUTCFullYear() + '-W' + pad(Math.ceil(((t - y0) / 864e5 + 1) / 7));
}

/** Una serie cuenta si tiene repeticiones y, en ejercicios con peso, peso > 0 (en corporal/tiempo el peso es lastre opcional). */
export const serieValida = (st, modo = 'kg') => !!st && st.reps > 0 && (modo !== 'kg' ? (st.peso == null || st.peso >= 0) : st.peso > 0);

export function historial(sesiones, exId, modo = 'kg') {
  return sesiones.slice().sort(byFecha).map(s => ({ fecha: s.fecha, e: (s.ejercicios || []).find(x => x.ejercicio === exId) }))
    .filter(x => x.e && (x.e.sets || []).some(st => serieValida(st, modo)))
    .map(x => ({ fecha: x.fecha, sets: x.e.sets.filter(st => serieValida(st, modo)).map(st => ({ peso: st.peso || 0, reps: st.reps })), nota: x.e.nota || '' }));
}

export function evalSesion(ex, h) {
  const top = Math.max(...h.sets.map(s => s.peso || 0));
  const work = h.sets.filter(s => (s.peso || 0) === top);
  const minR = Math.min(...work.map(s => s.reps));
  return { top, minR, allTop: work.length >= ex.series && work.every(s => s.reps >= ex.repMax), fail: minR < ex.repMin };
}

export function objetivo(ex, h) {
  const modo = ex.modo || 'kg';
  const paso = modo === 'tiempo' ? 5 : 1;
  if (!h.length) return { peso: modo === 'kg' ? null : 0, reps: ex.repMin, motivo: modo === 'kg' ? 'Calibración: elige un peso con el que te sobren 2-3 repeticiones' : 'Primera vez: empieza cómodo y apunta lo que hagas', tipo: 'cal' };
  const last = h.at(-1), ev = evalSesion(ex, last);
  const ultima = { peso: ev.top, sets: last.sets, fecha: last.fecha };
  const enRango = r => Math.max(ex.repMin, Math.min(r, ex.repMax));
  if (/dolor|molest/i.test(last.nota)) return { peso: ev.top, reps: enRango(ev.minR), motivo: 'Mantener: anotaste molestias la última vez. Si sigue, coméntalo con Claude', tipo: 'hold', ultima };
  if (ev.allTop) {
    if (modo === 'kg' || (ex.incremento > 0 && ev.top > 0)) return { peso: r05(ev.top + (ex.incremento || 2.5)), reps: ex.repMin, motivo: 'Subes peso: completaste todas las series en el tope del rango', tipo: 'up', ultima };
    return { peso: ev.top, reps: ex.repMax, motivo: 'Estás en el tope: añade lastre o pasa a una variante más difícil', tipo: 'up', ultima };
  }
  const fallo2 = ev.fail && h.length >= 2 && evalSesion(ex, h.at(-2)).fail;
  if (fallo2 && ev.top > 0) return { peso: r05(ev.top * 0.9), reps: ex.repMin, motivo: 'Bajamos un 10 % para volver a sumar series buenas', tipo: 'down', ultima };
  if (ev.fail) return { peso: ev.top, reps: ex.repMin, motivo: 'Intenta llegar al mínimo del rango en todas las series', tipo: 'hold', ultima };
  return { peso: ev.top, reps: Math.min(ex.repMax, ev.minR + paso), motivo: modo === 'tiempo' ? 'Mismo lastre: suma unos segundos donde puedas' : 'Mismo peso: suma una repetición donde puedas', tipo: 'hold', ultima };
}

/** Rutina sugerida: la del plan de hoy si existe y aún no hay sesión hoy; si no, la siguiente a la última hecha. */
export function siguientePlantilla(plantillas, sesiones, planHoy, hoy) {
  const ids = Object.keys(plantillas);
  if (!ids.length) return null;
  const yaHoy = sesiones.some(s => s.fecha === hoy);
  if (planHoy && planHoy.tipo === 'gimnasio' && planHoy.plantilla && plantillas[planHoy.plantilla] && !yaHoy) return planHoy.plantilla;
  const last = sesiones.filter(s => s.plantilla && plantillas[s.plantilla]).sort(byFecha).at(-1);
  if (!last) return ids[0];
  return ids[(ids.indexOf(last.plantilla) + 1) % ids.length];
}

/** Recuento de lo hecho en una semana ISO (sin objetivos). */
export function recuentoSemana(estado, semana) {
  const de = arr => (arr || []).filter(x => x.fecha && isoWeek(x.fecha) === semana);
  return { gimnasio: de(estado.sesiones).length, carreras: de(estado.carreras).length, deportes: de(estado.deportes).length, movilidad: de(estado.movilidad).length,
    km: de(estado.carreras).reduce((a, c) => a + (c.km || 0), 0), minutosDeporte: de(estado.deportes).reduce((a, d) => a + (d.minutos || 0), 0) };
}
