# APE4 — Informe de Pruebas del Sistema REGALÍA

Repositorio limpio para registrar los resultados de ejecución de los **107 casos de prueba** (`CP-001`–`CP-107`) y generar el informe final en PDF (`APE4_Informe_REGALIA.pdf`).

## Estructura del repositorio

- `APE4_Informe_REGALIA.tex` — Documento principal LaTeX.
- `APE4_Informe_REGALIA.pdf` — Informe compilado en PDF (entregable único).
- `secciones/` — Fichas de diseño (`disenio.tex`), ejecución (`ejecucion.tex`) y defectos (`defectos.tex`).
- `evidencias/` — Capturas de pantalla (`CP-XXX.png`) que LaTeX inserta automáticamente en la sección `2.7.4`.
- `catalogo-pruebas-regalia.md` — Referencia completa de los 107 casos de prueba en Markdown.
- `picture/logo.pdf` — Encabezado institucional.
- `compilar.sh` — Script para compilar el PDF en dos pasadas manteniendo limpia la raíz.

## Distribución de archivos por integrante

Para evitar conflictos en Git, cada integrante edita **únicamente** su archivo `ejecucion.tex` y agrega sus capturas en `evidencias/`:

| Integrante | Área | Rango de casos | Archivo a editar |
|---|---|---|---|
| Saimol Jimenez | Backend | `CP-001`–`CP-027` | `secciones/backend/ejecucion.tex` |
| Kerly Chicaiza | Frontend Web | `CP-028`–`CP-054` | `secciones/frontend/ejecucion.tex` |
| Carlos Ramos | Móvil | `CP-055`–`CP-081` | `secciones/movil/ejecucion.tex` |
| José Mateo Auz | Calidad y consolidación | `CP-082`–`CP-107` | `secciones/calidad/ejecucion.tex` y `secciones/defectos.tex` |

## Cómo registrar un caso ejecutado

En su archivo `secciones/<area>/ejecucion.tex`, cada caso usa la macro `\casoejec` con 6 parámetros:

```latex
\casoejec{CP-001}
  {Compra ADMIN para cliente con destinatario de regalo}
  {Descripción real de lo observado al ejecutar la prueba.}
  {PASS}
  {Referencia de log, suite automatizada o comando ejecutado.}
  {Ninguno}
```

- **Estado:** `PASS`, `FAIL`, `BLOCKED` o `N/A`.
- **Defecto:** código del defecto (`DEF-01`, etc.) si falló, o `Ninguno` si pasó.
- **Resultado obtenido:** descripción de la respuesta, comportamiento observado o causa de fallo/bloqueo.
- **Evidencia gráfica:** si se guarda `evidencias/CP-001.png` (respetando mayúsculas en `CP-XXX.png`), se inserta automáticamente dentro de su ficha `2.7.4.X`.

Al finalizar la ejecución de todo el equipo, Calidad completa las filas de versión en `2.7.3`, la tabla de conteos en `2.7.6` y ajusta `2.8 Conclusiones` en `APE4_Informe_REGALIA.tex`.

## Cómo compilar el PDF

```bash
./compilar.sh
```

También se puede subir el contenido completo del repositorio directamente a **Overleaf** (compilador `pdfLaTeX`, documento principal `APE4_Informe_REGALIA.tex`).
