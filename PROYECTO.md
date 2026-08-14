# Finanzas Personales — Documentación del proyecto

> Última actualización: 2026-08-14
> Este archivo es la fuente de verdad sobre qué es la app, cómo está construida y qué falta.
> Si algo aquí no coincide con el código, el código manda — y este archivo debe corregirse (ver [CLAUDE.md](CLAUDE.md)).

## 1. Qué es

App personal (uso individual, no multi-tenant real aunque el backend soporta varios usuarios) para llevar el control de finanzas:
cuentas/bolsillos de dinero, ingresos y gastos, deudas (propias y de terceros) y recordatorios de pago.

Nombre visible de la app: **SRM Finanzas** (`mobile-app/app.json`, bundle id `com.stiven.finanzas`).

## 2. Estructura del repo

```
Finanzas personales/
├── backend/            ← API activa (Express 5 + TypeScript + MongoDB). Esta es la que usa la app móvil.
├── api-backend/         ← Prototipo antiguo/abandonado. NO se usa. Ver sección 7.
├── mobile-app/          ← App React Native + Expo + TypeScript (iOS/Android).
└── package-lock.json    ← archivo suelto en la raíz, no pertenece a un package.json real ahí.
```

Repo git inicializado en la raíz, con remoto `origin` en GitHub (`stivenrodriguezm/SRM_Finanzas`).

## 3. Backend (`backend/`)

- Stack: Node.js, **TypeScript** (`strict: true`), Express 5, Mongoose 9 (MongoDB), JWT (`jsonwebtoken`), `bcryptjs`, `zod` (validación), `nodemailer` (envío de correo).
- Entry point: `src/server.ts` (conecta DB y levanta `app.listen`). `src/app.ts` exporta la app de Express ya configurada (rutas + middlewares) sin conectar DB ni escuchar — es lo que importan los tests.
- Scripts: `npm run dev` (tsx watch), `npm run build` (compila a `dist/`), `npm start` (corre `dist/server.js`), `npm run typecheck`, `npm test` (Jest), `npm run migrate:debt-transactions` (script de migración puntual, ver 3.4).
- Variables de entorno (`backend/.env`, no versionado — ver `.env.example`): `PORT` (**5005**), `MONGO_URI`, `JWT_SECRET`, `EMAIL_USER`, `EMAIL_APP_PASSWORD`, `EMAIL_FROM` (estas tres para recuperación de contraseña — ver 3.2).
- Todas las rutas bajo `/api` están protegidas con el middleware `protect` (`src/middlewares/authMiddleware.ts`), excepto `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/forgot-password` y `POST /api/auth/reset-password`.
- `protect` espera un JWT en el header `Authorization: Bearer <token>` y expone `req.user` (documento completo de `User`, sin password).
- **Manejo de errores centralizado**: los controllers usan `catchAsync` (envuelve el handler y reenvía cualquier rechazo a `next`) y lanzan `throw new AppError(mensaje, statusCode)` en vez de `res.status().json()` manual. `src/middlewares/errorHandler.ts` captura todo al final: si es un `AppError` responde su mensaje tal cual; cualquier otro error (bug, fallo de Mongo) se loguea en el servidor y al cliente solo le llega `{ message: 'Error interno del servidor' }` — nunca se filtra `error.message`/stack de errores no operacionales.
- **Validación**: cada ruta que recibe body pasa por `validate(schema)` (`src/middlewares/validate.ts`) con un schema de `zod` en `src/schemas/*Schemas.ts`. Si falla, responde 400 con un `AppError`.

### 3.1 Modelos (Mongoose, con interfaces TS en cada archivo)

| Modelo | Campos clave | Notas |
|---|---|---|
| `User` | `name`, `username`, `email`, `password` (hash), `preferences: { theme, hideAmounts, accountOrder, selectedAccounts }`, `resetPasswordCodeHash?`, `resetPasswordExpires?` (ambos `select: false`) | `preferences` existe en el modelo y tiene endpoint (`PUT /api/auth/preferences`) pero **el frontend no lo usa** (ver 6). Los campos de reset de contraseña se usan en el flujo de recuperación (3.2). |
| `Account` | `user`, `name`, `balance`, `color`, `icon`, `isLiability`, `description` | Representa una cuenta/bolsillo. `isLiability` distingue cuentas normales de "pasivos". Índice en `user`. |
| `Transaction` | `user`, `account`, `reminder?`, `debt?`, `title`, `amount`, `type: ingreso\|egreso\|abono_deuda`, `date` | El `type` determina si suma o resta del `balance` de la cuenta. `debt` (nuevo) liga un abono directamente a la deuda que paga. Índices en `{user,date}`, `{user,debt}`, `{user,reminder}`. |
| `Debt` | `user`, `name`, `totalAmount`, `remainingAmount`, `type: debo\|me_deben`, `dueDate?`, `color`, `icon`, `isActive`, `description` | `debo` = yo debo (pasivo), `me_deben` = préstamo que hice (activo/cuenta por cobrar). Índice en `user`. |
| `Reminder` | `user`, `title`, `date`, `type: unico\|periodico`, `amount?`, `isPaid`, `paymentLink?`, `description?`, `dayOfMonth?` | Recordatorios de pago; los periódicos avanzan de fecha automáticamente al pagarse. Índice en `{user,date}`. |

### 3.2 Endpoints por recurso

Todos bajo `http://<host>:5005/api`.

**Auth** (`/auth`)
- `POST /register` — crea usuario, devuelve `{ ...user, token }`.
- `POST /login` — devuelve `{ ...user, token }`.
- `POST /forgot-password` — `{ email }`. Si el correo existe, genera un código de 6 dígitos, lo guarda hasheado (10 min de validez) y lo envía por correo (`utils/sendEmail.ts`, Nodemailer sobre Gmail). Responde siempre el mismo mensaje genérico, exista o no el correo, para no revelar usuarios. Si `EMAIL_USER`/`EMAIL_APP_PASSWORD` no están configurados en `.env`, no fala la request pero tampoco se envía nada (solo queda un `console.warn`).
- `POST /reset-password` — `{ email, code, newPassword }`. Verifica el código contra el hash guardado y su expiración.
- `GET /profile`, `PUT /profile`, `PUT /change-password`.
- `PUT /preferences` — **no usado por el frontend actualmente**.

**Accounts** (`/accounts`)
- `GET /` (filtro opcional `?isLiability=true|false`), `POST /`, `PUT /:id`, `DELETE /:id`.

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

### 3.3 Reglas de negocio importantes
- El balance de una `Account` **sigue sin ser una fuente derivada** (no se recalcula desde las transacciones), pero cada operación que lo toca (crear/editar/borrar transacción, pagar deuda, pagar recordatorio) corre dentro de `session.withTransaction()` (`src/utils/withTransaction.ts`). Si algo falla a mitad de camino, Mongo revierte todo el conjunto — ya no puede quedar el balance actualizado sin la transacción, o viceversa.
- `PUT /transactions/:id` no permite cambiar el `type` (p. ej. de `egreso` a `abono_deuda`): la lógica de conversión sería ambigua respecto al `remainingAmount` de una deuda. Para cambiar el tipo hay que borrar y crear una transacción nueva.

### 3.4 Migraciones y bugs corregidos en el hardening de 2026-08-14
- **`Transaction.debt`** es un campo nuevo. Los abonos históricos (creados antes de este cambio) no lo tienen, solo tienen el título con el nombre de la deuda embebido. `backend/scripts/migrateDebtTransactions.ts` los vincula por regex una sola vez (ya se corrió contra la base real — no encontró transacciones para migrar en ese momento, pero es seguro re-correrlo, es idempotente). `getDebtTransactions` sigue soportando el regex como fallback para no perder historial de datos que nunca se migraron.
- **Bug corregido**: `payReminder` recalculaba la próxima fecha de un recordatorio periódico desde "hoy" en vez de desde el vencimiento actual guardado, lo que en ciertos casos dejaba la fecha sin avanzar al pagar. Ahora avanza siempre un mes exacto desde `reminder.date` (igual que `markReminderPaid`).
- **`JWT_SECRET` regenerado** con un valor aleatorio fuerte (antes era un placeholder predecible) — esto invalidó las sesiones que hubiera activas antes de este cambio; los usuarios necesitan volver a iniciar sesión una vez.

## 4. Mobile app (`mobile-app/`)

- Stack: Expo ~54, React 19, React Native 0.81, **TypeScript** (`strict: true`, `tsconfig.json` extiende `expo/tsconfig.base`), React Navigation (bottom tabs + native stack), `axios`, `@react-native-async-storage/async-storage`, `react-native-chart-kit` + `react-native-svg` (gráficos), `expo-local-authentication` (biometría), `expo-notifications` (avisos locales), `expo-file-system` + `expo-sharing` (exportar datos).
- Proyecto con carpeta `ios/` generada (`expo prebuild`), CocoaPods instalado. Compila limpio para simulador (`npx expo run:ios`) al día de esta actualización.
- Todo el texto de la UI y los mensajes están en español. Todos los archivos fuente son `.ts`/`.tsx` (ya no queda JS en `src/`).

### 4.1 Navegación (`src/navigation/AppNavigator.tsx`, tipos en `src/navigation/types.ts`)
- Si `!isAuthenticated` → stack de auth: `Landing`, `Register`, `ForgotPassword`, `ResetPassword`.
- Si autenticado → el stack completo queda envuelto en `<BiometricGate>` (ver 4.5) y contiene `TabRoot` (bottom tabs: **Balance** = Home, **Transacciones**, **Deudas**, **Recordatorios**, **Análisis**) + pantallas modal/stack: `AddRecord`, `AddReminder`, `ReminderDetail`, `Perfil`, `DebtDetail`, `AddDebt`, `Receivables` ("Me Deben"), `Preferences`, `AccountDetail`.
- `RootStackParamList`/`TabParamList` en `navigation/types.ts` documentan exactamente qué params espera cada pantalla — son la referencia si vas a agregar una navegación nueva (varios params reales no eran obvios por el nombre de la pantalla, p. ej. `DebtDetail` recibe `id`, `title`, `total`, `color`, `icon`, `iconColor`, `iconBg`, `type`).

### 4.2 Pantallas (`src/screens/`)
- `HomeScreen.tsx` — balance general / listado de cuentas.
- `TransactionsScreen.tsx` — listado de movimientos; **tocar una transacción abre un modal para editarla (título/monto/cuenta) o eliminarla**.
- `AddRecordScreen.tsx` — crear transacción.
- `DebtsScreen.tsx` / `DebtDetailScreen.tsx` / `AddDebtScreen.tsx` — cuentas de deuda (isLiability) y deudas persona-a-persona. `AddDebtScreen` en modo "Modificar" ahora precarga los datos existentes de la deuda (antes abría un formulario vacío).
- `ReceivablesScreen.tsx` — deudas de tipo `me_deben` ("Me Deben").
- `RemindersScreen.tsx` / `ReminderDetailScreen.tsx` / `AddReminderScreen.tsx` — recordatorios de pago.
- `ChartsScreen.tsx` — **nueva**, pestaña "Análisis": flujo neto mensual (barras, últimos 6 meses) y distribución de balance por cuenta (dona), más tarjetas de resumen de deudas.
- `AccountDetailScreen.tsx` — detalle de una cuenta.
- `ProfileScreen.tsx` — perfil; "Cambiar contraseña" e "Información personal" ahora llaman de verdad al backend (antes eran formularios que no persistían nada). Incluye acciones de exportar datos.
- `PreferencesScreen.tsx` — tema, privacidad por sección, notificaciones de recordatorios y **el nuevo toggle de bloqueo biométrico**.
- `Auth/LandingScreen.tsx`, `Auth/RegisterScreen.tsx`, `Auth/ForgotPasswordScreen.tsx` (ahora sí llama al backend), `Auth/ResetPasswordScreen.tsx` (**nueva** — código de 6 dígitos + nueva contraseña).

### 4.3 Estado global (Context API, sin Redux)
- `AuthContext.tsx` — sesión (login/register/logout/forgotPassword/resetPassword), token y user en `AsyncStorage` (`userToken`, `userInfo`). Cada cambio de token llama `setAuthToken()` del cliente HTTP central (ver 4.4).
- `PreferencesContext.tsx` — preferencias **locales al dispositivo** en `AsyncStorage` bajo `appPreferences`: tema (`light|dark|adaptive`), privacidad por pantalla, notificaciones de recordatorios, y **`biometricLockEnabled`** (nuevo). Expone `colors` según el tema activo (`src/theme/theme.ts`).

### 4.4 Cliente HTTP centralizado
`src/services/apiClient.ts` es ahora la **única** forma en que la app habla con el backend. Es una instancia de `axios` con `baseURL` = `API_URL` (`src/config/api.ts`, hostname Bonjour del Mac — ver sección 8) y un interceptor de request que agrega `Authorization: Bearer <token>` automáticamente, leyendo un token en memoria actualizado por `setAuthToken()` (llamado desde `AuthContext` en login/register/logout/carga inicial). Ninguna pantalla arma headers a mano ni importa `axios` directo — antes cada una repetía `axios.get(...)` con el header pegado, en 12 archivos distintos.

`src/utils/apiError.ts` centraliza la extracción del mensaje de error (`getErrorMessage(error, fallback)`), usado en los `catch` de las pantallas en vez de repetir `error.response?.data?.message || '...'`.

### 4.5 Bloqueo biométrico
`src/components/BiometricGate.tsx` envuelve el stack autenticado completo en `AppNavigator`. Si `preferences.biometricLockEnabled` está activo, pide Face ID/Touch ID (`src/services/biometricAuth.ts`, sobre `expo-local-authentication`) al abrir la app y cada vez que vuelve de segundo plano (`AppState`). El toggle está en `PreferencesScreen` y, al activarlo, primero verifica que el dispositivo tenga biometría configurada y pide una autenticación de confirmación antes de guardar la preferencia.

### 4.6 Notificaciones locales
`src/services/notifications.ts` (sobre `expo-notifications`) programa un aviso local un día antes del vencimiento de cada recordatorio no pagado (`syncReminderNotifications`, llamado tras cada fetch de recordatorios en `HomeScreen` y `RemindersScreen`). Pide permiso la primera vez que el usuario activa el toggle "Notificaciones de Recordatorios" en Preferencias. Son notificaciones **locales al dispositivo** (no push desde el backend) — se reprograman solas cada vez que se listan los recordatorios, así que no hay que preocuparse por vencer/reprogramar manualmente.

### 4.7 Exportar datos
`src/services/exportService.ts`: `exportAllDataAsJson()` (respaldo completo: cuentas, transacciones, deudas, recordatorios en un `.json`) y `exportTransactionsAsCsv()` (solo transacciones en `.csv`, para Excel/Sheets). Ambas escriben a `expo-file-system` (API moderna, clases `File`/`Paths`, no la API "legacy" de versiones viejas de Expo) y abren el share sheet nativo con `expo-sharing`. Botones en `ProfileScreen`. El formateo CSV puro (`toCsv`/`toCsvValue`) vive en `src/utils/csv.ts`, separado de la I/O nativa, justamente para poder testearlo sin mockear módulos nativos.

## 5. Cómo correr el proyecto en desarrollo

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
```

Para que **"olvidé mi contraseña"** envíe correos de verdad, completa `EMAIL_USER`/`EMAIL_APP_PASSWORD` en `backend/.env` con una [contraseña de aplicación de Gmail](https://myaccount.google.com/apppasswords) (requiere verificación en 2 pasos activa en esa cuenta). Sin esto, el endpoint sigue funcionando (no falla), pero el correo no se envía y solo queda un log en la consola del backend.

La app móvil necesita al backend corriendo y alcanzable en la red local — ver sección 8 para el detalle de despliegue en iPhone físico.

## 6. Deuda técnica / cosas a tener en cuenta

1. **`api-backend/` es un prototipo abandonado.** Sigue ahí, sin tocar; sigue sin usarse. Candidato a eliminar si se confirma que no se necesita.
2. **Preferencias duplicadas.** El backend (`User.preferences`) tiene `theme`, `hideAmounts`, `accountOrder`, `selectedAccounts` con su propio endpoint `PUT /api/auth/preferences`, pero la app usa únicamente `PreferencesContext` con `AsyncStorage` local — el backend nunca se llama para esto. Si el objetivo es sincronizar preferencias entre dispositivos, falta esa integración; si no, se podría simplificar/quitar del modelo de backend.
3. **Sin backend en la nube.** El Mac tiene que estar prendido y en la misma red que el iPhone para que la app funcione (ver sección 8). Es una limitación de infraestructura conocida y aceptada por ahora, no un bug.
4. **Cobertura de tests desigual a propósito.** El backend tiene una suite real cubriendo toda la lógica de dinero (22 tests). El móvil tiene tests solo para lógica pura sin dependencias nativas (`apiError`, `csv`, el interceptor de `apiClient`, un smoke test de componente) — no hay tests de integración de pantallas completas ni de navegación. Fue una decisión deliberada de prioridad (el dinero es lo crítico), no un olvido.
5. **`react-native-chart-kit`** está bien pero es una librería relativamente estática (sin animaciones ricas ni interacción táctil sobre las barras/dona). Si en el futuro se quiere algo más pulido, la alternativa natural es Victory Native XL (requiere `@shopify/react-native-skia`, una dependencia nativa más pesada).
6. **`SafeAreaView` deprecado.** React Native marcó como deprecado el `SafeAreaView` que se importa de `'react-native'` en varias pantallas (aparece como warning en consola). La librería correcta ya está instalada (`react-native-safe-area-context`) pero migrar cada pantalla no se hizo en este hardening por no ser código roto, solo una advertencia.

## 7. Notas sobre `api-backend/`

Servidor Express mínimo (`server.js` con solo `/`, `/health` y manejo de 404/errores genérico), con modelos `Account`/`Transaction` y un controlador de transacciones sin autenticación. No tiene `authRoutes`, `debtRoutes` ni `reminderRoutes`. Todo indica que fue el punto de partida antes de que `backend/` se convirtiera en la API real y completa. Mantenido aquí solo como referencia histórica. Sigue en JavaScript (no se migró a TS — está fuera de uso).

## 8. Despliegue en el iPhone físico

Modelo actual: **no hay backend en la nube**. El iPhone corre la app nativa (compilada e instalada desde Xcode) y le habla al backend Express que corre en el Mac, en la misma red Wi-Fi. Esto implica dos requisitos permanentes mientras no se despliegue el backend a un host real:
- El Mac tiene que estar encendido y con `backend/` corriendo (`npm run dev`, puerto 5005) para que la app funcione.
- El iPhone y el Mac tienen que estar en la misma red Wi-Fi (el hostname `.local` de la sección 4.4 no resuelve a través de redes distintas ni por datos móviles).

### 8.1 Proyecto nativo iOS
- `mobile-app/ios/` es un proyecto Xcode ya generado (`expo prebuild`), con CocoaPods instalado.
- Bundle ID: `com.stiven.finanzas`. Nombre del esquema/target: `Finanzas`.
- Firma ya configurada en el `.pbxproj`: `DEVELOPMENT_TEAM = ZLCWNMPT33`.
- El Mac (`Stivens-MacBook-Air`) ya tiene registrado el dispositivo "iPhone de Stiven" en Xcode (aparece en `xcrun xctrace list devices`, aunque puede figurar "Offline" si no está conectado en ese momento).
- Plugins de config en `app.json`: `@react-native-community/datetimepicker`, `expo-asset`, `expo-local-authentication` (con `faceIDPermission`, agrega `NSFaceIDUsageDescription` a Info.plist), `expo-notifications`, `expo-font`.
- **`@expo/vector-icons` y `expo-font` deben estar declarados como dependencias directas** en `package.json` (no solo transitivas de `expo`). Sin esto, `tsc`/herramientas fuera de Metro no resuelven `@expo/vector-icons`, y CocoaPods puede descartar el pod de `ExpoFont` al reinstalar — causando el crash en runtime `Cannot find native module 'ExpoFontLoader'` (ya ocurrió una vez durante este hardening, ya está resuelto).
- Si una compilación falla con errores de tipo `module map file ... not found` / `no such module 'Expo'`, es un problema de caché de Xcode: borrar `~/Library/Developer/Xcode/DerivedData/Finanzas-*` y volver a compilar.
- Si el linker falla con `Undefined symbols for architecture arm64` (p. ej. `facebook::react::Sealable::Sealable()`), es un desajuste entre Pods cacheados y los binarios prebuilt de React Native — solución: `rm -rf ios/Pods ios/Podfile.lock ~/Library/Caches/CocoaPods && cd ios && pod install` (reinstalación limpia), luego recompilar.
- Con una cuenta Apple gratuita (sin Apple Developer Program pagado), las apps instaladas por cable vía Xcode expiran a los 7 días y hay que reinstalar (repetir Run desde Xcode, o `npx expo run:ios -d <device>`). Con cuenta paga ($99/año) duran un año y se puede pasar a distribución por TestFlight sin cable.
- Carpetas `ios/build`, `ios/build_debug`, `ios/build_release`, `ios/Payload` y el archivo `Finanzas.ipa` en la raíz de `mobile-app/` son artefactos de compilaciones manuales anteriores; no son necesarios para compilar desde Xcode.
