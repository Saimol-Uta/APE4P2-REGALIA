#!/usr/bin/env python3
"""Render the CP-027 failure excerpt from a recorded Jest run."""
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

if len(sys.argv) != 2:
    raise SystemExit('Usage: render-cp027.py JEST_LOG')
log = Path(sys.argv[1]).read_text(encoding='utf-8')
required = ['CP-027: Liberación auditada de DRAFT caducado (RELEASE_DRAFT)',
            'Expected length: 1', 'Received length: 0', 'Received array:  []',
            'expect(proposalsRes.body.proposals).toHaveLength(1);',
            'Tests:       2 failed, 13 passed, 15 total']
if any(text not in log for text in required):
    raise SystemExit('Required observed failure evidence is missing')
root = Path(__file__).resolve().parents[2]
image = Image.new('RGB', (1500, 420), '#111827')
draw = ImageDraw.Draw(image)
font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf', 22)
bold = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf', 26)
draw.text((35, 25), 'CP-027 - evidencia automatizada', font=bold, fill='#f9fafb')
lines = ['FAIL CP-027: Liberación auditada de DRAFT caducado',
         'Expected length: 1', 'Received length: 0', 'Received array:  []',
         'expect(proposalsRes.body.proposals).toHaveLength(1);',
         'Tests:       2 failed, 13 passed, 15 total']
for i, text in enumerate(lines):
    draw.text((35, 95 + 45 * i), text, font=font, fill='#fca5a5' if i in (0, 5) else '#f9fafb')
image.save(root / 'evidencias/CP-027.png')
print('Rendered CP-027 from observed Jest failure')
