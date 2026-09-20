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

body_has() { curl -fsS --max-time 20 "$1" | grep -q "$2"; }
redirects_to() { [ "$(curl -sS --max-time 20 -o /dev/null -w '%{redirect_url}' "$1")" = "$2" ]; }
status_is() { [ "$(curl -sS --max-time 20 -o /dev/null -w '%{http_code}' "$1")" = "$2" ]; }

echo "US7-S1: https://$DOMAIN carga con certificado válido"
check "responde 200 sin errores de certificado" status_is "https://$DOMAIN/" 200
check "contiene el aviso \"Sitio en construcción\"" body_has "https://$DOMAIN/" "Sitio en construcción"

echo "US7-S2: http y www terminan en https://$DOMAIN"
check "http://$DOMAIN/ redirige a https://$DOMAIN/" redirects_to "http://$DOMAIN/" "https://$DOMAIN/"
check "https://www.$DOMAIN/ redirige a https://$DOMAIN/" redirects_to "https://www.$DOMAIN/" "https://$DOMAIN/"

echo "Lo interno no se publica"
for path in docs/PRD.md docs/ specs/; do
  check "/$path da 404" status_is "https://$DOMAIN/$path" 404
done

exit $FAILED
