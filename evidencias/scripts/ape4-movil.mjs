// APE4 — Módulo Móvil: ejecución de CP-055..CP-081 (excepto CP-075, que se ejecuta en el teléfono) contra la API local.
// Uso: APE4_ADMIN_PASSWORD=… APE4_DRIVER_PASSWORD=… APE4_CLIENT_PASSWORD=… APE4_DB=logistica_ape4_movil node evidencias/scripts/ape4-movil.mjs
// Cada caso guarda en evidencias/json/CP-XXX.json las peticiones reales, respuestas y verificaciones del criterio de aceptación.
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { Caso, setup, login, day, at, uuid, OUT } from './ape4-movil-lib.mjs';

const env = (k) => { const v = process.env[k]; if (!v) throw new Error(`Falta ${k}`); return v; };
const DB = process.env.APE4_DB ?? 'logistica_ape4_movil';
const psql = (sql) => execFileSync('docker', ['exec', 'logistica_postgres', 'psql', '-U', 'logistica_user', '-d', DB, '-tAc', sql], { encoding: 'utf8' }).trim();

const HOY = day(0), MANANA = day(1);
const CARD = { number: '9000 0000 0000 0001', holderName: 'PRUEBA APROBADA', expiresMonth: 12, expiresYear: 2030, cvv: '111' };
const PUNTOS = [[-1.2420, -78.6190], [-1.2380, -78.6120], [-1.2450, -78.6250], [-1.2500, -78.6100], [-1.2300, -78.6200]];
let punto = 0;
const sig = () => PUNTOS[punto++ % PUNTOS.length];

// ---------------------------------------------------------------- actores sintéticos
const T = {};
T.admin = await login('admin@delivery.com', env('APE4_ADMIN_PASSWORD'));
T.dA = await login('driver1@delivery.com', env('APE4_DRIVER_PASSWORD'));
T.dB = await login('driver2@delivery.com', env('APE4_DRIVER_PASSWORD'));
T.cA = await login('client1@delivery.com', env('APE4_CLIENT_PASSWORD'));
T.cB = await login('client2@delivery.com', env('APE4_CLIENT_PASSWORD'));
const drivers = (await setup.http('GET', '/drivers', { token: T.admin })).body;
const D = { A: drivers.find((d) => d.user.email === 'driver1@delivery.com'), B: drivers.find((d) => d.user.email === 'driver2@delivery.com') };
const clients = (await setup.http('GET', '/admin/clients', { token: T.admin })).body.items;
const CL = { A: clients.find((c) => c.email === 'client1@delivery.com'), B: clients.find((c) => c.email === 'client2@delivery.com') };
const productos = (await setup.http('GET', '/shop/products?pageSize=24')).body.items.sort((a, b) => b.stock - a.stock);
const P = productos[0];

/** Repartidor sintético adicional (para no mezclar causas de no disponibilidad entre casos). */
async function nuevoRepartidor(nombre) {
  const email = `ape4.${nombre.toLowerCase()}.${uuid().slice(0, 6)}@fixture.invalid`;
  const r = await setup.http('POST', '/drivers', { token: T.admin, body: { name: `APE4 ${nombre}`, email, vehicle: 'Moto APE4' } });
  if (r.status !== 201) throw new Error('crear repartidor ' + JSON.stringify(r.body));
  return { id: r.body.id, token: await login(email, r.body.temporaryPassword) };
}
async function pedidoAdmin(c, { fecha = HOY, hora = '16:00', cliente = CL.A } = {}) {
  const [lat, lng] = sig();
  const r = await (c ?? setup).http('POST', '/orders/admin', {
    actor: 'ADMIN', token: T.admin, headers: { 'Idempotency-Key': uuid() },
    body: { buyer: { type: 'REGISTERED_CLIENT', clientId: cliente.id, contactPhone: '0991234567' }, payment: { method: 'CASH' },
      deliveryAddress: `Pedido sintético APE4 ${hora}`, deliveryLat: lat, deliveryLng: lng, scheduledDeliveryDate: at(fecha, hora), items: [{ productId: P.id, quantity: 1 }] },
  });
  if (r.status !== 201) throw new Error('pedido admin ' + JSON.stringify(r.body));
  return r.body;
}
async function compraShop(c, { fecha = HOY, hora = '15:00', token = T.cA, producto = P, cantidad = 1 } = {}) {
  const [lat, lng] = sig();
  const delivery = { recipient: { name: 'Ana Cliente', phone: '0991234567' }, deliveryAddress: 'Compra Shop APE4, Ambato', deliveryLocation: { lat, lng }, scheduledDeliveryDate: at(fecha, hora) };
  const items = [{ productId: producto.id, quantity: cantidad }];
  const q = await c.http('POST', '/shop/checkout/quote', { actor: 'CLIENT-A', token, body: { items, delivery } });
  const quoteToken = q.body?.quoteToken ?? q.body?.token;
  const r = await c.http('POST', '/shop/checkout', { actor: 'CLIENT-A', token, headers: { 'Idempotency-Key': uuid() }, body: { items, delivery, paymentCard: CARD, quoteToken } });
  return { quote: q, checkout: r };
}
const crearRuta = (c, orderIds, hora = '16:00', fecha = HOY) => c.http('POST', '/routes', { actor: 'ADMIN', token: T.admin, body: { routeDate: at(fecha, hora), orderIds } });
const asignar = (c, routeId, driverId) => c.http('POST', `/routes/${routeId}/assign`, { actor: 'ADMIN', token: T.admin, body: { driverId } });
const detalle = async (c, routeId) => (await c.http('GET', `/routes/${routeId}`, { actor: 'ADMIN', token: T.admin })).body;
const pedido = async (c, id) => (await c.http('GET', `/orders/${id}`, { actor: 'ADMIN', token: T.admin })).body;
const intervenir = (c, body, token = T.admin, actor = 'ADMIN') => c.http('POST', '/dispatch/interventions', { actor, token, body: { requestId: uuid(), reason: 'Gestión APE4 móvil', ...body } });
const estadoRuta = (r) => ({ status: r.status, driverId: r.driverId, startedAt: r.startedAt, completedAt: r.completedAt, returnedAt: r.returnedAt, stops: (r.stops ?? []).map((s) => ({ id: s.id, orderId: s.orderId, sequence: s.sequence, outcome: s.outcome, attempts: (s.attempts ?? []).length })) });
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const resultados = [];
const fin = (c, extra) => { const d = c.guardar(extra); resultados.push({ caso: c.id, estado: d.estado, fallidas: d.verificaciones.filter((v) => !v.ok).map((v) => v.descripcion) }); console.log(`${c.id} ${d.estado}`); };

// Compra Shop de CLIENT-A usada por CP-056 y CP-060 (pedido y comprobante propios).
const base = new Caso('base', 'fixture');
const compraA = await compraShop(base, { hora: '14:00' });
if (compraA.checkout.status !== 201) throw new Error('checkout base ' + JSON.stringify(compraA.checkout.body) + JSON.stringify(compraA.quote.body));
const pedidoShopA = compraA.checkout.body.order.id;

// ================================================================ CP-055
{
  const c = new Caso('CP-055', 'Acceso sin sesión JWT a rutas, pedidos y configuración');
  for (const p of ['/drivers/me/routes', '/shop/orders', '/admin/shop-settings']) {
    const r = await c.http('GET', p);
    c.check(`GET ${p} sin token responde 401`, r.status === 401, r.status);
    const s = JSON.stringify(r.body);
    c.check(`GET ${p} no devuelve listados ni configuración`, !Array.isArray(r.body) && !/"items"|"stops"|"tax"|"deliverySchedule"/.test(s));
  }
  fin(c);
}

// ================================================================ CP-056
{
  const c = new Caso('CP-056', 'Aislamiento entre CLIENT-B y pedido/comprobante de CLIENT-A');
  const antes = await pedido(c, pedidoShopA);
  const sensibles = [antes.recipientName, String(compraA.checkout.body.order.totalCents), compraA.checkout.body.order.number, antes.deliveryAddress];
  for (const [m, p, body] of [['GET', `/shop/orders/${pedidoShopA}`], ['GET', `/shop/orders/${pedidoShopA}/receipt`], ['GET', `/orders/${pedidoShopA}`], ['PATCH', `/orders/${pedidoShopA}/status`, { status: 'CANCELLED' }]]) {
    const r = await c.http(m, p, { actor: 'CLIENT-B', token: T.cB, body });
    c.check(`${m} ${p} como CLIENT-B responde 403 o 404`, [403, 404].includes(r.status), r.status);
    const s = JSON.stringify(r.body);
    c.check(`${m} ${p} no expone datos de CLIENT-A`, !sensibles.some((x) => x && s.includes(x)));
  }
  const despues = await pedido(c, pedidoShopA);
  c.check('El pedido de CLIENT-A permanece sin cambios', igual(antes, despues));
  fin(c);
}

// ================================================================ CP-061 (crea la ruta R1 de DRIVER-A usada por CP-057, 060, 064, 065, 067, 068, 076..081)
let R1, O1, O2;
{
  const c = new Caso('CP-061', 'Pedido de hoy elegible en propuesta, ruta y asignación');
  O1 = await pedidoAdmin(c, { hora: '16:00' });
  O2 = await pedidoAdmin(c, { hora: '16:10' });
  const prop = await c.http('GET', `/route-proposals?date=${HOY}`, { actor: 'ADMIN', token: T.admin });
  const propuestos = (prop.body.proposals ?? []).flatMap((p) => p.orderIds ?? (p.stops ?? []).map((s) => s.orderId));
  c.check('La propuesta del día operativo responde 200 con isToday=true', prop.status === 200 && prop.body.isToday === true, { status: prop.status, isToday: prop.body.isToday });
  c.check('La propuesta incluye los pedidos de hoy', propuestos.includes(O1.id) && propuestos.includes(O2.id));
  const r = await crearRuta(c, [O1.id, O2.id], '16:00');
  c.check('POST /routes crea la ruta en DRAFT (201)', r.status === 201 && r.body.status === 'DRAFT', r.status);
  R1 = r.body.id;
  const a = await asignar(c, R1, D.A.id);
  c.check('POST /routes/:id/assign asigna DRIVER-A (200, ASSIGNED)', a.status === 200 && a.body.status === 'ASSIGNED' && a.body.driverId === D.A.id, a.status);
  const d = await detalle(c, R1);
  c.check('La ruta persistida queda ASSIGNED con 2 paradas y fecha de hoy', d.status === 'ASSIGNED' && d.stops.length === 2 && d.date.startsWith(HOY));
  fin(c);
}

// ================================================================ CP-057
{
  const c = new Caso('CP-057', 'Aislamiento de DRIVER-B ante ruta y parada de DRIVER-A');
  const antes = estadoRuta(await detalle(c, R1));
  const mias = await c.http('GET', '/drivers/me/routes', { actor: 'DRIVER-B', token: T.dB });
  c.check('Mi Ruta de DRIVER-B no lista la ruta de DRIVER-A', mias.status === 200 && !mias.body.some((r) => r.id === R1));
  const ver = await c.http('GET', `/routes/${R1}`, { actor: 'DRIVER-B', token: T.dB });
  c.check('GET /routes/:id ajeno como DRIVER-B responde 403 o 404', [403, 404].includes(ver.status), ver.status);
  const stop = antes.stops[0].id;
  for (const [p, body] of [[`/routes/${R1}/start`, {}], [`/routes/${R1}/stops/${stop}/failure`, { requestId: uuid(), reason: 'RECIPIENT_ABSENT', context: 'Intento de DRIVER-B' }], [`/routes/${R1}/complete`, {}]]) {
    const r = await c.http('POST', p, { actor: 'DRIVER-B', token: T.dB, body });
    c.check(`POST ${p.replace(R1, ':id').replace(stop, ':stopId')} como DRIVER-B se rechaza (403/404)`, [403, 404].includes(r.status), r.status);
  }
  c.check('Ruta y paradas de DRIVER-A conservan su estado', igual(antes, estadoRuta(await detalle(c, R1))));
  fin(c, { routeId: R1 });
}

// ================================================================ CP-058
{
  const c = new Caso('CP-058', 'Registro público con rol ADMIN rechazado sin escalación');
  const email = `ape4.escalacion.${uuid().slice(0, 8)}@fixture.invalid`;
  const r = await c.http('POST', '/auth/register', { body: { name: 'Intento Admin', email, password: 'ClaveSegura#2026', role: 'ADMIN' } });
  c.check('El registro con role ADMIN se rechaza con 400 o 403', [400, 403].includes(r.status), r.status);
  const l = await c.http('POST', '/auth/login', { body: { email, password: 'ClaveSegura#2026' } });
  c.check('El inicio de sesión posterior falla (401)', l.status === 401, l.status);
  const n = psql(`SELECT count(*) FROM public."user" WHERE email = '${email}'`);
  const admins = psql(`SELECT count(*) FROM public."user" WHERE role = 'ADMIN'`);
  c.check('No existe ninguna cuenta con el correo enviado', n === '0', { cuentas: n });
  c.check('La cantidad de cuentas ADMIN sigue siendo 1 (solo la del seed)', admins === '1', { admins });
  fin(c, { consultaBD: { cuentasConEseCorreo: Number(n), cuentasAdmin: Number(admins) } });
}

// ================================================================ CP-059
{
  const c = new Caso('CP-059', 'Intento de CLIENT de modificar configuración o cobertura');
  const sAntes = (await c.http('GET', '/admin/shop-settings', { actor: 'ADMIN', token: T.admin })).body;
  const cAntes = (await c.http('GET', '/store-coverage', { actor: 'ADMIN', token: T.admin })).body;
  const p1 = await c.http('PATCH', '/admin/shop-settings', { actor: 'CLIENT-A', token: T.cA, body: { taxEnabled: false } });
  c.check('PATCH /admin/shop-settings como CLIENT-A responde 403', p1.status === 403, p1.status);
  const p2 = await c.http('PUT', '/admin/store-coverage', { actor: 'CLIENT-A', token: T.cA, body: { location: { lat: -1.0, lng: -78.0 }, coverage: { type: 'Polygon', coordinates: [[[-78.1, -1.1], [-77.9, -1.1], [-77.9, -0.9], [-78.1, -0.9], [-78.1, -1.1]]] } } });
  c.check('PUT /admin/store-coverage como CLIENT-A responde 403', p2.status === 403, p2.status);
  const sDesp = (await c.http('GET', '/admin/shop-settings', { actor: 'ADMIN', token: T.admin })).body;
  const cDesp = (await c.http('GET', '/store-coverage', { actor: 'ADMIN', token: T.admin })).body;
  c.check('La configuración de tienda es idéntica antes y después', igual(sAntes, sDesp));
  c.check('La cobertura (ubicación y polígono) es idéntica antes y después', igual(cAntes, cDesp));
  fin(c);
}

// ================================================================ CP-060
{
  const c = new Caso('CP-060', 'Acceso autorizado por titular, ADMIN y DRIVER sobre recursos propios');
  const o = await c.http('GET', `/shop/orders/${pedidoShopA}`, { actor: 'CLIENT-A', token: T.cA });
  c.check('CLIENT-A lee su propio pedido (200)', o.status === 200 && o.body.id === pedidoShopA, o.status);
  const rc = await c.http('GET', `/shop/orders/${pedidoShopA}/receipt`, { actor: 'CLIENT-A', token: T.cA });
  c.check('CLIENT-A lee su propio comprobante (200)', rc.status === 200, rc.status);
  const lista = await c.http('GET', '/shop/orders?pageSize=50', { actor: 'CLIENT-A', token: T.cA });
  const ajenos = psql(`SELECT count(*) FROM public."order" WHERE "userId" <> '${CL.A.id}' AND id IN (${(lista.body.items ?? []).map((i) => `'${i.id}'`).join(',') || "'00000000-0000-0000-0000-000000000000'"})`);
  c.check('El historial de CLIENT-A no contiene pedidos de otros clientes', lista.status === 200 && ajenos === '0', { pedidos: lista.body.items?.length, ajenos });
  const s = await c.http('GET', '/admin/shop-settings', { actor: 'ADMIN', token: T.admin });
  c.check('ADMIN consulta la configuración (200)', s.status === 200, s.status);
  const inbox = await c.http('GET', '/dispatch/inbox', { actor: 'ADMIN', token: T.admin });
  c.check('ADMIN consulta la bandeja de despacho (200)', inbox.status === 200, inbox.status);
  const mias = await c.http('GET', '/drivers/me/routes', { actor: 'DRIVER-A', token: T.dA });
  const ids = mias.body.map((r) => r.id);
  const deOtro = ids.length ? psql(`SELECT count(*) FROM public.route WHERE id IN (${ids.map((i) => `'${i}'`).join(',')}) AND "driverId" <> '${D.A.id}'`) : '0';
  c.check('DRIVER-A ve su ruta asignada (200) y solo rutas propias', mias.status === 200 && ids.includes(R1) && deOtro === '0', { rutas: ids.length, deOtro });
  fin(c);
}

// ================================================================ CP-064
{
  const c = new Caso('CP-064', 'Ausencia futura no altera ni reasigna rutas activas de hoy');
  const antes = estadoRuta(await detalle(c, R1));
  const ab = await c.http('POST', `/drivers/${D.A.id}/absences`, { actor: 'ADMIN', token: T.admin, body: { startDate: MANANA, endDate: day(2), reason: 'Ausencia futura APE4' } });
  c.check('La ausencia futura de DRIVER-A queda registrada (201, ACTIVE)', ab.status === 201 && ab.body.status === 'ACTIVE', ab.status);
  const despues = estadoRuta(await detalle(c, R1));
  c.check('La ruta de hoy mantiene conductor, estado y paradas', igual(antes, despues));
  const resv = psql(`SELECT count(*) FROM public."driverReservation" WHERE "routeId" = '${R1}' AND "releasedAt" IS NULL`);
  c.check('La reserva activa de la ruta de hoy sigue vigente (no se libera ni reasigna)', resv === '1', { reservasActivas: resv });
  const cancel = await c.http('POST', `/drivers/${D.A.id}/absences/${ab.body.id}/cancel`, { actor: 'ADMIN', token: T.admin, body: { reason: 'Restaurar datos APE4' } });
  c.nota(`Ausencia anulada al terminar para restaurar los datos (HTTP ${cancel.status}).`);
  fin(c);
}

// ================================================================ CP-065
let U1;
{
  const c = new Caso('CP-065', 'Pedido urgente con ruta IN_PROGRESS no altera ruta iniciada');
  const st = await c.http('POST', `/routes/${R1}/start`, { actor: 'DRIVER-A', token: T.dA, body: {} });
  c.check('DRIVER-A inicia R1 (IN_PROGRESS)', st.status === 200 && st.body.status === 'IN_PROGRESS', st.status);
  const antes = estadoRuta(await detalle(c, R1));
  U1 = await pedidoAdmin(c, { hora: '16:20' });
  const p = await c.http('GET', `/dispatch/orders/${U1.id}/proposal`, { actor: 'ADMIN', token: T.admin });
  c.check('La propuesta de urgencia es NEW_ROUTE o BLOCKED', p.status === 200 && ['NEW_ROUTE', 'BLOCKED'].includes(p.body.kind), { status: p.status, kind: p.body.kind });
  c.check('La propuesta no inserta el pedido en la ruta iniciada', p.body.targetRouteId !== R1 && p.body.routeId !== R1);
  const inbox = await c.http('GET', '/dispatch/inbox', { actor: 'ADMIN', token: T.admin });
  c.check('La bandeja de despacho responde 200', inbox.status === 200);
  c.check('Paradas, orden y estado de R1 son idénticos antes y después', igual(antes, estadoRuta(await detalle(c, R1))));
  fin(c);
}

// ================================================================ CP-063 (repartidor sin rutas para aislar la causa: solo la ausencia)
{
  const c = new Caso('CP-063', 'Ausencia registrada hoy impide asignar repartidor');
  const DB2 = await nuevoRepartidor('DriverB2');
  c.nota('Se usó un segundo repartidor sintético sin rutas (DRIVER-B2), para que la ausencia sea la única causa de no disponibilidad.');
  const o = await pedidoAdmin(c, { hora: '15:30' });
  const r = await crearRuta(c, [o.id], '15:30');
  const ab = await c.http('POST', `/drivers/${DB2.id}/absences`, { actor: 'ADMIN', token: T.admin, body: { startDate: HOY, endDate: HOY, reason: 'Ausencia de hoy APE4' } });
  c.check('Ausencia de hoy registrada (201)', ab.status === 201, ab.status);
  const av = await c.http('GET', `/drivers/${DB2.id}/availability?date=${HOY}`, { actor: 'ADMIN', token: T.admin });
  c.check('Disponibilidad reporta isAvailable=false', av.status === 200 && av.body.isAvailable === false, av.body);
  const a = await asignar(c, r.body.id, DB2.id);
  c.check('El intento de asignación se rechaza (4xx)', a.status >= 400 && a.status < 500, a.status);
  const d = await detalle(c, r.body.id);
  c.check('La ruta permanece DRAFT sin conductor', d.status === 'DRAFT' && d.driverId === null);
  const resv = psql(`SELECT count(*) FROM public."driverReservation" WHERE "driverId" = '${DB2.id}'`);
  c.check('No se generó reserva para el repartidor ausente', resv === '0', { reservas: resv });
  fin(c);
}

// ================================================================ CP-066
let DC;
{
  const c = new Caso('CP-066', 'Decisión manual ADMIN en urgencias: INSERT con cupo o NEW_ROUTE');
  DC = await nuevoRepartidor('DriverC');
  const a1 = await pedidoAdmin(c, { hora: '16:00' }), a2 = await pedidoAdmin(c, { hora: '16:05' });
  const r = await crearRuta(c, [a1.id, a2.id], '16:00');
  const R66 = r.body.id;
  await asignar(c, R66, D.B.id);
  // 1) Urgentes del día (U1 de CP-065 y siguientes): mientras alguna ruta elegible tenga cupo (< 4) el sistema propone INSERT;
  //    cada inserción solo ocurre tras la confirmación explícita del ADMIN. Cuando no queda cupo, propone NEW_ROUTE.
  const decisiones = [];
  const insertadas = new Set();
  let u = U1, p, hora = 16 * 60 + 15;
  for (let i = 0; i < 8; i++) {
    p = await c.http('GET', `/dispatch/orders/${u.id}/proposal`, { actor: 'ADMIN', token: T.admin });
    if (p.body.kind !== 'INSERT') break;
    const destino = p.body.routeId;
    const antes = (await detalle(c, destino)).stops.length;
    c.check(`Urgente ${u.id.slice(0, 8)}: INSERT propuesto en ruta ${destino.slice(0, 8)} con cupo (${antes} < 4)`, antes < 4 && destino !== R1, { antes });
    c.check('Sin confirmación explícita la ruta destino no cambia', (await detalle(c, destino)).stops.length === antes);
    const conf = await intervenir(c, { action: 'CONFIRM', orderId: u.id, fingerprint: p.body.fingerprint });
    decisiones.push(conf.body);
    const desp = await detalle(c, destino);
    c.check('Tras confirmar, la ruta destino gana exactamente una parada con secuencia contigua', conf.status === 200 && conf.body.outcome === 'APPLIED' && desp.stops.length === antes + 1 && igual(desp.stops.map((s) => s.sequence), desp.stops.map((_, k) => k + 1)), { http: conf.status, paradas: desp.stops.length });
    insertadas.add(destino);
    const h = String(Math.floor(hora / 60)).padStart(2, '0') + ':' + String(hora % 60).padStart(2, '0');
    hora += 5;
    u = await pedidoAdmin(c, { hora: h });
  }
  c.check('Se confirmó al menos una inserción (INSERT con cupo)', decisiones.length >= 1, { inserciones: decisiones.length });
  // 2) Sin cupo: el siguiente urgente propone NEW_ROUTE y se confirma con un repartidor libre
  c.check('Sin rutas con cupo propone NEW_ROUTE', p.body.kind === 'NEW_ROUTE', p.body.kind);
  const conf3 = await intervenir(c, { action: 'CONFIRM', orderId: u.id, fingerprint: p.body.fingerprint, driverId: DC.id });
  decisiones.push(conf3.body);
  c.check('NEW_ROUTE confirmado crea una ruta nueva', conf3.status === 200 && conf3.body.routeId && !insertadas.has(conf3.body.routeId), conf3.status);
  for (const r of insertadas) c.check(`La ruta ${r.slice(0, 8)} no supera 4 paradas tras el NEW_ROUTE`, (await detalle(c, r)).stops.length <= 4);
  c.check('La ruta R66 (sin seleccionar) queda intacta o solo con inserciones confirmadas', (await detalle(c, R66)).stops.length <= 4);
  const maxStops = psql(`SELECT coalesce(max(n),0) FROM (SELECT count(*) n FROM public."routeStop" GROUP BY "routeId") t`);
  c.check('Ninguna ruta del sistema supera 4 paradas', Number(maxStops) <= 4, { maxStops });
  const audit = (await c.http('GET', '/dispatch/audit', { actor: 'ADMIN', token: T.admin })).body;
  const lista = audit.items ?? audit;
  c.check('Las tres decisiones quedan auditadas con el actor ADMIN', decisiones.every((dd) => lista.some((x) => x.requestId === dd.requestId && x.actorId === dd.actorId)));
  c.check('R1 (iniciada) no recibió inserciones', (await detalle(c, R1)).stops.length === 2);
  fin(c, { R66, nuevaRuta: conf3.body.routeId });
  globalThis.R_DC = conf3.body.routeId;
}

// ================================================================ CP-068 (antes de CP-067: la parada aún está PENDING)
{
  const c = new Caso('CP-068', 'Registro de fallo por actor o conductor no autorizado rechazado');
  const d = await detalle(c, R1);
  const stop = d.stops.find((s) => s.orderId === O1.id);
  for (const [actor, token] of [['DRIVER-B', T.dB], ['CLIENT-A', T.cA]]) {
    const r = await c.http('POST', `/routes/${R1}/stops/${stop.id}/failure`, { actor, token, body: { requestId: uuid(), reason: 'RECIPIENT_ABSENT', context: `Intento no autorizado de ${actor}` } });
    c.check(`Fallo registrado por ${actor} se rechaza (403/404/409)`, [403, 404, 409].includes(r.status), r.status);
  }
  const d2 = await detalle(c, R1);
  const s2 = d2.stops.find((s) => s.id === stop.id);
  c.check('La parada sigue PENDING y sin intentos', s2.outcome === 'PENDING' && s2.attempts.length === 0);
  c.check('El pedido no cambió de estado', (await pedido(c, O1.id)).status === 'ASSIGNED');
  fin(c);
}

// ================================================================ CP-067
let attempt1;
{
  const c = new Caso('CP-067', 'Entrega fallida en móvil conserva parada e historial pendiente');
  const stop = (await detalle(c, R1)).stops.find((s) => s.orderId === O1.id);
  const r = await c.http('POST', `/routes/${R1}/stops/${stop.id}/failure`, { actor: 'DRIVER-A', token: T.dA, body: { requestId: uuid(), reason: 'RECIPIENT_ABSENT', context: 'Nadie atendió en el domicilio' } });
  c.check('DRIVER-A registra la entrega fallida (200)', r.status === 200, r.status);
  const s = (await detalle(c, R1)).stops.find((x) => x.id === stop.id);
  attempt1 = s.attempts[0]?.id;
  c.check('La parada pasa a FAILED y conserva el intento con su motivo', s.outcome === 'FAILED' && s.attempts.length === 1 && JSON.stringify(s.attempts[0]).includes('RECIPIENT_ABSENT'));
  const o = await pedido(c, O1.id);
  c.check('El pedido no queda DELIVERED ni CANCELLED', !['DELIVERED', 'CANCELLED'].includes(o.status), o.status);
  const t = await c.http('GET', `/shop/orders/${O1.id}`, { actor: 'CLIENT-A', token: T.cA });
  c.check('El seguimiento del cliente lo muestra pendiente de gestión', t.status === 200 && t.body.pendingManagement === true, { status: t.status, pendingManagement: t.body.pendingManagement });
  fin(c);
}

// ================================================================ CP-076
{
  const c = new Caso('CP-076', 'Cierre de ruta móvil rechazado con visita aún PENDING');
  const antes = await detalle(c, R1);
  c.check('Existe una parada PENDING en la ruta', antes.stops.some((s) => s.outcome === 'PENDING'));
  const r = await c.http('POST', `/routes/${R1}/complete`, { actor: 'DRIVER-A', token: T.dA, body: {} });
  c.check('El cierre se rechaza con HTTP 409', r.status === 409, r.status);
  const d = await detalle(c, R1);
  c.check('La ruta sigue IN_PROGRESS sin completedAt', d.status === 'IN_PROGRESS' && d.completedAt === null);
  const av = (await c.http('GET', '/drivers/me/availability', { actor: 'DRIVER-A', token: T.dA })).body;
  c.check('El conductor sigue ocupado', av.isAvailable === false, av);
  fin(c);
}

// ================================================================ CP-077
{
  const c = new Caso('CP-077', 'Cierre de ruta COMPLETED con visitas resueltas y una FAILED');
  for (const s of ['IN_TRANSIT', 'DELIVERED']) {
    const r = await c.http('PATCH', `/orders/${O2.id}/status`, { actor: 'DRIVER-A', token: T.dA, body: { status: s } });
    c.check(`DRIVER-A marca la segunda parada ${s} (200)`, r.status === 200, r.status);
  }
  const r = await c.http('POST', `/routes/${R1}/complete`, { actor: 'DRIVER-A', token: T.dA, body: {} });
  c.check('Cierre de ruta responde 200 COMPLETED con completedAt', r.status === 200 && r.body.status === 'COMPLETED' && r.body.completedAt, r.status);
  const d = await detalle(c, R1);
  c.check('La parada fallida sigue FAILED y la entregada SUCCESSFUL/DELIVERED', d.stops.find((s) => s.orderId === O1.id).outcome === 'FAILED' && d.stops.find((s) => s.orderId === O2.id).outcome !== 'PENDING');
  c.check('El pedido fallido no se marca DELIVERED', (await pedido(c, O1.id)).status !== 'DELIVERED');
  const av = (await c.http('GET', '/drivers/me/availability', { actor: 'DRIVER-A', token: T.dA })).body;
  c.check('El conductor aún no queda disponible (falta el regreso)', av.isAvailable === false && av.blockingRouteIds.includes(R1), av);
  fin(c);
}

// ================================================================ CP-078
{
  const c = new Caso('CP-078', 'Bloqueo de nueva salida antes de confirmar regreso (returnedAt)');
  const d = await detalle(c, R1);
  c.check('La ruta previa está COMPLETED con returnedAt nulo', d.status === 'COMPLETED' && d.returnedAt === null);
  const o = await pedidoAdmin(c, { hora: '16:40' });
  const r = await crearRuta(c, [o.id], '16:40');
  const a = await asignar(c, r.body.id, D.A.id);
  c.check('La asignación de la nueva salida se rechaza con 409', a.status === 409, a.status);
  const d2 = await detalle(c, r.body.id);
  c.check('La segunda ruta permanece DRAFT sin conductor', d2.status === 'DRAFT' && d2.driverId === null);
  const resv = psql(`SELECT count(*) FROM public."driverReservation" WHERE "driverId" = '${D.A.id}' AND "releasedAt" IS NULL`);
  c.check('DRIVER-A tiene una sola reserva activa (sin doble reserva)', resv === '1', { reservasActivas: resv });
  fin(c);
  globalThis.R78 = r.body.id;
}

// ================================================================ CP-081
{
  const c = new Caso('CP-081', 'Intento de cierre o regreso por DRIVER-B rechazado sobre ruta ajena');
  const antes = estadoRuta(await detalle(c, R1));
  const resvAntes = psql(`SELECT count(*) FROM public."driverReservation" WHERE "routeId" = '${R1}' AND "releasedAt" IS NULL`);
  for (const p of ['complete', 'return']) {
    const r = await c.http('POST', `/routes/${R1}/${p}`, { actor: 'DRIVER-B', token: T.dB, body: {} });
    c.check(`POST /routes/:id/${p} como DRIVER-B se rechaza (403/404)`, [403, 404].includes(r.status), r.status);
  }
  c.check('Estado, completedAt y returnedAt de la ruta de DRIVER-A no cambian', igual(antes, estadoRuta(await detalle(c, R1))));
  const resvDesp = psql(`SELECT count(*) FROM public."driverReservation" WHERE "routeId" = '${R1}' AND "releasedAt" IS NULL`);
  c.check('La reserva de DRIVER-A sigue activa', resvAntes === '1' && resvDesp === '1', { resvAntes, resvDesp });
  fin(c);
}

// ================================================================ CP-079
let retorno1;
{
  const c = new Caso('CP-079', 'Confirmación de regreso por titular libera y actualiza disponibilidad');
  const r = await c.http('POST', `/routes/${R1}/return`, { actor: 'DRIVER-A', token: T.dA, body: {} });
  retorno1 = r.body;
  c.check('DRIVER-A confirma el regreso (200) con returnedAt', r.status === 200 && r.body.returnedAt, r.status);
  const resv = psql(`SELECT count(*) FROM public."driverReservation" WHERE "routeId" = '${R1}' AND "releasedAt" IS NULL`);
  c.check('La reserva de la ruta queda liberada', resv === '0', { reservasActivas: resv });
  const av = (await c.http('GET', '/drivers/me/availability', { actor: 'DRIVER-A', token: T.dA })).body;
  c.check('Sin ausencia, DRIVER-A queda disponible', av.isAvailable === true, av);
  // Variante con ausencia vigente hoy: la ruta NEW_ROUTE de CP-066 (DRIVER-C).
  const RC = globalThis.R_DC;
  await c.http('POST', `/routes/${RC}/start`, { actor: 'DRIVER-C', token: DC.token, body: {} });
  const oc = (await detalle(c, RC)).stops[0].orderId;
  for (const s of ['IN_TRANSIT', 'DELIVERED']) await c.http('PATCH', `/orders/${oc}/status`, { actor: 'DRIVER-C', token: DC.token, body: { status: s } });
  await c.http('POST', `/routes/${RC}/complete`, { actor: 'DRIVER-C', token: DC.token, body: {} });
  const ab = await c.http('POST', `/drivers/${DC.id}/absences`, { actor: 'ADMIN', token: T.admin, body: { startDate: HOY, endDate: HOY, reason: 'Ausencia vigente APE4' } });
  const rc = await c.http('POST', `/routes/${RC}/return`, { actor: 'DRIVER-C', token: DC.token, body: {} });
  c.check('Con ausencia vigente, el regreso también se registra (200, returnedAt)', rc.status === 200 && rc.body.returnedAt, rc.status);
  const resvC = psql(`SELECT count(*) FROM public."driverReservation" WHERE "routeId" = '${RC}' AND "releasedAt" IS NULL`);
  c.check('La reserva de esa ruta se libera', resvC === '0', { reservasActivas: resvC });
  const avC = (await c.http('GET', `/drivers/${DC.id}/availability?date=${HOY}`, { actor: 'ADMIN', token: T.admin })).body;
  c.check('Con ausencia vigente hoy el repartidor sigue NO disponible', avC.isAvailable === false, avC);
  const cancel = await c.http('POST', `/drivers/${DC.id}/absences/${ab.body.id}/cancel`, { actor: 'ADMIN', token: T.admin, body: { reason: 'Restaurar datos APE4' } });
  c.nota(`Ausencia anulada al terminar (HTTP ${cancel.status}).`);
  fin(c);
}

// ================================================================ CP-080
{
  const c = new Caso('CP-080', 'Repetición de regreso a tienda sin duplicar ni liberar dos veces');
  const antesBD = psql(`SELECT "returnedAt" || '|' || "returnedById" FROM public.route WHERE id = '${R1}'`);
  const resvAntes = psql(`SELECT count(*) || '|' || max("releasedAt")::text FROM public."driverReservation" WHERE "routeId" = '${R1}'`);
  const r = await c.http('POST', `/routes/${R1}/return`, { actor: 'DRIVER-A', token: T.dA, body: {} });
  c.check('La repetición responde de forma idempotente (200) o con conflicto controlado (409)', [200, 409].includes(r.status), r.status);
  if (r.status === 200) c.check('La respuesta repetida es idéntica a la original', igual(r.body, retorno1));
  c.check('returnedAt y returnedById se mantienen sin cambios', antesBD === psql(`SELECT "returnedAt" || '|' || "returnedById" FROM public.route WHERE id = '${R1}'`), antesBD);
  c.check('No se crea ni libera otra reserva', resvAntes === psql(`SELECT count(*) || '|' || max("releasedAt")::text FROM public."driverReservation" WHERE "routeId" = '${R1}'`), resvAntes);
  const av = (await c.http('GET', '/drivers/me/availability', { actor: 'DRIVER-A', token: T.dA })).body;
  c.check('La disponibilidad del conductor no cambia (sigue disponible)', av.isAvailable === true, av);
  fin(c);
}

// ================================================================ CP-069 / CP-070 / CP-071 (ruta de DRIVER-D con dos entregas fallidas)
const DD = await nuevoRepartidor('DriverD');
const base2 = new Caso('base2', 'fixture');
const Oc = await pedidoAdmin(base2, { hora: '15:00' }), Op = await pedidoAdmin(base2, { hora: '15:10' });
const RD = (await crearRuta(base2, [Oc.id, Op.id], '15:00')).body.id;
await asignar(base2, RD, DD.id);
await base2.http('POST', `/routes/${RD}/start`, { token: DD.token, body: {} });
const att = {};
for (const o of [Oc, Op]) {
  const s = (await detalle(base2, RD)).stops.find((x) => x.orderId === o.id);
  await base2.http('POST', `/routes/${RD}/stops/${s.id}/failure`, { token: DD.token, body: { requestId: uuid(), reason: 'RECIPIENT_REFUSED', context: 'El destinatario pidió otra alternativa' } });
  att[o.id] = (await detalle(base2, RD)).stops.find((x) => x.orderId === o.id).attempts[0].id;
}
await base2.http('POST', `/routes/${RD}/complete`, { token: DD.token, body: {} });

{
  const c = new Caso('CP-069', 'Gestión post-fallo ADMIN: CONTACT y RESCHEDULE con nueva fecha');
  const nueva = at(MANANA, '12:00');
  const ct = await intervenir(c, { action: 'CONTACT', orderId: Oc.id, attemptId: att[Oc.id], agreementConfirmed: true, scheduledDeliveryDate: nueva, deliveryWindowStart: at(MANANA, '11:30'), deliveryWindowEnd: at(MANANA, '12:30') });
  c.check('CONTACT con acuerdo explícito se aplica (200)', ct.status === 200 && ct.body.outcome === 'APPLIED', ct.status);
  const rs = await intervenir(c, { action: 'RESCHEDULE', orderId: Oc.id, agreementId: ct.body.id });
  c.check('RESCHEDULE con el acuerdo se aplica (200)', rs.status === 200 && rs.body.outcome === 'APPLIED', rs.status);
  const o = await pedido(c, Oc.id);
  c.check('El pedido queda PENDING, sin ruta y con la nueva fecha', o.status === 'PENDING' && o.routeId === null && new Date(o.scheduledDeliveryDate).getTime() === new Date(nueva).getTime(), { status: o.status, routeId: o.routeId, scheduledDeliveryDate: o.scheduledDeliveryDate });
  const h = await detalle(c, RD);
  const s = h.stops.find((x) => x.orderId === Oc.id);
  c.check('La ruta original conserva la parada FAILED y su intento', s && s.outcome === 'FAILED' && s.attempts.length === 1);
  const asign = psql(`SELECT count(*) FROM public."routeStop" rs JOIN public.route r ON r.id = rs."routeId" WHERE rs."orderId" = '${Oc.id}' AND r.status IN ('DRAFT','ASSIGNED','IN_PROGRESS')`);
  c.check('No existe asignación activa duplicada', asign === '0', { asignacionesActivas: asign });
  const prop = await c.http('GET', `/route-proposals?date=${MANANA}`, { actor: 'ADMIN', token: T.admin });
  c.check('El pedido queda listo para planificar en la nueva fecha', (prop.body.proposals ?? []).flatMap((p) => p.orderIds ?? []).includes(Oc.id));
  fin(c);
}
{
  const c = new Caso('CP-070', 'Gestión post-fallo ADMIN: acuerdo de retiro en tienda (PICKUP_AGREE)');
  const stockAntes = (await c.http('GET', `/shop/products/${P.id}`)).body.stock;
  const r = await intervenir(c, { action: 'PICKUP_AGREE', orderId: Op.id, attemptId: att[Op.id] });
  c.check('PICKUP_AGREE se aplica (200)', r.status === 200 && r.body.outcome === 'APPLIED', r.status);
  const o = await pedido(c, Op.id);
  c.check('El pedido queda pendiente de retiro sin marcarse entregado', o.status !== 'DELIVERED' && o.pickup?.state === 'PENDING_PICKUP', { status: o.status, pickup: o.pickup });
  const t = await c.http('GET', `/shop/orders/${Op.id}`, { actor: 'CLIENT-A', token: T.cA });
  c.check('El seguimiento del cliente muestra "pendiente de retiro"', t.body.pickup?.state === 'PENDING_PICKUP' && (t.body.timeline ?? []).some((x) => x.code === 'PICKUP_AGREED'));
  const s = (await detalle(c, RD)).stops.find((x) => x.orderId === Op.id);
  c.check('Se conserva el registro de la visita fallida', s.outcome === 'FAILED' && s.attempts.length === 1);
  const stockDesp = (await c.http('GET', `/shop/products/${P.id}`)).body.stock;
  c.check('No se repone stock', stockAntes === stockDesp, { stockAntes, stockDesp });
  fin(c);
}
{
  const c = new Caso('CP-071', 'Confirmación de retiro (PICKUP_CONFIRM) y rechazo de repetición');
  const stockAntes = (await c.http('GET', `/shop/products/${P.id}`)).body.stock;
  const r1 = await intervenir(c, { action: 'PICKUP_CONFIRM', orderId: Op.id });
  c.check('La primera confirmación se aplica (200)', r1.status === 200 && r1.body.outcome === 'APPLIED', r1.status);
  const o = await pedido(c, Op.id);
  c.check('El pedido queda DELIVERED por retiro (PICKED_UP)', o.status === 'DELIVERED' && o.pickup?.state === 'PICKED_UP', { status: o.status, pickup: o.pickup });
  const r2 = await intervenir(c, { action: 'PICKUP_CONFIRM', orderId: Op.id });
  c.check('La repetición se rechaza con 409 PICKUP_ALREADY_CONFIRMED', r2.status === 409 && JSON.stringify(r2.body).includes('PICKUP_ALREADY_CONFIRMED'), { status: r2.status });
  const n = psql(`SELECT count(*) FROM public."orderPickup" WHERE "orderId" = '${Op.id}'`);
  c.check('Existe un solo registro de retiro', n === '1', { retiros: n });
  const stockDesp = (await c.http('GET', `/shop/products/${P.id}`)).body.stock;
  c.check('Sin movimientos adicionales de inventario', stockAntes === stockDesp, { stockAntes, stockDesp });
  fin(c);
}
await base2.http('POST', `/routes/${RD}/return`, { token: DD.token, body: {} });

// ================================================================ CP-062
{
  const c = new Caso('CP-062', 'Pedido futuro admitido en compra y bloqueado en ruta/assign');
  const rutasAntes = psql(`SELECT count(*) FROM public.route`);
  const shop = await compraShop(c, { fecha: MANANA, hora: '10:00' });
  c.check('Compra Shop para mañana creada (201)', shop.checkout.status === 201, shop.checkout.status);
  const adm = await pedidoAdmin(c, { fecha: MANANA, hora: '10:30' });
  c.check('Pedido ADMIN para mañana creado (201)', !!adm.id);
  const fut = [shop.checkout.body?.order?.id, adm.id];
  const prop = await c.http('GET', `/route-proposals?date=${MANANA}`, { actor: 'ADMIN', token: T.admin });
  c.check('La propuesta (preview) de mañana responde 200 con isToday=false', prop.status === 200 && prop.body.isToday === false, { isToday: prop.body.isToday, canConfirm: prop.body.canConfirm });
  c.check('Los pedidos futuros aparecen en la vista previa', fut.every((id) => (prop.body.proposals ?? []).flatMap((p) => p.orderIds ?? []).includes(id)));
  const r = await crearRuta(c, fut, '10:00', MANANA);
  c.check('POST /routes para mañana se rechaza con 409 ROUTE_DATE_NOT_TODAY', r.status === 409 && JSON.stringify(r.body).includes('ROUTE_DATE_NOT_TODAY'), r.status);
  const a = await c.http('POST', '/routes/assign', { actor: 'ADMIN', token: T.admin, body: { driverId: D.A.id, orderIds: fut } });
  c.check('POST /routes/assign directo para mañana se rechaza (409)', a.status === 409, { status: a.status, code: a.body?.error?.code ?? a.body?.code });
  c.check('No se crean rutas nuevas', rutasAntes === psql(`SELECT count(*) FROM public.route`));
  const est = psql(`SELECT string_agg(status::text, ',') FROM public."order" WHERE id IN ('${fut.join("','")}')`);
  c.check('Los pedidos futuros siguen PENDING', est === 'PENDING,PENDING', est);
  fin(c);
}

// ================================================================ CP-072 / CP-073 / CP-074 (recorrido E2E con DRIVER-A)
let E2E;
{
  const c = new Caso('CP-072', 'Recorrido E2E: creación de compra y verificación de estado inicial');
  const stockAntes = (await c.http('GET', `/shop/products/${productos[1].id}`)).body.stock;
  const { quote, checkout } = await compraShop(c, { hora: '16:30', producto: productos[1], cantidad: 2 });
  c.check('El checkout con tarjeta demo aprobada responde 201', checkout.status === 201, checkout.status);
  const ord = checkout.body.order;
  E2E = ord.id;
  c.check('Pedido creado en estado inicial PENDING', ord.status === 'PENDING');
  c.check('Importes congelados: total = subtotal + IVA 15 %', ord.totalCents === ord.subtotalCents + ord.taxAmountCents && ord.taxAmountCents === Math.round(ord.subtotalCents * 0.15), { subtotal: ord.subtotalCents, iva: ord.taxAmountCents, total: ord.totalCents, cotizado: quote.body?.totals ?? quote.body?.totalCents });
  const t = await c.http('GET', `/shop/orders/${E2E}`, { actor: 'CLIENT-A', token: T.cA });
  c.check('El seguimiento de CLIENT-A muestra el pedido PENDING', t.status === 200 && t.body.status === 'PENDING');
  const rc = await c.http('GET', `/shop/orders/${E2E}/receipt`, { actor: 'CLIENT-A', token: T.cA });
  c.check('El comprobante está disponible y coincide en total', rc.status === 200 && JSON.stringify(rc.body).includes(String(ord.totalCents)));
  const stockDesp = (await c.http('GET', `/shop/products/${productos[1].id}`)).body.stock;
  c.check('Stock descontado en la cantidad comprada (2)', stockAntes - stockDesp === 2, { stockAntes, stockDesp });
  fin(c);
}
let RE;
{
  const c = new Caso('CP-073', 'Recorrido E2E: propuesta, confirmación y asignación en día operativo');
  const av = (await c.http('GET', `/drivers/${D.A.id}/availability?date=${HOY}`, { actor: 'ADMIN', token: T.admin })).body;
  c.check('DRIVER-A disponible antes de asignar', av.isAvailable === true, av);
  const prop = await c.http('GET', `/route-proposals?date=${HOY}`, { actor: 'ADMIN', token: T.admin });
  c.check('La propuesta de hoy incluye el pedido del E2E', (prop.body.proposals ?? []).flatMap((p) => p.orderIds ?? []).includes(E2E));
  const r = await crearRuta(c, [E2E], '16:30');
  RE = r.body.id;
  c.check('El borrador se persiste (201, DRAFT)', r.status === 201 && r.body.status === 'DRAFT');
  const a = await asignar(c, RE, D.A.id);
  c.check('La ruta queda ASSIGNED a DRIVER-A', a.status === 200 && a.body.status === 'ASSIGNED');
  const mias = (await c.http('GET', '/drivers/me/routes', { actor: 'DRIVER-A', token: T.dA })).body;
  const enMovil = mias.filter((x) => x.id === RE);
  c.check('La ruta aparece una sola vez en Mi Ruta de DRIVER-A con su parada', enMovil.length === 1 && enMovil[0].stops.length === 1 && enMovil[0].stops[0].orderId === E2E);
  const resv = psql(`SELECT count(*) FROM public."driverReservation" WHERE "routeId" = '${RE}' AND "releasedAt" IS NULL`);
  c.check('Existe exactamente una reserva del conductor para la ruta', resv === '1', { reservas: resv });
  fin(c);
}
{
  const c = new Caso('CP-074', 'Recorrido E2E: progreso móvil reflejado en seguimiento del cliente');
  const paso = async (nombre, fn, esperado) => {
    const r = await fn();
    const back = await pedido(c, E2E);
    const cli = await c.http('GET', `/shop/orders/${E2E}`, { actor: 'CLIENT-A', token: T.cA });
    c.check(`${nombre}: el cliente ve el mismo estado que el backend (${esperado})`, r.status === 200 && back.status === esperado && cli.body.status === esperado, { http: r.status, backend: back.status, cliente: cli.body.status });
    return cli.body;
  };
  await paso('Inicio de ruta', () => c.http('POST', `/routes/${RE}/start`, { actor: 'DRIVER-A', token: T.dA, body: {} }), 'ASSIGNED');
  c.check('La ruta queda IN_PROGRESS', (await detalle(c, RE)).status === 'IN_PROGRESS');
  await paso('En camino', () => c.http('PATCH', `/orders/${E2E}/status`, { actor: 'DRIVER-A', token: T.dA, body: { status: 'IN_TRANSIT' } }), 'IN_TRANSIT');
  const finalCli = await paso('Entregado', () => c.http('PATCH', `/orders/${E2E}/status`, { actor: 'DRIVER-A', token: T.dA, body: { status: 'DELIVERED' } }), 'DELIVERED');
  c.check('El seguimiento no inventa ubicación GPS', !/"(lat|lng|latitude|longitude)"\s*:\s*-?\d/.test(JSON.stringify(finalCli.timeline ?? [])));
  await c.http('POST', `/routes/${RE}/complete`, { actor: 'DRIVER-A', token: T.dA, body: {} });
  await c.http('POST', `/routes/${RE}/return`, { actor: 'DRIVER-A', token: T.dA, body: {} });
  c.nota('Al terminar se cerró la ruta y se confirmó el regreso para dejar libre a DRIVER-A.');
  fin(c);
}

writeFileSync(path.join(OUT, 'movil-resumen.json'), JSON.stringify({ ejecutado: new Date().toISOString(), resultados }, null, 2));
console.log(JSON.stringify(resultados.filter((r) => r.estado !== 'PASS'), null, 2));
