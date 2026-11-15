#!/usr/bin/env python3
"""Render recorded real-OSRM and routing-suite results for CP-021."""
import json
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

if len(sys.argv) != 3:
    raise SystemExit('Usage: render-cp021.py OSRM_LOG ROUTING_LOG')
real = Path(sys.argv[1]).read_text(encoding='utf-8')
routing = Path(sys.argv[2]).read_text(encoding='utf-8')
marker = 'EVIDENCIA OSRM REAL '
line = next((line for line in real.splitlines() if marker in line), None)
if not line or 'Tests:       2 passed, 2 total' not in real or 'Tests:       1 failed, 14 passed, 15 total' not in routing:
    raise SystemExit('Required real-OSRM or joint routing result missing')
evidence = json.loads(line.split(marker, 1)[1])
if evidence.get('distanceMethod') != 'OSRM_ROAD_NETWORK' or evidence.get('roadMetrics', {}).get('provider') != 'OSRM':
    raise SystemExit('Real OSRM evidence is inconsistent')
root = Path(__file__).resolve().parents[2]
image = Image.new('RGB', (1500, 480), '#111827')
draw = ImageDraw.Draw(image)
font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf', 22)
bold = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf', 26)
draw.text((35, 25), 'CP-021 - evidencia automatizada', font=bold, fill='#f9fafb')
lines = [
    'Suite motor OSRM real: 2 passed, 2 total',
    'distanceMethod: ' + evidence['distanceMethod'],
    'provider: ' + evidence['roadMetrics']['provider'] + ' | orders: ' + str(evidence['orders']),
    'totalDistanceKm: ' + str(evidence['totalDistanceKm']) + ' | totalDurationSeconds: ' + str(evidence['totalDurationSeconds']),
    'Suite de margen y desempate: 14 passed, 1 failed (CP-023)',
    'Desempate probado con matrices simuladas; OSRM real probado aparte.',
]
for i, text in enumerate(lines):
    draw.text((35, 100 + 48 * i), text, font=font, fill='#d1d5db')
image.save(root / 'evidencias/CP-021.png')
print('Rendered CP-021 using actual OSRM and routing suite results')
