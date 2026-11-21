import { createStore } from './store.js';
import { opsSesion, opsBorrarSesion, opsCarrera, opsMovilidad, opsEjercicio, tiempoASeg as parseTime, segATiempo as fmtTime } from './schema.js';
import { objetivo, historial, evalSesion, r05, isoWeek, siguientePlantilla } from './logic.js';

const app = document.getElementById('app');
const toastEl = document.getElementById('toast');
const syncEl = document.getElementById('sync');
const S = { ok: false, ejercicios: [], plantillas: {}, sesiones: [], carreras: [], movilidad: [], plan: {}, revisiones: [], view: 'hoy', tpl: null, tplManual: null, ex: null, confirm: null, info: {} };
const MOVILIDAD = [
  ['Gemelo en pared, rodilla recta', '2 × 30 s por pierna'],
  ['Gemelo en pared, rodilla flexionada', '2 × 30 s por pierna'],
  ['Flexor de cadera en zancada', '2 × 30 s por lado'],
  ['Gato-camello', '10 repeticiones lentas'],
  ['Postura del niño', '45 s respirando'],
  ['Cuello: inclinación lateral suave', '20 s por lado, sin forzar'],
  ['Isquios tumbado con toalla', '30 s por pierna'],
];
const TIPOS = { suave: 'Suave', larga: 'Tirada larga', series: 'Series', test: 'Test' };

/* ---------- utilidades ---------- */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
const hoyISO = () => { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
const parseD = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const fechaCorta = s => { try { return parseD(s).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' }); } catch (e) { return s; } };
const kg = x => (x == null || isNaN(x)) ? '—' : String(+(+x).toFixed(2)).replace('.', ',');
const toNum = v => { if (v == null) return NaN; const n = parseFloat(String(v).replace(',', '.')); return isNaN(n) ? NaN : n; };
const toast = msg => { toastEl.textContent = msg; toastEl.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => toastEl.classList.remove('show'), 2200); };
const lsGet = k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
const lsSet = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
const exById = id => S.ejercicios.find(e => e.id === id);
const byFecha = (a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : (a.creado || 0) - (b.creado || 0));
const nuevoId = p => p + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const obj = ex => objetivo(ex, historial(S.sesiones, ex.id));

/* ---------- datos ---------- */
const store = createStore({
  onChange: (estado, info) => {
    Object.assign(S, estado); S.info = info; S.ok = true;
    pintarSync();
    const a = document.activeElement;
    if (a && a.dataset && (a.dataset.ed || a.dataset.cfg || (a.form && a.form.id === 'f-run') || a.dataset.in)) return; // no repintar mientras escribes
    render();
  },
});

/* ---------- indicador de sincronización ---------- */
function haceCuanto(ts) {
  if (!ts) return 'nunca';
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return 'ahora mismo';
  if (m < 60) return 'hace ' + m + ' min';
  const h = Math.round(m / 60); if (h < 24) return 'hace ' + h + ' h';
  return 'hace ' + Math.round(h / 24) + ' d';
}
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
  syncEl.title = i.error || ('Última sincronización: ' + haceCuanto(i.ultimaSync));
}

/* ---------- semana ---------- */
function semanaActual() {
  const w = isoWeek(hoyISO());
  const gym = S.sesiones.filter(s => isoWeek(s.fecha) === w);
  const run = S.carreras.filter(c => isoWeek(c.fecha) === w);
  const plan = S.plan[w];
  const meta = (plan && plan.objetivo) || 3;
  return { w, gym, run, plan, meta, hechas: gym.length + run.length };
}
function semanaHTML() {
  const s = semanaActual();
  const dots = [];
  s.gym.forEach(() => dots.push('<span class="dot on" title="Gimnasio"></span>'));
  s.run.forEach(() => dots.push('<span class="dot run" title="Carrera"></span>'));
  for (let i = s.hechas; i < s.meta; i++) dots.push('<span class="dot"></span>');
  const txt = s.hechas >= s.meta ? 'Objetivo de la semana cumplido' : s.hechas + ' de ' + s.meta + ' sesiones esta semana';
  return '<div><div class="week" aria-hidden="true">' + dots.join('') + '</div><div class="sub" style="margin-top:4px">' + txt + '</div></div>';
}

/* ---------- vista: HOY ---------- */
const draftKey = () => 'entreno-borrador-' + S.tpl;
const getDraft = () => lsGet(draftKey()) || { sets: {}, notas: {}, nota: '' };
const saveDraft = d => lsSet(draftKey(), d);

function vistaHoy() {
  const ids = Object.keys(S.plantillas).sort();
  if (!ids.length) return '<div class="top"><h1>Hoy</h1>' + semanaHTML() + '</div><div class="card empty">Tu rutina aún no está cargada. Pídele a Claude que la escriba en la hoja.</div>';
  S.tpl = (S.tplManual && S.plantillas[S.tplManual]) ? S.tplManual : siguientePlantilla(S.plantillas, S.sesiones);
  const tpl = S.plantillas[S.tpl];
  const d = getDraft();
  const s = semanaActual();
  const hoyPlan = s.plan && (s.plan.dias || []).find(x => x.fecha === hoyISO());
  let html = '<div class="top"><div><div class="sub">' + esc(fechaCorta(hoyISO())) + '</div><h1>' + esc(tpl.nombre || S.tpl) + '</h1></div>' + semanaHTML() + '</div>';
  if (!S.info.configurado) html += '<div class="card banner">La app aún no está conectada a tu hoja de Google. Lo que apuntes se guarda en el móvil y se subirá al conectarla. <a href="#ajustes">Conectar</a></div>';
  if (hoyPlan && hoyPlan.tipo === 'carrera') html += '<div class="card">Según tu plan, hoy toca correr' + (hoyPlan.detalle ? ': <b>' + esc(hoyPlan.detalle) + '</b>' : '') + '. <a href="#carrera" style="color:var(--run)">Apuntar carrera</a></div>';
  if (ids.length > 1) html += '<div class="seg" role="group" aria-label="Sesión" style="margin-bottom:12px">' + ids.map(id => '<button data-act="tpl" data-id="' + esc(id) + '" aria-pressed="' + (id === S.tpl) + '">' + esc(S.plantillas[id].nombre || id) + '</button>').join('') + '</div>';
  (tpl.ejercicios || []).forEach(exId => {
    const ex = exById(exId);
    if (!ex || ex.activo === false) return;
    const o = obj(ex);
    const sets = d.sets[exId] || [];
    const tag = o.tipo === 'up' ? '<span class="tag up">Sube</span>' : o.tipo === 'down' ? '<span class="tag down">Baja</span>' : o.tipo === 'cal' ? '<span class="tag">Calibrar</span>' : '';
    const ult = o.ultima ? o.ultima.sets.map(st => st.reps).join('-') + ' reps con ' + kg(o.ultima.peso) + ' kg' : 'sin registros aún';
    html += '<section class="card" aria-label="' + esc(ex.nombre) + '"><div class="ex-head"><h3>' + esc(ex.nombre) + '</h3>' + tag + '</div>'
      + '<div class="meta">Última: ' + esc(ult) + ' · Objetivo: <b>' + ex.series + ' × ' + o.reps + (o.peso ? ' con ' + kg(o.peso) + ' kg' : '') + '</b> <span class="sub">(rango ' + ex.repMin + '-' + ex.repMax + ')</span></div>'
      + '<div class="why">' + esc(o.motivo) + '</div>' + (ex.notas ? '<div class="why">· ' + esc(ex.notas) + '</div>' : '');
    for (let i = 0; i < ex.series; i++) {
      const st = sets[i] || {};
      const done = st.peso > 0 && st.reps > 0;
      html += '<div class="set"><div class="n">' + (i + 1) + '</div>'
        + '<div class="field"><input inputmode="decimal" aria-label="Peso serie ' + (i + 1) + '" data-in="peso" data-ex="' + esc(exId) + '" data-i="' + i + '" value="' + (st.peso ?? '') + '" placeholder="' + (o.peso ? kg(o.peso) : '–') + '"><span>kg</span></div>'
        + '<div class="field"><input inputmode="numeric" aria-label="Repeticiones serie ' + (i + 1) + '" data-in="reps" data-ex="' + esc(exId) + '" data-i="' + i + '" value="' + (st.reps ?? '') + '" placeholder="' + o.reps + '"><span>reps</span></div>'
        + '<button class="chk' + (done ? ' done' : '') + '" data-act="fill" data-ex="' + esc(exId) + '" data-i="' + i + '" aria-label="Serie ' + (i + 1) + ' igual que el objetivo">✓</button></div>';
    }
    const nota = d.notas[exId] || '';
    html += '<details style="margin-top:8px"' + (nota ? ' open' : '') + '><summary class="sub">Nota del ejercicio</summary><input class="in" data-in="nota" data-ex="' + esc(exId) + '" value="' + esc(nota) + '" placeholder="p. ej. molestia lumbar, cambié de máquina…"></details></section>';
  });
  html += '<label class="l" for="nota-ses">Nota de la sesión (opcional)</label><textarea id="nota-ses" data-in="nota-ses" placeholder="Cómo te has sentido, si algo molestó…">' + esc(d.nota) + '</textarea>';
  html += '<div style="margin-top:14px"><button class="btn-main" data-act="terminar">Terminar sesión</button></div>';
  html += '<h2>Movilidad</h2><div class="card">' + movilidadHTML() + '</div>';
  return html;
}
function movilidadHTML() {
  const hoy = hoyISO();
  const hecha = S.movilidad.some(m => m.fecha === hoy);
  const marcados = lsGet('entreno-mov-' + hoy) || [];
  const w = isoWeek(hoy), semana = S.movilidad.filter(m => isoWeek(m.fecha) === w).length;
  return '<div class="sub" style="margin-bottom:6px">Unos 10 minutos, después de entrenar o cuando te venga bien. Esta semana: ' + semana + (semana === 1 ? ' vez' : ' veces') + '.</div>'
    + MOVILIDAD.map((m, i) => '<label class="mob"><input type="checkbox" data-act="mov" data-i="' + i + '"' + (hecha || marcados.includes(i) ? ' checked' : '') + '><span><b style="font-weight:600">' + esc(m[0]) + '</b><br><span class="sub">' + esc(m[1]) + '</span></span></label>').join('')
    + (hecha ? '<div class="sub" style="margin-top:8px;color:var(--ok)">Movilidad de hoy hecha.</div>' : '<div class="row-actions"><button data-act="movok">Marcar movilidad como hecha</button></div>');
}

/* ---------- vista: CARRERA ---------- */
function paceTxt(km, t) { const k = toNum(km), s = parseTime(t); return (k > 0 && s > 0) ? fmtTime(s / k) : '–:––'; }
function vistaCarrera() {
  const f = lsGet('entreno-carrera-borrador') || { fecha: hoyISO(), km: '', tiempo: '', tipo: 'suave', sens: '' };
  let html = '<div class="top"><div><h1>Carrera</h1><div class="sub">Copia de Strava fecha, distancia y tiempo</div></div>' + semanaHTML() + '</div>';
  html += '<form class="card" id="f-run" novalidate><div class="grid2"><div><label class="l" for="r-fecha">Fecha</label><input class="in" type="date" id="r-fecha" name="fecha" value="' + esc(f.fecha) + '" max="' + hoyISO() + '"></div>'
    + '<div><label class="l" for="r-tipo">Tipo</label><select id="r-tipo" name="tipo">' + Object.entries(TIPOS).map(([k, v]) => '<option value="' + k + '"' + (f.tipo === k ? ' selected' : '') + '>' + v + '</option>').join('') + '</select></div>'
    + '<div><label class="l" for="r-km">Distancia (km)</label><input class="in" id="r-km" name="km" inputmode="decimal" placeholder="5,2" value="' + esc(f.km) + '"></div>'
    + '<div><label class="l" for="r-t">Tiempo (mm:ss o h:mm:ss)</label><input class="in" id="r-t" name="tiempo" inputmode="numeric" placeholder="31:40" value="' + esc(f.tiempo) + '"></div></div>'
    + '<label class="l">Sensación (opcional)</label><div class="seg" role="group" aria-label="Sensación">' + [1, 2, 3, 4, 5].map(n => '<button type="button" data-act="sens" data-n="' + n + '" aria-pressed="' + (String(f.sens) === String(n)) + '">' + n + '</button>').join('') + '</div>'
    + '<div class="sub" style="margin-top:4px">1 = muy duro · 5 = me sobraba</div>'
    + '<div class="pace"><span class="big" id="r-pace">' + paceTxt(f.km, f.tiempo) + '</span><span class="sub">min/km</span></div>'
    + '<div style="margin-top:12px"><button class="btn-main btn-run" type="submit">Guardar carrera</button></div></form>';
  const runs = S.carreras.slice().sort(byFecha).reverse().slice(0, 15);
  html += '<h2>Últimas carreras</h2>';
  html += runs.length ? '<div class="card"><ul class="list">' + runs.map(c => '<li><div><b style="font-weight:600">' + kg(c.km) + ' km</b> · ' + esc(TIPOS[c.tipo] || c.tipo) + '<div class="sub">' + esc(fechaCorta(c.fecha)) + (c.sensacion ? ' · sensación ' + c.sensacion + '/5' : '') + '</div></div><div class="r"><span class="num" style="font-size:20px">' + fmtTime(c.segundos / c.km) + '</span> <span class="sub">/km</span><div class="sub">' + fmtTime(c.segundos) + ' <button class="ghost" data-act="delrun" data-id="' + esc(c.id) + '">' + (S.confirm === 'run-' + c.id ? '¿Seguro?' : 'Borrar') + '</button></div></div></li>').join('') + '</ul></div>' : '<div class="card empty">Aún no hay carreras. La primera puede ser tu test: 20-30 minutos a ritmo cómodo.</div>';
  return html;
}

/* ---------- vista: PROGRESO ---------- */
function vistaProgreso() {
  let html = '<div class="top"><h1>Progreso</h1>' + semanaHTML() + '</div>';
  const conHist = S.ejercicios.filter(e => historial(S.sesiones, e.id).length);
  html += '<h2>Gimnasio</h2>';
  if (!conHist.length) html += '<div class="card empty">Cuando termines tu primera sesión verás aquí la evolución de cada ejercicio.</div>';
  else {
    if (!S.ex || !conHist.some(e => e.id === S.ex)) S.ex = conHist[0].id;
    const ex = exById(S.ex), h = historial(S.sesiones, S.ex);
    html += '<div class="card"><label class="l" for="sel-ex" style="margin-top:0">Ejercicio</label><select id="sel-ex" data-sel="ex">' + conHist.map(e => '<option value="' + esc(e.id) + '"' + (e.id === S.ex ? ' selected' : '') + '>' + esc(e.nombre) + '</option>').join('') + '</select>'
      + '<div class="sub" style="margin:10px 0 0">Peso de trabajo por sesión (kg) · ' + h.length + (h.length === 1 ? ' sesión' : ' sesiones') + '</div><div class="fig" id="fig-ex"></div>'
      + '<div class="scroll"><table><thead><tr><th>Fecha</th><th class="num-c">Peso</th><th class="num-c">Reps</th></tr></thead><tbody>' + h.slice().reverse().slice(0, 8).map(x => { const ev = evalSesion(ex, x); return '<tr><td>' + esc(fechaCorta(x.fecha)) + '</td><td class="num-c">' + kg(ev.top) + ' kg</td><td class="num-c">' + x.sets.map(s => s.reps).join('-') + '</td></tr>'; }).join('') + '</tbody></table></div></div>';
  }
  html += '<h2>Running</h2>';
  if (!S.carreras.length) html += '<div class="card empty">Apunta tus carreras para ver los km por semana y cómo baja tu ritmo suave.</div>';
  else {
    const semanas = [];
    for (let i = 9; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - 7 * i); semanas.push(isoWeek(d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()))); }
    const kmW = semanas.map(w => S.carreras.filter(c => isoWeek(c.fecha) === w).reduce((a, c) => a + c.km, 0));
    const mx = Math.max(...kmW, 1);
    html += '<div class="card"><div class="sub" style="margin-bottom:6px">Km por semana (últimas 10)</div><div class="bars">' + semanas.map((w, i) => '<div class="b"><span>' + w.slice(5) + '</span><div class="t"><div class="f" style="width:' + (kmW[i] / mx * 100).toFixed(1) + '%"></div></div><span class="r">' + kg(+kmW[i].toFixed(1)) + ' km</span></div>').join('') + '</div>';
    const suaves = S.carreras.filter(c => c.tipo === 'suave' || c.tipo === 'larga');
    html += suaves.length >= 2 ? '<div class="sub" style="margin:16px 0 0">Ritmo de salidas suaves y largas (min/km; arriba es más rápido)</div><div class="fig" id="fig-run"></div>' : '<div class="sub" style="margin-top:12px">Con dos salidas suaves verás aquí la evolución de tu ritmo.</div>';
    html += '</div>';
  }
  const ses = S.sesiones.slice().sort(byFecha).reverse().slice(0, 10);
  if (ses.length) html += '<h2>Sesiones recientes</h2><div class="card"><ul class="list">' + ses.map(s => '<li><div><b style="font-weight:600">' + esc((S.plantillas[s.plantilla] || {}).nombre || s.nombre || s.plantilla) + '</b><div class="sub">' + esc(fechaCorta(s.fecha)) + ' · ' + (s.ejercicios || []).length + ((s.ejercicios || []).length === 1 ? ' ejercicio' : ' ejercicios') + (s.nota ? ' · ' + esc(s.nota) : '') + '</div></div><button class="ghost" data-act="delses" data-id="' + esc(s.id) + '">' + (S.confirm === 'ses-' + s.id ? '¿Seguro?' : 'Borrar') + '</button></li>').join('') + '</ul></div>';
  return html;
}
function lineChart(el, pts, opts) {
  if (!el) return;
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
function chartsProgreso() {
  if (S.ex) { const ex = exById(S.ex); const h = historial(S.sesiones, S.ex); if (ex && h.length) lineChart(document.getElementById('fig-ex'), h.map(x => ({ y: evalSesion(ex, x).top, label: x.fecha.slice(8) + '/' + x.fecha.slice(5, 7) })), { color: '#ff5f45', fmt: v => kg(r05(v)), aria: 'Evolución del peso en ' + ex.nombre }); }
  const suaves = S.carreras.filter(c => c.tipo === 'suave' || c.tipo === 'larga').sort(byFecha);
  if (suaves.length >= 2) lineChart(document.getElementById('fig-run'), suaves.map(c => ({ y: c.segundos / c.km, label: c.fecha.slice(8) + '/' + c.fecha.slice(5, 7) })), { color: '#4fc3f7', invert: true, pad: 15, fmt: v => fmtTime(v), aria: 'Evolución del ritmo suave' });
}

/* ---------- vista: PLAN ---------- */
function vistaPlan() {
  const s = semanaActual();
  let html = '<div class="top"><h1>Plan</h1>' + semanaHTML() + '</div>';
  html += '<h2>Esta semana</h2>';
  if (s.plan && (s.plan.dias || []).length) {
    html += '<div class="card"><ul class="list">' + s.plan.dias.slice().sort((a, b) => a.fecha < b.fecha ? -1 : 1).map(d => {
      const hecho = d.tipo === 'gimnasio' ? S.sesiones.some(x => x.fecha === d.fecha) : d.tipo === 'carrera' ? S.carreras.some(x => x.fecha === d.fecha) : S.movilidad.some(x => x.fecha === d.fecha);
      const det = d.detalle || (d.plantilla && S.plantillas[d.plantilla] ? S.plantillas[d.plantilla].nombre : d.tipo);
      return '<li><div><b style="font-weight:600">' + esc(fechaCorta(d.fecha)) + (d.hora ? ' · ' + esc(d.hora) : '') + '</b><div class="sub">' + esc(det) + '</div></div><span class="tag' + (hecho ? ' up' : '') + '">' + (hecho ? 'Hecho' : 'Pendiente') + '</span></li>';
    }).join('') + '</ul>' + (s.plan.nota ? '<div class="note" style="margin-top:10px">' + esc(s.plan.nota) + '</div>' : '') + '</div>';
  } else html += '<div class="card"><p style="margin:0">Objetivo: <b>' + s.meta + ' sesiones</b> esta semana, cuando mejor te venga.</p><p class="sub" style="margin:6px 0 0">Claude rellenará aquí el plan día a día en la revisión semanal.</p></div>';
  const rev = S.revisiones.slice().sort((a, b) => (a.semana || a.id) < (b.semana || b.id) ? 1 : -1)[0];
  html += '<h2>Última revisión de Claude</h2>';
  html += rev ? '<div class="card"><div class="sub">' + esc(rev.semana || rev.id) + '</div><div class="note" style="margin-top:8px">' + esc(rev.resumen || '') + '</div>' + (rev.ajustes ? '<div class="sub" style="margin-top:10px"><b style="color:var(--ink)">Ajustes:</b> ' + esc(rev.ajustes) + '</div>' : '') + '</div>' : '<div class="card empty">La primera revisión llegará al final de tu primera semana.</div>';
  html += '<h2>Rutina</h2>';
  Object.keys(S.plantillas).sort().forEach(id => {
    const t = S.plantillas[id];
    html += '<div class="card"><h3>' + esc(t.nombre || id) + '</h3><div class="scroll" style="margin-top:6px"><table><thead><tr><th>Ejercicio</th><th class="num-c">Series</th><th class="num-c">Rango</th><th class="num-c">+kg</th></tr></thead><tbody>'
      + (t.ejercicios || []).map(exId => { const e = exById(exId); if (!e) return ''; return '<tr' + (e.activo === false ? ' style="opacity:.5"' : '') + '><td>' + esc(e.nombre) + (e.notas ? '<div class="sub">' + esc(e.notas) + '</div>' : '') + '</td>'
        + '<td class="num-c"><input aria-label="Series de ' + esc(e.nombre) + '" inputmode="numeric" data-ed="series" data-ex="' + esc(e.id) + '" value="' + e.series + '"></td>'
        + '<td class="num-c nowrap"><input aria-label="Mínimo de reps de ' + esc(e.nombre) + '" inputmode="numeric" data-ed="repMin" data-ex="' + esc(e.id) + '" value="' + e.repMin + '" style="width:44px">–<input aria-label="Máximo de reps de ' + esc(e.nombre) + '" inputmode="numeric" data-ed="repMax" data-ex="' + esc(e.id) + '" value="' + e.repMax + '" style="width:44px"></td>'
        + '<td class="num-c"><input aria-label="Incremento de ' + esc(e.nombre) + '" inputmode="decimal" data-ed="incremento" data-ex="' + esc(e.id) + '" value="' + kg(e.incremento) + '" style="width:52px"></td></tr>'; }).join('')
      + '</tbody></table></div></div>';
  });
  html += '<p class="sub">Los cambios en series, rango e incremento se guardan al salir de cada casilla. Para cambiar ejercicios o la rutina, pídeselo a Claude.</p>';
  html += '<p><a class="btn" href="#ajustes" style="display:inline-flex;align-items:center;text-decoration:none">Ajustes y sincronización</a></p>';
  return html;
}

/* ---------- vista: AJUSTES ---------- */
function vistaAjustes() {
  const c = store.config || {};
  const i = S.info;
  let html = '<div class="top"><div><h1>Ajustes</h1><div class="sub">Conexión con tu hoja de Google</div></div></div>';
  html += '<div class="card"><div class="ex-head"><h3>Estado</h3><span class="tag' + (i.configurado && !i.error ? ' up' : ' down') + '">' + (i.configurado ? (i.error ? 'Con problemas' : 'Conectada') : 'Sin conectar') + '</span></div>'
    + '<div class="meta">Última sincronización: <b>' + esc(haceCuanto(i.ultimaSync)) + '</b>' + (i.pendientes ? ' · ' + i.pendientes + ' cambios sin subir' : '') + '</div>'
    + (i.error ? '<div class="why" style="color:var(--warn)">' + esc(i.error) + '</div>' : '')
    + '<div class="row-actions"><button data-act="sync"' + (i.configurado ? '' : ' disabled') + '>Sincronizar ahora</button></div></div>';
  html += '<form class="card" id="f-cfg" novalidate><label class="l" for="c-url" style="margin-top:0">URL del Apps Script</label><input class="in" id="c-url" data-cfg="1" name="url" type="url" placeholder="https://script.google.com/macros/s/…/exec" value="' + esc(c.url || '') + '">'
    + '<label class="l" for="c-token">Clave</label><input class="in" id="c-token" data-cfg="1" name="token" autocomplete="off" value="' + esc(c.token || '') + '">'
    + '<div class="row-actions"><button type="submit" class="btn-main" style="width:auto">Guardar y conectar</button>' + (c.url ? '<button type="button" class="ghost" data-act="desconectar">Desconectar</button>' : '') + '</div>'
    + '<p class="sub">Lo normal es no tocar esto: abre en el móvil el enlace de configuración que te pasó Claude y se rellena solo.</p></form>';
  html += '<p class="sub">Versión ' + esc(window.APP_VERSION || '') + '</p>';
  return html;
}

/* ---------- render y rutas ---------- */
const VIEWS = { hoy: vistaHoy, carrera: vistaCarrera, progreso: vistaProgreso, plan: vistaPlan, ajustes: vistaAjustes };
function render() {
  document.querySelectorAll('#nav a').forEach(a => (a.dataset.v === S.view || (S.view === 'ajustes' && a.dataset.v === 'plan')) ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'));
  if (!S.ok) { app.innerHTML = '<div class="card empty">Cargando tu libreta…</div>'; return; }
  app.innerHTML = VIEWS[S.view]();
  if (S.view === 'progreso') chartsProgreso();
}
function route() {
  const h = location.hash.slice(1);
  if (h.startsWith('config=')) { aplicarEnlaceConfig(h.slice(7)); return; }
  S.view = VIEWS[h] ? h : 'hoy'; S.confirm = null; render(); window.scrollTo(0, 0);
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

/* ---------- eventos ---------- */
app.addEventListener('input', e => {
  const t = e.target, k = t.dataset.in;
  if (k) {
    const d = getDraft();
    if (k === 'nota-ses') d.nota = t.value;
    else if (k === 'nota') d.notas[t.dataset.ex] = t.value;
    else {
      const arr = d.sets[t.dataset.ex] = d.sets[t.dataset.ex] || []; const i = +t.dataset.i; arr[i] = arr[i] || {};
      const n = k === 'peso' ? toNum(t.value) : parseInt(t.value, 10); arr[i][k] = isNaN(n) ? null : n;
      t.closest('.set').querySelector('.chk').classList.toggle('done', arr[i].peso > 0 && arr[i].reps > 0);
    }
    saveDraft(d);
    return;
  }
  const f = t.form;
  if (f && f.id === 'f-run') { const fd = Object.fromEntries(new FormData(f)); const prev = lsGet('entreno-carrera-borrador') || {}; lsSet('entreno-carrera-borrador', { ...prev, ...fd }); document.getElementById('r-pace').textContent = paceTxt(fd.km, fd.tiempo); }
});
app.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.sel === 'ex') { S.ex = t.value; render(); return; }
  if (t.dataset.ed) editarEjercicio(t);
});
app.addEventListener('submit', e => {
  e.preventDefault();
  if (e.target.id === 'f-run') guardarCarrera();
  if (e.target.id === 'f-cfg') guardarConfig(e.target);
});
app.addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const a = b.dataset.act;
  if (a === 'tpl') { S.tplManual = b.dataset.id; render(); }
  else if (a === 'fill') rellenarSerie(b.dataset.ex, +b.dataset.i);
  else if (a === 'terminar') terminarSesion(b);
  else if (a === 'mov') { const k = 'entreno-mov-' + hoyISO(); const m = new Set(lsGet(k) || []); b.checked ? m.add(+b.dataset.i) : m.delete(+b.dataset.i); lsSet(k, [...m]); }
  else if (a === 'movok') guardarMovilidad();
  else if (a === 'sens') { const prev = lsGet('entreno-carrera-borrador') || {}; const n = prev.sens == b.dataset.n ? '' : b.dataset.n; lsSet('entreno-carrera-borrador', { ...prev, sens: n }); b.parentElement.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x.dataset.n === n)); }
  else if (a === 'delrun' || a === 'delses') borrar(a === 'delrun' ? 'run-' : 'ses-', b.dataset.id);
  else if (a === 'sync') store.sincronizar().then(ok => toast(ok ? 'Sincronizado' : 'No se pudo sincronizar'));
  else if (a === 'desconectar') store.setConfig(null).then(() => { render(); toast('Desconectada'); });
});
syncEl.addEventListener('click', () => { location.hash = '#ajustes'; });

function rellenarSerie(exId, i) {
  const ex = exById(exId), o = obj(ex), d = getDraft();
  const arr = d.sets[exId] = d.sets[exId] || [];
  const cur = arr[i] || {};
  if (cur.peso > 0 && cur.reps > 0) arr[i] = {};
  else {
    const prev = arr.slice(0, i).reverse().find(s => s && s.peso > 0);
    const peso = cur.peso > 0 ? cur.peso : (prev ? prev.peso : o.peso);
    if (!peso) { toast('Escribe el peso de esta serie'); app.querySelector('[data-in="peso"][data-ex="' + exId + '"][data-i="' + i + '"]').focus(); return; }
    arr[i] = { peso, reps: cur.reps > 0 ? cur.reps : o.reps };
  }
  saveDraft(d); render();
}
async function terminarSesion(btn) {
  const tpl = S.plantillas[S.tpl], d = getDraft();
  const ejercicios = (tpl.ejercicios || []).map(exId => {
    const ex = exById(exId); if (!ex) return null;
    const sets = (d.sets[exId] || []).filter(s => s && s.peso > 0 && s.reps > 0).map(s => ({ peso: s.peso, reps: s.reps }));
    if (!sets.length && !d.notas[exId]) return null;
    const o = obj(ex);
    return { ejercicio: exId, nombre: ex.nombre, sets, objetivo: { peso: o.peso, reps: o.reps }, nota: d.notas[exId] || '' };
  }).filter(Boolean);
  if (!ejercicios.some(x => x.sets.length)) { toast('Apunta al menos una serie'); return; }
  btn.disabled = true; btn.textContent = 'Guardando…';
  const ses = { id: nuevoId('s'), fecha: hoyISO(), plantilla: S.tpl, nombre: tpl.nombre || S.tpl, nota: d.nota || '', ejercicios, creado: Date.now() };
  saveDraft(null); S.tplManual = null;
  await store.escribir(opsSesion(ses));
  toast('Sesión guardada. ¡Buen trabajo!'); window.scrollTo(0, 0);
}
async function guardarCarrera() {
  const f = document.getElementById('f-run'), fd = Object.fromEntries(new FormData(f));
  const draft = lsGet('entreno-carrera-borrador') || {};
  const km = toNum(fd.km), seg = parseTime(fd.tiempo);
  if (!(km > 0)) { toast('Escribe la distancia en km'); f.km.focus(); return; }
  if (!(seg > 0)) { toast('Escribe el tiempo, p. ej. 31:40'); f.tiempo.focus(); return; }
  if (!fd.fecha) { toast('Elige la fecha'); return; }
  const c = { id: nuevoId('c'), fecha: fd.fecha, km: +km.toFixed(2), segundos: Math.round(seg), tipo: fd.tipo, sensacion: draft.sens ? +draft.sens : null, creado: Date.now() };
  lsSet('entreno-carrera-borrador', null);
  document.activeElement && document.activeElement.blur();
  await store.escribir(opsCarrera(c));
  toast('Carrera guardada');
}
async function guardarMovilidad() {
  await store.escribir(opsMovilidad({ id: hoyISO(), fecha: hoyISO(), creado: Date.now() }));
  toast('Movilidad apuntada');
}
async function borrar(pre, id) {
  if (S.confirm !== pre + id) { S.confirm = pre + id; render(); return; }
  S.confirm = null;
  await store.escribir(pre === 'run-' ? [{ op: 'del', hoja: 'carreras', id }] : opsBorrarSesion(id));
  toast('Borrado');
}
async function editarEjercicio(t) {
  const e = exById(t.dataset.ex), f = t.dataset.ed;
  const n = f === 'incremento' ? toNum(t.value) : parseInt(t.value, 10);
  const ok = f === 'incremento' ? n > 0 && n <= 20 : n >= 1 && n <= 30;
  if (!ok || (f === 'repMin' && n > e.repMax) || (f === 'repMax' && n < e.repMin)) { toast('Valor no válido'); t.value = f === 'incremento' ? kg(e[f]) : e[f]; return; }
  if (n === e[f]) return;
  t.blur();
  await store.escribir(opsEjercicio({ ...e, [f]: n }));
  toast('Guardado');
}
async function guardarConfig(f) {
  const fd = Object.fromEntries(new FormData(f));
  if (!/^https:\/\/script\.google(usercontent)?\.com\//.test(fd.url.trim())) { toast('La URL debe empezar por https://script.google.com/'); return; }
  document.activeElement && document.activeElement.blur();
  toast('Conectando…');
  const ok = await store.setConfig(fd);
  render();
  toast(ok ? 'Conectada' : 'No se pudo conectar: revisa la URL y la clave');
}

/* ---------- arranque ---------- */
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
      nw && nw.addEventListener('statechange', () => {
        if (nw.state === 'installed' && navigator.serviceWorker.controller) toast('Nueva versión lista: cierra y abre la app');
      });
    });
  }).catch(() => {});
}
window.__entreno = { S, store };
