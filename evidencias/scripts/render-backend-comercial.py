#!/usr/bin/env python3
"""Render a shared Jest summary as clearly labelled case evidence cards."""
import re
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

if len(sys.argv) != 3:
    raise SystemExit('Usage: render-backend-comercial.py LOG TEST_SOURCE')
root = Path(__file__).resolve().parents[2]
log = Path(sys.argv[1]).read_text(encoding='utf-8')
source = Path(sys.argv[2]).read_text(encoding='utf-8')
summary = [line for line in log.splitlines() if line.startswith(('Test Suites:', 'Tests:', 'Snapshots:', 'Time:'))]
if not any('12 passed, 12 total' in line for line in summary):
    raise SystemExit('Expected successful 12-test summary not found; no images written')
cases = re.findall(r"it\('(CP-0\d\d): ([^']+)'", source)
if [case for case, _ in cases] != [f'CP-{n:03d}' for n in range(1, 13)]:
    raise SystemExit('Test source does not have exactly CP-001 through CP-012')
out = root / 'evidencias'
font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf', 21)
bold = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf', 25)
for case, title in cases:
    image = Image.new('RGB', (1400, 420), '#111827')
    draw = ImageDraw.Draw(image)
    draw.text((35, 25), f'{case} - evidencia automatizada', font=bold, fill='#f9fafb')
    draw.text((35, 120), 'Suite: test/ape4-backend-commercial.e2e-spec.ts', font=font, fill='#d1d5db')
    draw.text((35, 157), f'Prueba en el codigo: {case}', font=font, fill='#d1d5db')
    y = 210
    for line in summary:
        draw.text((35, y), line, font=font, fill='#a7f3d0')
        y += 32
    image.save(out / f'{case}.png')
print(f'Generated {len(cases)} labelled renderings from recorded Jest output')
