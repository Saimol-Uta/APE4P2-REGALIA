import { type ChildProcess, execFileSync, spawn } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { cleanupOwnedResources, createOwnedDatabase, runPrismaMigrate, startOwnedContainer } from './test/geolocation-migration.fixtures.js';
import { VOLUME_SIZES, buildDataset, datasetChecksum, theoreticalRoutes } from './benchmarks/load/dataset.js';
import { cleanupPerf, seedPerf } from './benchmarks/load/seed.js';
import { summarizeLatencies } from './benchmarks/load/stats.js';
import { mintJwt } from './benchmarks/load/fixture.js';

/**
 * APE4 CP-102..104: latencia de GET /route-proposals con 100, 500 y 2000 pedidos, con el motor vial OSRM REAL local,
 * una base PostgreSQL desechable y la API en 127.0.0.1. Uso:
 *   APE4_OUT=<carpeta> OSRM_URL=http://127.0.0.1:5001 pnpm tsx ape4-volume.ts
 */
const OUT = process.env['APE4_OUT']!;
const OSRM = process.env['OSRM_URL']!;
const RUNS = Number(process.env['APE4_RUNS'] ?? '7');
if (!OUT || !/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(OSRM ?? '')) throw new Error('APE4_OUT y OSRM_URL (local) son obligatorios');
const PORT = 3101;
const BASE = `http://127.0.0.1:${PORT}`;
const log = (m: string) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const sh = (cmd: string, args: string[]) => execFileSync(cmd, args, { encoding: 'utf8' }).trim();

async function main() {
  mkdirSync(OUT, { recursive: true });
  const secret = randomBytes(32).toString('hex');
  const container = startOwnedContainer();
  const dbName = `ape4perf_${randomUUID().replaceAll('-', '').slice(0, 10)}`;
  const dbUrl = createOwnedDatabase(dbName);
  runPrismaMigrate(dbUrl);
  process.env['DATABASE_URL'] = dbUrl;
  process.env['JWT_SECRET'] = secret;
  const { db } = await import('./src/prisma/db.js');
  let api: ChildProcess | undefined;
  const results: unknown[] = [];
  try {
    const adminId = randomUUID();
    const ensureAdmin = () =>
      db.transaction((tx) =>
        tx.execute(db.raw.sql`INSERT INTO public."user" ("id","name","email","password","role","createdAt")
          VALUES (${adminId}, 'Admin Perf', 'perf-admin@perf.test', 'perf-fixture-no-login', 'ADMIN', clock_timestamp())
          ON CONFLICT ("email") DO NOTHING`.affectedCount().build()),
      );
    await ensureAdmin();
    const token = mintJwt(secret, { sub: adminId, email: 'perf-admin@perf.test', role: 'ADMIN' }, 3600);
    api = spawn(process.execPath, ['dist/main.js'], {
      stdio: ['ignore', 'ignore', 'ignore'],
      env: { ...process.env, PORT: String(PORT), DATABASE_URL: dbUrl, JWT_SECRET: secret, NODE_ENV: 'test', ROAD_ENGINE: 'OSRM', OSRM_BASE_URL: OSRM, OSRM_TIMEOUT_MS: '120000' },
    });
    for (let i = 0; i < 120; i++) {
      try { if ((await fetch(`${BASE}/api/v1/route-proposals/road-engine`, { headers: { Authorization: `Bearer ${token}` } })).ok) break; } catch { /* arrancando */ }
      await sleep(500);
    }
    const engine = await (await fetch(`${BASE}/api/v1/route-proposals/road-engine`, { headers: { Authorization: `Bearer ${token}` } })).json();
    log(`motor vial: ${JSON.stringify(engine)}`);
    for (const size of VOLUME_SIZES) {
      await cleanupPerf(db);
      await ensureAdmin();
      const dataset = buildDataset(size);
      const t0 = performance.now();
      await seedPerf(db, dataset);
      const seedMs = performance.now() - t0;
      const times: number[] = [];
      let errors = 0;
      let summary: unknown = null;
      let method: unknown = null;
      let errorSample: unknown = null;
      for (let run = 0; run < RUNS; run++) {
        const start = performance.now();
        const res = await fetch(`${BASE}/api/v1/route-proposals?date=${dataset.date}`, { headers: { Authorization: `Bearer ${token}` } });
        const body = (await res.json()) as { summary?: unknown; distanceMethod?: string };
        times.push(performance.now() - start);
        if (!res.ok || !body.summary) { errors++; errorSample ??= { status: res.status, body }; }
        else { summary = body.summary; method = body.distanceMethod; }
      }
      const stats = summarizeLatencies(times);
      log(`${size} pedidos: ${JSON.stringify(stats)} errores=${errors} método=${String(method)} muestra=${JSON.stringify(errorSample)}`);
      results.push({ size, checksum: datasetChecksum(dataset), theoreticalRoutes: theoreticalRoutes(dataset), seedMs: Math.round(seedMs), runs: RUNS, timesMs: times.map((t) => Math.round(t)), stats, errors, errorSample, distanceMethod: method, summary });
    }
    await cleanupPerf(db);
    const environment = {
      date: new Date().toISOString(),
      commit: sh('git', ['rev-parse', 'HEAD']),
      node: process.version,
      os: `${os.type()} ${os.release()} (${os.arch()})`,
      cpu: os.cpus()[0]?.model, threads: os.cpus().length, memoryGB: Math.round((os.totalmem() / 1024 ** 3) * 10) / 10,
      postgres: 'postgres:16-alpine (Docker, contenedor desechable)',
      roadEngine: { engine, image: 'osrm/osrm-backend v5.26.0 (mld)', map: 'ecuador-latest.osm.pbf (Geofabrik)' },
      generator: 'ape4-volume.ts (fetch de Node, un solo cliente secuencial; sin JMeter ni k6)',
      maxPoints: process.env['OSRM_MAX_POINTS'] ?? 'por defecto (300)', shared: 'API, PostgreSQL, OSRM y el generador comparten la misma laptop',
    };
    writeFileSync(path.join(OUT, `volumen-${process.env['APE4_TAG'] ?? 'run'}.json`), JSON.stringify({ environment, results }, null, 2));
    log('listo');
  } finally {
    api?.kill();
    await sleep(500);
    cleanupOwnedResources();
    void container;
  }
}
main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
