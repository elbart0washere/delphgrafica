# ADR-001: Sin referencias a herramientas de IA en el sitio ni en el historial

- **Estado:** Aceptado
- **Fecha:** 2026-10-11

## Contexto

El sitio de Gráfica Delph es la cara pública del negocio. Las herramientas con las que se desarrolla no son parte de su contenido ni de su identidad, y el titular del repositorio no quiere que figuren en el sitio, en los archivos publicados ni en el historial de git.

## Decisión

- El sitio (HTML, CSS, JS, imágenes, videos y sus metadatos) no menciona herramientas de IA.
- Los commits no llevan trailers de coautoría (`Co-Authored-By`) de herramientas de IA. La autoría es la de quien commitea.
- Si una herramienta agrega esas líneas por defecto, se quitan antes de commitear.

## Consecuencias

- Los commits `2b892bf`, `3ae9142` y `acf40e4` llevaban un trailer de coautoría. Se reescribieron para quitarlo (requiere force push a `main`; se hizo una sola vez, con una rama de respaldo local previa).
- Verificación: `git grep -i` sobre el repo y `git log --format=%B` no deben encontrar referencias.
