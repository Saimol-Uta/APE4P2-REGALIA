#!/usr/bin/env python3
"""Render historical failure and recorded revised-suite summary side by side."""
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

if len(sys.argv) != 4:
    raise SystemExit('Usage: render-casos-revisados.py OLD_023_LOG OLD_027_LOG NEW_LOG')
old23, old27, new = [Path(p).read_text(encoding='utf-8') for p in sys.argv[1:]]
if ('CP-023:' not in old23 or 'Expected: true' not in old23 or 'Received: false' not in old23
    or 'CP-027:' not in old27 or 'Expected length: 1' not in old27 or 'Received length: 0' not in old27
    or 'Tests:       15 passed, 15 total' not in new or 'Test Suites: 1 passed, 1 total' not in new):
    raise SystemExit('Recorded historical or revised test results missing')
root = Path(__file__).resolve().parents[2]
font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf', 21)
bold = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf', 25)
for case, before in [('CP-023', ['Expected: true', 'Received: false']),
                     ('CP-027', ['Expected length: 1', 'Received length: 0'])]:
    image = Image.new('RGB', (1500, 470), '#111827')
    draw = ImageDraw.Draw(image)
    draw.text((35, 25), f'{case} - evidencia automatizada', font=bold, fill='#f9fafb')
    draw.text((35, 100), 'Ejecucion anterior: FAIL (expectativa original)', font=font, fill='#fca5a5')
    for i, line in enumerate(before):
        draw.text((35, 140 + i * 35), line, font=font, fill='#f9fafb')
    draw.text((35, 250), 'Suite revisada: Test Suites: 1 passed, 1 total', font=font, fill='#a7f3d0')
    draw.text((35, 290), 'Tests: 15 passed, 15 total', font=font, fill='#a7f3d0')
    draw.text((35, 350), 'CP-027: reprogramacion via HTTP para fecha futura.', font=font, fill='#d1d5db') if case == 'CP-027' else None
    image.save(root / f'evidencias/{case}.png')
print('Rendered historical and revised suite evidence for CP-023 and CP-027')
