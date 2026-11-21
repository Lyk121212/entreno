// entreno v1.1.1
// Utilidades sin estado.
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const pad = n => String(n).padStart(2, '0');
export const isoDate = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
export const hoyISO = () => isoDate(new Date());
export const parseD = s => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, m - 1, d); };
export const fechaValida = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s)) && !isNaN(parseD(s));
export function fechaCorta(s) {
  if (!fechaValida(s)) return String(s || '');
  return parseD(s).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
}
export function fechaRelativa(s) {
  if (!fechaValida(s)) return String(s || '');
  const dias = Math.round((parseD(hoyISO()) - parseD(s)) / 864e5);
  if (dias === 0) return 'Hoy, ' + fechaCorta(s);
  if (dias === 1) return 'Ayer, ' + fechaCorta(s);
  return fechaCorta(s).replace(/^./, c => c.toUpperCase());
}
export const kg = x => (x == null || x === '' || isNaN(x)) ? '—' : String(+(+x).toFixed(2)).replace('.', ',');
export const toNum = v => { if (v == null || v === '') return NaN; const n = parseFloat(String(v).replace(',', '.')); return isNaN(n) ? NaN : n; };
export const lsGet = k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
export const lsSet = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
export const nuevoId = p => p + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
export const slug = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
const toastEl = typeof document !== 'undefined' ? document.getElementById('toast') : null;
export function toast(msg) {
  if (!toastEl) return;
  toastEl.textContent = msg; toastEl.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => toastEl.classList.remove('show'), 2400);
}
