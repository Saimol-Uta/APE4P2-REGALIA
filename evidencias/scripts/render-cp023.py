#!/usr/bin/env python3
"""Render the observed CP-023 failure excerpt from the real Jest log."""
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

if len(sys.argv) != 2:
    raise SystemExit('Usage: render-cp023.py JEST_LOG')
log = Path(sys.argv[1]).read_text(encoding='utf-8')
required = ['CP-023: Exclusión en propuestas y 409 en asignación sin fecha',
            'Expected: true', 'Received: false', 'Tests:       1 failed, 14 passed, 15 total',
            'expect(proposalsRes.body.excluded.some((e: any) => e.orderId === order.id)).toBe(true);']
if any(text not in log for text in required):
    raise SystemExit('Required observed failure evidence is missing')
root = Path(__file__).resolve().parents[2]
image = Image.new('RGB', (1600, 420), '#111827')
draw = ImageDraw.Draw(image)
font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf', 21)
bold = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf', 25)
draw.text((35, 25), 'CP-023 - evidencia automatizada', font=bold, fill='#f9fafb')
draw.text((35, 95), 'FAIL  CP-023: Exclusión en propuestas y 409 en asignación sin fecha', font=font, fill='#fca5a5')
draw.text((35, 150), 'Expected: true', font=font, fill='#f9fafb')
draw.text((35, 185), 'Received: false', font=font, fill='#f9fafb')
draw.text((35, 240), 'expect(proposalsRes.body.excluded.some((e: any) =>', font=font, fill='#d1d5db')
draw.text((35, 275), '  e.orderId === order.id)).toBe(true);', font=font, fill='#d1d5db')
draw.text((35, 340), 'Tests:       1 failed, 14 passed, 15 total', font=font, fill='#fca5a5')
image.save(root / 'evidencias/CP-023.png')
print('Rendered CP-023 from observed Jest failure')
