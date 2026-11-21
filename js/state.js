// entreno v1.1.1
// Estado compartido de la interfaz y ayudantes que dependen de él.
import { createStore } from './store.js';
import { normEjercicio, CAT } from './schema.js';
import { CATALOGO } from './catalogo.js';
import { isoWeek, recuentoSemana } from './logic.js';
import { esc, hoyISO, lsGet, lsSet } from './util.js';
import * as SES from './sesion.js';

export const S = {
  ok: false, info: {},
  ejercicios: [], plantillas: {}, sesiones: [], carreras: [], movilidad: [], deportes: [], plan: {}, revisiones: [],
  view: 'hoy', param: '', confirm: null, ex: null, actTab: 'carrera', picker: null, detalle: null, nuevaRutina: false,
};

/** Ejercicio por id: el de la hoja (completado con el catálogo) o, si no está en la hoja, el del catálogo. */
export function getEj(id) {
  return S.ejercicios.find(e => e.id === id) || (CAT[id] ? normEjercicio({}, id) : null);
}
export const misEjercicios = () => S.ejercicios.filter(e => e.activo !== false);
export const catalogoRestante = () => CATALOGO.filter(c => !S.ejercicios.some(e => e.id === c.id)).map(c => normEjercicio({}, c.id));

const ICONO_GRUPO = { pierna: '🦵', empuje: '💪', 'tirón': '🧗', core: '🎯' };
export function imgUrl(ej, i) {
  if (!ej || !ej.foto) return '';
  const portada = ej.modo === 'tiempo' ? 1 : 0;
  return 'img/ej/' + encodeURIComponent(ej.foto) + '/' + (i ?? portada) + '.webp';
}
export function thumb(ej, cls = 'thumb') {
  const u = imgUrl(ej);
  return u ? '<img class="' + cls + '" src="' + u + '" alt="" loading="lazy" decoding="async">'
    : '<span class="' + cls + ' ph" aria-hidden="true">' + (ICONO_GRUPO[ej && ej.grupo] || '🏋️') + '</span>';
}

/* ---- sesión en curso ---- */
export const getDraft = () => { const d = lsGet(SES.CLAVE); return SES.valido(d) ? d : null; };
export const setDraft = d => lsSet(SES.CLAVE, d);

/* ---- semana ---- */
export function semanaHTML() {
  const r = recuentoSemana(S, isoWeek(hoyISO()));
  const partes = [];
  if (r.gimnasio) partes.push('<span class="chip" title="Gimnasio">🏋️ ' + r.gimnasio + '</span>');
  if (r.carreras) partes.push('<span class="chip run" title="Carreras">🏃 ' + r.carreras + '</span>');
  if (r.deportes) partes.push('<span class="chip dep" title="Otros deportes">🎾 ' + r.deportes + '</span>');
  if (r.movilidad) partes.push('<span class="chip" title="Movilidad">🧘 ' + r.movilidad + '</span>');
  return '<div class="semana"><div class="sub">Esta semana</div>' + (partes.length ? '<div class="chips">' + partes.join('') + '</div>' : '<div class="sub">Nada registrado todavía</div>') + '</div>';
}

export const store = createStore({ onChange: (estado, info) => { Object.assign(S, estado); S.info = info; S.ok = true; hooks.onData(); } });
export const hooks = { onData: () => {} };
export { esc };
