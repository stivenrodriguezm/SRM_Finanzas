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

- Dos backends existen en el repo: `backend/` es el que usa la app (puerto 5005), `api-backend/` es un prototipo
  abandonado. No lo confundas ni lo actualices pensando que es el activo.
- La URL del backend en la app móvil vive en un solo sitio: `mobile-app/src/config/api.js` (hostname `.local` del Mac,
  no IP fija). Si vuelves a ver un `API_URL` hardcodeado copiado en alguna pantalla, es una regresión — debe importarse
  desde ahí. Ver sección 4.4/8 de `PROYECTO.md`.
- El backend no está desplegado en la nube: la app en el iPhone depende de que el Mac esté encendido, con
  `backend/` corriendo, y en la misma red Wi-Fi que el iPhone. Ver sección 8 de `PROYECTO.md` para el detalle de
  firma de Xcode / dispositivo registrado antes de tocar nada de compilación iOS.
- Todo el texto de UI, commits de negocio y mensajes de error del backend están en español — sigue esa convención
  al escribir código nuevo (nombres de variables/funciones en inglés está bien, pero strings visibles al usuario en
  español).
- No hay repositorio git inicializado en la raíz. Si el usuario pide hacer commits, probablemente primero haya que
  inicializar el repo (pregunta antes de hacerlo).

## Preferencias de trabajo conocidas

Tu rol es desarrollador fullstack con enfasis en la experiencia de usuario ui/ux y el codigo persistente, agil, con mucha experiencia en desarrollo de aplicaciones moviles