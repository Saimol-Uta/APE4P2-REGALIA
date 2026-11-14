"""APE4 — Módulo Móvil: genera evidencias/CP-XXX.png (estilo terminal) a partir de evidencias/json/CP-XXX.json.

Solo para los casos ejecutados por API (los casos del teléfono ya tienen captura real del dispositivo).
Uso: python evidencias/scripts/ape4-movil-capturas.py
"""
import json
import re
import textwrap
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
CASOS = ["CP-055", "CP-056", "CP-058", "CP-059", "CP-061", "CP-062", "CP-063", "CP-064", "CP-065",
         "CP-066", "CP-068", "CP-069", "CP-070", "CP-071", "CP-072", "CP-078", "CP-080", "CP-081"]
FONT = ImageFont.truetype("C:/Windows/Fonts/consola.ttf", 17)
BOLD = ImageFont.truetype("C:/Windows/Fonts/consolab.ttf", 19)
BG, FG, MUTED, BLUE, GREEN, RED, YEL = "#16191f", "#e6e6e6", "#9aa0a6", "#8ab4f8", "#81c995", "#f28b82", "#fdd663"
WIDTH, LINE, WRAP = 1500, 25, 128
UUID = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")


def corto(texto: str) -> str:
    return UUID.sub(lambda m: m.group(0)[:8], texto)


def render(caso: str) -> None:
    data = json.loads((ROOT / "evidencias/json" / f"{caso}.json").read_text(encoding="utf-8"))
    estado = data["estado"]
    filas = [(f"{caso} — {data['titulo']}", BLUE, BOLD),
             (f"Estado (verificaciones API): {data.get('estadoAPI', estado)}", GREEN if estado == "PASS" else RED, BOLD),
             ("Comando: node evidencias/scripts/ape4-movil.mjs  (HTTP real con JWT de login)", MUTED, FONT),
             (f"Backend: commit 9b17cce · API {data['api']} · PostgreSQL 16 aislado (logistica_ape4_movil) · {data['ejecutado'][:10]}", MUTED, FONT),
             ("", FG, FONT)]
    peticiones = [p for p in data["peticiones"] if not p["request"].startswith("GET /api/v1/routes/") or len(data["peticiones"]) < 14]
    for p in peticiones[:14]:
        color = GREEN if p["status"] < 300 else (YEL if p["status"] < 500 else RED)
        filas.append((corto(f"{p['request']} ({p['actor']}) → HTTP {p['status']}"), color, FONT))
        r = p.get("response")
        if p["status"] >= 400 and isinstance(r, dict):
            err = r.get("error") if isinstance(r.get("error"), dict) else {}
            msg = err.get("code") or r.get("code") or r.get("message") or r.get("error")
            if msg:
                filas.append((corto(f"    ↳ {msg if isinstance(msg, str) else json.dumps(msg, ensure_ascii=False)}"), MUTED, FONT))
    if len(peticiones) > 14:
        filas.append((f"… {len(peticiones) - 14} peticiones más en evidencias/json/{caso}.json", MUTED, FONT))
    filas.append(("", FG, FONT))
    for v in data["verificaciones"]:
        detalle = "" if v.get("detalle") in (None, "") else f"  {json.dumps(v['detalle'], ensure_ascii=False)}"
        texto = corto(f"[{'OK' if v['ok'] else 'FALLA'}] {v['descripcion']}{detalle}")
        filas.append((texto, GREEN if v["ok"] else RED, FONT))
    for n in data.get("notas", []):
        filas.append((f"nota: {n}", MUTED, FONT))
    lineas = []
    for texto, color, fuente in filas:
        partes = textwrap.wrap(texto, WRAP, subsequent_indent="    ") or [""]
        lineas += [(t, color, fuente) for t in partes]
    img = Image.new("RGB", (WIDTH, 30 + LINE * len(lineas) + 20), BG)
    dib = ImageDraw.Draw(img)
    for i, (texto, color, fuente) in enumerate(lineas):
        dib.text((22, 22 + i * LINE), texto, fill=color, font=fuente)
    img.save(ROOT / "evidencias" / f"{caso}.png")


if __name__ == "__main__":
    for c in CASOS:
        render(c)
        print("ok", c)
