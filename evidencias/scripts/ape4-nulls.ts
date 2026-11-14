import { buildDataset } from './benchmarks/load/dataset.js';

// Diagnóstico APE4: ¿qué pares de puntos del dataset de 2000 pedidos devuelven null en la matriz del OSRM real?
const OSRM = process.env['OSRM_URL']!;
const ds = buildDataset(2000);
const pts = [...ds.zones.map((z) => ({ lat: z.depotLat, lng: z.depotLng, name: `depot ${z.code}` })), ...ds.orders.map((o, i) => ({ lat: o.lat, lng: o.lng, name: `pedido ${i}` }))];
const TILE = 50;
const nullsBySource = new Map<number, number>();
const nullsByDest = new Map<number, number>();
let totalNull = 0;
let pairs = 0;
const badDistance: Array<{ i: number; j: number; v: string }> = [];
const badDuration: Array<{ i: number; j: number; v: string }> = [];
for (let i = 0; i < pts.length; i += TILE) {
  for (let j = 0; j < pts.length; j += TILE) {
    const src = pts.slice(i, i + TILE);
    const dst = pts.slice(j, j + TILE);
    const coords = [...src, ...dst].map((p) => `${p.lng},${p.lat}`).join(';');
    const s = src.map((_, k) => k).join(';');
    const d = dst.map((_, k) => src.length + k).join(';');
    let body: { code: string; durations?: Array<Array<number | null>>; distances?: Array<Array<number | null>> } | undefined;
    for (let attempt = 0; attempt < 5 && !body; attempt++) {
      try {
        const res = await fetch(`${OSRM}/table/v1/driving/${coords}?sources=${s}&destinations=${d}&annotations=duration,distance`);
        body = (await res.json()) as { code: string; durations?: Array<Array<number | null>>; distances?: Array<Array<number | null>> };
      } catch { await new Promise((r) => setTimeout(r, 300)); }
    }
    if (!body) { console.log('tile', i, j, 'sin respuesta'); continue; }
    if (body.code !== 'Ok' || !body.durations) { console.log('tile', i, j, 'code', body.code); continue; }
    body.distances?.forEach((row, a) => row.forEach((v, b) => {
      if (i + a !== j + b && v !== null && !(typeof v === 'number' && Number.isFinite(v) && v >= 0)) {
        badDistance.push({ i: i + a, j: j + b, v: String(v) });
      }
    }));
    body.durations.forEach((row, a) => row.forEach((v, b) => {
      if (i + a !== j + b && v !== null && !(typeof v === 'number' && Number.isFinite(v) && v >= 0)) badDuration.push({ i: i + a, j: j + b, v: String(v) });
      pairs++;
      if (v === null) {
        totalNull++;
        nullsBySource.set(i + a, (nullsBySource.get(i + a) ?? 0) + 1);
        nullsByDest.set(j + b, (nullsByDest.get(j + b) ?? 0) + 1);
      }
    }));
  }
}
console.log(JSON.stringify({ badDistance: badDistance.length, badDuration: badDuration.length, sample: [...badDistance.slice(0, 3), ...badDuration.slice(0, 3)], points: pts.length, pairs, nullPairs: totalNull, sourcesWithNulls: nullsBySource.size, destsWithNulls: nullsByDest.size,
  worst: [...nullsBySource.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => ({ point: pts[k]!.name, lat: pts[k]!.lat, lng: pts[k]!.lng, nullsInRow: v })) }, null, 1));
