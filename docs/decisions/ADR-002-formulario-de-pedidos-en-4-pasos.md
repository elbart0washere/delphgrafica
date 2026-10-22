# ADR-002: Formulario de pedidos en 4 pasos; ojales y bolsillos solo para banner

- **Estado:** Aceptado
- **Fecha:** 2026-10-22
- **Deploy:** PR #8, merge `c99c653` a `main`

## Contexto

El formulario de `pedido.html` mostraba todo en una sola página y la terminación era una lista con "Ojales y bolsillo" juntos. La gráfica quería que al cliente no le resulte complejo: simple, usable y con el diseño del resto del sitio. Se compararon tres bocetos (una página, paso a paso, primero el archivo) y se eligió el paso a paso.

## Decisión

- El formulario avanza de a un paso (producto, cantidad, archivo, contacto) con validación por paso y botón Atrás. El botón de enviar, único con el color de acento, aparece recién en el último paso.
- Ojales y Bolsillos son dos casillas separadas y solo se ofrecen para el producto `banner`. Lona no ofrece terminación por ahora. Si se cambia de producto, lo marcado se descarta.
- El contrato con el sistema de pedidos no cambia: `finishing` sigue siendo texto de hasta 100 caracteres. Ahora vale `Ojales`, `Bolsillos` u `Ojales y Bolsillos` (antes `Ojales y bolsillo`) y no se envía si no se eligió nada.
- La verificación anti-robots (Turnstile) se carga al llegar al último paso, donde se ve, y no al abrir la página.
- Se quitó la opción "Otra (la aclaro abajo)": lo que haga falta aclarar va en las notas.

## Consecuencias

- El backend confirmó que `finishing` es texto opaco (se guarda y se escribe tal cual en la planilla), sin lista cerrada ni comparaciones con el texto viejo. Los pedidos anteriores quedan con "Ojales y bolsillo"; si algún día se agrega un reporte por terminación, hay que tratar ambos textos como equivalentes.
- Verificación previa al deploy: 386 tests unitarios y estáticos y 455 e2e en verde (Chromium celular, Chromium escritorio y WebKit).
- Pendiente tras el deploy: probar un pedido real con el widget de Turnstile, sobre todo a 320 px, porque la sitekey es del dominio y no se pudo probar en local.
- Para volver atrás alcanza con revertir el merge `c99c653`.
