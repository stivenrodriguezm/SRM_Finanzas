# Finanzas Personales — Documentación del proyecto

> Última actualización: 2026-08-18 (El backend en el VPS estaba desactualizado desde el 15 ago — varios commits detrás,
> incluido todo el trabajo de Cierre Mensual/Histórico del 17 ago, que nunca se había desplegado — por eso la web local
> mostraba "no hay cierres" y "recordatorio no encontrado" aunque el código ya existiera. Se hizo commit + push de los
> cambios de `backend/` pendientes y se desplegó al VPS vía rsync + build + `pm2 restart` — ver 8.1, la VPS ya no usa
> `git pull` para desplegar, sino rsync directo desde el Mac, porque `~/app/backend` ahí no es un repo git. También:
> bug corregido de `selectedAccounts` excluyendo cuentas nuevas en `DebtsPage.tsx`/`POST /accounts`, ver 3.2)
> Última actualización de contenido (2026-08-17): Dataset grande de ejemplo para steven@gmail.com, unificado en
> `seedStevenService.ts`; Cierre mensual / Histórico: modelo + endpoints + cron en el backend, pantalla nueva en
> web-app; rediseño de escritorio completo en web-app; fix de typecheck real en toda `web-app/`
> Este archivo es la fuente de verdad sobre qué es la app, cómo está construida y qué falta.
> Si algo aquí no coincide con el código, el código manda — y este archivo debe corregirse (ver [CLAUDE.md](CLAUDE.md)).

## 1. Qué es

App personal (uso individual, no multi-tenant real aunque el backend soporta varios usuarios) para llevar el control de finanzas:
cuentas/bolsillos de dinero, ingresos y gastos, deudas (propias y de terceros) y recordatorios de pago.

Nombre visible de la app: **SRM Finanzas** (`mobile-app/app.json`, bundle id `com.stiven.finanzas`).

## 2. Estructura del repo

```
Finanzas personales/
├── backend/            ← API activa (Express 5 + TypeScript + MongoDB). La usan la app móvil y la web.
├── mobile-app/          ← App React Native + Expo + TypeScript (iOS/Android).
└── web-app/             ← App web (Vite + React + TypeScript). Mismo backend/base de datos que mobile-app.
```

(`api-backend/`, el prototipo abandonado, y un `package-lock.json` suelto en la raíz que no pertenecía a ningún `package.json` ahí, ya se eliminaron.)

Repo git inicializado en la raíz, con remoto `origin` en GitHub (`stivenrodriguezm/SRM_Finanzas`).

## 3. Backend (`backend/`)

- Stack: Node.js, **TypeScript** (`strict: true`), Express 5, Mongoose 9 (MongoDB), JWT (`jsonwebtoken`), `bcryptjs`, `zod` (validación), `nodemailer` (envío de correo), `node-cron` (scheduler del cierre mensual, ver 3.2/3.5).
- Entry point: `src/server.ts` (conecta DB, arranca el scheduler de cierre mensual y levanta `app.listen`). `src/app.ts` exporta la app de Express ya configurada (rutas + middlewares) sin conectar DB, sin arrancar el scheduler y sin escuchar — es lo que importan los tests.
- Scripts: `npm run dev` (tsx watch), `npm run build` (compila a `dist/`), `npm start` (corre `dist/server.js`), `npm run typecheck`, `npm test` (Jest), `npm run migrate:debt-transactions` (script de migración puntual, ver 3.4).
- Variables de entorno (`backend/.env`, no versionado — ver `.env.example`): `PORT` (**5005**), `MONGO_URI`, `JWT_SECRET`, `EMAIL_USER`, `EMAIL_APP_PASSWORD`, `EMAIL_FROM` (estas tres para recuperación de contraseña — ver 3.2), `GEMINI_API_KEY`/`GEMINI_MODEL` (análisis con IA — ver endpoint `Analysis` en 3.2; `GEMINI_MODEL` usa un alias "latest" en vez de una versión fechada, porque Google retira esas versiones de vez en cuando — el default es `gemini-flash-lite-latest`; se probó `gemini-flash-latest` pero devolvía 503 por alta demanda de forma consistente al momento de este cambio, mientras que la variante "lite" respondió siempre bien con la misma calidad de análisis en las pruebas), `CLOSING_TIMEZONE` (opcional, zona IANA para el cierre mensual automático — ver 3.5; default `America/Bogota`).
- Todas las rutas bajo `/api` están protegidas con el middleware `protect` (`src/middlewares/authMiddleware.ts`), excepto `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/forgot-password` y `POST /api/auth/reset-password`.
- `protect` espera un JWT en el header `Authorization: Bearer <token>` y expone `req.user` (documento completo de `User`, sin password).
- **Manejo de errores centralizado**: los controllers usan `catchAsync` (envuelve el handler y reenvía cualquier rechazo a `next`) y lanzan `throw new AppError(mensaje, statusCode)` en vez de `res.status().json()` manual. `src/middlewares/errorHandler.ts` captura todo al final: si es un `AppError` responde su mensaje tal cual; cualquier otro error (bug, fallo de Mongo) se loguea en el servidor y al cliente solo le llega `{ message: 'Error interno del servidor' }` — nunca se filtra `error.message`/stack de errores no operacionales.
- **Validación**: cada ruta que recibe body pasa por `validate(schema)` (`src/middlewares/validate.ts`) con un schema de `zod` en `src/schemas/*Schemas.ts`. Si falla, responde 400 con un `AppError`.

### 3.1 Modelos (Mongoose, con interfaces TS en cada archivo)

| Modelo | Campos clave | Notas |
|---|---|---|
| `User` | `name`, `username`, `email`, `password` (hash), `preferences: { theme, hideAmounts, accountOrder, selectedAccounts, reminderOrder, debtOrder, monthlyClosingDay }`, `resetPasswordCodeHash?`, `resetPasswordExpires?` (ambos `select: false`) | `preferences` tiene endpoint (`PUT /api/auth/preferences`, actualización parcial — solo pisa los campos presentes en el body). `theme`/`hideAmounts` no los usa el móvil (ver 7). `accountOrder`/`selectedAccounts`/`reminderOrder`/`debtOrder` sí — son el orden personalizado y la visibilidad de cuentas en Home (ver 4.2/4.3). `monthlyClosingDay` (**nuevo**, `number 1-31 \| null`) es el día elegido para el cierre mensual automático — ver 3.5; lo usa la web (`HistoricoPage.tsx`), no el móvil todavía. Los campos de reset de contraseña se usan en el flujo de recuperación (3.2). |
| `Account` | `user`, `name`, `balance`, `color`, `icon`, `isLiability`, `description` | Representa una cuenta/bolsillo. `isLiability` distingue cuentas normales de "pasivos". Índice en `user`. |
| `Transaction` | `user`, `account`, `reminder?`, `debt?`, `title`, `amount`, `type: ingreso\|egreso\|abono_deuda`, `date` | El `type` determina si suma o resta del `balance` de la cuenta. `debt` (nuevo) liga un abono directamente a la deuda que paga. Índices en `{user,date}`, `{user,debt}`, `{user,reminder}`. |
| `Debt` | `user`, `name`, `totalAmount`, `remainingAmount`, `type: debo\|me_deben`, `dueDate?`, `color`, `icon`, `isActive`, `description` | `debo` = yo debo (pasivo), `me_deben` = préstamo que hice (activo/cuenta por cobrar). Índice en `user`. |
| `Reminder` | `user`, `title`, `date`, `type: unico\|periodico`, `amount?`, `isPaid`, `paymentLink?`, `description?`, `dayOfMonth?`, `notificationConfig`, `snoozedUntil?` | Recordatorios de pago; los periódicos avanzan de fecha automáticamente al pagarse. `notificationConfig` (subdocumento con defaults, ver 4.6) controla cómo se notifica cada recordatorio; `snoozedUntil` aplaza el ciclo de notificaciones a un día puntual sin tocar `date`. Ambos se limpian/aplican solo del lado del cálculo en mobile — el backend solo los persiste. Índice en `{user,date}`. |
| `AiChat` | `user`, `title`, `messages: [{role: 'user'\|'model', text, charts?, createdAt}]` | Historial de conversaciones del "Análisis con IA" (ver endpoint `Analysis` en 3.2). `charts?` solo en mensajes `model`, cuando la IA incluyó alguna. Índice en `{user,updatedAt}` para listar rápido. |
| `MonthlyClosing` (**nuevo**, 2026-08-17) | `user`, `period` ('YYYY-MM'), `date`, `netWorth`, `accounts: [{account, name, color, icon, isLiability, balance}]`, `isAutomatic`, `note?` | Cierre mensual / "Histórico" — foto del saldo de cada `Account` (no incluye `Debt` persona-a-persona) en una fecha dada. `netWorth` siempre se recalcula en el servidor a partir de `accounts`, nunca se edita directo. Índice único `{user, period}` — un cierre por usuario por mes. Ver 3.5. |

### 3.2 Endpoints por recurso

Todos bajo `http://<host>:5005/api`.

**Auth** (`/auth`)
- `POST /register` — crea usuario, devuelve `{ ...user, token }`.
- `POST /login` — devuelve `{ ...user, token }`.
- `POST /forgot-password` — `{ email }`. Si el correo existe, genera un código de 6 dígitos, lo guarda hasheado (10 min de validez) y lo envía por correo (`utils/sendEmail.ts`, Nodemailer sobre Gmail). Responde siempre el mismo mensaje genérico, exista o no el correo, para no revelar usuarios. Si `EMAIL_USER`/`EMAIL_APP_PASSWORD` no están configurados en `.env`, no fala la request pero tampoco se envía nada (solo queda un `console.warn`).
- `POST /reset-password` — `{ email, code, newPassword }`. Verifica el código contra el hash guardado y su expiración.
- `GET /profile`, `PUT /profile`, `PUT /change-password`.
- `PUT /preferences` — actualización parcial de `User.preferences`. `theme`/`hideAmounts` siguen sin usarse
  desde ningún frontend; `monthlyClosingDay` sí lo usa `HistoricoPage.tsx` en la web (ver 3.5).

**Accounts** (`/accounts`)
- `GET /` (filtro opcional `?isLiability=true|false`), `POST /`, `PUT /:id`, `DELETE /:id`.
- **Bug corregido (2026-08-18)**: `POST /` ahora agrega la cuenta recién creada a `User.preferences.selectedAccounts`
  cuando ese array ya tenía contenido (es decir, cuando el usuario ya había personalizado su selección desde Home o
  Deudas). Antes, una cuenta creada después de esa personalización quedaba fuera del array y por lo tanto excluida en
  silencio de los totales que filtran por `selectedAccounts` (p. ej. "Total adeudado"/"Incluidas en el total" en
  `DebtsPage.tsx` de la web) — no había forma de notar que estaba pasando salvo comparando IDs a mano. `DebtsPage.tsx`
  además hace un merge de reconciliación al cargar (agrega y persiste cualquier cuenta de deuda existente que falte
  en `selectedAccounts`) para corregir el estado ya guardado de cuentas creadas antes de este fix. Si se agrega esta
  misma pantalla/lógica al móvil o a Home en la web, replicar el mismo merge.
- `POST /:id/payment` — abono a una cuenta de deuda (`isLiability: true`) pagado desde otra cuenta propia (`{ amount, sourceAccountId, date? }`). Baja el `balance` de la cuenta de deuda (sin bajar de 0) y el de la cuenta de origen, y crea dos `Transaction` (`abono_deuda` en la cuenta de deuda, `egreso` en la de origen). Todo en una transacción de Mongo. Rechaza si la cuenta destino no es `isLiability` o si origen y destino son la misma cuenta. **No confundir con `POST /debts/:id/payment`** (abajo): ese es para el modelo `Debt` (préstamos persona-a-persona), este es para `Account` con `isLiability: true` (tarjetas, hipotecas, etc.) — son dos conceptos de "deuda" separados en esta app (ver 4.2).

**Transactions** (`/transactions`)
- `GET /` (poblado con `account`).
- `POST /` — crea la transacción y actualiza el balance de la cuenta **dentro de una transacción de Mongo** (ver 3.3).
- `PUT /:id` — edita `title`/`amount`/`date`/`account` (no el `type`) y recalcula el/los balance(s) afectados; si la transacción es un `abono_deuda`, también ajusta `Debt.remainingAmount`. Todo atómico.
- `DELETE /:id` — revierte el balance (y el `remainingAmount` de la deuda si aplica), atómico.

**Debts** (`/debts`)
- `GET /`, `GET /:id`, `POST /`, `PUT /:id`, `DELETE /:id`.
- `GET /:id/transactions` — abonos relacionados: primero por `Transaction.debt` (relación real), y como fallback para datos históricos anteriores a esta migración, por regex sobre el título (ver 3.4).
- `POST /:id/payment` — registra un abono: baja `remainingAmount`, crea `Transaction` tipo `abono_deuda` (con `debt` seteado), ajusta el balance de la cuenta según el sentido de la deuda (`debo` resta, `me_deben` suma), y marca `isActive: false` si queda saldada. Todo en una transacción de Mongo.

**Reminders** (`/reminders`)
- `GET /`, `POST /`, `PUT /:id`, `DELETE /:id`.
- `PUT /:id/mark-paid` — marca pagado; si es periódico, avanza al mes siguiente (desde la fecha actual del recordatorio) y resetea `isPaid`.
- `POST /:id/pay` — crea una `Transaction` tipo `egreso` ligada al recordatorio (`reminder` ref) y ajusta el balance; si es periódico avanza la fecha un mes exacto desde su vencimiento actual (no desde "hoy" — bug corregido, ver 3.4). Todo en una transacción de Mongo.
- `GET /:id/payments` — historial de pagos (`Transaction.find({ reminder: id })`).

**Analysis** (`/analysis`) — análisis financiero con IA (Gemini), como **chat persistente**, no como
un análisis de un solo disparo. Modelo `AiChat` (`user`, `title`, `messages: [{role: 'user'|'model',
text, charts?, createdAt}]`, timestamps).
- `GET /chats` — lista los chats del usuario (`title`, `createdAt`, `updatedAt`), más recientes primero.
- `POST /chats` — crea un chat nuevo: manda el mensaje fijo `"Haz un análisis general de mis
  finanzas."` a Gemini con los datos financieros actuales del usuario adjuntos, guarda ese mensaje +
  la respuesta del modelo como los dos primeros mensajes del chat, y devuelve el chat completo (201).
  El título se genera de la primera frase de la respuesta del modelo (sin llamada extra a la IA).
- `GET /chats/:id` — chat completo (mensajes incluidos). 404/401 si no existe o no es del usuario.
- `POST /chats/:id/messages` — `{ text: string }` (máx. 2000 caracteres). Manda a Gemini el
  **historial completo de la conversación** (para que la respuesta tenga contexto de lo ya hablado)
  más el mensaje nuevo del usuario — a ese último turno se le anteponen, de forma invisible para el
  chat, los datos financieros **recién consultados** (no los de cuando se creó el chat), así cada
  respuesta usa cifras frescas aunque la conversación lleve tiempo abierta. Devuelve el chat completo
  actualizado.
- `DELETE /chats/:id` — borra el chat. 404/401 igual que arriba.
- `src/utils/geminiClient.ts::generateAiChatReply(contents)` es la única función que habla con la API
  de Gemini (`GEMINI_API_KEY`/`GEMINI_MODEL` en `.env`, ver 3.), con salida estructurada
  (`responseSchema`): `reply` (siempre) y `charts?` (opcional — solo cuando una gráfica realmente
  aporta a esa respuesta puntual, no se fuerza en cada turno como si fuera un informe). Si falta la
  API key responde 503; si la llamada a Gemini falla o la respuesta no es JSON válido, 502 — siempre
  con `AppError` en español, nunca un error crudo de la API externa.

**Monthly Closings** (`/monthly-closings`) — "Histórico" / cierre mensual (**nuevo**, 2026-08-17).
- `GET /` — lista los cierres del usuario, ordenados por `period` descendente.
- `GET /:period` — un cierre puntual (`period` = 'YYYY-MM').
- `POST /` — `{ period? }` (default: mes actual en `CLOSING_TIMEZONE`). Captura el saldo actual de todas
  las `Account` del usuario y calcula `netWorth`. **Idempotente**: si ya existe un cierre para ese período
  (automático o editado a mano) no lo pisa, devuelve el existente (200); si es nuevo, 201.
- `PUT /:period` — `{ accounts: [{account, balance}], note? }`. Edita los saldos de las cuentas ya
  incluidas en el cierre (400 si mandas un `account` que no estaba en el snapshot original), recalcula
  `netWorth`, marca `isAutomatic: false`.
- `DELETE /:period`.
- Toda la lógica de captura vive en `src/utils/monthlyClosingScheduler.ts::captureClosing` — la reusan este
  endpoint y el cron (ver 3.5), para no duplicarla.

### 3.3 Reglas de negocio importantes
- El balance de una `Account` **sigue sin ser una fuente derivada** (no se recalcula desde las transacciones), pero cada operación que lo toca (crear/editar/borrar transacción, pagar deuda, pagar recordatorio) corre dentro de `session.withTransaction()` (`src/utils/withTransaction.ts`). Si algo falla a mitad de camino, Mongo revierte todo el conjunto — ya no puede quedar el balance actualizado sin la transacción, o viceversa.
- `PUT /transactions/:id` no permite cambiar el `type` (p. ej. de `egreso` a `abono_deuda`): la lógica de conversión sería ambigua respecto al `remainingAmount` de una deuda. Para cambiar el tipo hay que borrar y crear una transacción nueva.

### 3.4 Migraciones y bugs corregidos en el hardening de 2026-08-14
- **`Transaction.debt`** es un campo nuevo. Los abonos históricos (creados antes de este cambio) no lo tienen, solo tienen el título con el nombre de la deuda embebido. `backend/scripts/migrateDebtTransactions.ts` los vincula por regex una sola vez (ya se corrió contra la base real — no encontró transacciones para migrar en ese momento, pero es seguro re-correrlo, es idempotente). `getDebtTransactions` sigue soportando el regex como fallback para no perder historial de datos que nunca se migraron.
- **Bug corregido**: `payReminder` recalculaba la próxima fecha de un recordatorio periódico desde "hoy" en vez de desde el vencimiento actual guardado, lo que en ciertos casos dejaba la fecha sin avanzar al pagar. Ahora avanza siempre un mes exacto desde `reminder.date` (igual que `markReminderPaid`).
- **`JWT_SECRET` regenerado** con un valor aleatorio fuerte (antes era un placeholder predecible) — esto invalidó las sesiones que hubiera activas antes de este cambio; los usuarios necesitan volver a iniciar sesión una vez.

### 3.5 Cierre mensual automático (scheduler)

- `src/utils/monthlyClosingSchedule.ts` — lógica **pura**, sin DB (mismo espíritu que
  `mobile-app/src/utils/reminderNotificationSchedule.ts`, testeada directo con Jest sin mocks):
  `effectiveClosingDay(chosenDay, year, month)` (si el usuario eligió un día que ese mes no tiene, p. ej. 31
  en abril, cae al último día real del mes), `formatPeriod`, `nowInTimeZone(timeZone, now?)` (año/mes/día de
  "ahora" en una zona IANA dada, sin depender de la del proceso — usa `Intl.DateTimeFormat`).
- `src/utils/monthlyClosingScheduler.ts` — `captureClosing` (ver 3.2) y `runMonthlyClosingCheck()`: recorre
  `User.find({ 'preferences.monthlyClosingDay': { $ne: null } })`, calcula el día efectivo de cada uno y
  captura el cierre de los que coincidan con "hoy" (en `CLOSING_TIMEZONE`). `startMonthlyClosingScheduler()`
  registra esto con `node-cron` (`'0 6 * * *'`, una vez al día) — se llama **solo desde `src/server.ts`**,
  nunca desde `app.ts`, para que los tests con supertest no disparen un cron real.
- **Importante**: el disparo automático solo corre en el proceso que tiene `server.ts` corriendo 24/7 (el
  VPS, ver 8.1) — en local (`npm run dev`) también corre mientras el proceso esté vivo, pero no tiene efecto
  en producción hasta que el backend se despliegue ahí. Capturar manualmente (`POST /monthly-closings`) y
  editar cierres funciona igual sin depender del cron.

### 3.6 Cuenta de demo con datos de ejemplo (`steven@gmail.com`)

- **Fuente única**: `src/utils/seedStevenService.ts::seedStevenAccount()` — genera un dataset grande y
  coherente para `steven@gmail.com` / `Lottus123`: 9 cuentas (6 de activo + 3 de deuda), 6 `Debt` (3 `debo` +
  3 `me_deben`, sin solaparse en nombre/monto con ninguna cuenta — ver el bug corregido más abajo), 9
  `Reminder`, ~730 `Transaction` con fecha entre enero de 2024 y "hoy" (el mes en curso se corta en el día
  real, nunca fechas a futuro — usa `today.getDate()`, no el total de días del mes), y un `MonthlyClosing`
  por cada mes ya cerrado (todos menos el actual, para que quede uno por capturar desde la UI) con progresión
  suave del patrimonio neto. Es **idempotente por reemplazo**: borra todo lo de ese usuario y lo vuelve a
  crear desde cero cada vez que se llama — no hace merge.
- **Tres formas de dispararla**, todas llaman a la misma función:
  1. `npm run seed:steven` (`backend/scripts/seedStevenAccount.ts`) — conecta a `MONGO_URI`, siembra,
     desconecta. Es la forma explícita/manual de correrla.
  2. `POST` o `GET /api/auth/seed-demo` (`authController.ts::seedDemoUser`) — mismo efecto vía HTTP, sin auth.
  3. **`POST /api/auth/login` con `email: steven@gmail.com`** — `loginUser` llama a `seedStevenAccount()`
     **antes** de validar la contraseña, en cualquier intento de login con ese correo (contraseña correcta o
     no). Pensado para que la demo "siempre tenga datos frescos", pero como efecto secundario: (a) cualquier
     edición manual que se haga mientras se explora esa cuenta se pierde en el siguiente login, y (b) un
     intento de login con contraseña incorrecta también dispara el reseed completo. No se ha decidido si vale
     la pena ajustar esto — que quede claro para no confundirlo con un bug si "desaparecen" cambios de prueba.
- **`tests/seedSteven.test.ts`** también llama a `seedStevenAccount()`, pero a diferencia de todos los demás
  archivos en `backend/tests/` (que usan `testDb.ts`/`mongodb-memory-server`, aislado) **se conecta al
  `MONGO_URI` real del `.env`** — por lo tanto **cada `npm test` vuelve a poblar la cuenta de demo en la base
  de datos real**, agrega ~20-25s a la corrida y depende de tener red hacia Atlas. Es una decisión consciente
  documentada en el propio archivo, no un descuido, pero es una diferencia de comportamiento real frente al
  resto de la suite si alguien no lo espera.
- `scripts/seedStevenAccount.js` es una copia standalone en JS plano (schemas de Mongoose inline, sin
  importar los modelos de `src/`) que quedó de una iteración anterior — no está referenciada por ningún
  script de `package.json` ni por nada más; es código muerto, no se actualiza junto con el resto.
- **Bug ya corregido (2026-08-17)**: la primera versión del seed creaba "Tarjeta de Crédito Visa" a la vez
  como `Account` (`isLiability: true`) y como `Debt` (`type: 'debo'`) con el mismo monto, duplicando ese
  pasivo en cualquier vista que sume `Account` con `isLiability` + `Debt` con `type: 'debo'` (p. ej. "Debo" en
  `HomePage`/escritorio). Se reemplazó por un "Préstamo Personal Banco Popular" sin relación con ninguna
  cuenta — si se agregan más cuentas o deudas a este seed en el futuro, verificar que ningún nombre/monto se
  repita entre `Account.isLiability` y `Debt.type === 'debo'`.

## 4. Mobile app (`mobile-app/`)

- Stack: Expo ~54, React 19, React Native 0.81, **TypeScript** (`strict: true`, `tsconfig.json` extiende `expo/tsconfig.base`), React Navigation (bottom tabs + native stack), `axios`, `@react-native-async-storage/async-storage`, `react-native-chart-kit` + `react-native-svg` (gráficos), `expo-local-authentication` (biometría), `expo-notifications` (avisos locales), `expo-file-system` + `expo-sharing` (exportar datos).
- Proyecto con carpeta `ios/` generada (`expo prebuild`), CocoaPods instalado. Compila limpio para simulador (`npx expo run:ios`) al día de esta actualización.
- Todo el texto de la UI y los mensajes están en español. Todos los archivos fuente son `.ts`/`.tsx` (ya no queda JS en `src/`).

### 4.1 Navegación (`src/navigation/AppNavigator.tsx`, tipos en `src/navigation/types.ts`)
- Si `!isAuthenticated` → stack de auth: `Landing`, `Register`, `ForgotPassword`, `ResetPassword`.
- Si autenticado → el stack completo queda envuelto en `<BiometricGate>` (ver 4.5) y contiene `TabRoot` (bottom tabs: **Balance** = Home, **Transacciones**, **Deudas**, **Recordatorios**, **Análisis**) + pantallas modal/stack: `AddRecord`, `AddReminder`, `ReminderDetail`, `Perfil`, `DebtDetail`, `AddDebt`, `Receivables` ("Me Deben"), `Preferences`, `AccountDetail`, `AiChatHistory`, `AiChat`.
- `RootStackParamList`/`TabParamList` en `navigation/types.ts` documentan exactamente qué params espera cada pantalla — son la referencia si vas a agregar una navegación nueva (varios params reales no eran obvios por el nombre de la pantalla, p. ej. `DebtDetail` recibe `id`, `title`, `total`, `color`, `icon`, `iconColor`, `iconBg`, `type`).

### 4.2 Pantallas (`src/screens/`)
- `HomeScreen.tsx` — balance general / listado de cuentas. La fila de cuentas se reordena manteniendo presionada una tarjeta (`react-native-draggable-flatlist` + `GestureHandlerRootView` local a la pantalla — no hay uno global en `App.tsx`), persistido en `user.preferences.accountOrder`. La lógica de "aplicar el orden guardado" / "recalcular el orden a guardar tras soltar" está en `src/utils/orderPreference.ts` (`applySavedOrder`/`mergeOrderAfterDrag`), compartida con `RemindersScreen.tsx`/`DebtsScreen.tsx` — cualquier pantalla nueva con listas reordenables debería reusar esas dos funciones, no reinventar el merge de "ids ocultos/no visibles se van al final".
- `TransactionsScreen.tsx` — listado de movimientos; **tocar una transacción abre un modal para editarla (título/monto/cuenta) o eliminarla**.
- `AddRecordScreen.tsx` — crear transacción. El tipo "Abono a Deuda" tiene **dos modos** según cómo se llegó a la pantalla: si `route.params.preselectedAccount` es una cuenta con `isLiability: true` (llegaste con el botón "Abonar" de `AccountDetailScreen`), la pantalla fija esa cuenta como destino y solo pide "Cuenta Origen", llamando a `POST /accounts/:id/payment`; si no, es el flujo genérico de "Abono a Deuda", con un selector combinado de **todo** a lo que se puede abonar (cuentas de deuda `isLiability` + préstamos persona-a-persona del modelo `Debt`, ambos tipos) — según qué se elija, llama a `POST /accounts/:id/payment` o `POST /debts/:id/payment`. Antes el selector solo mostraba `Debt`, lo que dejaba afuera las cuentas de deuda (que hoy es la forma normal de registrar "debo").
- `DebtsScreen.tsx` / `DebtDetailScreen.tsx` / `AddDebtScreen.tsx` — cuentas de deuda (isLiability) y deudas persona-a-persona. `AddDebtScreen` en modo "Modificar" ahora precarga los datos existentes de la deuda (antes abría un formulario vacío). `DebtsScreen` reordena manteniendo presionada una cuenta de deuda (mismo patrón que `HomeScreen`, persistido en `debtOrder`).
- `ReceivablesScreen.tsx` — deudas de tipo `me_deben` ("Me Deben").
- `RemindersScreen.tsx` / `ReminderDetailScreen.tsx` / `AddReminderScreen.tsx` — recordatorios de pago. `RemindersScreen` reordena manteniendo presionado un recordatorio (mismo patrón, persistido en `reminderOrder`).
- `ChartsScreen.tsx` — pestaña "Análisis": flujo neto mensual (barras, últimos 6 meses), distribución de balance por cuenta (dona) y tarjetas de resumen de deudas — esto siempre se muestra, no depende de la IA. Tarjeta "Analizar con IA": crea un chat nuevo (`createAiChat`, `src/services/aiChat.ts`) y navega directo a `AiChatScreen` con ese id — el botón abre el chat, no un formulario. Debajo, un link chico "Ver conversaciones anteriores" navega a `AiChatHistoryScreen`.
- `AiChatHistoryScreen.tsx` — **nueva**: lista los chats guardados (`GET /analysis/chats`), tocar uno abre `AiChatScreen` con ese `chatId`; ícono de basura por fila (con confirmación) para `deleteAiChat`; botón flotante "+ Nuevo análisis" para crear uno sin volver a la pestaña Análisis.
- `AiChatScreen.tsx` — **nueva**, la conversación en sí: recibe siempre `{ chatId }` (lo crea quien navega, nunca la pantalla misma) y hace `GET /analysis/chats/:id` al montar. `FlatList` de mensajes tipo chat (burbuja del usuario a la derecha, de la IA a la izquierda con ícono), cada mensaje de la IA puede traer sus propias `charts[]` (mismo render `BarChart`/`PieChart`/`LineChart` de `react-native-chart-kit` que antes vivía en `ChartsScreen.tsx`). Envío optimista (la burbuja del usuario aparece antes de tener respuesta, con una burbuja de "Pensando…" mientras se espera) — si falla, se revierte y el texto vuelve al input. Ícono de basura en el header para borrar el chat actual.
- `AccountDetailScreen.tsx` — detalle de una cuenta.
- `ProfileScreen.tsx` — perfil; "Cambiar contraseña" e "Información personal" ahora llaman de verdad al backend (antes eran formularios que no persistían nada). Incluye acciones de exportar datos.
- `PreferencesScreen.tsx` — tema, privacidad por sección, notificaciones de recordatorios y **el nuevo toggle de bloqueo biométrico**.
- `Auth/LandingScreen.tsx`, `Auth/RegisterScreen.tsx`, `Auth/ForgotPasswordScreen.tsx` (ahora sí llama al backend), `Auth/ResetPasswordScreen.tsx` (**nueva** — código de 6 dígitos + nueva contraseña).

### 4.3 Estado global (Context API, sin Redux)
- `AuthContext.tsx` — sesión (login/register/logout/forgotPassword/resetPassword), token y user en `AsyncStorage` (`userToken`, `userInfo`). Cada cambio de token llama `setAuthToken()` del cliente HTTP central (ver 4.4).
- `PreferencesContext.tsx` — preferencias **locales al dispositivo** en `AsyncStorage` bajo `appPreferences`: tema (`light|dark|adaptive`), privacidad por pantalla, notificaciones de recordatorios, y **`biometricLockEnabled`** (nuevo). Expone `colors` según el tema activo (`src/theme/theme.ts`).

### 4.4 Cliente HTTP centralizado
`src/services/apiClient.ts` es ahora la **única** forma en que la app habla con el backend. Es una instancia de `axios` con `baseURL` = `API_URL` (`src/config/api.ts`, la URL HTTPS del VPS — ver sección 8) y un interceptor de request que agrega `Authorization: Bearer <token>` automáticamente, leyendo un token en memoria actualizado por `setAuthToken()` (llamado desde `AuthContext` en login/register/logout/carga inicial). Ninguna pantalla arma headers a mano ni importa `axios` directo — antes cada una repetía `axios.get(...)` con el header pegado, en 12 archivos distintos.

`src/utils/apiError.ts` centraliza la extracción del mensaje de error (`getErrorMessage(error, fallback)`), usado en los `catch` de las pantallas en vez de repetir `error.response?.data?.message || '...'`.

**`src/components/AppInput.tsx`** es ahora la forma estándar de armar un campo de texto con ícono/prefijo
(`leftSlot`/`rightSlot`/`prefixText`) — envuelve el `TextInput` en un `Pressable` que ocupa todo el
contenedor visual y hace foco al tocar en cualquier parte (bordes, ícono, padding), no solo sobre el
área nativa de texto exacta (era un bug de usabilidad real: en el patrón viejo, `View` contenedora con
padding + ícono + `TextInput` suelto, tocar cerca del borde no hacía nada). Todas las pantallas con
inputs de texto lo usan — si vas a agregar un campo nuevo, usalo en vez de volver a armar
`View + Ionicons + TextInput` a mano. Los pocos `TextInput` sueltos que quedan en el código (modal de
editar transacción en `TransactionsScreen`, los inputs de `DebtDetailScreen`, la barra de chat en
`AiChatScreen`) no tienen el bug porque el padding vive directamente en el estilo del `TextInput`, sin
un contenedor separado por fuera — no hace falta `AppInput` ahí.

### 4.5 Bloqueo biométrico
`src/components/BiometricGate.tsx` envuelve el stack autenticado completo en `AppNavigator`. Si `preferences.biometricLockEnabled` está activo, pide Face ID/Touch ID (`src/services/biometricAuth.ts`, sobre `expo-local-authentication`) al abrir la app y cada vez que vuelve de segundo plano (`AppState`). El toggle está en `PreferencesScreen` y, al activarlo, primero verifica que el dispositivo tenga biometría configurada y pide una autenticación de confirmación antes de guardar la preferencia.

### 4.6 Notificaciones locales (personalizables por recordatorio)
Son notificaciones **locales al dispositivo** (`expo-notifications`, no push desde el backend). La lógica está partida en dos capas, igual que `csv.ts`/`exportService.ts` (4.8):

- `src/utils/reminderNotificationSchedule.ts` — **puro**, sin imports nativos, testeado directo (`reminderNotificationSchedule.test.ts`). `computeNotificationTriggers(reminder, now)` calcula la lista de avisos de un recordatorio según su `notificationConfig` (ver 3.1):
  - `mode: 'default'` — un único aviso `daysBefore` días antes, a las `hour:00` (comportamiento histórico; defaults 1 día antes, 9am).
  - `mode: 'escalating'` — cascada de avisos el **día activo** (el de vencimiento, o `snoozedUntil` si está aplazado a hoy o a futuro): empieza en `startHour` con intervalo `initialIntervalMinutes`, y cada aviso siguiente reduce el intervalo a la mitad hasta un piso de `minIntervalMinutes`, cortando en `endHour`. Si el vencimiento real todavía está a más de 1 día, en vez de la cascada completa cae a un único aviso el día antes (para no gastar cupo de notificaciones en algo que aún no es urgente) — la cascada se termina de completar cuando la app se vuelve a abrir más cerca de la fecha.
  - `mode: 'off'` — nada.
  - Recordatorio pagado (`isPaid`) → nada, sin importar el modo.
- `src/services/notifications.ts` — capa fina sobre la API de Expo. `syncReminderNotifications(reminders, notificationsEnabled)` cancela **todas** las notificaciones locales pendientes (esta app no usa notificaciones locales para nada más) y, si el toggle de Preferencias está activo y hay permiso concedido, junta los avisos de todos los recordatorios, los ordena por fecha y agenda como máximo `MAX_TOTAL_SCHEDULED = 60` (los más próximos primero) — **límite técnico**: iOS permite ~64 notificaciones locales pendientes por app, así que se deja margen y se prioriza lo urgente si hay varios recordatorios "insistentes" activos el mismo día. Se llama tras cada fetch de recordatorios (`HomeScreen`, `RemindersScreen`) y tras aplazar/editar un recordatorio individual (`ReminderDetailScreen`).
- **Limitación conocida**: el ciclo de un día (la cascada de `escalating`) se recalcula al abrir la app; si el usuario no abre la app ni el día antes ni el día del vencimiento, ese día no llega a agendarse. Es la misma limitación de fondo que ya existía (no hay tareas en background en iOS con la cuenta de desarrollador actual — ver sección 8.2), solo que ahora es más perceptible porque el modo insistente depende de refrescos más frecuentes.
- Aplazar (`snoozedUntil`, editable desde `ReminderDetailScreen` con `@react-native-community/datetimepicker`) no cambia `date`/monto/periodicidad — solo mueve el día en que dispara el ciclo de notificaciones. Se limpia automáticamente al marcar el recordatorio como pagado (`markReminderPaid`/`payReminder` en el backend).
- El toggle "Notificaciones de Recordatorios" en Preferencias pide permiso al activarse y cancela todo lo pendiente de inmediato al desactivarse (`cancelAllReminderNotifications`).

### 4.7 Tema visual / modo oscuro
- `src/theme/theme.ts` exporta dos objetos planos, `lightColors` y `darkColors`, con las mismas claves (`background`, `card`, `cardElevated`, `textPrimary/Secondary/Muted`, `border`, `iconBg`, `primary`, `primaryText`, `success/successLight/successText`, `danger/dangerLight/dangerMuted/dangerText`, `warning/warningLight`, `info/infoLight`, `purple/purpleLight`, `orange/orangeLight`, `white`, `transparentBg`). Ningún componente debe usar un color hex suelto salvo (a) `shadowColor` (siempre `#000`, no depende del tema) y (b) paletas de elección explícita del usuario (el selector de color de cuentas/deudas en `AccountDetailScreen`/`DebtDetailScreen`, o el color por defecto que se manda al crear una cuenta/deuda sin personalizar) — esas son decisiones de datos, no bugs de tema.
- `PreferencesContext` calcula `colors` (uno de los dos objetos de arriba, según `preferences.theme` y, si es `'adaptive'`, el tema del sistema operativo) e `isDark` (booleano) y los expone junto con `preferences`/`updatePreference`. Patrón obligatorio en cada pantalla: `const { colors } = usePreferences();` y `const styles = getStyles(colors);`, donde `getStyles` es una función `(colors: Colors) => StyleSheet.create({...})` — **nunca** un `StyleSheet.create({...})` a nivel de módulo, porque entonces no puede leer `colors` (rompe TypeScript en build). Lo mismo aplica a cualquier tabla/diccionario de estilos por tipo (p. ej. colores por tipo de transacción): tiene que ser una función `getX(colors)` llamada dentro del componente, no una constante de módulo.
- **Texto/ícono sobre un botón de color sólido** (fondo `colors.primary`, `colors.success`, `colors.danger`, etc., no su versión `...Light`): usar siempre `colors.primaryText`, nunca blanco fijo ni `colors.white`/`colors.card`. Motivo: en modo claro esos tokens de acento son oscuros (blanco encima contrasta bien), pero en modo oscuro son versiones claras/pastel para que se lean bien como texto sobre el fondo oscuro de una card — eso significa que texto blanco fijo encima de un botón `colors.primary` en modo oscuro queda con contraste pésimo (~3:1, casi ilegible). `colors.primaryText` ya resuelve esto (blanco en claro, casi negro en oscuro) y es el único token pensado para "texto/ícono encima de un acento sólido".
- La barra de pestañas inferior (bottom tabs) toma su tema de un objeto `Theme` de React Navigation construido en `App.tsx` a partir de `colors` y pasado a `NavigationContainer`. Si no se hace así, `NavigationContainer` usa su tema por defecto (fondo blanco) y deja ver un fondo blanco detrás de las esquinas redondeadas de la tab bar en modo oscuro — ya se corrigió, pero si se toca `App.tsx` o se agrega un `NavigationContainer` nuevo en algún lado, hay que pasarle este `Theme` calculado.
- Las pantallas de `Auth/` (`LandingScreen`, `RegisterScreen`, `ForgotPasswordScreen`, `ResetPasswordScreen`) **no** usan `usePreferences()` — tienen un diseño fijo (no siguen el tema claro/oscuro), decisión deliberada por estar fuera del área autenticada donde vive la preferencia. Si en el futuro se pide que también respeten el tema, hay que engancharlas al mismo patrón `colors`/`getStyles(colors)` del resto de la app.

### 4.8 Exportar datos
`src/services/exportService.ts`: `exportAllDataAsJson()` (respaldo completo: cuentas, transacciones, deudas, recordatorios en un `.json`) y `exportTransactionsAsCsv()` (solo transacciones en `.csv`, para Excel/Sheets). Ambas escriben a `expo-file-system` (API moderna, clases `File`/`Paths`, no la API "legacy" de versiones viejas de Expo) y abren el share sheet nativo con `expo-sharing`. Botones en `ProfileScreen`. El formateo CSV puro (`toCsv`/`toCsvValue`) vive en `src/utils/csv.ts`, separado de la I/O nativa, justamente para poder testearlo sin mockear módulos nativos.

## 5. Web app (`web-app/`)

App web multiplataforma que replica la interfaz y funcionalidad de `mobile-app/`, hablando con **el mismo
backend y la misma base de datos** (no es un sistema aparte). Pensada para verse bien en laptop grande/mediana,
iPad y celular (responsive), no solo en desktop.

- Stack: **Vite** + React 19 + TypeScript (`strict: true`) + React Router v7 (`<BrowserRouter>`, modo SPA) +
  **Tailwind CSS v4** (vía plugin `@tailwindcss/vite`, sin `tailwind.config.js` — los tokens de color viven en
  `src/index.css` como variables `@theme`) + `axios` + `recharts` (gráficos) + `react-icons/io5` (Ionicons, para
  igualar visualmente los íconos de `@expo/vector-icons` del móvil) + `date-fns`.
- Apunta al mismo backend que el móvil: `src/config/api.ts` → `https://finanzas-api.muebleslottus.com/api`
  (mismo valor que `mobile-app/src/config/api.ts`, sin cambios de CORS necesarios — el backend ya tiene
  `app.use(cors())` sin restricciones).
- **Paridad de datos con mobile**: `src/types/models.ts`, `src/utils/apiError.ts`, `src/utils/csv.ts` y
  `src/services/aiChat.ts` son copias literales de sus equivalentes en `mobile-app/` (sin dependencias de React
  Native, se pudieron portar tal cual). El resto de la lógica de negocio (reglas de "Abono a Deuda", cascada de
  notificaciones no aplica aquí — ver Deuda técnica, cálculo de vencimiento de recordatorios en
  `src/utils/dates.ts`) está reimplementada a mano siguiendo la misma lógica que las pantallas de mobile, pantalla
  por pantalla.
- **Tema claro/oscuro**: en vez del patrón de mobile (`getStyles(colors)` por componente), acá los tokens de
  `theme.ts` (copia literal de `mobile-app/src/theme/theme.ts`) están declarados dos veces en `src/index.css`:
  una vez como variables `@theme` (valores claros) y otra vez bajo el selector `html.dark { ... }` (valores
  oscuros). Esto genera clases de Tailwind (`bg-card`, `text-text-primary`, `bg-primary`, etc.) que cambian solas
  con el tema sin re-renderizar nada. `PreferencesContext` sigue exponiendo un objeto `colors` (mismo shape que
  `lightColors`/`darkColors`) para los pocos casos que necesitan el valor hex crudo en JS (charts de `recharts`,
  colores de cuenta elegidos por el usuario).
- **Diálogos**: React no tiene `Alert.alert` como React Native. `src/context/DialogContext.tsx` expone
  `alert(mensaje, título?)`/`confirm(mensaje, título?, opciones?)` basados en Promises, usados en todo lugar
  donde mobile usaba `Alert.alert`.
- **Layout responsive** (`src/components/Layout.tsx`): sidebar fija (`hidden md:flex`, solo íconos entre
  `md`–`lg`, íconos+texto en `lg+`) para tablet/desktop; barra de tabs inferior fija (`md:hidden`) para celular;
  contenido central `max-w-5xl` por debajo de `lg:`, y hasta `max-w-[1600px]` con más padding en `lg:`+.
- **Rediseño de escritorio en curso (2026-08-17).** El pedido original era que la web en computador/portátil
  (13"–24", es decir `lg:` de Tailwind, ≥1024px) dejara de verse como "la versión móvil estirada" y tuviera un
  layout propio, denso, tipo dashboard fintech (no solo tarjetas más grandes). Patrón de implementación: cada
  página con markup distinto para escritorio queda dividida en dos bloques dentro del mismo componente —
  `<div className="lg:hidden">` (diseño móvil/tablet sin tocar) y `<div className="hidden lg:block">` (diseño
  nuevo) — comparten el mismo estado/fetch/handlers, solo cambia el JSX; es el mismo patrón que `Layout.tsx` ya
  usaba para sidebar vs. bottom-tabs. Piezas nuevas reutilizables: `components/StatCard.tsx` (tarjeta de KPI
  compacta con acento de color) y `SkeletonTable`/`SkeletonStatRow` en `components/Skeleton.tsx` (loading state
  con la forma del layout de escritorio, no el de tarjetas móvil).
  **Estado: completo.** Todas las páginas (incluidas las de `Auth/` — `LandingPage`/`RegisterPage`/
  `ForgotPasswordPage`/`ResetPasswordPage`, que en escritorio pasaron a un layout partido en dos: panel de
  marca a la izquierda + formulario centrado a la derecha) tienen ya su bloque `lg:hidden`/`hidden lg:*`
  separado, con tira de KPIs (`StatCard`), tablas reales en vez de listas de tarjetas, y barra de
  herramientas con búsqueda/filtros/selects siempre visibles en vez de pills con scroll horizontal. Si se
  agrega una página nueva, seguir el mismo patrón (ver `DebtsPage.tsx`/`DebtDetailPage.tsx` como referencia).
- **Diferencias deliberadas frente a mobile** (para no atrasar el alcance en esta primera versión):
  - Sin reordenar cuentas/deudas/recordatorios arrastrando (drag-to-reorder) — mobile sí lo tiene
    (`accountOrder`/`debtOrder`/`reminderOrder`, ver 4.2).
  - Sin cambio de cuenta (multi-cuenta) en el perfil — `AuthContext` de la web sí soporta guardar varias cuentas
    (`savedAccounts`/`switchAccount`/`addOtherAccount`/`removeSavedAccount`, portado de mobile), pero la pantalla
    de Perfil todavía no tiene la UI para usarlo.
  - Sin bloqueo biométrico ni notificaciones locales (no aplican a un navegador de escritorio/tablet del mismo
    modo que a un teléfono) — `PreferencesPage` por eso solo tiene tema + privacidad por sección, no las
    secciones de "Seguridad"/"Otros Ajustes" que sí tiene `PreferencesScreen.tsx` en mobile.
  - Exportar datos (JSON/CSV) usa `Blob` + `<a download>` en vez de `expo-file-system`/`expo-sharing`.
- **Endpoint nuevo que esto motivó en el backend**: `GET /api/reminders/:id` (antes no existía — mobile llegaba
  a `ReminderDetailScreen` siempre por navegación con los datos ya en memoria, así que nunca necesitó pedirle
  este recurso al backend por id; la web sí, porque una URL como `/recordatorios/:id` tiene que poder cargar
  sola con solo el id, por ejemplo al refrescar la página). Ver 3.2/`reminderController.ts::getReminderById`.
- Páginas (`src/pages/`), un mapeo ~1:1 contra las pantallas de mobile (4.2): `LandingPage`, `RegisterPage`,
  `ForgotPasswordPage`, `ResetPasswordPage`, `HomePage`, `TransactionsPage`, `DebtsPage`, `DebtDetailPage`,
  `ReceivablesPage`, `RemindersPage`, `ReminderDetailPage`, `AnalysisPage`, `AiChatHistoryPage`, `AiChatPage`,
  `AccountDetailPage`, `ProfilePage`, `PreferencesPage`. Más `HistoricoPage`/`HistoricoDetailPage` (**nuevas**,
  2026-08-17, sin equivalente en mobile todavía — ver bullet de "Cierre mensual" abajo).
- **Cierre mensual / "Histórico"** (**nuevo**, 2026-08-17, solo en `web-app/` por ahora): `HistoricoPage.tsx`
  (ruta `/historico`) lista los cierres (`MonthlyClosing`, ver 3.1/3.2), con un selector de "día de cierre
  automático" (1-31 o desactivado, escribe `user.preferences.monthlyClosingDay` vía `PUT /auth/preferences` +
  `updateUserLocal`, mismo patrón que `DebtsPage.tsx::toggleAccountSelection`) y un gráfico de línea
  (`recharts`) de patrimonio neto por mes. Un botón "Cerrar este mes ahora" llama `POST /monthly-closings`
  cuando el período actual todavía no tiene cierre. `HistoricoDetailPage.tsx` (ruta `/historico/:period`)
  muestra el detalle y abre `components/HistoricoEditModal.tsx` para editar el saldo de cada cuenta a mano
  (`PUT /monthly-closings/:period`). Tiene su propia entrada en `Preferences.privacy` (`historico`, local al
  navegador, igual que las demás secciones — ver 5 más arriba/`PreferencesPage.tsx`).
- **No desplegada todavía** — por ahora solo corre en local (`npm run dev`, puerto 5173). Ver 8.3.

## 6. Cómo correr el proyecto en desarrollo

```bash
# Backend
cd backend
npm install
npm run dev          # tsx watch, puerto definido en .env (PORT=5005)
npm test             # Jest + Supertest + Mongo en memoria (réplica, para probar transacciones)
npm run typecheck

# Mobile app
cd mobile-app
npm install
npx expo start        # o: npm run ios / npm run android / npm run web
npm test              # Jest (jest-expo)
npm run typecheck

# Web app
cd web-app
npm install
npm run dev                              # Vite, puerto 5173
npx tsc --noEmit -p tsconfig.app.json    # no hay script "typecheck" en package.json todavía, ni suite de tests — ver Deuda técnica
```

Para que **"olvidé mi contraseña"** envíe correos de verdad, completa `EMAIL_USER`/`EMAIL_APP_PASSWORD` en `backend/.env` con una [contraseña de aplicación de Gmail](https://myaccount.google.com/apppasswords) (requiere verificación en 2 pasos activa en esa cuenta). Sin esto, el endpoint sigue funcionando (no falla), pero el correo no se envía y solo queda un log en la consola del backend.

Para que **"Analizar con IA"** (pestaña Análisis, ahora un chat — ver 3.2 y 4.2) funcione, completa
`GEMINI_API_KEY` en `backend/.env` con una API key de [Google AI Studio](https://aistudio.google.com/apikey).
Sin esto, `POST /api/analysis/chats` responde 503 con un mensaje claro — el resto de la pestaña
(gráficas fijas, totales) funciona igual.

La app móvil habla con el backend en producción (VPS, ver sección 8.1) — no necesita que el Mac esté corriendo nada para funcionar. Sección 8.2 para el detalle de build/instalación en iPhone físico.

## 7. Deuda técnica / cosas a tener en cuenta

1. **Preferencias parcialmente duplicadas (ya no todas sin usar).** El backend (`User.preferences`) tiene `theme`, `hideAmounts`, `accountOrder`, `selectedAccounts`, `reminderOrder`, `debtOrder` con su propio endpoint `PUT /api/auth/preferences`. `theme`/`hideAmounts` siguen sin usarse desde el móvil (la app maneja tema/privacidad solo local, vía `PreferencesContext`/`AsyncStorage`) — de esos dos sí sigue aplicando la duda de si conviene simplificarlos/quitarlos del backend. Pero `accountOrder`/`selectedAccounts`/`reminderOrder`/`debtOrder` **sí se usan activamente**: son el orden personalizado (mantener presionado para reordenar, ver 4.2) de cuentas/recordatorios/cuentas de deuda, y si acabas de tocar algo relacionado con reordenar listas, este es el lugar — no lo confundas con `PreferencesContext` local.
2. ~~Sin backend en la nube~~ — **resuelto (2026-08-17).** El backend corre 24/7 en un VPS, no depende del Mac. Ver sección 8.1.
3. **Cobertura de tests desigual a propósito.** El backend tiene una suite real cubriendo toda la lógica de dinero y el cierre mensual (57 tests, 9 archivos en `backend/tests/` — uno de ellos, `seedSteven.test.ts`, no es un test aislado sino que puebla la cuenta de demo en la base de datos real, ver 3.6). El móvil tiene tests solo para lógica pura sin dependencias nativas (`apiError`, `csv`, el interceptor de `apiClient`, un smoke test de componente) — no hay tests de integración de pantallas completas ni de navegación. Fue una decisión deliberada de prioridad (el dinero es lo crítico), no un olvido.
4. **`react-native-chart-kit`** está bien pero es una librería relativamente estática (sin animaciones ricas ni interacción táctil sobre las barras/dona). Si en el futuro se quiere algo más pulido, la alternativa natural es Victory Native XL (requiere `@shopify/react-native-skia`, una dependencia nativa más pesada).
5. **`SafeAreaView` deprecado (migración parcial en curso).** El `SafeAreaView` de `'react-native'` no calcula bien los insets del notch/Dynamic Island cuando la pantalla está anidada dentro de navegadores (tab + stack) — esto no es solo una advertencia de consola, causó un bug real (header recortado/tapado por el borde en `TransactionsScreen`). `App.tsx` ya envuelve la app en `SafeAreaProvider` (`react-native-safe-area-context`) y `TransactionsScreen.tsx` ya usa el `SafeAreaView` de esa librería. **El resto de pantallas todavía usa el `SafeAreaView` de `'react-native'`** — si aparece el mismo síntoma (contenido cortado cerca del borde/notch) en otra pantalla, migrarla de la misma forma (cambiar el import a `react-native-safe-area-context`; el `SafeAreaProvider` raíz ya existe).
6. **Web app sin verificación visual real todavía.** `npm run build` (`tsc -b` + `vite build`) y
   `npx tsc --noEmit -p tsconfig.app.json` quedan limpios — **ojo**: antes del 2026-08-17 esto en realidad no
   era cierto pese a lo que decía esta misma nota; `tsconfig.app.json` trae `verbatimModuleSyntax: true` del
   scaffold de Vite y casi ningún archivo separaba imports de tipos de imports de valores (~30 archivos con el
   error `TS1484`, más 3 imports de `React` sin usar y 2 errores de tipos reales en los `Tooltip` de Recharts de
   `AnalysisPage.tsx`) — se corrigió todo en esta pasada, típecheck/build limpios de verdad ahora. Pero sigue sin
   probarse en un navegador real (login contra el backend de producción, responsive en los distintos
   breakpoints, dark mode) por no haber herramienta de navegador/captura disponible en el entorno donde se
   construye. Antes de dar por completamente lista cualquier página, probarla a mano (`npm run dev` en
   `web-app/`, abrir `localhost:5173`).
7. **Web app sin suite de tests.** A diferencia del backend (Jest+Supertest) y mobile (Jest, lógica pura), `web-app/`
   no tiene tests todavía — solo `tsc --noEmit` como verificación.
8. **Web app: multi-cuenta sin UI.** `AuthContext` de la web ya soporta guardar/cambiar entre varias cuentas
   (portado de mobile), pero `ProfilePage` no expone esa función todavía (ver 5).
9. **`npm test` completo es intermitentemente flaky, más allá de solo `debts.test.ts` (visto de nuevo
   2026-08-18, todavía no diagnosticado).** Detectado primero en `debts.test.ts` (ver nota original abajo),
   pero corriendo la suite completa varias veces seguidas sin tocar código de dinero, también fallaron —
   en corridas distintas, no todas a la vez — tests de `monthlyClosings.test.ts`, `reminders.test.ts`,
   `transactions.test.ts` y `analysis.test.ts` (este último con una aserción de status 404 vs 401, que huele
   a algo distinto: posible orden de validación en el controller, no necesariamente la misma condición de
   carrera). Confirma que **no es un problema de un archivo puntual** sino algo compartido — sigue apuntando
   a `withTransaction`/réplica-set de `mongodb-memory-server` bajo `--runInBand`, pero con alcance más amplio
   de lo que se pensaba. Si `npm test` falla en algún archivo de forma aislada, volver a correrlo antes de
   asumir que se rompió algo real. Nota original (2026-08-17): en `debts.test.ts`, el test "abonar a una
   deuda 'debo' reduce remainingAmount y resta del balance" a veces falla con un `remainingAmount` incorrecto
   (valores vistos: `0`, `100` en vez de `300`).

## 8. Despliegue

El backend corre en producción en un VPS Ubuntu compartido con otro proyecto (`api.muebleslottus.com`, que "no se puede caer" — cualquier cambio de infraestructura en el VPS debe evitar tocar ese proyecto). La app móvil le habla siempre a esa URL, en cualquier red (Wi-Fi o datos móviles) — ya no depende de que el Mac esté encendido ni de estar en la misma red.

### 8.1 Backend en el VPS

- **Aislamiento**: el backend corre bajo su propio usuario Linux `finanzas` (`/home/finanzas/app/backend`), con su propio Node vía `nvm` (`~/.nvm`, Node 22) y su propio daemon de PM2 (`~/.pm2`) — completamente separado del usuario/proceso del otro proyecto.
- **Proceso**: gestionado con PM2 bajo el nombre `finanzas-backend` (`pm2 list`, `pm2 logs finanzas-backend`, `pm2 restart finanzas-backend`). Arranque automático al reiniciar el VPS ya configurado (`pm2 startup` + `pm2 save`, systemd unit `pm2-finanzas.service`).
- **Red**: el proceso Node escucha solo en `127.0.0.1:5005` (`HOST=127.0.0.1` en `backend/.env` del VPS — ver `server.ts`), nunca expuesto directo a internet. Nginx (ya instalado, comparte instancia con el otro proyecto) hace de reverse proxy: bloque propio en `/etc/nginx/sites-available/finanzas-api.muebleslottus.com`, symlink en `sites-enabled`, proxy a `127.0.0.1:5005`.
- **Dominio y HTTPS**: `https://finanzas-api.muebleslottus.com` (subdominio de `muebleslottus.com`, registro DNS tipo A → `147.93.43.111`). Certificado real de Let's Encrypt vía Certbot (`sudo certbot --nginx -d finanzas-api.muebleslottus.com`, ya instalado en el VPS) — se renueva solo (cron/systemd timer de certbot). Esto es lo que consume la app móvil como `API_URL` (`src/config/api.ts`).
- **Base de datos**: sigue siendo MongoDB **Atlas** (la nube de Mongo, no algo que corra en el VPS) — el VPS solo aloja el proceso de Node que se conecta a Atlas por `MONGO_URI`. Ver sección 3.
- **Acceso**: `finanzas` tiene login SSH por llave (sin password, sin sudo). Para cualquier tarea que necesite root (systemd, editar config de Nginx, Certbot) hay que pedirle al usuario que lo corra desde la cuenta admin del otro proyecto (la única con sudo en este VPS) — `finanzas` está deliberadamente sin sudo por aislamiento del proyecto que no puede caerse.
- **Desplegar un cambio de código nuevo**: `~/app/backend` en el VPS **no es un repo git** (confirmado 2026-08-18, no
  `.git` ahí) — el código se sincroniza por `rsync` desde el Mac, no por `git pull`. Desde `backend/` local:
  `rsync -av --exclude='.env' --exclude='node_modules/' --exclude='dist/' --exclude='coverage/' --exclude='*.log' ./ finanzas@147.93.43.111:~/app/backend/`,
  luego por SSH como `finanzas` (con `nvm`/`npm`/`pm2` en el PATH: `export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"`
  antes de usarlos, porque SSH no interactivo no carga `.bashrc`) — `npm install` si cambiaron dependencias,
  `npm run build`, `pm2 restart finanzas-backend`. El `.env` del VPS es independiente del local (no lo pisa el
  rsync) — si se agrega una variable de entorno nueva con default en código (como `CLOSING_TIMEZONE`), no hace falta
  tocarlo a menos que se quiera un valor distinto del default. **Importante**: como no hay repo git ahí, el VPS puede
  quedarse desactualizado en silencio si se hacen commits locales sin recordar desplegar — no hay forma de que se
  entere solo. No hace falta tocar Nginx/Certbot/systemd para un deploy de código — todo eso ya queda fijo.

### 8.2 App móvil en el iPhone físico
- `mobile-app/ios/` es un proyecto Xcode ya generado (`expo prebuild`), con CocoaPods instalado.
- Bundle ID: `com.stiven.finanzas`. Nombre del esquema/target: `Finanzas`.
- Firma ya configurada en el `.pbxproj`: `DEVELOPMENT_TEAM = ZLCWNMPT33`.
- El Mac (`Stivens-MacBook-Air`) ya tiene registrado el dispositivo "iPhone de Stiven" en Xcode (aparece en `xcrun xctrace list devices`, aunque puede figurar "Offline" si no está conectado en ese momento).
- Plugins de config en `app.json`: `@react-native-community/datetimepicker`, `expo-asset`, `expo-local-authentication` (con `faceIDPermission`, agrega `NSFaceIDUsageDescription` a Info.plist), `expo-notifications`, `expo-font`, y **`./plugins/withNoPushEntitlement.js`** (plugin local, ver más abajo).
- **`@expo/vector-icons` y `expo-font` deben estar declarados como dependencias directas** en `package.json` (no solo transitivas de `expo`). Sin esto, `tsc`/herramientas fuera de Metro no resuelven `@expo/vector-icons`, y CocoaPods puede descartar el pod de `ExpoFont` al reinstalar — causando el crash en runtime `Cannot find native module 'ExpoFontLoader'` (ya ocurrió una vez durante este hardening, ya está resuelto).
- **`expo-notifications` agrega el entitlement `aps-environment` (push remoto) aunque solo usemos notificaciones locales.** Con firma automática y un equipo sin la capability de Push Notifications habilitada, esto rompe el build a dispositivo físico con `Provisioning Profile "..." does not support the Push Notifications capability`. `mobile-app/plugins/withNoPushEntitlement.js` es un config plugin local que quita esa entitlement; está referenciado al final del array `plugins` de `app.json`. **Ojo:** por algo en el pipeline de `expo prebuild` que no se terminó de diagnosticar, el plugin no siempre gana la carrera contra la re-inserción de esa entitlement dentro del mismo `expo prebuild` — si después de correr `expo prebuild` el archivo `ios/Finanzas/Finanzas.entitlements` vuelve a tener `aps-environment`, bórralo a mano (dejar `<dict/>` vacío) **y no vuelvas a correr `expo prebuild` antes del siguiente build** — `npx expo run:ios` por sí solo no reaplica los config plugins, así que el archivo se queda limpio.
- Si una compilación falla con errores de tipo `module map file ... not found` / `no such module 'Expo'`, es un problema de caché de Xcode: borrar `~/Library/Developer/Xcode/DerivedData/Finanzas-*` y volver a compilar.
- Si el linker falla con `Undefined symbols for architecture arm64` (p. ej. `facebook::react::Sealable::Sealable()`), es un desajuste entre Pods cacheados y los binarios prebuilt de React Native — solución: `rm -rf ios/Pods ios/Podfile.lock ~/Library/Caches/CocoaPods && cd ios && pod install` (reinstalación limpia), luego recompilar.
- **Para instalar en el iPhone físico usa `--configuration Release`**: `npx expo run:ios -d "<nombre o UDID>" --configuration Release`. A diferencia de Debug, empaqueta el JS dentro de la app en el paso de build de Xcode — una vez instalada, la app no necesita Metro corriendo en el Mac, solo el backend. (Se puede confirmar que un build no depende de Metro si su log de `expo run:ios` **no** contiene una línea `Opening com.stiven.finanzas://expo-development-client/...`; los builds Debug sí la tienen.)
- Con una cuenta Apple gratuita (sin Apple Developer Program pagado), las apps instaladas por cable vía Xcode expiran a los 7 días y hay que reinstalar (repetir Run desde Xcode, o `npx expo run:ios -d <device>`). Con cuenta paga ($99/año) duran un año y se puede pasar a distribución por TestFlight sin cable.
- Carpetas `ios/build`, `ios/build_debug`, `ios/build_release`, `ios/Payload` y el archivo `Finanzas.ipa` en la raíz de `mobile-app/` son artefactos de compilaciones manuales anteriores; no son necesarios para compilar desde Xcode.

### 8.3 Web app

**Todavía no desplegada** — por ahora `web-app/` solo corre en local (`npm run dev`, sección 6). El camino natural
cuando se quiera ponerla en producción es servirla como estáticos (`npm run build` → carpeta `dist/`) detrás del
mismo Nginx del VPS (bloque nuevo tipo `finanzas.muebleslottus.com` con `root` apuntando a `dist/`, mismo patrón de
Certbot que 8.1), ya que el VPS y el dominio `muebleslottus.com` ya están disponibles — pero esto no se ha
conversado ni empezado, no asumir que es lo que el usuario quiere sin confirmar primero.
