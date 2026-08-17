# Instrucciones para Claude en este proyecto

Este es un proyecto personal de finanzas (Stiven). Antes de hacer cambios importantes, lee **[PROYECTO.md](PROYECTO.md)** —
ahí está toda la documentación de arquitectura, modelos, endpoints y deuda técnica conocida. No vuelvas a re-analizar
todo el repo desde cero cada vez; usa ese archivo como punto de partida y solo profundiza en el código cuando
`PROYECTO.md` no tenga el detalle que necesitas.

## Mantener `PROYECTO.md` actualizado

`PROYECTO.md` debe reflejar el estado real del código, no el estado en el que se escribió. Actualízalo cuando termines
un cambio (no hace falta preguntar, pero sí avisar brevemente qué actualizaste) si ocurre algo de esto:

- Se agrega, elimina o renombra un modelo, endpoint, pantalla o carpeta del proyecto.
- Se cambia una regla de negocio descrita en la sección 3.3 (ej. cómo se actualiza el balance de una cuenta).
- Se resuelve o cambia alguno de los puntos de "Deuda técnica" (sección 6) — muévelo a resuelto o bórralo si ya no aplica.
- Cambia la forma de correr el proyecto (variables de entorno nuevas, puertos, scripts).
- Se agrega una dependencia o herramienta relevante para arquitectura (no hace falta documentar cada paquete npm menor).

No documentes ahí detalles que ya se pueden derivar leyendo el código (nombres exactos de variables internas, lógica
trivial) — eso es lo que dice `PROYECTO.md` en su encabezado: es la fuente de verdad de arquitectura y decisiones, no
un espejo línea por línea del código. Actualiza también la fecha del encabezado (`Última actualización: YYYY-MM-DD`)
cuando edites el archivo.

## Contexto rápido del proyecto

- Solo hay un backend en el repo: `backend/` (TypeScript, puerto 5005). El prototipo abandonado `api-backend/` que
  existía antes ya se eliminó — no lo recrees ni lo confundas con nada.
- Backend y mobile están **en TypeScript, `strict: true`**. Antes de dar por terminado un cambio en cualquiera de los
  dos, corre `npm run typecheck` (y `npm test`) en la carpeta correspondiente — ambos deben quedar limpios.
- La URL del backend en la app móvil vive en un solo sitio: `mobile-app/src/config/api.ts` (`https://finanzas-api.muebleslottus.com/api`,
  el VPS en producción — ya no el Mac). Todas las pantallas llaman al backend a través de `mobile-app/src/services/apiClient.ts` (instancia de
  axios centralizada que inyecta el JWT solo). Si ves una pantalla importando `axios` directo o armando headers de
  `Authorization` a mano, es una regresión al patrón viejo — debe usar `apiClient`. Ver sección 4.4 de `PROYECTO.md`.
- Las operaciones que mueven dinero (crear/editar/borrar transacción, pagar deuda, pagar recordatorio, abono a cuenta
  de deuda) están envueltas en `session.withTransaction()` de Mongo (`backend/src/utils/withTransaction.ts`). Cualquier
  nueva forma de mover dinero entre `Account`/`Debt`/`Transaction` debe seguir ese mismo patrón, no hacer los `save()`
  sueltos.
- El backend corre 24/7 en un VPS Ubuntu (usuario `finanzas`, PM2, detrás de Nginx con HTTPS) — ya no depende del Mac
  ni de la red Wi-Fi. Ese VPS es compartido con otro proyecto que "no se puede caer"; `finanzas` está aislado a
  propósito y sin sudo, así que cualquier cambio de infraestructura (Nginx, systemd, Certbot) necesita la cuenta admin
  del otro proyecto. Ver sección 7.1 de `PROYECTO.md` para el detalle completo, y 7.2 para firma de Xcode / dispositivo
  registrado antes de tocar nada de compilación iOS. Si agregas una dependencia nativa nueva al móvil, declárala como
  dependencia directa en `package.json` (no confíes en que quede resuelta solo por ser transitiva de `expo`) y corre
  `npx expo prebuild --platform ios` + `pod install` después.
- Todo el texto de UI, commits de negocio y mensajes de error del backend están en español — sigue esa convención
  al escribir código nuevo (nombres de variables/funciones en inglés está bien, pero strings visibles al usuario en
  español).
- Hay repo git inicializado con remoto en GitHub (`stivenrodriguezm/SRM_Finanzas`). Nunca hagas `push` sin que el
  usuario lo pida explícitamente.

## Preferencias de trabajo conocidas

- Tu rol es desarrollador fullstack con énfasis en experiencia de usuario (UI/UX) y código persistente, ágil, con
  mucha experiencia en desarrollo de aplicaciones móviles.
- Cuando el usuario pide una lista larga de features/fixes agrupados por prioridad, espera que se implementen todos
  los ítems pedidos de una sola vez (no uno por uno con confirmación intermedia), con commits separados por área
  (backend / mobile) y verificación real (tests + typecheck + build) antes de dar cada bloque por terminado.