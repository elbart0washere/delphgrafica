#!/usr/bin/env bash
# Verifica el sitio publicado (Historia 7 de la spec). Uso: ./scripts/check-deploy.sh [dominio]
# Sale con código distinto de 0 si algún chequeo falla.
set -uo pipefail

DOMAIN="${1:-delphgrafica.com.ar}"
FAILED=0

check() {
  local label="$1"; shift
  if "$@" >/dev/null 2>&1; then echo "  ok   $label"; else echo "  FALLA $label"; FAILED=1; fi
}

# Se guarda el cuerpo en una variable: con `curl | grep -q` y pipefail, grep cierra la tubería al primer acierto
# y curl termina con error (SIGPIPE), lo que daría un falso negativo.
body_has() { local body; body="$(curl -fsS --max-time 20 "$1")" || return 1; grep -q "$2" <<<"$body"; }
body_lacks() { local body; body="$(curl -fsS --max-time 20 "$1")" || return 1; ! grep -q "$2" <<<"$body"; }
redirects_to() { [ "$(curl -sS --max-time 20 -o /dev/null -w '%{redirect_url}' "$1")" = "$2" ]; }
status_is() { [ "$(curl -sS --max-time 20 -o /dev/null -w '%{http_code}' "$1")" = "$2" ]; }

echo "US7-S1: https://$DOMAIN carga con certificado válido"
check "responde 200 sin errores de certificado" status_is "https://$DOMAIN/" 200
check "ya no muestra el aviso de construcción" body_lacks "https://$DOMAIN/" "Sitio en construcción"

echo "US7-S2: http y www terminan en https://$DOMAIN"
check "http://$DOMAIN/ redirige a https://$DOMAIN/" redirects_to "http://$DOMAIN/" "https://$DOMAIN/"
check "https://www.$DOMAIN/ redirige a https://$DOMAIN/" redirects_to "https://www.$DOMAIN/" "https://$DOMAIN/"

echo "Lo interno no se publica"
for path in docs/PRD.md docs/ specs/; do
  check "/$path da 404" status_is "https://$DOMAIN/$path" 404
done

echo "SEO: lo que Google lee está publicado"
check "robots.txt apunta al sitemap" body_has "https://$DOMAIN/robots.txt" "Sitemap: https://$DOMAIN/sitemap.xml"
check "sitemap.xml lista el inicio" body_has "https://$DOMAIN/sitemap.xml" "<loc>https://$DOMAIN/</loc>"
check "sitemap.xml lista el portfolio" body_has "https://$DOMAIN/sitemap.xml" "<loc>https://$DOMAIN/portfolio.html</loc>"
check "sitemap.xml lista Gráfica en Moreno" body_has "https://$DOMAIN/sitemap.xml" "<loc>https://$DOMAIN/grafica-en-moreno.html</loc>"
check "sitemap.xml lista Gráfica en Paso del Rey" body_has "https://$DOMAIN/sitemap.xml" "<loc>https://$DOMAIN/grafica-en-paso-del-rey.html</loc>"
check "Gráfica en Paso del Rey declara su canonical" body_has "https://$DOMAIN/grafica-en-paso-del-rey.html" 'rel="canonical" href="https://'"$DOMAIN"'/grafica-en-paso-del-rey.html"'
check "el inicio declara su canonical" body_has "https://$DOMAIN/" 'rel="canonical" href="https://'"$DOMAIN"'/"'
check "el portfolio declara su canonical" body_has "https://$DOMAIN/portfolio.html" 'rel="canonical" href="https://'"$DOMAIN"'/portfolio.html"'
check "llms.txt (resumen para asistentes de IA) está publicado" body_has "https://$DOMAIN/llms.txt" "# Gráfica Delph"

# Una URL inexistente tiene que dar 404 de verdad (si no, Google indexa páginas fantasma) y mostrar la página del sitio.
serves_404_page() {
  local body status
  body="$(curl -sS --max-time 20 "$1")" || return 1
  status="$(curl -sS --max-time 20 -o /dev/null -w '%{http_code}' "$1")"
  [ "$status" = "404" ] && grep -q "Esta página no existe" <<<"$body"
}
check "una URL inexistente da 404 y muestra la página del sitio" serves_404_page "https://$DOMAIN/esta-pagina-no-existe"

exit $FAILED
