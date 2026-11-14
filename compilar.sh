#!/usr/bin/env bash
set -euo pipefail

mkdir -p .build
pdflatex -interaction=nonstopmode -halt-on-error -output-directory=.build APE4_Informe_REGALIA.tex > .build/pass1.log 2>&1
pdflatex -interaction=nonstopmode -halt-on-error -output-directory=.build APE4_Informe_REGALIA.tex > .build/pass2.log 2>&1
cp .build/APE4_Informe_REGALIA.pdf APE4_Informe_REGALIA.pdf
echo "PDF generado: APE4_Informe_REGALIA.pdf ($(pdfinfo APE4_Informe_REGALIA.pdf | awk '/Pages:/ {print $2}') páginas)"
