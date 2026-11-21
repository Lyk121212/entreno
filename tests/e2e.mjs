// Prueba de extremo a extremo: la PWA real en Chrome (móvil simulado) contra el Code.gs real ejecutado en el simulador.
// Uso: node tests/e2e.mjs   (deja capturas en tests/out/)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { cargarGas } from './gas-mock.mjs';
import { HOJAS } from '../js/schema.js';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const OUT = path.join(ROOT, 'tests/out'); fs.mkdirSync(OUT, { recursive: true });
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
const srv = http.createServer((q, r) => {
  let p = decodeURIComponent(new URL(q.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
});
await new Promise(r => srv.listen(8765, r));
const BASE = 'http://localhost:8765/';
const URL_GAS = 'https://script.google.com/macros/s/PRUEBA/exec';
const TOKEN = 'clave-de-prueba';
const gas = cargarGas({ token: TOKEN });
let llamadas = 0, offline = false;

const fallos = []; let n = 0;
const ok = (c, msg) => { n++; if (c) console.log('  ✓ ' + msg); else { console.log('  ✗ ' + msg); fallos.push(msg); } };

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 393, height: 851 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'es-ES', timezoneId: 'Europe/Madrid', serviceWorkers: 'allow' });
await ctx.route('https://script.google.com/**', async route => {
  if (offline) return route.abort('internetdisconnected');
  llamadas++;
  const req = route.request(); const u = new URL(req.url());
  const res = req.method() === 'POST' ? gas.post(req.postData()) : gas.get(Object.fromEntries(u.searchParams));
  await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(res) });
});
const page = await ctx.newPage();
const errores = []; page.on('pageerror', e => errores.push(e.message)); page.on('console', m => { if (m.type() === 'error') errores.push(m.text()); });
const toast = async () => (await page.locator('#toast').textContent()).trim();
const shot = async nombre => page.screenshot({ path: path.join(OUT, nombre + '.png'), fullPage: false });

console.log('1. Primera apertura, sin conectar');
await page.goto(BASE);
await page.waitForSelector('h1:has-text("Full body A")');
ok(await page.locator('.banner').isVisible(), 'aviso de "sin conectar" visible');
ok((await page.locator('#sync').textContent()).includes('Sin conectar'), 'indicador muestra "Sin conectar"');
ok(await page.locator('section.card').count() === 6, 'Full body A cargada con 6 ejercicios (semilla local)');
await shot('01-hoy-sin-conectar');

console.log('2. Apuntar una sesión sin conexión con la hoja');
const prensa = page.locator('section[aria-label="Prensa de piernas"]');
await prensa.locator('[data-in="peso"]').first().fill('60');
await prensa.locator('[data-in="reps"]').first().fill('12');
await prensa.locator('.chk').nth(1).click();
await prensa.locator('.chk').nth(2).click();
ok(await prensa.locator('.chk.done').count() === 3, 'botón ✓ rellena las series con el mismo peso');
const pecho = page.locator('section[aria-label="Press de pecho en máquina"]');
await pecho.locator('.chk').first().click();
ok((await toast()).includes('Escribe el peso'), 'sin peso previo, ✓ pide el peso');
await pecho.locator('[data-in="peso"]').first().fill('35,5');
await pecho.locator('.chk').first().click();
await page.locator('#nota-ses').fill('primera sesión de prueba');
await shot('02-hoy-rellenando');
await page.locator('[data-act="terminar"]').click();
await page.waitForFunction(() => document.querySelector('#toast').textContent.includes('Sesión guardada'));
ok(true, 'sesión guardada');
await page.waitForSelector('h1:has-text("Full body B")');
ok(true, 'la siguiente sesión pasa a ser Full body B');
ok((await page.locator('#sync').textContent()).includes('sin subir'), 'indicador muestra cambios sin subir');

console.log('3. Conectar con el enlace de configuración');
const cfg = Buffer.from(JSON.stringify({ url: URL_GAS, token: TOKEN })).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
await page.goto(BASE + '#config=' + cfg);
await page.waitForFunction(() => document.querySelector('#toast').textContent.includes('Conectada'), null, { timeout: 10000 });
ok(true, 'el enlace conecta la app');
ok(!page.url().includes('config='), 'la clave no se queda en la barra de direcciones');
await page.waitForFunction(() => document.querySelector('#sync').textContent.includes('Guardado'));
ok(gas.ss.tabla('ejercicios').length === 13 && gas.ss.tabla('plantillas').length === 2, 'la hoja vacía recibe la rutina inicial');
const sesH = gas.ss.tabla('sesiones'), serH = gas.ss.tabla('series');
ok(sesH.length === 1 && sesH[0].nota === 'primera sesión de prueba', 'la sesión apuntada antes de conectar llega a la hoja');
ok(serH.filter(s => s.ejercicio === 'prensa').length === 3 && serH.find(s => s.ejercicio === 'press-pecho').peso === '35.5', 'las series llegan con sus pesos (35,5 → 35.5)');
await shot('03-ajustes-conectada');

console.log('4. Carrera');
await page.goto(BASE + '#carrera');
await page.fill('#r-km', '5,2'); await page.fill('#r-t', '31:40');
ok((await page.locator('#r-pace').textContent()) === '6:05', 'ritmo calculado en vivo (6:05 min/km)');
await page.click('[data-act="sens"][data-n="4"]');
await shot('04-carrera');
await page.click('#f-run button[type=submit]');
await page.waitForFunction(() => document.querySelector('#sync').textContent.includes('Guardado') && document.querySelectorAll('.list li').length === 1);
const car = gas.ss.tabla('carreras')[0];
ok(car && car.km === '5.2' && car.tiempo === '31:40' && car.ritmo === '6:05' && car.sensacion === '4', 'la carrera llega a la hoja con tiempo y ritmo');

console.log('5. Claude escribe el plan y una revisión en la hoja');
const hoy = await page.evaluate(() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); });
const semana = await page.evaluate(() => window.__entreno.S && null) ?? null;
const { isoWeek } = await import('../js/logic.js');
gas.ss.poner('plan_semanal', HOJAS.plan_semanal, [
  { id: 'p1', semana: isoWeek(hoy), fecha: hoy, hora: '08:00', tipo: 'gimnasio', plantilla: 'B', objetivo: '4', nota: 'Semana tranquila: prioriza técnica.' },
]);
gas.ss.poner('revisiones', HOJAS.revisiones, [{ id: '2026-W47', semana: '2026-W47', resumen: 'Buen arranque.', ajustes: 'Nada que cambiar.' }]);
await page.goto(BASE + '#plan');
await page.click('#sync'); await page.click('[data-act="sync"]');
await page.waitForFunction(() => document.querySelector('#toast').textContent.includes('Sincronizado'));
await page.goto(BASE + '#plan');
await page.waitForSelector('text=Semana tranquila');
ok(await page.locator('text=Buen arranque.').isVisible(), 'la revisión de Claude aparece en Plan');
ok((await page.locator('.week .dot').count()) === 4, 'el objetivo semanal de la hoja (4) se refleja');
await shot('05-plan');

console.log('6. Editar rango en Plan');
const inp = page.locator('input[data-ed="repMax"][data-ex="prensa"]');
await inp.fill('15'); await inp.blur();
await page.waitForFunction(() => document.querySelector('#sync').textContent.includes('Guardado') && document.querySelector('#toast').textContent.includes('Guardado'));
await page.waitForTimeout(1500);
ok(gas.ss.tabla('ejercicios').find(e => e.id === 'prensa').repMax === '15', 'el cambio de rango llega a la hoja');

console.log('7. Sin conexión');
await page.goto(BASE + '#hoy'); await page.waitForTimeout(500);
await ctx.setOffline(true); offline = true;
srv.close();
await page.reload();
await page.waitForSelector('h1:has-text("Full body B")', { timeout: 10000 });
ok(true, 'la app abre sin conexión (service worker) y conserva los datos');
await page.click('[data-act="movok"]');
await page.waitForTimeout(1200);
ok((await page.locator('#sync').textContent()).match(/sin subir/), 'sin conexión, el cambio queda pendiente');
await shot('06-offline');
const antes = gas.ss.tabla('movilidad').length;
await ctx.setOffline(false); offline = false;
await page.evaluate(() => window.dispatchEvent(new Event('online')));
await page.waitForFunction(() => document.querySelector('#sync').textContent.includes('Guardado'), null, { timeout: 10000 });
ok(gas.ss.tabla('movilidad').length === antes + 1, 'al volver la conexión, la movilidad se sube sola');

console.log('8. Progreso');
await page.goto(BASE + '#progreso').catch(() => {});
await page.evaluate(() => { location.hash = '#progreso'; });
await page.waitForSelector('#fig-ex svg');
ok(true, 'gráfica de progreso dibujada');
await shot('07-progreso');

console.log('9. Instalabilidad');
const cdp = await ctx.newCDPSession(page);
const man = await cdp.send('Page.getAppManifest');
ok(!man.errors.length, 'manifest sin errores' + (man.errors.length ? ': ' + JSON.stringify(man.errors) : ''));
const inst = await cdp.send('Page.getInstallabilityErrors');
inst.installabilityErrors = inst.installabilityErrors.filter(e => e.errorId !== 'in-incognito'); // el navegador de pruebas siempre es incógnito
ok(!inst.installabilityErrors.length, 'Chrome la considera instalable' + (inst.installabilityErrors.length ? ': ' + JSON.stringify(inst.installabilityErrors) : ''));

ok(!errores.filter(e => !/ERR_INTERNET_DISCONNECTED|Failed to load resource|net::/.test(e)).length, 'sin errores de JavaScript' + (errores.length ? ' (' + errores.join(' | ') + ')' : ''));
console.log(`\n${n - fallos.length}/${n} comprobaciones OK · ${llamadas} llamadas al Apps Script`);
await browser.close(); srv.close();
process.exit(fallos.length ? 1 : 0);
