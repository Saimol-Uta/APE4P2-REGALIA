// APE4 — Módulo Móvil: apoyo a la sesión en teléfono físico (Android por USB, adb reverse tcp:3003).
//   node ape4-movil-telefono.mjs prep            -> crea ruta de hoy con 2 paradas (pedido ADMIN + compra Shop de CLIENT-A) asignada a DRIVER-A
//   node ape4-movil-telefono.mjs snap <etiqueta> -> guarda el estado real en backend (ruta, paradas, pedidos, seguimiento del cliente)
// El estado se acumula en evidencias/json/movil-telefono.json; las capturas del teléfono se guardan como evidencias/CP-XXX.png.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { Caso, login, day, at, uuid, OUT } from './ape4-movil-lib.mjs';

const env = (k) => { const v = process.env[k]; if (!v) throw new Error(`Falta ${k}`); return v; };
const FILE = path.join(OUT, 'movil-telefono.json');
const estado = existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf8')) : { dispositivo: 'Xiaomi M2101K6G (Android 13, API 33) por USB; API vía adb reverse tcp:3003', pasos: [] };
const c = new Caso('telefono', 'sesión en teléfono');
const admin = await login('admin@delivery.com', env('APE4_ADMIN_PASSWORD'));
const cA = await login('client1@delivery.com', env('APE4_CLIENT_PASSWORD'));
// Repartidor del teléfono: cuenta sintética creada por ADMIN (POST /drivers); su clave temporal llega por variable de entorno.
const dA = await login(env('APE4_PHONE_DRIVER_EMAIL'), env('APE4_PHONE_DRIVER_PASSWORD'));

if (process.argv[2] === 'prep') {
  const drivers = (await c.http('GET', '/drivers', { token: admin })).body;
  const A = drivers.find((d) => d.user.email.toLowerCase() === env('APE4_PHONE_DRIVER_EMAIL').toLowerCase());
  const zoneId = process.env.APE4_ZONE_ID ?? null;
  const cl = (await c.http('GET', '/admin/clients', { token: admin })).body.items.find((x) => x.email === 'client1@delivery.com');
  const prod = (await c.http('GET', '/shop/products?pageSize=24')).body.items.sort((a, b) => b.stock - a.stock)[2];
  const hoy = day(0);
  const p1 = (await c.http('POST', '/orders/admin', { token: admin, headers: { 'Idempotency-Key': uuid() }, body: {
    buyer: { type: 'REGISTERED_CLIENT', clientId: cl.id, contactPhone: '0991234567' }, payment: { method: 'CASH' },
    deliveryAddress: 'Av. Cevallos y Montalvo, Ambato (parada 1)', deliveryLat: -1.2420, deliveryLng: -78.6190,
    scheduledDeliveryDate: at(hoy, '16:45'), items: [{ productId: prod.id, quantity: 1 }] } })).body;
  const delivery = { recipient: { name: 'Ana Cliente', phone: '0991234567' }, deliveryAddress: 'Calle Bolívar y Quito, Ambato (parada 2)', deliveryLocation: { lat: -1.2385, lng: -78.6125 }, scheduledDeliveryDate: at(hoy, '16:50') };
  const items = [{ productId: prod.id, quantity: 1 }];
  const q = await c.http('POST', '/shop/checkout/quote', { token: cA, body: { items, delivery } });
  const ck = await c.http('POST', '/shop/checkout', { token: cA, headers: { 'Idempotency-Key': uuid() }, body: { items, delivery, quoteToken: q.body.quoteToken,
    paymentCard: { number: '9000 0000 0000 0001', holderName: 'PRUEBA APROBADA', expiresMonth: 12, expiresYear: 2030, cvv: '111' } } });
  const p2 = ck.body.order;
  const r = (await c.http('POST', '/routes', { token: admin, body: { zoneId, routeDate: at(hoy, '16:45'), orderIds: [p1.id, p2.id] } })).body;
  const a = await c.http('POST', `/routes/${r.id}/assign`, { token: admin, body: { driverId: A.id } });
  Object.assign(estado, { zoneId, routeId: r.id, driverId: A.id, pedidoAdmin: p1.id, pedidoShop: p2.id, numeroShop: p2.number });
  estado.pasos.push({ etiqueta: 'prep', momento: new Date().toISOString(), checkout: ck.status, ruta: r.status, asignacion: a.status });
  console.log({ checkout: ck.status, route: r.id, assign: a.status });
} else if (process.argv[2] === 'snap') {
  const r = (await c.http('GET', `/routes/${estado.routeId}`, { token: admin })).body;
  const cli = (await c.http('GET', `/shop/orders/${estado.pedidoShop}`, { token: cA })).body;
  const av = (await c.http('GET', '/drivers/me/availability', { token: dA })).body;
  const paso = {
    etiqueta: process.argv[3], momento: new Date().toISOString(),
    ruta: { status: r.status, startedAt: r.startedAt, completedAt: r.completedAt, returnedAt: r.returnedAt },
    paradas: r.stops.map((s) => ({ sequence: s.sequence, orderId: s.orderId, outcome: s.outcome, intentos: s.attempts.map((x) => ({ reason: x.reason, context: x.context, recordedAt: x.recordedAt ?? x.createdAt })) })),
    pedidos: r.orders.map((o) => ({ id: o.id, status: o.status })),
    seguimientoCliente: { status: cli.status, pendingManagement: cli.pendingManagement, timeline: (cli.timeline ?? []).map((t) => t.code) },
    disponibilidadRepartidor: av
  };
  estado.pasos.push(paso);
  console.log(JSON.stringify(paso, null, 1));
}
writeFileSync(FILE, JSON.stringify(estado, null, 2));
