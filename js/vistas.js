// Vistas: cada función devuelve el HTML de una pantalla o de un diálogo.
import { S, getEj, misEjercicios, catalogoRestante, imgUrl, thumb, semanaHTML, getDraft, store } from './state.js';
import { historial, objetivo, evalSesion, isoWeek, r05 } from './logic.js';
import { normEjercicio, segATiempo as fmtTime, tiempoASeg as parseTime } from './schema.js';
import { GRUPOS } from './catalogo.js';
import * as SES from './sesion.js';
import { esc, kg, toNum, hoyISO, fechaCorta, fechaRelativa, parseD, isoDate, lsGet } from './util.js';

export const MOVILIDAD = [
  ['Gemelo en pared, rodilla recta', '2 × 30 s por pierna'],
  ['Gemelo en pared, rodilla flexionada', '2 × 30 s por pierna'],
  ['Flexor de cadera en zancada', '2 × 30 s por lado'],
  ['Gato-camello', '10 repeticiones lentas'],
  ['Postura del niño', '45 s respirando'],
  ['Cuello: inclinación lateral suave', '20 s por lado, sin forzar'],
  ['Isquios tumbado con toalla', '30 s por pierna'],
];
export const TIPOS = { suave: 'Suave', larga: 'Tirada larga', series: 'Series', test: 'Test' };
export const DEPORTES = ['Pádel', 'Fútbol', 'Baloncesto', 'Tenis', 'Bici', 'Natación', 'Senderismo', 'Escalada', 'Yoga'];
const MODO_TXT = { kg: 'Con peso', corporal: 'Peso corporal', tiempo: 'Por tiempo' };
const byFecha = (a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : (a.creado || 0) - (b.creado || 0));
const ejSeguro = id => getEj(id) || normEjercicio({ nombre: id + ' (ya no existe)' }, id);
const confirmTxt = (clave, normal, pregunta = '¿Seguro?') => S.confirm === clave ? pregunta : normal;

function avisoConexion() {
  return S.info.configurado ? '' : '<div class="card banner">La app aún no está conectada a tu hoja de Google. Lo que apuntes se guarda en el móvil y se subirá al conectarla. <a href="#ajustes">Conectar</a></div>';
}
function planDe(fecha) {
  const p = S.plan[isoWeek(fecha)];
  return p ? (p.dias || []).filter(x => x.fecha === fecha) : [];
}

/* =================== HOY =================== */
export function vistaHoy() {
  const d = getDraft();
  if (!d) return '<div class="card empty">Preparando la sesión…</div>';
  const editando = !!d.id;
  const plantillas = Object.values(S.plantillas);
  let h = '<div class="top"><div><div class="sub">' + (editando ? 'Editando · ' + esc(fechaRelativa(d.fecha)) : esc(fechaRelativa(d.fecha))) + '</div><h1>' + esc(d.nombre) + '</h1></div>' + semanaHTML() + '</div>';
  h += avisoConexion();
  if (editando) h += '<div class="card banner edit">Estás editando una sesión ya guardada. Al guardar se sustituye. <button class="ghost" data-act="cancelar-edicion">Cancelar edición</button></div>';
  if (!editando && d.fecha === hoyISO()) {
    planDe(d.fecha).filter(x => x.tipo !== 'gimnasio').forEach(x => {
      h += '<div class="card">Según tu agenda, hoy toca ' + (x.tipo === 'carrera' ? 'correr' : esc(x.tipo)) + (x.detalle ? ': <b>' + esc(x.detalle) + '</b>' : '') + (x.hora ? ' (' + esc(x.hora) + ')' : '') + '. <a href="#actividad">Apuntarlo</a></div>';
    });
  }
  h += '<div class="card ctrl"><div class="ctrl-row"><label class="l" for="ses-fecha">Día de la sesión</label><input class="in fecha" type="date" id="ses-fecha" data-in="fecha" value="' + esc(d.fecha) + '" max="' + hoyISO() + '"></div>';
  if (!editando) {
    h += '<div class="l">Empezar desde</div><div class="seg wrap" role="group" aria-label="Empezar desde">'
      + plantillas.map(t => '<button data-act="tpl" data-id="' + esc(t.id) + '" aria-pressed="' + (d.plantilla === t.id) + '">' + esc(confirmTxt('tpl-' + t.id, t.nombre, '¿Cambiar? Se pierde lo apuntado')) + '</button>').join('')
      + '<button data-act="tpl" data-id="" aria-pressed="' + (d.plantilla === '') + '">' + esc(confirmTxt('tpl-', 'Vacía', '¿Vaciar? Se pierde lo apuntado')) + '</button></div>';
  }
  h += '</div>';
  if (!d.items.length) h += '<div class="card empty">Sesión vacía. Añade los ejercicios que vayas a hacer.</div>';
  const otras = S.sesiones.filter(s => s.id !== d.id && s.fecha <= d.fecha);
  d.items.forEach((it, idx) => { h += tarjetaEjercicio(it, idx, d, otras); });
  h += '<button class="btn-add" data-act="picker" data-modo="sesion">+ Añadir ejercicio</button>';
  if (!editando && d.items.length && SES.difiereDePlantilla(d, S.plantillas[d.plantilla])) {
    const tpl = S.plantillas[d.plantilla];
    h += '<div class="card guardar-rutina"><div class="sub">' + (tpl ? 'Has cambiado los ejercicios respecto a «' + esc(tpl.nombre) + '». Esto solo afecta a hoy, salvo que lo guardes:' : '¿Quieres guardar estos ejercicios como rutina para otro día?') + '</div><div class="row-actions">'
      + (tpl ? '<button data-act="tpl-actualizar">Actualizar «' + esc(tpl.nombre) + '»</button>' : '')
      + (S.nuevaRutina ? '' : '<button data-act="tpl-nueva">Guardar como rutina nueva</button>') + '</div>'
      + (S.nuevaRutina ? '<form class="ctrl-row" id="f-nueva-rutina" style="margin-top:8px"><input class="in" name="nombre" data-in="nombre-rutina" placeholder="Nombre, p. ej. Torso" maxlength="40" required><button type="submit">Guardar</button></form>' : '')
      + '</div>';
  }
  h += '<label class="l" for="nota-ses">Nota de la sesión (opcional)</label><textarea id="nota-ses" data-in="nota-ses" placeholder="Cómo te has sentido, si algo molestó…">' + esc(d.nota) + '</textarea>';
  h += '<div class="acciones-fin"><button class="btn-main" data-act="terminar">' + (editando ? 'Guardar cambios' : 'Terminar sesión') + '</button>'
    + (editando ? '' : (SES.tieneDatos(d) || d.tocada ? '<button class="ghost" data-act="descartar">' + confirmTxt('descartar', 'Descartar sesión', '¿Descartar? Toca otra vez') + '</button>' : '')) + '</div>';
  if (!editando) h += '<h2>Movilidad</h2><div class="card">' + movilidadHTML() + '</div>';
  return h;
}

function tarjetaEjercicio(it, idx, d, otras) {
  const ej = ejSeguro(it.ej);
  const o = objetivo(ej, historial(otras, ej.id, ej.modo));
  const uw = ej.modo === 'kg' ? 'kg' : '+kg', ur = ej.modo === 'tiempo' ? 's' : 'reps';
  const tag = o.tipo === 'up' ? '<span class="tag up">Sube</span>' : o.tipo === 'down' ? '<span class="tag down">Baja</span>' : o.tipo === 'cal' ? '<span class="tag">Primera vez</span>' : '';
  const ult = o.ultima ? o.ultima.sets.map(st => st.reps).join('-') + ' ' + ur + (o.ultima.peso ? ' con ' + kg(o.ultima.peso) + ' kg' : '') + ' (' + fechaCorta(o.ultima.fecha) + ')' : 'sin registros aún';
  const sug = ej.series + ' × ' + o.reps + (ej.modo === 'tiempo' ? ' s' : '') + (o.peso ? ' con ' + kg(o.peso) + ' kg' : '');
  let h = '<section class="card ex" aria-label="' + esc(ej.nombre) + '"><div class="ex-top">'
    + '<button class="thumb-btn" data-act="detalle" data-id="' + esc(ej.id) + '" aria-label="Ver fotos de ' + esc(ej.nombre) + '">' + thumb(ej) + '</button>'
    + '<div class="ex-tit"><h3>' + esc(ej.nombre) + '</h3><div class="sub">' + esc(ej.musculo || GRUPOS[ej.grupo] || '') + ' ' + tag + '</div></div>'
    + '<div class="ex-tools">'
    + '<button class="icon" data-act="up" data-idx="' + idx + '" aria-label="Subir ' + esc(ej.nombre) + '"' + (idx === 0 ? ' disabled' : '') + '>↑</button>'
    + '<button class="icon" data-act="down" data-idx="' + idx + '" aria-label="Bajar ' + esc(ej.nombre) + '"' + (idx === d.items.length - 1 ? ' disabled' : '') + '>↓</button>'
    + '<button class="icon' + (S.confirm === 'quitar-' + idx ? ' warn' : '') + '" data-act="quitar" data-idx="' + idx + '" aria-label="Quitar ' + esc(ej.nombre) + '">' + (S.confirm === 'quitar-' + idx ? '¿Quitar?' : '✕') + '</button>'
    + '</div></div>'
    + '<div class="meta">Última: ' + esc(ult) + '<br>Sugerencia: <b>' + esc(sug) + '</b> <span class="sub">(rango ' + ej.repMin + '-' + ej.repMax + ')</span></div>'
    + '<div class="why">' + esc(o.motivo) + '</div>' + (ej.notas ? '<div class="why">· ' + esc(ej.notas) + '</div>' : '');
  for (let i = 0; i < it.n; i++) {
    const st = it.sets[i] || {};
    const done = st.reps > 0 && (ej.modo === 'kg' ? st.peso > 0 : true);
    h += '<div class="set"><div class="n">' + (i + 1) + '</div>'
      + '<div class="field"><input inputmode="decimal" enterkeyhint="next" aria-label="Peso serie ' + (i + 1) + ' de ' + esc(ej.nombre) + '" data-in="peso" data-idx="' + idx + '" data-i="' + i + '" value="' + (st.peso ?? '') + '" placeholder="' + (o.peso ? kg(o.peso) : ej.modo === 'kg' ? '–' : '0') + '"><span>' + uw + '</span></div>'
      + '<div class="field"><input inputmode="numeric" enterkeyhint="next" aria-label="' + (ej.modo === 'tiempo' ? 'Segundos' : 'Repeticiones') + ' serie ' + (i + 1) + ' de ' + esc(ej.nombre) + '" data-in="reps" data-idx="' + idx + '" data-i="' + i + '" value="' + (st.reps ?? '') + '" placeholder="' + o.reps + '"><span>' + ur + '</span></div>'
      + '<button class="chk' + (done ? ' done' : '') + '" data-act="fill" data-idx="' + idx + '" data-i="' + i + '" aria-label="Serie ' + (i + 1) + ' igual que la sugerencia">✓</button></div>';
  }
  h += '<div class="row-actions small"><button data-act="menos-serie" data-idx="' + idx + '"' + (it.n <= 1 ? ' disabled' : '') + '>− Serie</button><button data-act="mas-serie" data-idx="' + idx + '"' + (it.n >= 10 ? ' disabled' : '') + '>+ Serie</button></div>';
  h += '<details' + (it.nota ? ' open' : '') + '><summary class="sub">Nota del ejercicio</summary><input class="in" data-in="nota" data-idx="' + idx + '" value="' + esc(it.nota) + '" placeholder="p. ej. molestia lumbar, cambié de máquina…"></details></section>';
  return h;
}

export function movilidadHTML() {
  const hoy = hoyISO();
  const hecha = S.movilidad.some(m => m.fecha === hoy);
  const marcados = lsGet('entreno-mov-' + hoy) || [];
  return '<div class="sub" style="margin-bottom:6px">Unos 10 minutos, después de entrenar o cuando te venga bien.</div>'
    + MOVILIDAD.map((m, i) => '<label class="mob"><input type="checkbox" data-act="mov" data-i="' + i + '"' + (hecha || marcados.includes(i) ? ' checked' : '') + '><img class="thumb sm" src="img/ej/mov-' + i + '/0.webp" alt="" loading="lazy"><span><b style="font-weight:600">' + esc(m[0]) + '</b><br><span class="sub">' + esc(m[1]) + '</span></span></label>').join('')
    + (hecha ? '<div class="sub" style="margin-top:8px;color:var(--ok)">Movilidad de hoy hecha.</div>' : '<div class="row-actions"><button data-act="movok">Marcar movilidad como hecha</button></div>');
}

/* =================== DIÁLOGOS =================== */
const sinTildes = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
export function pickerHTML() {
  const p = S.picker;
  return '<div class="dlg-fijo"><div class="dlg-head"><h2>Añadir ejercicio</h2><button class="icon" data-act="cerrar-dlg" aria-label="Cerrar">✕</button></div>'
    + '<input type="search" class="in" id="pk-q" data-pk="q" placeholder="Buscar: remo, pecho, gemelo…" value="' + esc(p.q || '') + '" autocomplete="off">'
    + '<div class="seg wrap" role="group" aria-label="Grupo" style="margin:8px 0">' + [['', 'Todos'], ...Object.entries(GRUPOS)].map(([k, v]) => '<button data-act="pk-grupo" data-g="' + esc(k) + '" aria-pressed="' + ((p.grupo || '') === k) + '">' + esc(v) + '</button>').join('') + '</div></div>'
    + '<div id="pk-list" class="pk-list">' + pickerLista() + '</div>'
    + '<details class="crear"' + (p.crear ? ' open' : '') + '><summary>Crear ejercicio propio</summary>'
    + '<form id="f-crear-ej" class="grid2" novalidate>'
    + '<div style="grid-column:1/-1"><label class="l" for="ce-nombre">Nombre</label><input class="in" id="ce-nombre" name="nombre" maxlength="50" required placeholder="p. ej. Remo en máquina Hammer"></div>'
    + '<div><label class="l" for="ce-grupo">Grupo</label><select id="ce-grupo" name="grupo">' + Object.entries(GRUPOS).map(([k, v]) => '<option value="' + esc(k) + '">' + esc(v) + '</option>').join('') + '</select></div>'
    + '<div><label class="l" for="ce-modo">Tipo</label><select id="ce-modo" name="modo">' + Object.entries(MODO_TXT).map(([k, v]) => '<option value="' + k + '">' + v + '</option>').join('') + '</select></div>'
    + '<div><label class="l" for="ce-series">Series</label><input class="in" id="ce-series" name="series" inputmode="numeric" value="3"></div>'
    + '<div><label class="l" for="ce-inc">Subida de peso (kg)</label><input class="in" id="ce-inc" name="incremento" inputmode="decimal" value="2,5"></div>'
    + '<div><label class="l" for="ce-min">Reps mínimas</label><input class="in" id="ce-min" name="repMin" inputmode="numeric" value="8"></div>'
    + '<div><label class="l" for="ce-max">Reps máximas</label><input class="in" id="ce-max" name="repMax" inputmode="numeric" value="12"></div>'
    + '<div style="grid-column:1/-1"><button type="submit" class="btn-main">Crear y añadir</button></div></form></details>'
    + '<div class="row-actions"><button class="btn-main" data-act="cerrar-dlg">Listo</button></div>';
}
export function pickerLista() {
  const p = S.picker;
  const q = sinTildes(p.q).trim();
  const enDestino = new Set(p.modo === 'rutina' ? ((S.plantillas[p.rutina] || {}).ejercicios || []) : (getDraft() || { items: [] }).items.map(i => i.ej));
  const pasa = e => (!p.grupo || e.grupo === p.grupo) && (!q || sinTildes(e.nombre + ' ' + e.musculo + ' ' + (GRUPOS[e.grupo] || '') + ' ' + e.id).includes(q));
  const fila = e => '<button class="pk-item" data-act="pk-add" data-id="' + esc(e.id) + '"' + (enDestino.has(e.id) ? ' disabled' : '') + '>' + thumb(e) + '<span class="pk-txt"><b>' + esc(e.nombre) + '</b><span class="sub">' + esc([e.musculo, MODO_TXT[e.modo] !== 'Con peso' ? MODO_TXT[e.modo] : ''].filter(Boolean).join(' · ')) + '</span></span><span class="pk-ok">' + (enDestino.has(e.id) ? '✓ Añadido' : '+') + '</span></button>';
  const mios = misEjercicios().filter(pasa), cat = catalogoRestante().filter(pasa);
  let h = '';
  if (mios.length) h += '<div class="pk-sec">Tus ejercicios</div>' + mios.map(fila).join('');
  if (cat.length) h += '<div class="pk-sec">Catálogo</div>' + cat.map(fila).join('');
  if (!h) h = '<div class="empty">Nada con «' + esc(p.q) + '». Puedes crearlo abajo.</div>';
  return h;
}
export function detalleHTML(id) {
  const ej = ejSeguro(id);
  const fotos = ej.foto ? '<div class="fotos"><img src="' + imgUrl(ej, 0) + '" alt="' + esc(ej.nombre) + ': posición inicial"><img src="' + imgUrl(ej, 1) + '" alt="' + esc(ej.nombre) + ': posición final"></div>' : '<div class="empty">Ejercicio propio, sin fotos.</div>';
  return '<div class="dlg-head"><h2>' + esc(ej.nombre) + '</h2><button class="icon" data-act="cerrar-dlg" aria-label="Cerrar">✕</button></div>' + fotos
    + '<p class="sub">' + esc([GRUPOS[ej.grupo], ej.musculo, MODO_TXT[ej.modo]].filter(Boolean).join(' · ')) + '<br>' + ej.series + ' series de ' + ej.repMin + '-' + ej.repMax + (ej.modo === 'tiempo' ? ' s' : ' reps') + (ej.modo === 'kg' ? ' · sube ' + kg(ej.incremento) + ' kg' : '') + '</p>'
    + (ej.notas ? '<div class="note">' + esc(ej.notas) + '</div>' : '')
    + '<div class="row-actions"><button class="btn-main" data-act="cerrar-dlg">Cerrar</button></div>';
}

/* =================== ACTIVIDAD (carrera y otros deportes) =================== */
function paceTxt(km, t) { const k = toNum(km), s = parseTime(t); return (k > 0 && s > 0) ? fmtTime(s / k) : '–:––'; }
export function borradorCarrera() {
  if (S.editAct && S.editAct.tipo === 'carrera') { const c = S.carreras.find(x => x.id === S.editAct.id); if (c) return { fecha: c.fecha, km: kg(c.km), tiempo: fmtTime(c.segundos), tipo: c.tipo, sens: c.sensacion || '', nota: c.nota || '' }; }
  return { fecha: hoyISO(), km: '', tiempo: '', tipo: 'suave', sens: '', nota: '', ...(lsGet('entreno-carrera-borrador') || {}) };
}
export function borradorDeporte() {
  if (S.editAct && S.editAct.tipo === 'deporte') { const x = S.deportes.find(v => v.id === S.editAct.id); if (x) return { fecha: x.fecha, deporte: x.deporte, minutos: x.minutos ?? '', sens: x.sensacion || '', nota: x.nota || '' }; }
  return { fecha: hoyISO(), deporte: '', minutos: '', sens: '', nota: '', ...(lsGet('entreno-deporte-borrador') || {}) };
}
const sensHTML = (sel, form) => '<label class="l">Sensación (opcional)</label><div class="seg" role="group" aria-label="Sensación">' + [1, 2, 3, 4, 5].map(n => '<button type="button" data-act="sens" data-form="' + form + '" data-n="' + n + '" aria-pressed="' + (String(sel) === String(n)) + '">' + n + '</button>').join('') + '</div><div class="sub" style="margin-top:4px">1 = muy duro · 5 = me sobraba</div>';

export function vistaActividad() {
  const tab = S.editAct ? S.editAct.tipo : S.actTab;
  let h = '<div class="top"><div><h1>Actividad</h1><div class="sub">Carreras y cualquier otro deporte</div></div>' + semanaHTML() + '</div>';
  if (!S.editAct) h += '<div class="seg big" role="group" aria-label="Tipo de actividad"><button data-act="act-tab" data-t="carrera" aria-pressed="' + (tab === 'carrera') + '">🏃 Carrera</button><button data-act="act-tab" data-t="deporte" aria-pressed="' + (tab === 'deporte') + '">🎾 Otro deporte</button></div>';
  else h += '<div class="card banner edit">Editando ' + (tab === 'carrera' ? 'una carrera' : 'un deporte') + ' ya guardado. <button class="ghost" data-act="cancelar-act">Cancelar edición</button></div>';
  if (tab === 'carrera') {
    const f = borradorCarrera();
    h += '<form class="card" id="f-run" novalidate><div class="grid2"><div><label class="l" for="r-fecha">Fecha</label><input class="in" type="date" id="r-fecha" name="fecha" value="' + esc(f.fecha) + '" max="' + hoyISO() + '"></div>'
      + '<div><label class="l" for="r-tipo">Tipo</label><select id="r-tipo" name="tipo">' + Object.entries(TIPOS).map(([k, v]) => '<option value="' + k + '"' + (f.tipo === k ? ' selected' : '') + '>' + v + '</option>').join('') + '</select></div>'
      + '<div><label class="l" for="r-km">Distancia (km)</label><input class="in" id="r-km" name="km" inputmode="decimal" placeholder="5,2" value="' + esc(f.km) + '"></div>'
      + '<div><label class="l" for="r-t">Tiempo (mm:ss o h:mm:ss)</label><input class="in" id="r-t" name="tiempo" inputmode="numeric" placeholder="31:40" value="' + esc(f.tiempo) + '"></div></div>'
      + sensHTML(f.sens, 'run')
      + '<label class="l" for="r-nota">Nota (opcional)</label><input class="in" id="r-nota" name="nota" value="' + esc(f.nota) + '" placeholder="p. ej. gemelos cargados">'
      + '<div class="pace"><span class="big" id="r-pace">' + paceTxt(f.km, f.tiempo) + '</span><span class="sub">min/km</span></div>'
      + '<div style="margin-top:12px"><button class="btn-main btn-run" type="submit">' + (S.editAct ? 'Guardar cambios' : 'Guardar carrera') + '</button></div></form>';
  } else {
    const f = borradorDeporte();
    const usados = [...new Set(S.deportes.map(x => x.deporte))].filter(x => !DEPORTES.includes(x));
    const opciones = [...DEPORTES, ...usados];
    const otro = f.deporte && !opciones.includes(f.deporte) || f.otro;
    h += '<form class="card" id="f-dep" novalidate><label class="l">Deporte</label><div class="seg wrap" role="group" aria-label="Deporte">'
      + opciones.map(x => '<button type="button" data-act="dep-elegir" data-d="' + esc(x) + '" aria-pressed="' + (f.deporte === x && !f.otro) + '">' + esc(x) + '</button>').join('')
      + '<button type="button" data-act="dep-elegir" data-d="" aria-pressed="' + !!otro + '">Otro…</button></div>'
      + (otro ? '<input class="in" id="d-otro" name="deporte" maxlength="40" placeholder="¿Cuál?" value="' + esc(f.otro ? (f.deporte || '') : f.deporte) + '" style="margin-top:8px">' : '')
      + '<div class="grid2"><div><label class="l" for="d-fecha">Fecha</label><input class="in" type="date" id="d-fecha" name="fecha" value="' + esc(f.fecha) + '" max="' + hoyISO() + '"></div>'
      + '<div><label class="l" for="d-min">Duración (min)</label><input class="in" id="d-min" name="minutos" inputmode="numeric" placeholder="60" value="' + esc(f.minutos) + '"></div></div>'
      + sensHTML(f.sens, 'dep')
      + '<label class="l" for="d-nota">Nota (opcional)</label><input class="in" id="d-nota" name="nota" value="' + esc(f.nota) + '" placeholder="p. ej. partido con los de clase">'
      + '<div style="margin-top:12px"><button class="btn-main btn-dep" type="submit">' + (S.editAct ? 'Guardar cambios' : 'Guardar deporte') + '</button></div></form>';
  }
  const lista = [...S.carreras.map(c => ({ ...c, _t: 'carrera' })), ...S.deportes.map(x => ({ ...x, _t: 'deporte' }))].sort(byFecha).reverse().slice(0, 30);
  h += '<h2>Historial</h2>';
  h += lista.length ? '<div class="card"><ul class="list">' + lista.map(x => {
    const tit = x._t === 'carrera' ? '🏃 ' + kg(x.km) + ' km · ' + esc(TIPOS[x.tipo] || x.tipo) : '🎾 ' + esc(x.deporte) + (x.minutos ? ' · ' + x.minutos + ' min' : '');
    const der = x._t === 'carrera' ? '<span class="num" style="font-size:20px">' + fmtTime(x.segundos / x.km) + '</span> <span class="sub">/km</span>' : '';
    const k = (x._t === 'carrera' ? 'run-' : 'dep-') + x.id;
    return '<li><div><b style="font-weight:600">' + tit + '</b><div class="sub">' + esc(fechaRelativa(x.fecha)) + (x._t === 'carrera' ? ' · ' + fmtTime(x.segundos) : '') + (x.sensacion ? ' · sensación ' + x.sensacion + '/5' : '') + (x.nota ? ' · ' + esc(x.nota) : '') + '</div></div>'
      + '<div class="r">' + der + '<div class="botones"><button class="ghost" data-act="edit-act" data-t="' + x._t + '" data-id="' + esc(x.id) + '">Editar</button><button class="ghost" data-act="del-act" data-t="' + x._t + '" data-id="' + esc(x.id) + '">' + confirmTxt('del-' + k, 'Borrar') + '</button></div></div></li>';
  }).join('') + '</ul></div>' : '<div class="card empty">Aún no hay nada. Tu primera carrera puede ser un test: 20-30 minutos a ritmo cómodo.</div>';
  return h;
}

/* =================== PROGRESO =================== */
export function vistaProgreso() {
  let h = '<div class="top"><h1>Progreso</h1>' + semanaHTML() + '</div>';
  // semana día a día
  const hoy = parseD(hoyISO()); const lunes = new Date(hoy); lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7));
  h += '<h2>Esta semana, día a día</h2><div class="card"><ul class="list dias">';
  for (let i = 0; i < 7; i++) {
    const dt = new Date(lunes); dt.setDate(lunes.getDate() + i); const f = isoDate(dt);
    const cosas = [
      ...S.sesiones.filter(s => s.fecha === f).map(s => '<span class="chip">🏋️ ' + esc(s.nombre || 'Gimnasio') + '</span>'),
      ...S.carreras.filter(c => c.fecha === f).map(c => '<span class="chip run">🏃 ' + kg(c.km) + ' km</span>'),
      ...S.deportes.filter(x => x.fecha === f).map(x => '<span class="chip dep">🎾 ' + esc(x.deporte) + '</span>'),
      ...S.movilidad.filter(m => m.fecha === f).map(() => '<span class="chip">🧘 Movilidad</span>'),
    ];
    h += '<li' + (f === hoyISO() ? ' class="hoy"' : '') + '><span class="dia">' + esc(fechaCorta(f)) + '</span><span class="chips">' + (cosas.join('') || '<span class="sub">—</span>') + '</span></li>';
  }
  h += '</ul></div>';
  // gimnasio
  const conHist = [...new Set(S.sesiones.flatMap(s => (s.ejercicios || []).map(e => e.ejercicio)))].map(ejSeguro).filter(e => historial(S.sesiones, e.id, e.modo).length);
  h += '<h2>Gimnasio</h2>';
  if (!conHist.length) h += '<div class="card empty">Cuando termines tu primera sesión verás aquí la evolución de cada ejercicio.</div>';
  else {
    if (!S.ex || !conHist.some(e => e.id === S.ex)) S.ex = conHist[0].id;
    const ex = ejSeguro(S.ex), hh = historial(S.sesiones, S.ex, ex.modo);
    const usaPeso = hh.some(x => evalSesion(ex, x).top > 0);
    h += '<div class="card"><label class="l" for="sel-ex" style="margin-top:0">Ejercicio</label><select id="sel-ex" data-sel="ex">' + conHist.map(e => '<option value="' + esc(e.id) + '"' + (e.id === S.ex ? ' selected' : '') + '>' + esc(e.nombre) + '</option>').join('') + '</select>'
      + '<div class="sub" style="margin:10px 0 0">' + (usaPeso ? 'Peso de trabajo por sesión (kg)' : (ex.modo === 'tiempo' ? 'Mejor serie (segundos)' : 'Mejor serie (repeticiones)')) + ' · ' + hh.length + (hh.length === 1 ? ' sesión' : ' sesiones') + '</div><div class="fig" id="fig-ex"></div>'
      + '<div class="scroll"><table><thead><tr><th>Fecha</th><th class="num-c">Peso</th><th class="num-c">' + (ex.modo === 'tiempo' ? 'Segundos' : 'Reps') + '</th></tr></thead><tbody>' + hh.slice().reverse().slice(0, 8).map(x => { const ev = evalSesion(ex, x); return '<tr><td>' + esc(fechaCorta(x.fecha)) + '</td><td class="num-c">' + (ev.top ? kg(ev.top) + ' kg' : '—') + '</td><td class="num-c">' + x.sets.map(s => s.reps).join('-') + '</td></tr>'; }).join('') + '</tbody></table></div></div>';
  }
  // carreras y deportes por semana
  const semanas = []; for (let i = 9; i >= 0; i--) { const dt = new Date(); dt.setDate(dt.getDate() - 7 * i); semanas.push(isoWeek(isoDate(dt))); }
  const barras = (vals, fmt, cls) => { const mx = Math.max(...vals, 1); return '<div class="bars">' + semanas.map((w, i) => '<div class="b"><span>' + w.slice(5) + '</span><div class="t"><div class="f ' + cls + '" style="width:' + (vals[i] / mx * 100).toFixed(1) + '%"></div></div><span class="r">' + fmt(vals[i]) + '</span></div>').join('') + '</div>'; };
  h += '<h2>Running</h2>';
  if (!S.carreras.length) h += '<div class="card empty">Apunta tus carreras para ver los km por semana y cómo baja tu ritmo suave.</div>';
  else {
    const kmW = semanas.map(w => S.carreras.filter(c => isoWeek(c.fecha) === w).reduce((a, c) => a + c.km, 0));
    h += '<div class="card"><div class="sub" style="margin-bottom:6px">Km por semana (últimas 10)</div>' + barras(kmW, v => kg(+v.toFixed(1)) + ' km', '');
    const suaves = S.carreras.filter(c => c.tipo === 'suave' || c.tipo === 'larga');
    h += suaves.length >= 2 ? '<div class="sub" style="margin:16px 0 0">Ritmo de salidas suaves y largas (min/km; arriba es más rápido)</div><div class="fig" id="fig-run"></div>' : '<div class="sub" style="margin-top:12px">Con dos salidas suaves verás aquí la evolución de tu ritmo.</div>';
    h += '</div>';
  }
  if (S.deportes.length) {
    const minW = semanas.map(w => S.deportes.filter(x => isoWeek(x.fecha) === w).reduce((a, x) => a + (x.minutos || 0), 0));
    h += '<h2>Otros deportes</h2><div class="card"><div class="sub" style="margin-bottom:6px">Minutos por semana (últimas 10)</div>' + barras(minW, v => v + ' min', 'dep') + '</div>';
  }
  const ses = S.sesiones.slice().sort(byFecha).reverse().slice(0, 15);
  if (ses.length) h += '<h2>Sesiones de gimnasio</h2><div class="card"><ul class="list">' + ses.map(s => '<li><div><b style="font-weight:600">' + esc(s.nombre || (S.plantillas[s.plantilla] || {}).nombre || 'Sesión') + '</b><div class="sub">' + esc(fechaRelativa(s.fecha)) + ' · ' + (s.ejercicios || []).length + ((s.ejercicios || []).length === 1 ? ' ejercicio' : ' ejercicios') + (s.nota ? ' · ' + esc(s.nota) : '') + '</div></div><div class="r botones"><button class="ghost" data-act="edit-ses" data-id="' + esc(s.id) + '">' + confirmTxt('edit-' + s.id, 'Editar', '¿Editar? Se descarta la sesión a medias') + '</button><button class="ghost" data-act="del-ses" data-id="' + esc(s.id) + '">' + confirmTxt('ses-' + s.id, 'Borrar') + '</button></div></li>').join('') + '</ul></div>';
  return h;
}

/* =================== PLAN =================== */
export function vistaPlan() {
  let h = '<div class="top"><h1>Plan</h1>' + semanaHTML() + '</div>';
  const hoy = parseD(hoyISO()); const lunes = new Date(hoy); lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7)); const desde = isoDate(lunes);
  const semanaActual = isoWeek(hoyISO());
  const dias = Object.values(S.plan).flatMap(p => p.dias.map(d => ({ ...d, semana: p.id, notaSemana: p.nota }))).filter(d => d.fecha >= desde).sort((a, b) => a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : String(a.hora).localeCompare(String(b.hora)));
  h += '<h2>Agenda</h2>';
  if (dias.length) {
    const porSemana = {}; dias.forEach(d => { (porSemana[d.semana] = porSemana[d.semana] || []).push(d); });
    Object.entries(porSemana).forEach(([w, ds]) => {
      h += '<div class="card"><div class="sub" style="margin-bottom:4px">' + (w === semanaActual ? 'Esta semana' : 'Semana ' + esc(w.slice(6)) + ' (' + esc(fechaCorta(ds[0].fecha)) + ')') + '</div><ul class="list">' + ds.map(d => {
        const hecho = d.tipo === 'gimnasio' ? S.sesiones.some(x => x.fecha === d.fecha) : d.tipo === 'carrera' ? S.carreras.some(x => x.fecha === d.fecha) : d.tipo === 'movilidad' ? S.movilidad.some(x => x.fecha === d.fecha) : S.deportes.some(x => x.fecha === d.fecha);
        const det = d.detalle || (d.plantilla && S.plantillas[d.plantilla] ? S.plantillas[d.plantilla].nombre : d.tipo);
        const pasado = d.fecha < hoyISO();
        return '<li><div><b style="font-weight:600">' + esc(fechaRelativa(d.fecha)) + (d.hora ? ' · ' + esc(d.hora) : '') + '</b><div class="sub">' + esc(det) + '</div></div><span class="tag' + (hecho ? ' up' : '') + '">' + (hecho ? 'Hecho' : pasado ? 'No hecho' : 'Pendiente') + '</span></li>';
      }).join('') + '</ul>' + (ds[0].notaSemana ? '<div class="note" style="margin-top:10px">' + esc(ds[0].notaSemana) + '</div>' : '') + '</div>';
    });
  } else h += '<div class="card"><p style="margin:0">Sin agenda por ahora.</p><p class="sub" style="margin:6px 0 0">Se planifica el domingo por la noche, hablándolo con Claude en la revisión semanal.</p></div>';
  const rev = S.revisiones.slice().sort((a, b) => (a.semana || a.id) < (b.semana || b.id) ? 1 : -1)[0];
  h += '<h2>Última revisión de Claude</h2>';
  h += rev ? '<div class="card"><div class="sub">' + esc(rev.semana || rev.id) + '</div><div class="note" style="margin-top:8px">' + esc(rev.resumen || '') + '</div>' + (rev.ajustes ? '<div class="sub" style="margin-top:10px"><b style="color:var(--ink)">Ajustes:</b> ' + esc(rev.ajustes) + '</div>' : '') + '</div>' : '<div class="card empty">La primera revisión llegará el domingo por la noche.</div>';
  h += '<h2>Rutinas</h2>';
  Object.values(S.plantillas).forEach(t => {
    const ejs = t.ejercicios.map(ejSeguro);
    h += '<div class="card rutina"><div class="ex-head"><h3>' + esc(t.nombre) + '</h3><a class="btn sm" href="#rutina/' + encodeURIComponent(t.id) + '">Editar</a></div><div class="sub">' + ejs.length + (ejs.length === 1 ? ' ejercicio' : ' ejercicios') + '</div><div class="tira">' + ejs.map(e => '<span title="' + esc(e.nombre) + '">' + thumb(e, 'thumb sm') + '</span>').join('') + '</div><div class="sub">' + esc(ejs.map(e => e.nombre).join(' · ')) + '</div></div>';
  });
  h += '<button class="btn-add" data-act="rutina-nueva">+ Nueva rutina</button>';
  h += '<p style="margin-top:22px"><a class="btn" href="#ajustes" style="display:inline-flex;align-items:center;text-decoration:none">Ajustes y sincronización</a></p>';
  return h;
}

export function vistaRutina(id) {
  const t = S.plantillas[id];
  if (!t) return '<div class="top"><h1>Rutina</h1></div><div class="card empty">Esta rutina ya no existe.</div><a class="btn" href="#plan">← Volver a Plan</a>';
  let h = '<div class="top"><div><a class="sub" href="#plan">← Plan</a><h1>Editar rutina</h1></div></div>';
  h += '<div class="card"><label class="l" for="rut-nombre" style="margin-top:0">Nombre</label><input class="in" id="rut-nombre" data-rut="nombre" maxlength="40" value="' + esc(t.nombre) + '"></div>';
  if (!t.ejercicios.length) h += '<div class="card empty">Sin ejercicios todavía.</div>';
  t.ejercicios.forEach((exId, idx) => {
    const e = ejSeguro(exId);
    h += '<div class="card ex"><div class="ex-top"><button class="thumb-btn" data-act="detalle" data-id="' + esc(e.id) + '" aria-label="Ver fotos de ' + esc(e.nombre) + '">' + thumb(e) + '</button><div class="ex-tit"><h3>' + esc(e.nombre) + '</h3><div class="sub">' + esc(e.musculo || '') + '</div></div><div class="ex-tools">'
      + '<button class="icon" data-act="rut-up" data-idx="' + idx + '" aria-label="Subir ' + esc(e.nombre) + '"' + (idx === 0 ? ' disabled' : '') + '>↑</button>'
      + '<button class="icon" data-act="rut-down" data-idx="' + idx + '" aria-label="Bajar ' + esc(e.nombre) + '"' + (idx === t.ejercicios.length - 1 ? ' disabled' : '') + '>↓</button>'
      + '<button class="icon" data-act="rut-quitar" data-idx="' + idx + '" aria-label="Quitar ' + esc(e.nombre) + '">✕</button></div></div>'
      + '<div class="params"><label>Series<input inputmode="numeric" data-ed="series" data-ex="' + esc(e.id) + '" value="' + e.series + '"></label>'
      + '<label>' + (e.modo === 'tiempo' ? 'Seg. mín.' : 'Reps mín.') + '<input inputmode="numeric" data-ed="repMin" data-ex="' + esc(e.id) + '" value="' + e.repMin + '"></label>'
      + '<label>' + (e.modo === 'tiempo' ? 'Seg. máx.' : 'Reps máx.') + '<input inputmode="numeric" data-ed="repMax" data-ex="' + esc(e.id) + '" value="' + e.repMax + '"></label>'
      + '<label>+kg<input inputmode="decimal" data-ed="incremento" data-ex="' + esc(e.id) + '" value="' + kg(e.incremento) + '"></label></div></div>';
  });
  h += '<button class="btn-add" data-act="picker" data-modo="rutina">+ Añadir ejercicio</button>';
  h += '<p class="sub">Los cambios se guardan solos. Series, rangos y subida de peso son del ejercicio, así que valen para todas las rutinas donde aparezca.</p>';
  h += '<div class="row-actions"><a class="btn" href="#plan">Listo</a><button class="ghost danger" data-act="rutina-borrar">' + confirmTxt('rut-borrar', 'Borrar rutina', '¿Borrar la rutina? Toca otra vez') + '</button></div>';
  return h;
}

/* =================== AJUSTES =================== */
function haceCuanto(ts) {
  if (!ts) return 'nunca';
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return 'ahora mismo'; if (m < 60) return 'hace ' + m + ' min';
  const hh = Math.round(m / 60); if (hh < 24) return 'hace ' + hh + ' h';
  return 'hace ' + Math.round(hh / 24) + ' d';
}
export { haceCuanto };
export function vistaAjustes() {
  const c = store.config || {};
  const i = S.info;
  let h = '<div class="top"><div><a class="sub" href="#plan">← Plan</a><h1>Ajustes</h1><div class="sub">Conexión con tu hoja de Google</div></div></div>';
  h += '<div class="card"><div class="ex-head"><h3>Estado</h3><span class="tag' + (i.configurado && !i.error ? ' up' : ' down') + '">' + (i.configurado ? (i.error ? 'Con problemas' : 'Conectada') : 'Sin conectar') + '</span></div>'
    + '<div class="meta">Última sincronización: <b>' + esc(haceCuanto(i.ultimaSync)) + '</b>' + (i.pendientes ? ' · ' + i.pendientes + ' cambios sin subir' : '') + '</div>'
    + (i.error ? '<div class="why" style="color:var(--warn)">' + esc(i.error) + '</div>' : '')
    + '<div class="row-actions"><button data-act="sync"' + (i.configurado ? '' : ' disabled') + '>Sincronizar ahora</button></div></div>';
  h += '<form class="card" id="f-cfg" novalidate><label class="l" for="c-url" style="margin-top:0">URL del Apps Script</label><input class="in" id="c-url" data-cfg="1" name="url" type="url" placeholder="https://script.google.com/macros/s/…/exec" value="' + esc(c.url || '') + '">'
    + '<label class="l" for="c-token">Clave</label><input class="in" id="c-token" data-cfg="1" name="token" autocomplete="off" value="' + esc(c.token || '') + '">'
    + '<div class="row-actions"><button type="submit" class="btn-main" style="width:auto">Guardar y conectar</button>' + (c.url ? '<button type="button" class="ghost" data-act="desconectar">Desconectar</button>' : '') + '</div>'
    + '<p class="sub">Lo normal es no tocar esto: abre en el móvil el enlace de configuración que te pasó Claude y se rellena solo.</p></form>';
  h += '<p class="sub">Versión ' + esc(window.APP_VERSION || '') + ' · Fotos de ejercicios: free-exercise-db (dominio público)</p>';
  return h;
}

/* =================== GRÁFICAS =================== */
export function lineChart(el, pts, opts) {
  if (!el || !pts.length) return;
  const draw = () => {
    const W = el.clientWidth, H = el.clientHeight; if (!W) return;
    const L = 44, R = 14, T = 14, B = 28;
    const ys = pts.map(p => p.y), lo0 = Math.min(...ys), hi0 = Math.max(...ys);
    const padY = (hi0 - lo0) * 0.15 || (opts.pad || 2.5);
    const lo = lo0 - padY, hi = hi0 + padY;
    const X = i => L + (pts.length === 1 ? (W - L - R) / 2 : i * (W - L - R) / (pts.length - 1));
    const Y = v => opts.invert ? T + (v - lo) / (hi - lo) * (H - T - B) : H - B - (v - lo) / (hi - lo) * (H - T - B);
    const ticks = [lo0, (lo0 + hi0) / 2, hi0].filter((v, i, a) => a.indexOf(v) === i);
    let s = ticks.map(v => '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(v) + '" y2="' + Y(v) + '" stroke="#343944"/><text x="' + (L - 6) + '" y="' + (Y(v) + 4) + '" text-anchor="end" font-size="12" fill="#9aa1ad">' + opts.fmt(v) + '</text>').join('');
    const step = Math.max(1, Math.ceil(pts.length / (W < 520 ? 3 : 6)));
    pts.forEach((p, i) => { if (i % step === 0 || i === pts.length - 1) s += '<text x="' + X(i) + '" y="' + (H - 8) + '" text-anchor="middle" font-size="12" fill="#9aa1ad">' + esc(p.label) + '</text>'; });
    s += '<polyline fill="none" stroke="' + opts.color + '" stroke-width="2.5" stroke-linejoin="round" points="' + pts.map((p, i) => X(i) + ',' + Y(p.y)).join(' ') + '"/>';
    s += pts.map((p, i) => '<circle cx="' + X(i) + '" cy="' + Y(p.y) + '" r="4" fill="' + opts.color + '"><title>' + esc(p.label + ': ' + opts.fmt(p.y)) + '</title></circle>').join('');
    el.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(opts.aria) + '">' + s + '</svg>';
  };
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(draw).observe(el);
  draw();
}
export function chartsProgreso() {
  if (S.ex) {
    const ex = ejSeguro(S.ex); const hh = historial(S.sesiones, S.ex, ex.modo);
    const usaPeso = hh.some(x => evalSesion(ex, x).top > 0);
    if (hh.length) lineChart(document.getElementById('fig-ex'), hh.map(x => ({ y: usaPeso ? evalSesion(ex, x).top : Math.max(...x.sets.map(s => s.reps)), label: x.fecha.slice(8) + '/' + x.fecha.slice(5, 7) })), { color: '#ff5f45', fmt: v => usaPeso ? kg(r05(v)) : String(Math.round(v)), aria: 'Evolución de ' + ex.nombre });
  }
  const suaves = S.carreras.filter(c => c.tipo === 'suave' || c.tipo === 'larga').sort(byFecha);
  if (suaves.length >= 2) lineChart(document.getElementById('fig-run'), suaves.map(c => ({ y: c.segundos / c.km, label: c.fecha.slice(8) + '/' + c.fecha.slice(5, 7) })), { color: '#4fc3f7', invert: true, pad: 15, fmt: v => fmtTime(v), aria: 'Evolución del ritmo suave' });
}
