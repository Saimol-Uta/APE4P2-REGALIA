#!/usr/bin/env python3
"""Render the actual joint Jest summary for the fourteen passing case blocks."""
import re
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

if len(sys.argv) != 3:
    raise SystemExit('Usage: render-backend-rutas.py LOG TEST_SOURCE')
root = Path(__file__).resolve().parents[2]
log = Path(sys.argv[1]).read_text(encoding='utf-8')
source = Path(sys.argv[2]).read_text(encoding='utf-8')
summary = [line for line in log.splitlines() if line.startswith(('Test Suites:', 'Tests:', 'Snapshots:', 'Time:'))]
if 'Tests:       1 failed, 14 passed, 15 total' not in summary or 'CP-023: Exclusión' not in log:
    raise SystemExit('Expected observed routing-suite summary and CP-023 failure not found')
cases = re.findall(r"it\('(CP-0\d\d): ([^']+)'", source)
expected = {f'CP-{n:03d}' for n in range(13, 28)}
if len(cases) != 15 or {case for case, _ in cases} != expected:
    raise SystemExit('Test source does not contain exactly CP-013 through CP-027')
font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf', 21)
bold = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf', 25)
for case, _ in cases:
    if case == 'CP-023':
        continue
    image = Image.new('RGB', (1400, 420), '#111827')
    draw = ImageDraw.Draw(image)
    draw.text((35, 25), f'{case} - evidencia automatizada', font=bold, fill='#f9fafb')
    draw.text((35, 120), 'Suite: test/ape4-backend-routing.e2e-spec.ts', font=font, fill='#d1d5db')
    draw.text((35, 157), f'Prueba en el codigo: {case}', font=font, fill='#d1d5db')
    for i, line in enumerate(summary):
        draw.text((35, 210 + i * 32), line, font=font, fill='#fbbf24')
    image.save(root / f'evidencias/{case}.png')
print('Generated 14 images from the observed joint Jest summary')
