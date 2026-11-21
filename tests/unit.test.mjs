import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { cargarGas } from './gas-mock.mjs';
import { filasAEstado, opsSesion, opsCarrera, opsDeporte, opsBorrarSesion, opsPlantilla, opsEjercicio, aplicarOps, tiempoASeg, segATiempo, HOJAS, normEjercicio, CAT } from '../js/schema.js';
import { objetivo, historial, isoWeek, siguientePlantilla, serieValida, recuentoSemana } from '../js/logic.js';
import * as SES from '../js/sesion.js';
import { CATALOGO } from '../js/catalogo.js';
import { SEED } from '../js/seed.js';

const ex = { id: 'prensa', series: 3, repMin: 10, repMax: 12, incremento: 5, modo: 'kg' };
const ses = (fecha, sets, nota = '', id = 'prensa') => ({ fecha, ejercicios: [{ ejercicio: id, sets: sets.map(([peso, reps]) => ({ peso, reps })), nota }] });

/* ---------- progresión ---------- */
test('progresión kg: calibración, subir, sumar rep, bajar 10 %, dolor', () => {
  assert.equal(objetivo(ex, []).tipo, 'cal');
  let o = objetivo(ex, historial([ses('2026-11-23', [[60, 12], [60, 12], [60, 12]])], 'prensa'));
  assert.deepEqual([o.tipo, o.peso, o.reps], ['up', 65, 10]);
  o = objetivo(ex, historial([ses('2026-11-23', [[60, 11], [60, 10], [60, 10]])], 'prensa'));
  assert.deepEqual([o.tipo, o.peso, o.reps], ['hold', 60, 11]);
  o = objetivo(ex, historial([ses('2026-11-20', [[60, 8], [60, 8], [60, 7]]), ses('2026-11-23', [[60, 9], [60, 8], [60, 8]])], 'prensa'));
  assert.deepEqual([o.tipo, o.peso], ['down', 54]);
  o = objetivo(ex, historial([ses('2026-11-23', [[60, 12], [60, 12], [60, 12]], 'algo de dolor lumbar')], 'prensa'));
  assert.deepEqual([o.tipo, o.peso], ['hold', 60]);
});
test('progresión corporal y por tiempo', () => {
  const fl = { id: 'flexiones', series: 3, repMin: 8, repMax: 20, incremento: 0, modo: 'corporal' };
  assert.equal(objetivo(fl, []).peso, 0);
  let o = objetivo(fl, historial([ses('2026-11-23', [[0, 12], [0, 10], [0, 10]], '', 'flexiones')], 'flexiones', 'corporal'));
  assert.deepEqual([o.peso, o.reps, o.tipo], [0, 11, 'hold']);
  o = objetivo(fl, historial([ses('2026-11-23', [[0, 20], [0, 20], [0, 20]], '', 'flexiones')], 'flexiones', 'corporal'));
  assert.equal(o.tipo, 'up'); assert.equal(o.peso, 0); assert.match(o.motivo, /lastre|variante/);
  o = objetivo(fl, historial([ses('2026-11-20', [[0, 5], [0, 5], [0, 4]], '', 'flexiones'), ses('2026-11-23', [[0, 6], [0, 5], [0, 5]], '', 'flexiones')], 'flexiones', 'corporal'));
  assert.notEqual(o.tipo, 'down'); assert.equal(o.peso, 0);
  const pl = { id: 'plancha', series: 3, repMin: 20, repMax: 60, incremento: 0, modo: 'tiempo' };
  o = objetivo(pl, historial([ses('2026-11-23', [[0, 30], [0, 30], [0, 25]], '', 'plancha')], 'plancha', 'tiempo'));
  assert.equal(o.reps, 30); // 25 + 5 s
  assert.ok(serieValida({ peso: 0, reps: 10 }, 'corporal'));
  assert.ok(serieValida({ peso: null, reps: 10 }, 'corporal'));
  assert.ok(!serieValida({ peso: 0, reps: 10 }, 'kg'));
  assert.ok(!serieValida({ peso: 20, reps: 0 }, 'kg'));
});
test('semana ISO, rutina sugerida y plan del día', () => {
  assert.equal(isoWeek('2026-11-21'), '2026-W47');
  assert.equal(isoWeek('2027-01-01'), '2026-W53');
  assert.equal(isoWeek('2026-12-28'), '2026-W53');
  const pl = { A: { id: 'A' }, B: { id: 'B' }, C: { id: 'C' } };
  assert.equal(siguientePlantilla(pl, [], null, '2026-11-23'), 'A');
  assert.equal(siguientePlantilla(pl, [{ fecha: '2026-11-20', plantilla: 'C' }], null, '2026-11-23'), 'A');
  assert.equal(siguientePlantilla(pl, [{ fecha: '2026-11-20', plantilla: 'A' }, { fecha: '2026-11-21', plantilla: '' }], null, '2026-11-23'), 'B');
  assert.equal(siguientePlantilla(pl, [{ fecha: '2026-11-20', plantilla: 'A' }], { tipo: 'gimnasio', plantilla: 'C' }, '2026-11-23'), 'C');
  assert.equal(siguientePlantilla(pl, [{ fecha: '2026-11-23', plantilla: 'C' }], { tipo: 'gimnasio', plantilla: 'C' }, '2026-11-23'), 'A', 'si ya entrenó hoy, no repite');
  assert.equal(siguientePlantilla(pl, [], { tipo: 'gimnasio', plantilla: 'Z' }, '2026-11-23'), 'A', 'plantilla del plan inexistente');
  assert.equal(siguientePlantilla({}, [], null, '2026-11-23'), null);
});
test('recuento semanal sin objetivos', () => {
  const e = { sesiones: [{ fecha: '2026-11-23' }, { fecha: '2026-11-24' }, { fecha: '2026-11-16' }], carreras: [{ fecha: '2026-11-25', km: 5 }], deportes: [{ fecha: '2026-11-26', minutos: 60 }, { fecha: '2026-11-27', minutos: 30 }], movilidad: [] };
  assert.deepEqual(recuentoSemana(e, '2026-W48'), { gimnasio: 2, carreras: 1, deportes: 2, movilidad: 0, km: 5, minutosDeporte: 90 });
});
test('tiempos', () => {
  assert.equal(tiempoASeg('31:40'), 1900); assert.equal(tiempoASeg('1:02:03'), 3723); assert.equal(tiempoASeg('30'), 1800); assert.equal(tiempoASeg('25,5'), 1530);
  for (const malo of ['', ':', '3:', '31:75', 'abc', '1:2:3:4', '-5', '-1:30']) assert.ok(isNaN(tiempoASeg(malo)), malo);
  assert.equal(segATiempo(1900), '31:40'); assert.equal(segATiempo(3723), '1:02:03'); assert.equal(segATiempo(59.6), '1:00');
});

/* ---------- catálogo ---------- */
test('catálogo: ids únicos, campos válidos, fotos presentes y sin sentadillas', () => {
  const ids = new Set();
  for (const c of CATALOGO) {
    assert.ok(!ids.has(c.id), 'repetido ' + c.id); ids.add(c.id);
    assert.match(c.id, /^[a-z0-9-]+$/);
    assert.ok(['pierna', 'empuje', 'tirón', 'core'].includes(c.grupo), c.id);
    assert.ok(['kg', 'corporal', 'tiempo'].includes(c.modo), c.id);
    assert.ok(c.repMin <= c.repMax && c.series >= 1, c.id);
    assert.equal(c.fotos, 2, c.id);
    for (const i of [0, 1]) assert.ok(fs.statSync(new URL('../img/ej/' + c.id + '/' + i + '.webp', import.meta.url)).size > 2000, c.id + ' foto ' + i);
    assert.ok(!/sentadilla|squat/i.test(c.nombre + c.id), 'sentadilla en el catálogo: ' + c.id);
  }
  for (let i = 0; i < 7; i++) assert.ok(fs.existsSync(new URL('../img/ej/mov-' + i + '/0.webp', import.meta.url)));
  for (const r of SEED.ejercicios) assert.ok(CAT[r.id], 'la rutina inicial usa ' + r.id + ' que no está en el catálogo');
});
test('normEjercicio: la hoja manda, el catálogo rellena, valores raros se corrigen', () => {
  const e = normEjercicio({ id: 'prensa', nombre: 'Prensa', series: '4', repMin: '', modo: '' }, 'prensa');
  assert.deepEqual([e.nombre, e.series, e.repMin, e.repMax, e.modo, e.foto, e.enHoja], ['Prensa', 4, 10, 12, 'kg', 'prensa', true]);
  const p = normEjercicio({ id: 'p-x', nombre: 'Mío', repMin: '15', repMax: '8', series: '99', modo: 'raro', incremento: '-3' }, 'p-x');
  assert.deepEqual([p.repMin, p.repMax, p.series, p.modo, p.incremento, p.foto, p.propio], [8, 15, 10, 'kg', 2.5, '', true]);
  const c = normEjercicio({}, 'plancha');
  assert.deepEqual([c.modo, c.enHoja, c.foto], ['tiempo', false, 'plancha']);
  assert.equal(normEjercicio({ id: 'prensa', activo: 'FALSE' }).activo, false);
  assert.equal(normEjercicio({ id: 'prensa', activo: '' }).activo, true);
});

/* ---------- sesión en curso ---------- */
const getEj = id => CAT[id] ? normEjercicio({}, id) : (id === 'p-mio' ? normEjercicio({ id, nombre: 'Mío', modo: 'corporal' }, id) : null);
test('sesión: desde rutina, añadir, quitar, mover, series, notas', () => {
  const tpl = { id: 'A', nombre: 'Full body A', ejercicios: ['prensa', 'press-pecho', 'no-existe', 'jalon'] };
  let d = SES.desdePlantilla(tpl, getEj, '2026-11-23');
  assert.deepEqual(d.items.map(i => i.ej), ['prensa', 'press-pecho', 'jalon'], 'ignora ejercicios inexistentes');
  assert.ok(!d.tocada && !SES.tieneDatos(d) && !SES.difiereDePlantilla(d, { ...tpl, ejercicios: ['prensa', 'press-pecho', 'jalon'] }));
  d = SES.anadir(d, getEj('plancha'));
  assert.equal(d.items.length, 4); assert.ok(d.tocada);
  assert.equal(SES.anadir(d, getEj('plancha')).items.length, 4, 'no duplica');
  d = SES.mover(d, 3, -1); assert.deepEqual(d.items.map(i => i.ej), ['prensa', 'press-pecho', 'plancha', 'jalon']);
  assert.deepEqual(SES.mover(d, 0, -1).items.map(i => i.ej), d.items.map(i => i.ej), 'mover fuera de rango no hace nada');
  d = SES.quitar(d, 1); assert.deepEqual(d.items.map(i => i.ej), ['prensa', 'plancha', 'jalon']);
  d = SES.masSerie(d, 0); assert.equal(d.items[0].n, 4);
  d = SES.ponerSet(d, 0, 3, 'peso', 50); d = SES.ponerSet(d, 0, 3, 'reps', 10);
  d = SES.menosSerie(d, 0); assert.equal(d.items[0].n, 3); assert.equal(d.items[0].sets.length, 3, 'al quitar la serie se quita su dato');
  for (let k = 0; k < 20; k++) d = SES.menosSerie(d, 0);
  assert.equal(d.items[0].n, 1, 'mínimo una serie');
  for (let k = 0; k < 20; k++) d = SES.masSerie(d, 0);
  assert.equal(d.items[0].n, 10, 'máximo diez');
  d = SES.ponerNota(d, 1, 'bien'); d = SES.ponerNotaSesion(d, 'día bueno'); d = SES.ponerFecha(d, '2026-11-20');
  assert.ok(SES.tieneDatos(d)); assert.equal(d.fecha, '2026-11-20');
  assert.ok(SES.difiereDePlantilla(d, tpl));
  assert.ok(SES.valido(d)); assert.ok(!SES.valido({ v: 1 })); assert.ok(!SES.valido(null)); assert.ok(!SES.valido({ v: 2, items: [{}], fecha: 'x' }));
});
test('sesión: aSesion guarda solo series válidas y respeta el modo', () => {
  let d = SES.vacia('2026-11-23');
  d = SES.anadir(d, getEj('prensa')); d = SES.anadir(d, getEj('flexiones')); d = SES.anadir(d, getEj('jalon')); d = SES.anadir(d, getEj('p-mio'));
  assert.equal(SES.aSesion(d, getEj, []), null, 'sin series no se guarda');
  d = SES.ponerSetCompleto(d, 0, 0, { peso: 60, reps: 10 });
  d = SES.ponerSetCompleto(d, 0, 1, { peso: null, reps: 10 }); // kg sin peso: no vale
  d = SES.ponerSetCompleto(d, 1, 0, { peso: null, reps: 15 }); // corporal sin lastre: vale
  d = SES.ponerNota(d, 2, 'máquina ocupada');                    // sin series pero con nota: se guarda la nota
  const s = SES.aSesion(d, getEj, [], 1000, () => 's-1');
  assert.equal(s.id, 's-1'); assert.equal(s.plantilla, ''); assert.equal(s.nombre, 'Sesión libre');
  assert.deepEqual(s.ejercicios.map(e => [e.ejercicio, e.sets.length, e.nota]), [['prensa', 1, ''], ['flexiones', 1, ''], ['jalon', 0, 'máquina ocupada']]);
  assert.deepEqual(s.ejercicios[1].sets[0], { peso: 0, reps: 15 });
  const pasada = { id: 's-old', fecha: '2026-11-10', creado: 5, plantilla: 'A', nombre: 'Full body A', nota: '', ejercicios: [{ ejercicio: 'prensa', nombre: 'Prensa', sets: [{ peso: 70, reps: 12 }], nota: '' }] };
  const posterior = { id: 's-new', fecha: '2026-11-20', ejercicios: [{ ejercicio: 'prensa', sets: [{ peso: 100, reps: 12 }, { peso: 100, reps: 12 }, { peso: 100, reps: 12 }] }] };
  let e = SES.desdeSesion(pasada, getEj);
  assert.ok(e.tocada && e.id === 's-old');
  e = SES.ponerSetCompleto(e, 0, 0, { peso: 72.5, reps: 11 });
  const s2 = SES.aSesion(e, getEj, [pasada, posterior], 9999);
  assert.deepEqual([s2.id, s2.creado, s2.fecha], ['s-old', 5, '2026-11-10']);
  assert.equal(s2.ejercicios[0].objetivo.peso, null, 'no usa sesiones posteriores para el objetivo');
});

/* ---------- Apps Script ---------- */
test('Apps Script: token, JSON malo, pestañas creadas', () => {
  const g = cargarGas();
  assert.equal(g.get({ a: 'pull', token: 'malo' }).error, 'token');
  assert.equal(g.post({ token: 'malo', ops: [] }).error, 'token');
  assert.equal(g.post('esto no es json').ok, false);
  const r = g.get({ a: 'pull', token: 'test-token' });
  assert.ok(r.ok); assert.deepEqual(Object.keys(r.data).sort(), Object.keys(HOJAS).sort());
});
test('Apps Script: pestañas nuevas se crean solas; nombres raros se rechazan', () => {
  const g = cargarGas(); const T = 'test-token';
  assert.ok(g.post({ token: T, ops: [{ op: 'put', hoja: 'extra_x', fila: { id: 'x1', a: 'pádel', b: 60 } }] }).ok);
  const p = g.get({ a: 'pull', token: T });
  assert.equal(p.version, 3);
  assert.deepEqual(p.data.extra_x, [{ id: 'x1', a: 'pádel', b: '60' }]);
  for (const malo of ['../Hoja 1', 'Hoja1', '', 'a b', null, undefined, 5]) {
    const r = g.post({ token: T, ops: [{ op: 'put', hoja: malo, fila: { id: 'a' } }, { op: 'put', hoja: 'deportes', fila: { id: 'ok-' + String(malo), deporte: 'x' } }] });
    assert.ok(r.ok && r.aplicadas === 1 && r.ignoradas.length === 1, 'se ignora solo la mala: ' + String(malo));
  }
  assert.ok(!g.ss.getSheetByName('null') && !g.ss.getSheetByName('undefined'));
  assert.equal(g.get({ a: 'ping', token: T }).version, 3);
  let r = g.post({ token: T, ops: [{ op: 'put', hoja: 'deportes', fila: { id: 'z', 'mal campo': 1 } }, null, { op: 'raro', hoja: 'deportes' }, { op: 'put', hoja: 'deportes', fila: null }, { op: 'del', hoja: 'deportes' }] });
  assert.ok(r.ok); assert.equal(r.ignoradas.length, 4, JSON.stringify(r));
  assert.ok(!g.ss.tabla('deportes').some(x => x.id === 'z'));
});
test('ida y vuelta completa: sesión libre, deporte, rutina nueva, edición de Claude', () => {
  const g = cargarGas(); const T = 'test-token';
  g.post({ token: T, ops: [...SEED.ejercicios.map(f => ({ op: 'put', hoja: 'ejercicios', fila: f })), ...SEED.plantillas.map(f => ({ op: 'put', hoja: 'plantillas', fila: f }))] });
  const s1 = { id: 's1', fecha: '2026-11-23', plantilla: '', nombre: 'Sesión libre', nota: 'bien', creado: 1, ejercicios: [
    { ejercicio: 'prensa', nombre: 'Prensa', sets: [{ peso: 60, reps: 12 }, { peso: 60, reps: 11 }, { peso: 60, reps: 10 }], objetivo: { peso: null, reps: 10 }, nota: '' },
    { ejercicio: 'flexiones', nombre: 'Flexiones', sets: [{ peso: 0, reps: 15 }], objetivo: { peso: 0, reps: 8 }, nota: '' },
    { ejercicio: 'jalon', nombre: 'Jalón', sets: [], objetivo: { peso: 40, reps: 8 }, nota: 'máquina ocupada' }] };
  assert.ok(g.post({ token: T, ops: opsSesion(s1) }).ok);
  assert.ok(g.post({ token: T, ops: [...opsEjercicio(normEjercicio({}, 'flexiones')), ...opsPlantilla({ id: 'r-1', nombre: 'Torso', ejercicios: ['press-pecho', 'flexiones'] })] }).ok);
  assert.ok(g.post({ token: T, ops: opsDeporte({ id: 'd1', fecha: '2026-11-24', deporte: 'Pádel', minutos: 90, sensacion: 4, nota: 'con los de clase', creado: 2 }) }).ok);
  assert.ok(g.post({ token: T, ops: opsCarrera({ id: 'c1', fecha: '2026-11-25', km: 5.2, segundos: 1900, tipo: 'suave', sensacion: 4, creado: 3 }) }).ok);
  g.post({ token: T, ops: opsSesion({ ...s1, ejercicios: [{ ...s1.ejercicios[0], sets: s1.ejercicios[0].sets.slice(0, 2) }] }) });
  assert.equal(g.ss.tabla('series').length, 2, 're-guardar con menos series no deja huérfanas');
  g.post({ token: T, ops: opsSesion(s1) });
  const cab = [...HOJAS.ejercicios, 'comentario_claude'];
  g.ss.poner('ejercicios', cab, g.ss.tabla('ejercicios').map(e => e.id === 'prensa' ? { ...e, repMax: '15', comentario_claude: 'probar 15' } : e));
  g.ss.poner('plan_semanal', HOJAS.plan_semanal, [{ semana: '2026-W48', fecha: '2026-11-23', hora: '08:00', tipo: 'gimnasio', plantilla: 'r-1', nota: 'Tranqui' }]);
  g.ss.poner('plantillas', HOJAS.plantillas, [...g.ss.tabla('plantillas'), { id: 'C', nombre: 'Core', ejercicios: 'plancha; dead-bug\nno-existe' }]);
  const e = filasAEstado(g.get({ a: 'pull', token: T }).data);
  assert.equal(e.ejercicios.find(x => x.id === 'prensa').repMax, 15);
  assert.equal(e.ejercicios.find(x => x.id === 'flexiones').modo, 'corporal');
  assert.deepEqual(Object.keys(e.plantillas), ['A', 'B', 'r-1', 'C'], 'orden de la hoja');
  assert.deepEqual(e.plantillas.C.ejercicios, ['plancha', 'dead-bug', 'no-existe']);
  assert.equal(e.sesiones.length, 1);
  assert.deepEqual(e.sesiones[0].ejercicios.map(x => [x.ejercicio, x.sets.length, x.nota]), [['prensa', 3, ''], ['flexiones', 1, ''], ['jalon', 0, 'máquina ocupada']]);
  assert.deepEqual(e.sesiones[0].ejercicios[1].sets[0], { peso: 0, reps: 15 });
  assert.deepEqual(e.deportes, [{ id: 'd1', fecha: '2026-11-24', deporte: 'Pádel', minutos: 90, sensacion: 4, nota: 'con los de clase', creado: 2 }]);
  assert.equal(e.carreras[0].segundos, 1900);
  assert.equal(e.plan['2026-W48'].dias[0].plantilla, 'r-1'); assert.equal(e.plan['2026-W48'].nota, 'Tranqui');
  g.post({ token: T, ops: [{ op: 'put', hoja: 'ejercicios', fila: { id: 'prensa', series: 4 } }] });
  const p = g.ss.tabla('ejercicios').find(x => x.id === 'prensa');
  assert.equal(p.comentario_claude, 'probar 15'); assert.equal(p.series, '4');
  g.post({ token: T, ops: [...opsBorrarSesion('s1'), { op: 'del', hoja: 'deportes', id: 'd1' }, { op: 'del', hoja: 'plantillas', id: 'r-1' }] });
  assert.equal(g.ss.tabla('sesiones').length, 0); assert.equal(g.ss.tabla('series').length, 0); assert.equal(g.ss.tabla('deportes').length, 0);
  assert.equal(g.ss.tabla('plantillas').length, 3);
});
test('cola local: aplicarOps reproduce al servidor', () => {
  const f = { sesiones: [], series: [] };
  const s = { id: 's9', fecha: '2026-11-23', plantilla: 'B', nombre: 'B', creado: 1, ejercicios: [{ ejercicio: 'hip-thrust', nombre: 'Hip', sets: [{ peso: 40, reps: 10 }], objetivo: {}, nota: '' }] };
  aplicarOps(f, opsSesion(s));
  assert.equal(filasAEstado(f).sesiones[0].ejercicios[0].sets[0].peso, 40);
  aplicarOps(f, opsBorrarSesion('s9'));
  assert.equal(filasAEstado(f).sesiones.length, 0);
});
test('robustez: datos basura en la hoja no rompen la app', () => {
  const basura = () => [null, undefined, '', 0, -1, 'NaN', 'abc', '2026-13-45', {}, [], true, '1e9', '  ', '<script>'][Math.floor(Math.random() * 14)];
  for (let n = 0; n < 300; n++) {
    const d = {};
    for (const [h, cols] of Object.entries(HOJAS)) d[h] = Array.from({ length: 4 }, () => Object.fromEntries(cols.map(c => [c, basura()])));
    const e = filasAEstado(d);
    assert.ok(Array.isArray(e.sesiones) && Array.isArray(e.deportes));
    e.ejercicios.forEach(x => { assert.ok(x.repMin <= x.repMax && x.series >= 1 && x.series <= 10, JSON.stringify(x)); });
  }
  assert.doesNotThrow(() => filasAEstado(undefined));
  assert.doesNotThrow(() => filasAEstado({ series: [{ sesion: 'x', reps: 5 }] }));
});
