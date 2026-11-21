import test from 'node:test';
import assert from 'node:assert/strict';
import { cargarGas } from './gas-mock.mjs';
import { filasAEstado, opsSesion, opsCarrera, opsBorrarSesion, aplicarOps, tiempoASeg, segATiempo, HOJAS } from '../js/schema.js';
import { objetivo, historial, isoWeek, siguientePlantilla } from '../js/logic.js';
import { SEED } from '../js/seed.js';

const ex = { id: 'prensa', series: 3, repMin: 10, repMax: 12, incremento: 5 };
const ses = (fecha, sets, nota = '') => ({ fecha, ejercicios: [{ ejercicio: 'prensa', sets: sets.map(([peso, reps]) => ({ peso, reps })), nota }] });

test('progresión: calibración sin historial', () => {
  const o = objetivo(ex, []);
  assert.equal(o.tipo, 'cal'); assert.equal(o.reps, 10);
});
test('progresión: sube peso al completar el tope del rango', () => {
  const h = historial([ses('2026-11-23', [[60, 12], [60, 12], [60, 12]])], 'prensa');
  const o = objetivo(ex, h); assert.equal(o.tipo, 'up'); assert.equal(o.peso, 65); assert.equal(o.reps, 10);
});
test('progresión: suma una repetición dentro del rango', () => {
  const o = objetivo(ex, historial([ses('2026-11-23', [[60, 11], [60, 10], [60, 10]])], 'prensa'));
  assert.equal(o.tipo, 'hold'); assert.equal(o.peso, 60); assert.equal(o.reps, 11);
});
test('progresión: baja 10 % tras dos fallos seguidos', () => {
  const o = objetivo(ex, historial([ses('2026-11-20', [[60, 8], [60, 8], [60, 7]]), ses('2026-11-23', [[60, 9], [60, 8], [60, 8]])], 'prensa'));
  assert.equal(o.tipo, 'down'); assert.equal(o.peso, 54);
});
test('progresión: con dolor no sube aunque complete el tope', () => {
  const o = objetivo(ex, historial([ses('2026-11-23', [[60, 12], [60, 12], [60, 12]], 'algo de dolor lumbar')], 'prensa'));
  assert.equal(o.tipo, 'hold'); assert.equal(o.peso, 60);
});
test('semana ISO y alternancia de plantillas', () => {
  assert.equal(isoWeek('2026-11-21'), '2026-W47');
  assert.equal(isoWeek('2027-01-01'), '2026-W53');
  const pl = { A: {}, B: {} };
  assert.equal(siguientePlantilla(pl, []), 'A');
  assert.equal(siguientePlantilla(pl, [{ fecha: '2026-11-23', plantilla: 'A' }]), 'B');
});
test('tiempos', () => {
  assert.equal(tiempoASeg('31:40'), 1900); assert.equal(tiempoASeg('1:02:03'), 3723); assert.equal(tiempoASeg('30'), 1800);
  assert.equal(segATiempo(1900), '31:40'); assert.equal(segATiempo(3723), '1:02:03');
});

test('Apps Script: token incorrecto se rechaza', () => {
  const g = cargarGas();
  assert.equal(g.get({ a: 'pull', token: 'malo' }).error, 'token');
  assert.equal(g.post({ token: 'malo', ops: [] }).error, 'token');
  assert.equal(g.post('esto no es json').ok, false);
});
test('Apps Script: crea las pestañas y devuelve vacío', () => {
  const g = cargarGas();
  const r = g.get({ a: 'pull', token: 'test-token' });
  assert.ok(r.ok); assert.deepEqual(Object.keys(r.data).sort(), Object.keys(HOJAS).sort());
  assert.equal(r.data.sesiones.length, 0);
});
test('ida y vuelta completa: sesión, carrera, borrado y edición por Claude', () => {
  const g = cargarGas();
  const T = 'test-token';
  // semilla
  g.post({ token: T, ops: [...SEED.ejercicios.map(f => ({ op: 'put', hoja: 'ejercicios', fila: f })), ...SEED.plantillas.map(f => ({ op: 'put', hoja: 'plantillas', fila: f }))] });
  const s1 = { id: 's1', fecha: '2026-11-23', plantilla: 'A', nombre: 'Full body A', nota: 'bien', creado: 1, ejercicios: [
    { ejercicio: 'prensa', nombre: 'Prensa', sets: [{ peso: 60, reps: 12 }, { peso: 60, reps: 11 }, { peso: 60, reps: 10 }], objetivo: { peso: null, reps: 10 }, nota: '' },
    { ejercicio: 'jalon', nombre: 'Jalón', sets: [], objetivo: { peso: 40, reps: 8 }, nota: 'máquina ocupada' }] };
  assert.ok(g.post({ token: T, ops: opsSesion(s1) }).ok);
  assert.ok(g.post({ token: T, ops: opsCarrera({ id: 'c1', fecha: '2026-11-24', km: 5.2, segundos: 1900, tipo: 'suave', sensacion: 4, creado: 2 }) }).ok);
  // re-guardar la misma sesión con una serie menos no deja series huérfanas
  const s1b = { ...s1, ejercicios: [{ ...s1.ejercicios[0], sets: s1.ejercicios[0].sets.slice(0, 2) }] };
  g.post({ token: T, ops: opsSesion(s1b) });
  assert.equal(g.ss.tabla('series').length, 2);
  // Claude edita la hoja a mano: cambia un rango y añade un día de plan sin id y una columna nueva
  const ej = g.ss.tabla('ejercicios');
  const cab = [...HOJAS.ejercicios, 'comentario_claude'];
  g.ss.poner('ejercicios', cab, ej.map(e => e.id === 'prensa' ? { ...e, repMax: '15', comentario_claude: 'probar 15' } : e));
  g.ss.poner('plan_semanal', HOJAS.plan_semanal, [{ semana: '2026-W48', fecha: '2026-11-23', hora: '08:00', tipo: 'gimnasio', plantilla: 'A', objetivo: '3' }]);
  const r = g.get({ a: 'pull', token: T });
  const e = filasAEstado(r.data);
  assert.equal(e.ejercicios.length, 13);
  assert.equal(e.ejercicios.find(x => x.id === 'prensa').repMax, 15);
  assert.deepEqual(e.plantillas.A.ejercicios.slice(0, 2), ['prensa', 'press-pecho']);
  assert.equal(e.sesiones.length, 1);
  assert.deepEqual(e.sesiones[0].ejercicios[0].sets, [{ peso: 60, reps: 12 }, { peso: 60, reps: 11 }]);
  assert.equal(e.carreras[0].segundos, 1900); assert.equal(e.carreras[0].km, 5.2);
  assert.equal(e.plan['2026-W48'].objetivo, 3); assert.equal(e.plan['2026-W48'].dias[0].hora, '08:00');
  // la app al actualizar un ejercicio no borra la columna que añadió Claude
  g.post({ token: T, ops: [{ op: 'put', hoja: 'ejercicios', fila: { id: 'prensa', series: 4 } }] });
  const p = g.ss.tabla('ejercicios').find(x => x.id === 'prensa');
  assert.equal(p.comentario_claude, 'probar 15'); assert.equal(p.series, '4'); assert.equal(p.repMax, '15');
  // borrar sesión borra sus series
  g.post({ token: T, ops: opsBorrarSesion('s1') });
  assert.equal(g.ss.tabla('sesiones').length, 0); assert.equal(g.ss.tabla('series').length, 0);
});
test('cola local: aplicarOps reproduce lo que hará el servidor', () => {
  const f = { sesiones: [], series: [] };
  const s = { id: 's9', fecha: '2026-11-23', plantilla: 'B', nombre: 'B', creado: 1, ejercicios: [{ ejercicio: 'hip-thrust', nombre: 'Hip', sets: [{ peso: 40, reps: 10 }], objetivo: {}, nota: '' }] };
  aplicarOps(f, opsSesion(s));
  assert.equal(filasAEstado(f).sesiones[0].ejercicios[0].sets[0].peso, 40);
  aplicarOps(f, opsBorrarSesion('s9'));
  assert.equal(filasAEstado(f).sesiones.length, 0);
});
