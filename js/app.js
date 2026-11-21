import { S, store, hooks, getEj, getDraft, setDraft, imgUrl } from './state.js';
import * as V from './vistas.js';
import * as SES from './sesion.js';
import { siguientePlantilla, isoWeek } from './logic.js';
import { opsSesion, opsBorrarSesion, opsCarrera, opsDeporte, opsMovilidad, opsBorrar, opsEjercicio, opsPlantilla, normEjercicio, MODOS, tiempoASeg, segATiempo } from './schema.js';
import { esc, toast, toNum, kg, hoyISO, lsGet, lsSet, nuevoId, slug, fechaValida } from './util.js';

const app = document.getElementById('app');
const syncEl = document.getElementById('sync');
const dlg = document.getElementById('dlg');

/* ---------- sesión en curso ---------- */
function planHoy() { const p = S.plan[isoWeek(hoyISO())]; return p ? (p.dias || []).find(x => x.fecha === hoyISO() && x.tipo === 'gimnasio') : null; }
function asegurarDraft() {
  const d = getDraft();
  // se conserva si la has tocado, elegido a mano o es una edición; un borrador sin tocar se rehace con la rutina que toca hoy
  if (d && (d.id || d.tocada || (d.manual && d.fecha === hoyISO()))) return d;
  const id = siguientePlantilla(S.plantillas, S.sesiones, planHoy(), hoyISO());
  const nuevo = id ? SES.desdePlantilla(S.plantillas[id], getEj, hoyISO()) : { ...SES.vacia(hoyISO()), manual: false };
  setDraft(nuevo);
  return nuevo;
}
const cambiar = f => { const d = f(getDraft() || asegurarDraft()); setDraft(d); return d; };

/* ---------- indicador de sincronización ---------- */
function pintarSync() {
  const i = S.info;
  let cls = 'ok', txt;
  if (!i.configurado) { cls = 'warn'; txt = i.pendientes ? i.pendientes + ' sin subir' : 'Sin conectar'; }
  else if (i.sincronizando) { cls = 'busy'; txt = 'Sincronizando…'; }
  else if (i.error) { cls = 'warn'; txt = i.pendientes ? i.pendientes + ' sin subir' : 'Sin sincronizar'; }
  else if (i.pendientes) { cls = 'busy'; txt = i.pendientes + ' sin subir'; }
  else txt = 'Guardado';
  syncEl.className = 'sync ' + cls;
  syncEl.innerHTML = '<span class="pip"></span>' + esc(txt);
  syncEl.title = i.error || ('Última sincronización: ' + V.haceCuanto(i.ultimaSync));
}

/* ---------- render y rutas ---------- */
const VIEWS = { hoy: V.vistaHoy, actividad: V.vistaActividad, progreso: V.vistaProgreso, plan: V.vistaPlan, rutina: () => V.vistaRutina(S.param), ajustes: V.vistaAjustes };
const NAV = { hoy: 'hoy', actividad: 'actividad', progreso: 'progreso', plan: 'plan', rutina: 'plan', ajustes: 'plan' };
function render() {
  document.querySelectorAll('#nav a').forEach(a => a.dataset.v === NAV[S.view] ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'));
  if (!S.ok) { app.innerHTML = '<div class="card empty">Cargando tu libreta…</div>'; return; }
  try {
    if (S.view === 'hoy') asegurarDraft();
    app.innerHTML = VIEWS[S.view]();
  } catch (e) {
    console.error(e);
    app.innerHTML = '<div class="card banner">Algo ha fallado al mostrar esta pantalla (' + esc(e.message) + '). Tus datos están a salvo. <a href="#hoy">Volver a Hoy</a></div>';
  }
  if (S.view === 'progreso') V.chartsProgreso();
  if (dlg.open) pintarDialogo();
}
function escribiendo() {
  const a = document.activeElement;
  return !!a && (app.contains(a) || dlg.contains(a)) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.type !== 'checkbox';
}
hooks.onData = () => { pintarSync(); if (!escribiendo()) render(); };

function route() {
  const h = location.hash.slice(1);
  if (h.startsWith('config=')) { aplicarEnlaceConfig(h.slice(7)); return; }
  let [v, ...rest] = decodeURIComponent(h).split('/');
  if (v === 'carrera') { v = 'actividad'; S.actTab = 'carrera'; }
  S.view = VIEWS[v] ? v : 'hoy'; S.param = rest.join('/'); S.confirm = null; S.nuevaRutina = false;
  if (dlg.open) dlg.close();
  render(); window.scrollTo(0, 0);
}
async function aplicarEnlaceConfig(b64) {
  try {
    const cfg = JSON.parse(decodeURIComponent(escape(atob(decodeURIComponent(b64).replace(/-/g, '+').replace(/_/g, '/')))));
    if (!cfg.url) throw new Error();
    history.replaceState(null, '', location.pathname + '#ajustes');
    S.view = 'ajustes'; render();
    toast('Conectando con tu hoja…');
    const ok = await store.setConfig(cfg);
    toast(ok ? 'Conectada. Ya está todo sincronizado' : 'Guardado, pero no se pudo conectar todavía');
  } catch (e) { history.replaceState(null, '', location.pathname + '#ajustes'); S.view = 'ajustes'; render(); toast('Enlace de configuración no válido'); }
}
window.addEventListener('hashchange', route);

/* ---------- diálogos ---------- */
function pintarDialogo() {
  const body = dlg.querySelector('.dlg-body');
  if (S.picker) body.innerHTML = V.pickerHTML();
  else if (S.detalle) body.innerHTML = V.detalleHTML(S.detalle);
}
function abrirDialogo() { pintarDialogo(); if (!dlg.open) dlg.showModal(); dlg.querySelector('.dlg-body').scrollTop = 0; }
dlg.addEventListener('close', () => { const habia = !!S.picker; S.picker = null; S.detalle = null; if (habia) render(); });
dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });

async function anadirDesdePicker(id) {
  const ej = getEj(id); if (!ej || !S.picker) return;
  const destino = S.picker;
  if (!ej.enHoja) await store.escribir(opsEjercicio(ej));
  if (destino.modo === 'rutina') {
    const t = S.plantillas[destino.rutina]; if (!t || t.ejercicios.includes(id)) return;
    await store.escribir(opsPlantilla({ ...t, ejercicios: [...t.ejercicios, id] }));
  } else cambiar(d => SES.anadir(d, getEj(id) || ej));
  toast('Añadido: ' + ej.nombre);
  const lista = document.getElementById('pk-list'); if (lista) lista.innerHTML = V.pickerLista();
}
async function crearEjercicio(f) {
  const fd = Object.fromEntries(new FormData(f));
  const nombre = (fd.nombre || '').trim().slice(0, 50);
  if (nombre.length < 2) { toast('Ponle un nombre al ejercicio'); f.nombre.focus(); return; }
  const modo = MODOS.includes(fd.modo) ? fd.modo : 'kg';
  const base = 'p-' + (slug(nombre) || 'ejercicio'); let id = base, k = 2;
  while (getEj(id)) id = base + '-' + k++;
  let repMin = parseInt(fd.repMin, 10), repMax = parseInt(fd.repMax, 10);
  if (!(repMin > 0)) repMin = 8;
  if (!(repMax > 0)) repMax = Math.max(12, repMin);
  if (repMin > repMax) [repMin, repMax] = [repMax, repMin];
  const series = Math.min(10, Math.max(1, parseInt(fd.series, 10) || 3));
  const inc = toNum(fd.incremento);
  const ej = normEjercicio({ id, nombre, grupo: fd.grupo, modo, series, repMin, repMax, incremento: inc >= 0 ? inc : (modo === 'kg' ? 2.5 : 0) }, id);
  await store.escribir(opsEjercicio(ej));
  S.picker.crear = false;
  await anadirDesdePicker(id);
  pintarDialogo();
}

/* ---------- eventos ---------- */
function onInput(e) {
  const t = e.target, k = t.dataset.in;
  if (t.dataset.pk === 'q' && S.picker) { S.picker.q = t.value; document.getElementById('pk-list').innerHTML = V.pickerLista(); return; }
  if (k) {
    const idx = +t.dataset.idx, i = +t.dataset.i;
    if (k === 'nota-ses') cambiar(d => SES.ponerNotaSesion(d, t.value));
    else if (k === 'nota') cambiar(d => SES.ponerNota(d, idx, t.value));
    else if (k === 'fecha') { if (fechaValida(t.value) && t.value <= hoyISO()) cambiar(d => SES.ponerFecha(d, t.value)); }
    else if (k === 'peso' || k === 'reps') {
      const n = k === 'peso' ? toNum(t.value) : parseInt(t.value, 10);
      const d = cambiar(dd => SES.ponerSet(dd, idx, i, k, isNaN(n) || n < 0 ? null : n));
      const st = d.items[idx].sets[i] || {}, ej = getEj(d.items[idx].ej) || { modo: 'kg' };
      t.closest('.set').querySelector('.chk').classList.toggle('done', st.reps > 0 && (ej.modo === 'kg' ? st.peso > 0 : true));
    }
    return;
  }
  const f = t.form;
  if (!f) return;
  const fd = Object.fromEntries(new FormData(f));
  if (f.id === 'f-run') {
    if (S.editAct) S.editBuf = { ...(S.editBuf || {}), ...fd }; else lsSet('entreno-carrera-borrador', { ...(lsGet('entreno-carrera-borrador') || {}), ...fd });
    const k2 = toNum(fd.km), s2 = tiempoASeg(fd.tiempo);
    document.getElementById('r-pace').textContent = (k2 > 0 && s2 > 0) ? segATiempo(s2 / k2) : '–:––';
  }
  if (f.id === 'f-dep') { if (S.editAct) S.editBuf = { ...(S.editBuf || {}), ...fd }; else lsSet('entreno-deporte-borrador', { ...(lsGet('entreno-deporte-borrador') || {}), ...fd }); }
}
function onChange(e) {
  const t = e.target;
  if (t.dataset.sel === 'ex') { S.ex = t.value; render(); return; }
  if (t.dataset.in === 'fecha') { if (!fechaValida(t.value) || t.value > hoyISO()) { toast('Elige un día de hoy hacia atrás'); t.value = (getDraft() || {}).fecha || hoyISO(); } else { t.blur(); render(); } return; }
  if (t.dataset.ed) editarEjercicio(t);
  if (t.dataset.rut === 'nombre') renombrarRutina(t);
}
app.addEventListener('input', onInput); dlg.addEventListener('input', onInput);
app.addEventListener('change', onChange);
app.addEventListener('submit', e => {
  e.preventDefault();
  if (e.target.id === 'f-run') guardarCarrera(e.target);
  if (e.target.id === 'f-dep') guardarDeporte(e.target);
  if (e.target.id === 'f-cfg') guardarConfig(e.target);
  if (e.target.id === 'f-nueva-rutina') guardarComoRutina(e.target);
});
dlg.addEventListener('submit', e => { if (e.target.id === 'f-crear-ej') { e.preventDefault(); crearEjercicio(e.target); } });
dlg.addEventListener('toggle', e => { if (e.target.classList && e.target.classList.contains('crear') && S.picker) S.picker.crear = e.target.open; }, true);

// acciones que piden confirmar con un segundo toque
function conConfirm(clave, accion) { if (S.confirm !== clave) { S.confirm = clave; render(); return; } S.confirm = null; accion(); }
const NEUTRAS = new Set(['mov', 'sens', 'pk-add', 'pk-grupo', 'cerrar-dlg', 'detalle', 'fill']);
function onClick(e) {
  const b = e.target.closest('[data-act]');
  if (!b || b.disabled) return;
  const a = b.dataset.act, idx = +b.dataset.idx, id = b.dataset.id;
  const pendiente = S.confirm;
  if (pendiente && !NEUTRAS.has(a)) S.confirm = null; // tocar cualquier otra cosa cancela la confirmación
  const conf = (clave, accion) => { S.confirm = pendiente; conConfirm(clave, accion); };
  switch (a) {
    case 'tpl': {
      const d = getDraft();
      if (d && d.plantilla === id && !SES.tieneDatos(d)) { render(); break; }
      const hacer = () => { const f = d ? d.fecha : hoyISO(); setDraft(id ? { ...SES.desdePlantilla(S.plantillas[id], getEj, f), manual: true } : SES.vacia(f)); S.nuevaRutina = false; render(); };
      if (d && SES.tieneDatos(d)) conf('tpl-' + id, hacer); else hacer();
      break;
    }
    case 'fill': rellenarSerie(idx, +b.dataset.i); break;
    case 'up': cambiar(d => SES.mover(d, idx, -1)); render(); break;
    case 'down': cambiar(d => SES.mover(d, idx, 1)); render(); break;
    case 'quitar': {
      const it = (getDraft() || { items: [] }).items[idx];
      const hacer = () => { cambiar(dd => SES.quitar(dd, idx)); render(); };
      if (it && (it.sets.some(s => s && s.reps > 0) || it.nota)) conf('quitar-' + idx, hacer); else hacer();
      break;
    }
    case 'mas-serie': cambiar(d => SES.masSerie(d, idx)); render(); break;
    case 'menos-serie': cambiar(d => SES.menosSerie(d, idx)); render(); break;
    case 'picker': S.picker = { modo: b.dataset.modo, rutina: S.param, q: '', grupo: '', crear: false }; S.detalle = null; abrirDialogo(); break;
    case 'pk-grupo': S.picker.grupo = b.dataset.g; pintarDialogo(); break;
    case 'pk-add': anadirDesdePicker(id); break;
    case 'detalle': S.detalle = id; S.picker = null; abrirDialogo(); break;
    case 'cerrar-dlg': dlg.close(); break;
    case 'terminar': terminarSesion(b); break;
    case 'descartar': conf('descartar', () => { setDraft(null); toast('Sesión descartada'); render(); }); break;
    case 'cancelar-edicion': setDraft(null); toast('Edición cancelada'); location.hash = '#progreso'; break;
    case 'tpl-actualizar': actualizarRutina(); break;
    case 'tpl-nueva': S.nuevaRutina = true; render(); setTimeout(() => { const i = app.querySelector('[data-in="nombre-rutina"]'); i && i.focus(); }, 30); break;
    case 'mov': { const k = 'entreno-mov-' + hoyISO(); const m = new Set(lsGet(k) || []); b.checked ? m.add(+b.dataset.i) : m.delete(+b.dataset.i); lsSet(k, [...m]); break; }
    case 'movok': guardarMovilidad(); break;
    case 'act-tab': S.actTab = b.dataset.t; render(); break;
    case 'sens': {
      const clave = b.dataset.form === 'run' ? 'entreno-carrera-borrador' : 'entreno-deporte-borrador';
      const grupo = b.parentElement.querySelectorAll('button');
      const n = b.getAttribute('aria-pressed') === 'true' ? '' : b.dataset.n;
      grupo.forEach(x => x.setAttribute('aria-pressed', x.dataset.n === n));
      if (S.editAct) S.editBuf = { ...(S.editBuf || {}), sens: n }; else lsSet(clave, { ...(lsGet(clave) || {}), sens: n });
      break;
    }
    case 'dep-elegir': {
      const val = b.dataset.d;
      const cambio = val ? { deporte: val, otro: false } : { otro: true, deporte: '' };
      if (S.editAct) S.editBuf = { ...(S.editBuf || {}), ...cambio }; else lsSet('entreno-deporte-borrador', { ...(lsGet('entreno-deporte-borrador') || {}), ...cambio });
      render();
      if (!val) setTimeout(() => { const i = document.getElementById('d-otro'); i && i.focus(); }, 30);
      break;
    }
    case 'edit-act': S.editAct = { tipo: b.dataset.t, id }; S.editBuf = null; S.actTab = b.dataset.t; render(); window.scrollTo(0, 0); break;
    case 'cancelar-act': S.editAct = null; S.editBuf = null; render(); break;
    case 'del-act': { const t = b.dataset.t; conf('del-' + (t === 'carrera' ? 'run-' : 'dep-') + id, async () => { if (S.editAct && S.editAct.id === id) { S.editAct = null; S.editBuf = null; } await store.escribir(opsBorrar(t === 'carrera' ? 'carreras' : 'deportes', id)); toast('Borrado'); }); break; }
    case 'edit-ses': editarSesion(id, conf); break;
    case 'del-ses': conf('ses-' + id, async () => { const d = getDraft(); if (d && d.id === id) setDraft(null); await store.escribir(opsBorrarSesion(id)); toast('Sesión borrada'); }); break;
    case 'rutina-nueva': nuevaRutinaVacia(); break;
    case 'rut-up': case 'rut-down': case 'rut-quitar': editarListaRutina(a, idx); break;
    case 'rutina-borrar': conf('rut-borrar', async () => { const rid = S.param; const d = getDraft(); if (d && d.plantilla === rid && !d.id && !d.tocada) setDraft(null); await store.escribir(opsBorrar('plantillas', rid)); toast('Rutina borrada'); location.hash = '#plan'; }); break;
    case 'sync': store.sincronizar().then(ok => toast(ok ? 'Sincronizado' : 'No se pudo sincronizar')); break;
    case 'desconectar': store.setConfig(null).then(() => { render(); toast('Desconectada'); }); break;
    default: if (pendiente && !S.confirm) render();
  }
}
app.addEventListener('click', onClick); dlg.addEventListener('click', onClick);
syncEl.addEventListener('click', () => { location.hash = '#ajustes'; });

/* ---------- acciones ---------- */
function rellenarSerie(idx, i) {
  const d = getDraft(); const it = d && d.items[idx]; if (!it) return;
  const ej = getEj(it.ej) || normEjercicio({}, it.ej);
  const cur = it.sets[i] || {};
  const lleno = cur.reps > 0 && (ej.modo === 'kg' ? cur.peso > 0 : true);
  if (lleno) { cambiar(dd => SES.ponerSetCompleto(dd, idx, i, {})); render(); return; }
  const card = app.querySelectorAll('section.ex')[idx];
  const campo = n => card && card.querySelector('[data-in="' + n + '"][data-i="' + i + '"]');
  const prev = it.sets.slice(0, i).reverse().find(s => s && s.reps > 0 && (s.peso > 0 || ej.modo !== 'kg'));
  let peso = cur.peso > 0 ? cur.peso : prev ? prev.peso : toNum(campo('peso') && campo('peso').placeholder);
  if (ej.modo !== 'kg' && !(peso >= 0)) peso = 0;
  const reps = cur.reps > 0 ? cur.reps : parseInt(campo('reps') && campo('reps').placeholder, 10);
  if (ej.modo === 'kg' && !(peso > 0)) { toast('Escribe el peso de esta serie'); const el = campo('peso'); el && el.focus(); return; }
  if (!(reps > 0)) { toast('Escribe las repeticiones'); return; }
  cambiar(dd => SES.ponerSetCompleto(dd, idx, i, { peso, reps }));
  render();
}
async function terminarSesion(btn) {
  const d = getDraft(); if (!d) return;
  const ses = SES.aSesion(d, getEj, S.sesiones, Date.now(), () => nuevoId('s'));
  if (!ses) { toast('Apunta al menos una serie completa'); return; }
  btn.disabled = true;
  const editando = !!d.id;
  setDraft(null); S.nuevaRutina = false;
  await store.escribir(opsSesion(ses));
  toast(editando ? 'Sesión actualizada' : 'Sesión guardada. ¡Buen trabajo!');
  if (editando) location.hash = '#progreso'; else { render(); window.scrollTo(0, 0); }
}
function editarSesion(id, conf) {
  const ses = S.sesiones.find(s => s.id === id); if (!ses) return;
  const d = getDraft();
  const hacer = () => { setDraft(SES.desdeSesion(ses, getEj)); if (location.hash === '#hoy') route(); else location.hash = '#hoy'; };
  if (d && !d.id && SES.tieneDatos(d)) conf('edit-' + id, hacer); else hacer();
}
async function actualizarRutina() {
  const d = getDraft(); const t = d && S.plantillas[d.plantilla]; if (!t) return;
  await store.escribir(opsPlantilla({ ...t, ejercicios: d.items.map(i => i.ej) }));
  toast('Rutina «' + t.nombre + '» actualizada');
}
async function guardarComoRutina(f) {
  const nombre = (new FormData(f).get('nombre') || '').trim().slice(0, 40);
  if (nombre.length < 2) { toast('Ponle un nombre a la rutina'); return; }
  const d = getDraft();
  const id = nuevoId('r');
  document.activeElement && document.activeElement.blur();
  S.nuevaRutina = false;
  setDraft({ ...d, plantilla: id, nombre });
  await store.escribir(opsPlantilla({ id, nombre, ejercicios: d.items.map(i => i.ej) }));
  toast('Rutina «' + nombre + '» guardada');
}
async function nuevaRutinaVacia() {
  const id = nuevoId('r');
  await store.escribir(opsPlantilla({ id, nombre: 'Rutina nueva', ejercicios: [] }));
  location.hash = '#rutina/' + id;
}
async function renombrarRutina(t) {
  const r = S.plantillas[S.param]; const nombre = t.value.trim().slice(0, 40);
  if (!r) return;
  if (!nombre || nombre === r.nombre) { t.value = r.nombre; return; }
  const d = getDraft(); if (d && d.plantilla === r.id && !d.id) setDraft({ ...d, nombre });
  await store.escribir(opsPlantilla({ ...r, nombre }));
  toast('Guardado');
}
async function editarListaRutina(a, idx) {
  const r = S.plantillas[S.param]; if (!r) return;
  const l = r.ejercicios.slice();
  if (a === 'rut-quitar') l.splice(idx, 1);
  else { const j = idx + (a === 'rut-up' ? -1 : 1); if (j < 0 || j >= l.length) return; [l[idx], l[j]] = [l[j], l[idx]]; }
  await store.escribir(opsPlantilla({ ...r, ejercicios: l }));
}
async function editarEjercicio(t) {
  const e = getEj(t.dataset.ex), f = t.dataset.ed; if (!e) return;
  const n = f === 'incremento' ? toNum(t.value) : parseInt(t.value, 10);
  const ok = f === 'incremento' ? n >= 0 && n <= 50 : f === 'series' ? n >= 1 && n <= 10 : n >= 1 && n <= 300;
  if (!ok || (f === 'repMin' && n > e.repMax) || (f === 'repMax' && n < e.repMin)) { toast('Valor no válido'); t.value = f === 'incremento' ? kg(e[f]) : e[f]; return; }
  if (n === e[f]) return;
  await store.escribir(opsEjercicio({ ...e, [f]: n }));
  toast('Guardado');
}
async function guardarCarrera(f) {
  const fd = Object.fromEntries(new FormData(f));
  const borr = S.editAct ? { ...V.borradorCarrera(), ...(S.editBuf || {}) } : (lsGet('entreno-carrera-borrador') || {});
  const km = toNum(fd.km), seg = tiempoASeg(fd.tiempo);
  if (!(km > 0) || km > 300) { toast('Escribe la distancia en km'); f.km.focus(); return; }
  if (!(seg > 0)) { toast('Escribe el tiempo, p. ej. 31:40'); f.tiempo.focus(); return; }
  if (!fechaValida(fd.fecha) || fd.fecha > hoyISO()) { toast('Elige una fecha de hoy hacia atrás'); return; }
  const previo = S.editAct ? S.carreras.find(c => c.id === S.editAct.id) : null;
  const c = { id: previo ? previo.id : nuevoId('c'), fecha: fd.fecha, km: +km.toFixed(2), segundos: Math.round(seg), tipo: fd.tipo, sensacion: borr.sens ? +borr.sens : null, nota: (fd.nota || '').trim(), creado: previo ? previo.creado : Date.now() };
  if (!S.editAct) lsSet('entreno-carrera-borrador', null);
  S.editAct = null; S.editBuf = null;
  document.activeElement && document.activeElement.blur();
  await store.escribir(opsCarrera(c));
  toast(previo ? 'Carrera actualizada' : 'Carrera guardada');
}
async function guardarDeporte(f) {
  const fd = Object.fromEntries(new FormData(f));
  const borr = S.editAct ? { ...V.borradorDeporte(), ...(S.editBuf || {}) } : (lsGet('entreno-deporte-borrador') || {});
  const deporte = ((fd.deporte !== undefined ? fd.deporte : borr.deporte) || '').trim();
  if (!deporte) { toast('Elige o escribe el deporte'); return; }
  const minutos = (fd.minutos || '').trim() === '' ? null : parseInt(fd.minutos, 10);
  if (minutos !== null && !(minutos > 0 && minutos <= 1440)) { toast('La duración va en minutos, p. ej. 60'); f.minutos.focus(); return; }
  if (!fechaValida(fd.fecha) || fd.fecha > hoyISO()) { toast('Elige una fecha de hoy hacia atrás'); return; }
  const previo = S.editAct ? S.deportes.find(x => x.id === S.editAct.id) : null;
  const x = { id: previo ? previo.id : nuevoId('d'), fecha: fd.fecha, deporte: deporte.slice(0, 40), minutos, sensacion: borr.sens ? +borr.sens : null, nota: (fd.nota || '').trim(), creado: previo ? previo.creado : Date.now() };
  if (!S.editAct) lsSet('entreno-deporte-borrador', null);
  S.editAct = null; S.editBuf = null;
  document.activeElement && document.activeElement.blur();
  await store.escribir(opsDeporte(x));
  toast(previo ? 'Actualizado' : x.deporte + ' guardado');
}
async function guardarMovilidad() {
  await store.escribir(opsMovilidad({ id: hoyISO(), fecha: hoyISO(), creado: Date.now() }));
  toast('Movilidad apuntada');
}
async function guardarConfig(f) {
  const fd = Object.fromEntries(new FormData(f));
  if (!/^https:\/\/script\.google(usercontent)?\.com\//.test((fd.url || '').trim())) { toast('La URL debe empezar por https://script.google.com/'); return; }
  document.activeElement && document.activeElement.blur();
  toast('Conectando…');
  const ok = await store.setConfig(fd);
  render();
  toast(ok ? 'Conectada' : 'No se pudo conectar: revisa la URL y la clave');
}

/* ---------- arranque ---------- */
try { Object.keys(localStorage).filter(k => k.startsWith('entreno-borrador-')).forEach(k => localStorage.removeItem(k)); } catch (e) {} // borradores de la v1
route();
store.cargar().then(() => store.sincronizar());
window.addEventListener('online', () => store.sincronizar());
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') store.sincronizar(); });
setInterval(() => { if (document.visibilityState === 'visible') store.sincronizar(); }, 5 * 60 * 1000);
setInterval(pintarSync, 60 * 1000);

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw.js').then(reg => {
    reg.addEventListener('updatefound', () => {
      const nw = reg.installing;
      nw && nw.addEventListener('statechange', () => { if (nw.state === 'installed' && navigator.serviceWorker.controller) toast('Nueva versión lista: cierra y abre la app'); });
    });
  }).catch(() => {});
  // precarga en segundo plano las fotos de tus rutinas, para tenerlas sin cobertura
  setTimeout(() => {
    const ids = new Set(Object.values(S.plantillas).flatMap(t => t.ejercicios));
    [...ids].map(getEj).filter(e => e && e.foto).forEach(e => [0, 1].forEach(i => fetch(imgUrl(e, i)).catch(() => {})));
    for (let i = 0; i < 7; i++) fetch('img/ej/mov-' + i + '/0.webp').catch(() => {});
  }, 4000);
}
window.__entreno = { S, store, getDraft };
