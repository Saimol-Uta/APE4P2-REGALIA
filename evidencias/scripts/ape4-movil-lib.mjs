// APE4 — Módulo Móvil (CP-055..CP-081): utilidades HTTP contra el backend REGALÍA levantado en local.
// No contiene credenciales: se leen de APE4_ADMIN_PASSWORD, APE4_DRIVER_PASSWORD y APE4_CLIENT_PASSWORD.
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export const API = process.env.APE4_API ?? 'http://127.0.0.1:3003/api/v1';
export const OUT = process.env.APE4_OUT ?? path.resolve('evidencias/json');
export const TZ = 'America/Guayaquil';
export const uuid = () => randomUUID();

/** Fecha operativa (YYYY-MM-DD) en Guayaquil con desplazamiento de días. */
export const day = (offset = 0) => {
  const d = new Date(Date.now() + offset * 86400000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
};
/** Instante ISO con offset explícito de Guayaquil (UTC-05:00). */
export const at = (date, hhmm) => `${date}T${hhmm}:00-05:00`;

/** Contexto de un caso: registra cada petición y las verificaciones del criterio de aceptación. */
export class Caso {
  constructor(id, titulo) {
    this.id = id;
    this.titulo = titulo;
    this.inicio = new Date().toISOString();
    this.peticiones = [];
    this.verificaciones = [];
    this.notas = [];
  }
  async http(method, p, { actor = 'ANÓNIMO', token, body, headers = {}, raw = false } = {}) {
    const h = { ...headers };
    if (token) h.Authorization = `Bearer ${token}`;
    if (body !== undefined) h['Content-Type'] = 'application/json';
    const t0 = performance.now();
    const res = await fetch(API + p, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
    const ms = Math.round(performance.now() - t0);
    const text = await res.text();
    let data;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    this.peticiones.push({ request: `${method} /api/v1${p}`, actor, body: redact(body), status: res.status, ms, response: raw ? data : trim(data) });
    return { status: res.status, body: data };
  }
  check(descripcion, ok, detalle) {
    this.verificaciones.push({ descripcion, ok: Boolean(ok), ...(detalle === undefined ? {} : { detalle }) });
    return Boolean(ok);
  }
  nota(texto) { this.notas.push(texto); }
  get estado() { return this.verificaciones.length && this.verificaciones.every((v) => v.ok) ? 'PASS' : 'FAIL'; }
  guardar(extra = {}) {
    mkdirSync(OUT, { recursive: true });
    const data = { caso: this.id, titulo: this.titulo, ejecutado: this.inicio, api: API, estado: this.estado, verificaciones: this.verificaciones, notas: this.notas, ...extra, peticiones: this.peticiones };
    writeFileSync(path.join(OUT, `${this.id}.json`), JSON.stringify(data, null, 2));
    return data;
  }
}

function redact(body) {
  if (!body || typeof body !== 'object') return body;
  const copy = JSON.parse(JSON.stringify(body));
  if (copy.password) copy.password = '***';
  if (copy.paymentCard) copy.paymentCard = { ...copy.paymentCard, number: '**** ' + String(copy.paymentCard.number).slice(-4), cvv: '***' };
  if (copy.quoteToken) copy.quoteToken = '<token de cotización>';
  return copy;
}
function trim(data) {
  if (data && typeof data === 'object') {
    const s = JSON.stringify(data);
    if (s.length > 6000) return { _resumen: 'respuesta recortada', _bytes: s.length, muestra: JSON.parse(JSON.stringify(data, (k, v) => (Array.isArray(v) && v.length > 5 ? [...v.slice(0, 5), `… ${v.length - 5} más`] : v))) };
    if (data.access_token) return { ...data, access_token: '<jwt>' };
    if (data.temporaryPassword) return { ...data, temporaryPassword: '***' };
  }
  return data;
}

/** Cliente sin registro de evidencia para preparar datos (fixtures). */
export const setup = new Caso('setup', 'preparación');
export async function login(email, password) {
  const r = await setup.http('POST', '/auth/login', { body: { email, password } });
  if (r.status !== 200 && r.status !== 201) throw new Error(`login ${email} -> ${r.status} ${JSON.stringify(r.body)}`);
  return r.body.access_token;
}
