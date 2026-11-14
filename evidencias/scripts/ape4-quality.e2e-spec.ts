import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import postgres from '@prisma/orm-postgres/runtime';
import type { Contract } from '../src/prisma/contract.d';
import contractJson from '../src/prisma/contract.json' with { type: 'json' };
import {
  startOwnedContainer,
  createOwnedDatabase,
  runPrismaMigrate,
  cleanupOwnedResources,
} from './geolocation-migration.fixtures.js';

jest.setTimeout(300000);

/**
 * APE4 — evidencia de los casos CP-082..085, CP-092 y CP-094 (módulo Calidad). Se ejecuta a mano con un OSRM REAL local:
 *   APE4_EVIDENCE_DIR=<carpeta> OSRM_REAL_URL=http://127.0.0.1:5001 pnpm test:e2e -- test/ape4-quality
 * Cada caso guarda en APE4_EVIDENCE_DIR/CP-XXX.json lo realmente observado (petición, respuesta y estado persistido).
 */
const realUrl = process.env.OSRM_REAL_URL;
const outDir = process.env.APE4_EVIDENCE_DIR;
const suite = realUrl && outDir && /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(realUrl) ? describe : describe.skip;

suite('APE4 Calidad: propuestas de rutas con OSRM real, no cobro del reemplazo y reprogramación', () => {
  let app: INestApplication;
  let db: ReturnType<typeof postgres<Contract>>;
  const secret = randomUUID() + randomUUID();
  const jwt = new JwtService({ secret });
  const ids = { admin: randomUUID(), client: randomUUID(), driverUser: randomUUID(), driver: randomUUID(), zone: randomUUID() };
  const STORE = { lat: -1.24908, lng: -78.61675 };
  const token = (sub: string, role: string) => jwt.sign({ sub, role, email: 'fixture@invalid.test' });
  const api = (method: 'get' | 'post', p: string, body?: object, sub = ids.admin, role = 'ADMIN') =>
    request(app.getHttpServer())[method]('/api/v1' + p).auth(token(sub, role), { type: 'bearer' }).send(body);
  const intervene = (body: Record<string, unknown>) =>
    api('post', '/dispatch/interventions', { requestId: randomUUID(), reason: 'Gestión APE4', ...body });
  const evidence = (cp: string, data: unknown) => {
    mkdirSync(outDir!, { recursive: true });
    writeFileSync(path.join(outDir!, `${cp}.json`), JSON.stringify(data, null, 2));
  };
  const day = (offset: number) => Temporal.Now.zonedDateTimeISO('America/Guayaquil').toPlainDate().add({ days: offset }).toString();
  const at = (date: string, hhmm: string) => Temporal.ZonedDateTime.from(`${date}T${hhmm}:00-05:00[America/Guayaquil]`).toInstant();
  const label = new Map<string, string>();
  const seed = async (name: string, date: string, hhmm: string, lat: number, lng: number) => {
    const order = await db.orm.public.Order.create({
      userId: ids.client, zoneId: ids.zone, deliveryAddress: name, status: 'PENDING',
      deliveryLat: lat, deliveryLng: lng, scheduledDeliveryDate: at(date, hhmm),
    });
    label.set(order.id, name);
    return order;
  };
  const proposals = async (date: string) => {
    const res = await api('get', `/route-proposals?date=${date}`).expect(200);
    const groups = (res.body.proposals as any[]).map((p) => ({
      stops: (p.stops as any[]).map((s) => ({ order: label.get(s.orderId) ?? s.orderId, scheduledAt: s.scheduledDeliveryDate ?? s.scheduledAt ?? null })),
      totalDistanceKm: p.totalDistanceKm, totalDurationSeconds: p.totalDurationSeconds,
    }));
    return { res, groups, names: groups.map((g) => g.stops.map((s) => s.order)) };
  };

  beforeAll(async () => {
    process.env.ROAD_ENGINE = 'OSRM';
    process.env.OSRM_BASE_URL = realUrl;
    process.env.OSRM_TIMEOUT_MS = '15000';
    startOwnedContainer();
    const url = createOwnedDatabase('ape4_' + randomUUID().replaceAll('-', '').slice(0, 8));
    runPrismaMigrate(url);
    process.env.JWT_SECRET = secret;
    db = postgres<Contract>({ contractJson, url });
    for (const [id, role] of [[ids.admin, 'ADMIN'], [ids.client, 'CLIENT'], [ids.driverUser, 'DRIVER']] as const)
      await db.orm.public.User.create({ id, role, name: role, email: id + '@fixture.invalid', password: 'not-a-real-password' });
    await db.orm.public.Driver.create({ id: ids.driver, userId: ids.driverUser, vehicle: 'fixture' });
    await db.orm.public.Zone.create({ id: ids.zone, code: 'CEN-01', name: 'Centro', depotLat: STORE.lat, depotLng: STORE.lng });
    await db.orm.public.SimulatedCard.create({ fixtureId: 'card-1', last4: '4242', active: true, balanceCents: 500000n });
    const { AppModule } = await import('../src/app.module.js');
    const { PrismaService } = await import('../src/database/prisma.service.js');
    const prisma = {
      client: db, orm: db.orm, sql: db.sql,
      user: db.orm.public.User, driver: db.orm.public.Driver, zone: db.orm.public.Zone, order: db.orm.public.Order,
      orderItem: db.orm.public.OrderItem, product: db.orm.public.Product, route: db.orm.public.Route,
    };
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(PrismaService).useValue(prisma).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
    await app.init();
  });

  afterAll(async () => {
    for (const key of ['ROAD_ENGINE', 'OSRM_BASE_URL', 'OSRM_TIMEOUT_MS']) delete process.env[key];
    await app?.close();
    await db?.close();
    cleanupOwnedResources();
  });

  it('CP-082: P1 10:00 y P2 10:20 (distantes) comparten ruta; P3 15:00 (cercano a P1) va en otra', async () => {
    const d = day(1);
    await seed('P1 10:00 Centro', d, '10:00', -1.2425, -78.6188);
    await seed('P2 10:20 lejano (norte)', d, '10:20', -1.2000, -78.5550);
    await seed('P3 15:00 cercano a P1', d, '15:00', -1.2430, -78.6190);
    const { res, groups, names } = await proposals(d);
    evidence('CP-082', { request: `GET /api/v1/route-proposals?date=${d} (ADMIN)`, status: res.status, distanceMethod: res.body.distanceMethod, timeWindowMarginMinutes: res.body.timeWindowMarginMinutes, summary: res.body.summary, groups });
    const withP1 = names.find((g) => g.some((n) => n.startsWith('P1')))!;
    expect(withP1.some((n) => n.startsWith('P2'))).toBe(true);
    expect(withP1.some((n) => n.startsWith('P3'))).toBe(false);
    expect(names.find((g) => g.some((n) => n.startsWith('P3')))!.some((n) => n.startsWith('P1'))).toBe(false);
  });

  it('CP-083: un único pedido elegible forma una ruta de 1 parada sin exigir mínimo de 4', async () => {
    const d = day(2);
    await seed('Único 11:00', d, '11:00', -1.2425, -78.6188);
    const { res, groups } = await proposals(d);
    evidence('CP-083', { request: `GET /api/v1/route-proposals?date=${d} (ADMIN)`, status: res.status, distanceMethod: res.body.distanceMethod, summary: res.body.summary, groups });
    expect(res.status).toBe(200);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.stops).toHaveLength(1);
  });

  it('CP-084: 4 pedidos compatibles (10:00-10:25) forman una ruta de 4 paradas', async () => {
    const d = day(3);
    await seed('A 10:00', d, '10:00', -1.2425, -78.6188);
    await seed('B 10:10', d, '10:10', -1.2380, -78.6120);
    await seed('C 10:15', d, '10:15', -1.2450, -78.6250);
    await seed('D 10:25', d, '10:25', -1.2500, -78.6100);
    const { res, groups } = await proposals(d);
    evidence('CP-084', { request: `GET /api/v1/route-proposals?date=${d} (ADMIN)`, status: res.status, summary: res.body.summary, groups });
    expect(groups).toHaveLength(1);
    expect(groups[0]!.stops).toHaveLength(4);
  });

  it('CP-085: 5 pedidos compatibles se dividen en rutas de máximo 4 paradas', async () => {
    const d = day(4);
    for (const [n, hhmm, lat, lng] of [['A', '10:00', -1.2425, -78.6188], ['B', '10:05', -1.2380, -78.6120], ['C', '10:10', -1.2450, -78.6250], ['D', '10:15', -1.2500, -78.6100], ['E', '10:20', -1.2300, -78.6200]] as const)
      await seed(`${n} ${hhmm}`, d, hhmm, lat, lng);
    const { res, groups, names } = await proposals(d);
    evidence('CP-085', { request: `GET /api/v1/route-proposals?date=${d} (ADMIN)`, status: res.status, summary: res.body.summary, groups });
    const all = names.flat();
    expect(new Set(all).size).toBe(5);
    expect(all).toHaveLength(5);
    for (const g of names) {
      expect(g.length).toBeGreaterThanOrEqual(1);
      expect(g.length).toBeLessThanOrEqual(4);
    }
    expect(Math.max(...names.map((g) => g.length))).toBeLessThan(5);
  });


  it('CP-100: UNIT_RECOVERY_CONFIRM y LOSS_DECLARE simultáneos sobre la misma unidad: exactamente uno gana', async () => {
    const product = await db.orm.public.Product.create({ name: 'Ramo APE4 c', price: 10, stock: 20 });
    const orders: Array<{ id: string; itemId: string }> = [];
    for (let i = 0; i < 4; i++) {
      const order = await db.orm.public.Order.create({
        userId: ids.client, zoneId: ids.zone, deliveryAddress: `Unidad ${i + 1} CP-100`, scheduledDeliveryDate: Temporal.Now.instant(),
        deliveryLat: -1.25 - i * 0.001, deliveryLng: -78.62,
      });
      const item = await db.orm.public.OrderItem.create({ orderId: order.id, productId: product.id, quantity: 1, price: 10, unitPriceCents: 1000n });
      orders.push({ id: order.id, itemId: item.id });
    }
    const driverUser2 = randomUUID();
    const driver2 = randomUUID();
    await db.orm.public.User.create({ id: driverUser2, role: 'DRIVER', name: 'DRIVER 2', email: driverUser2 + '@fixture.invalid', password: 'not-a-real-password' });
    await db.orm.public.Driver.create({ id: driver2, userId: driverUser2, vehicle: 'fixture 2' });
    const route = (await api('post', '/routes', { zoneId: ids.zone, routeDate: Temporal.Now.instant().toString(), orderIds: orders.map((o) => o.id) }).expect(201)).body;
    await api('post', `/routes/${route.id}/assign`, { driverId: driver2 }).expect(200);
    await api('post', `/routes/${route.id}/start`, {}, driverUser2, 'DRIVER').expect(200);
    const declared = (await intervene({ action: 'EMERGENCY_DECLARE', routeId: route.id, reason: 'Falla mecánica APE4' }).expect(200)).body;
    const emergencyId = declared.result.emergencyId as string;
    const races = [];
    for (const o of orders) {
      const recoveryId = (await db.orm.public.RouteUnitRecovery.where({ orderItemId: o.itemId, unitNumber: 1 }).first())!.id;
      const [recover, loss] = await Promise.all([
        intervene({ action: 'UNIT_RECOVERY_CONFIRM', recoveryId }),
        intervene({ action: 'LOSS_DECLARE', orderId: o.id, orderItemId: o.itemId, unitNumber: 1, emergencyId }),
      ]);
      const unit = (await db.orm.public.RouteUnitRecovery.where({ orderItemId: o.itemId, unitNumber: 1 }).first())!;
      const lossRows = await db.orm.public.OrderItemLoss.where({ orderItemId: o.itemId, unitNumber: 1, cancelledAt: null }).all();
      races.push({
        unit: o.itemId.slice(0, 8),
        unitRecovery: { status: recover.status, code: recover.body.code ?? null },
        lossDeclare: { status: loss.status, code: loss.body.code ?? null },
        persisted: { recovered: unit.recoveredAt != null, activeLosses: lossRows.length },
      });
      const statuses = [recover.status, loss.status].sort();
      expect(statuses).toEqual([200, 409]);
      const loser = recover.status === 409 ? recover : loss;
      expect(['UNIT_HAS_ACTIVE_LOSS', 'UNIT_ALREADY_RECOVERED']).toContain(loser.body.code);
      expect((unit.recoveredAt != null ? 1 : 0) + lossRows.length).toBe(1); // sin estado doble ni inconsistente
    }
    evidence('CP-100', { declared: { status: 200, emergencyId }, races });
  });


  it('CP-089: EMERGENCY_CLOSE con returnedAt NULL no libera al repartidor ni su reserva', async () => {
    const product = await db.orm.public.Product.create({ name: 'Ramo APE4 d', price: 10, stock: 5 });
    const order = await db.orm.public.Order.create({ userId: ids.client, zoneId: ids.zone, deliveryAddress: 'Pedido CP-089', scheduledDeliveryDate: Temporal.Now.instant(), deliveryLat: -1.25, deliveryLng: -78.62 });
    await db.orm.public.OrderItem.create({ orderId: order.id, productId: product.id, quantity: 1, price: 10, unitPriceCents: 1000n });
    const driverUser = randomUUID();
    const driverId = randomUUID();
    await db.orm.public.User.create({ id: driverUser, role: 'DRIVER', name: 'REPARTIDOR-A', email: driverUser + '@fixture.invalid', password: 'not-a-real-password' });
    await db.orm.public.Driver.create({ id: driverId, userId: driverUser, vehicle: 'fixture A' });
    const route = (await api('post', '/routes', { zoneId: ids.zone, routeDate: Temporal.Now.instant().toString(), orderIds: [order.id] }).expect(201)).body;
    await api('post', `/routes/${route.id}/assign`, { driverId: driverId }).expect(200);
    await api('post', `/routes/${route.id}/start`, {}, driverUser, 'DRIVER').expect(200);
    await intervene({ action: 'EMERGENCY_DECLARE', routeId: route.id, reason: 'Falla mecánica CP-089' }).expect(200);
    const unit = (await db.orm.public.RouteUnitRecovery.where({ orderId: order.id }).first())!;
    const closed = await intervene({ action: 'EMERGENCY_CLOSE', routeId: route.id, reason: 'Cierre administrativo CP-089' }).expect(200);
    const routeRow = (await db.orm.public.Route.where({ id: route.id }).first())!;
    const reservation = (await db.orm.public.DriverReservation.where({ routeId: route.id }).first())!;
    const availability = (await api('get', '/drivers/me/availability', undefined, driverUser, 'DRIVER').expect(200)).body;
    evidence('CP-089', {
      emergencyClose: { status: 200, result: closed.body.result },
      route: { status: routeRow.status, returnedAt: routeRow.returnedAt === null ? null : String(routeRow.returnedAt) },
      unitRecovery: { recoveredAt: unit.recoveredAt === null ? null : String(unit.recoveredAt) },
      driverReservation: { releasedAt: reservation.releasedAt === null ? null : String(reservation.releasedAt) },
      driverAvailability: availability,
    });
    expect(routeRow.status).toBe('INTERRUPTED');
    expect(routeRow.returnedAt).toBeNull();
    expect(unit.recoveredAt).toBeNull();
    expect(reservation.releasedAt).toBeNull();
    expect(JSON.stringify(availability)).not.toMatch(/"available":\s*true/);
  });

  it('CP-092: el reemplazo conserva el mismo pedido y no crea otro comprobante ni débito', async () => {
    const product = await db.orm.public.Product.create({ name: 'Ramo APE4', price: 10, stock: 3 });
    const order = await db.orm.public.Order.create({ userId: ids.client, zoneId: ids.zone, deliveryAddress: 'Pedido CP-092', total: 10, subtotalCents: 1000n });
    const item = await db.orm.public.OrderItem.create({ orderId: order.id, productId: product.id, quantity: 1, price: 10, unitPriceCents: 1000n });
    const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
    await db.orm.public.PurchaseReceipt.create({
      orderId: order.id, number: `REC-${suffix}`, commercialOrderNumber: `ORD-${suffix}`, buyerId: ids.client,
      subtotalCents: 1000n, taxEnabled: false, taxRateBps: 0, taxAmountCents: 0n, totalCents: 1000n, snapshot: { orderId: order.id },
    });
    await db.orm.public.PaymentAttempt.create({
      orderId: order.id, buyerId: ids.client, cardFixtureId: 'card-1', subtotalCents: 1000n, taxEnabled: false, taxRateBps: 0,
      taxAmountCents: 0n, totalCents: 1000n, amountCents: 1000n, cardLast4: '4242', reference: `PAY-${suffix}`,
    });
    const snapshot = async () => ({
      orders: (await db.orm.public.Order.where({ id: order.id }).all()).length,
      receipts: (await db.orm.public.PurchaseReceipt.where({ orderId: order.id }).all()).length,
      payments: (await db.orm.public.PaymentAttempt.where({ orderId: order.id }).all()).length,
      cardBalanceCents: String((await db.orm.public.SimulatedCard.where({ fixtureId: 'card-1' }).first())!.balanceCents),
      orderRow: await db.orm.public.Order.where({ id: order.id }).first(),
    });
    const before = await snapshot();
    const res = await intervene({ action: 'LOSS_DECLARE', orderId: order.id, orderItemId: item.id }).expect(200);
    const after = await snapshot();
    const history = (await api('get', `/dispatch/orders/${order.id}/losses`).expect(200)).body;
    evidence('CP-092', { request: 'POST /api/v1/dispatch/interventions LOSS_DECLARE', response: res.body, before: { ...before, orderRow: undefined }, after: { ...after, orderRow: undefined }, lossHistory: history });
    expect(after.orders).toBe(1);
    expect(after.receipts).toBe(1);
    expect(after.payments).toBe(1);
    expect(after.cardBalanceCents).toBe(before.cardBalanceCents);
    expect(after.orderRow!.id).toBe(order.id);
    expect(history).toEqual([expect.objectContaining({ orderId: order.id, replacement: expect.objectContaining({ state: 'PREPARED' }) })]);
  });

  it('CP-094: con el reemplazo PREPARED, CONTACT y RESCHEDULE auditan la fecha acordada sin entrega ficticia', async () => {
    const product = await db.orm.public.Product.create({ name: 'Ramo APE4 b', price: 10, stock: 3 });
    const order = await db.orm.public.Order.create({
      userId: ids.client, zoneId: ids.zone, deliveryAddress: 'Pedido CP-094', scheduledDeliveryDate: Temporal.Now.instant(),
      deliveryLat: -1.25, deliveryLng: -78.62,
    });
    const item = await db.orm.public.OrderItem.create({ orderId: order.id, productId: product.id, quantity: 1, price: 10, unitPriceCents: 1000n });
    const route = (await api('post', '/routes', { zoneId: ids.zone, routeDate: Temporal.Now.instant().toString(), orderIds: [order.id] }).expect(201)).body;
    await api('post', `/routes/${route.id}/assign`, { driverId: ids.driver }).expect(200);
    await api('post', `/routes/${route.id}/start`, {}, ids.driverUser, 'DRIVER').expect(200);
    const stop = (await api('get', `/routes/${route.id}`).expect(200)).body.stops[0];
    await api('post', `/routes/${route.id}/stops/${stop.id}/failure`, { requestId: randomUUID(), reason: 'RECIPIENT_ABSENT', context: 'Sin contexto adicional' }, ids.driverUser, 'DRIVER').expect(200);
    const attemptId = (await api('get', `/routes/${route.id}`).expect(200)).body.stops[0].attempts[0].id;
    await api('post', `/routes/${route.id}/complete`, {}, ids.driverUser, 'DRIVER').expect(200);

    const loss = await intervene({ action: 'LOSS_DECLARE', orderId: order.id, orderItemId: item.id, attemptId }).expect(200);
    expect(loss.body.result.replacement).toBe('PREPARED');
    const agreed = at(day(2), '12:00');
    const contact = (await intervene({
      action: 'CONTACT', orderId: order.id, attemptId, agreementConfirmed: true,
      scheduledDeliveryDate: agreed.toString(),
      deliveryWindowStart: agreed.subtract({ minutes: 30 }).toString(), deliveryWindowEnd: agreed.add({ minutes: 30 }).toString(),
    }).expect(200)).body;
    const resched = (await intervene({ action: 'RESCHEDULE', orderId: order.id, agreementId: contact.id }).expect(200)).body;
    const after = await db.orm.public.Order.where({ id: order.id }).first();
    const audits = (await db.orm.public.DispatchIntervention.where({ orderId: order.id }).all()).map((a) => ({ action: a.action, actorId: a.actorId, outcome: a.outcome }));
    const routesOfOrder = (await db.orm.public.RouteStop.where({ orderId: order.id }).all()).length;
    evidence('CP-094', {
      lossDeclare: loss.body, contact, reschedule: resched,
      orderAfter: { status: after!.status, scheduledDeliveryDate: String(after!.scheduledDeliveryDate), requiresAdministrativeReview: after!.requiresAdministrativeReview, routeId: after!.routeId },
      agreedDate: agreed.toString(), audits, routeStopsOfOrder: routesOfOrder,
    });
    expect(String(after!.scheduledDeliveryDate)).toBe(agreed.toString());
    expect(after!.status).not.toBe('DELIVERED');
    expect(audits.map((a) => a.action).sort()).toEqual(['CONTACT', 'LOSS_DECLARE', 'RESCHEDULE']);
    expect(routesOfOrder).toBe(1); // solo la parada fallida original: no se creó otra entrega
  });
});
