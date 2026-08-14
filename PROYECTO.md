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
├── backend/            ← API activa (Express 5 + MongoDB). Esta es la que usa la app móvil.
├── api-backend/         ← Prototipo antiguo/abandonado. NO se usa. Ver sección 7.
├── mobile-app/          ← App React Native + Expo (iOS/Android).
└── package-lock.json    ← archivo suelto en la raíz, no pertenece a un package.json real ahí.
```

**No hay repositorio git inicializado en la raíz** (`git status` falla con "not a git repository"). No hay historial de versiones del proyecto todavía.

## 3. Backend (`backend/`)

- Stack: Node.js, Express 5, Mongoose 9 (MongoDB), JWT (`jsonwebtoken`), `bcryptjs` para hash de contraseñas.
- Entry point: `server.js` → `app.listen(PORT, '0.0.0.0', ...)`.
- Variables de entorno (`backend/.env`, no versionado): `PORT` (actualmente **5005**), `MONGO_URI`, `JWT_SECRET`.
- Todas las rutas bajo `/api` están protegidas con el middleware `protect` (`src/middlewares/authMiddleware.js`), excepto `POST /api/auth/register` y `POST /api/auth/login`.
- `protect` espera un JWT en el header `Authorization: Bearer <token>` y expone `req.user.id`.

### 3.1 Modelos (Mongoose)

| Modelo | Campos clave | Notas |
|---|---|---|
| `User` | `name`, `username`, `email`, `password` (hash), `preferences: { theme, hideAmounts, accountOrder, selectedAccounts }` | `preferences` existe en el modelo y tiene endpoint (`PUT /api/auth/preferences`) pero **el frontend no lo usa** (ver 6.4). |
| `Account` | `user`, `name`, `balance`, `color`, `icon`, `isLiability`, `description` | Representa una cuenta/bolsillo. `isLiability` distingue cuentas normales de "pasivos". |
| `Transaction` | `user`, `account`, `reminder?`, `title`, `amount`, `type: ingreso\|egreso\|abono_deuda`, `date` | El `type` determina si suma o resta del `balance` de la cuenta. |
| `Debt` | `user`, `name`, `totalAmount`, `remainingAmount`, `type: debo\|me_deben`, `dueDate?`, `color`, `icon`, `isActive`, `description` | `debo` = yo debo (pasivo), `me_deben` = préstamo que hice (activo/cuenta por cobrar). |
| `Reminder` | `user`, `title`, `date`, `type: unico\|periodico`, `amount?`, `isPaid`, `paymentLink?`, `description?`, `dayOfMonth?` | Recordatorios de pago; los periódicos avanzan de fecha automáticamente al pagarse. |

### 3.2 Endpoints por recurso

Todos bajo `http://<host>:5005/api`.

**Auth** (`/auth`)
- `POST /register` — crea usuario, devuelve `{ ...user, token }`.
- `POST /login` — devuelve `{ ...user, token }`.
- `GET /profile` — perfil del usuario autenticado.
- `PUT /profile` — editar `name`/`username`/`email`.
- `PUT /change-password`.
- `PUT /preferences` — **no usado por el frontend actualmente**.

**Accounts** (`/accounts`)
- `GET /` (filtro opcional `?isLiability=true|false`), `POST /`, `PUT /:id`, `DELETE /:id`.

**Transactions** (`/transactions`)
- `GET /` (poblado con `account`), `POST /` (actualiza balance de la cuenta), `DELETE /:id` (revierte el balance).

**Debts** (`/debts`)
- `GET /`, `GET /:id`, `POST /`, `PUT /:id`, `DELETE /:id`.
- `GET /:id/transactions` — abonos relacionados (busca por `Transaction.title` que contenga el nombre de la deuda — ver limitación en 7).
- `POST /:id/payment` — registra un abono: baja `remainingAmount`, crea `Transaction` tipo `abono_deuda`, ajusta el balance de la cuenta según el sentido de la deuda (`debo` resta, `me_deben` suma), y marca `isActive: false` si queda saldada.

**Reminders** (`/reminders`)
- `GET /`, `POST /`, `PUT /:id`, `DELETE /:id`.
- `PUT /:id/mark-paid` — marca pagado; si es periódico, avanza al mes siguiente y resetea `isPaid`.
- `POST /:id/pay` — crea una `Transaction` tipo `egreso` ligada al recordatorio (`reminder` ref) y ajusta el balance; si es periódico avanza la fecha.
- `GET /:id/payments` — historial de pagos (`Transaction.find({ reminder: id })`).

### 3.3 Reglas de negocio importantes
- El balance de una `Account` **no se recalcula desde las transacciones**: se actualiza incrementalmente en cada create/delete de transacción y en cada pago de deuda/recordatorio. Si algo falla a mitad de camino, el balance puede desincronizarse (no hay transacciones atómicas de Mongo en uso).
- No existe endpoint de actualización de `Transaction` (solo crear/borrar), así que "editar" una transacción en la UI probablemente implica borrar + crear.

## 4. Mobile app (`mobile-app/`)

- Stack: Expo ~54, React 19, React Native 0.81, React Navigation (bottom tabs + native stack), `axios`, `@react-native-async-storage/async-storage`.
- Proyecto con carpeta `ios/` generada (prebuild nativo) — ya se ha compilado un `.ipa` (`Finanzas.ipa`) para instalar en dispositivo real.
- Todo el texto de la UI y los mensajes están en español.

### 4.1 Navegación (`src/navigation/AppNavigator.js`)
- Si `!isAuthenticated` → stack de auth: `Landing`, `Register`, `ForgotPassword`.
- Si autenticado → `TabRoot` (bottom tabs: **Balance** = Home, **Transacciones**, **Deudas**, **Recordatorios**) + pantallas modal/stack: `AddRecord`, `AddReminder`, `ReminderDetail`, `Perfil`, `DebtDetail`, `AddDebt`, `Receivables` ("Me Deben"), `Preferences`, `AccountDetail`.

### 4.2 Pantallas (`src/screens/`)
- `HomeScreen.js` — balance general / listado de cuentas.
- `TransactionsScreen.js` — listado de movimientos.
- `AddRecordScreen.js` — crear transacción.
- `DebtsScreen.js` / `DebtDetailScreen.js` / `AddDebtScreen.js` — deudas propias.
- `ReceivablesScreen.js` — deudas de tipo `me_deben` ("Me Deben").
- `RemindersScreen.js` / `ReminderDetailScreen.js` / `AddReminderScreen.js` — recordatorios de pago.
- `AccountDetailScreen.js` — detalle de una cuenta.
- `ProfileScreen.js` / `PreferencesScreen.js` — perfil y preferencias locales del usuario.
- `Auth/LandingScreen.js`, `Auth/RegisterScreen.js`, `Auth/ForgotPasswordScreen.js`.

### 4.3 Estado global (Context API, sin Redux)
- `AuthContext.js` — sesión (login/register/logout), token y user en `AsyncStorage` (`userToken`, `userInfo`).
- `PreferencesContext.js` — preferencias **locales al dispositivo** guardadas en `AsyncStorage` bajo la key `appPreferences`: tema (`light|dark|adaptive`), privacidad por pantalla (ocultar montos), notificaciones de recordatorios. Expone `colors` según el tema activo (`src/theme/theme.js` define `lightColors`/`darkColors`).

### 4.4 Cliente HTTP
Todas las pantallas y `AuthContext.js` llaman al backend con `axios` directo (no hay una instancia central de axios en uso) pero comparten una sola constante `API_URL`, importada desde **`src/config/api.js`**:

```js
export const API_URL = 'http://Stivens-MacBook-Air.local:5005/api';
```

Se usa el hostname Bonjour (`.local`) del Mac en vez de una IP fija porque la IP de Wi-Fi cambia con cada reasignación de DHCP (esto ya rompió la app dos veces — ver historial en sección 6). El `.local` se resuelve solo mientras el iPhone y el Mac estén en la misma red. Si deja de resolver, cambiar el valor por la IP LAN actual del Mac (`ipconfig getifaddr en0`).

`src/services/apiClient.js` sigue existiendo pero **no lo usa ninguna pantalla** (código muerto, ver sección 6). Además tiene dos bugs si algún día se retoma: lee `process.env.API_BASE_URL` sin el prefijo `EXPO_PUBLIC_` que Expo exige para inyectar variables de entorno al bundle del cliente (por eso siempre caía al fallback `localhost`, inútil en dispositivo físico), y el interceptor no envía el header `Authorization`.

## 5. Cómo correr el proyecto en desarrollo

```bash
# Backend
cd backend
npm install
npm run dev        # nodemon, puerto definido en .env (PORT=5005)

# Mobile app
cd mobile-app
npm install
npx expo start      # o: npm run ios / npm run android / npm run web
```

La app móvil necesita al backend corriendo y alcanzable en la red local — ver sección 8 para el detalle de despliegue en iPhone físico.

## 6. Deuda técnica / cosas a tener en cuenta

1. **`api-backend/` es un prototipo abandonado.** Solo tiene modelo/rutas de `Transaction` y `Account`, sin auth. La app móvil no le apunta. Candidato a eliminar si se confirma que no se necesita, o a documentar por qué se conserva.
2. ~~URL del backend duplicada e inconsistente en el móvil~~ — **resuelto 2026-08-14**: ahora hay una sola constante `API_URL` en `mobile-app/src/config/api.js` que todas las pantallas y `AuthContext.js` importan. Antes estaba repetida (hardcodeada) en 12 archivos distintos con IPs que ya se habían desincronizado dos veces (`192.168.2.62` en `.env`/`apiClient.js` sin usar vs `192.168.40.21` copiado en cada pantalla vs la IP real del Mac que ya era `192.168.40.22`). Se cambió además de IP fija a hostname Bonjour (`.local`) para que sobreviva a los cambios de IP por DHCP.
3. **`apiClient.js` sigue sin usarse y sin inyectar el token JWT** — el interceptor de request tiene el `Authorization` header comentado, y ya no es la fuente de la URL (ver 4.4). Si en el futuro se decide adoptarlo como cliente HTTP central, hay que arreglar ambas cosas.
4. **Preferencias duplicadas.** El backend (`User.preferences`) tiene `theme`, `hideAmounts`, `accountOrder`, `selectedAccounts` con su propio endpoint `PUT /api/auth/preferences`, pero la app usa únicamente `PreferencesContext` con `AsyncStorage` local — el backend nunca se llama. Si el objetivo es sincronizar preferencias entre dispositivos, falta esa integración; si no, se podría simplificar/quitar del modelo de backend.
5. **Balance de cuentas no es una fuente derivada.** Se actualiza a mano en cada operación (crear/borrar transacción, pagar deuda, pagar recordatorio). Si se agrega una nueva forma de mover dinero, hay que recordar actualizar el balance ahí también.
6. **`getDebtTransactions` matchea por texto** (`title` con regex del nombre de la deuda) en vez de por relación directa (`Transaction` no tiene campo `debt`). Riesgo: nombres de deuda parecidos o cambios de nombre rompen el historial.
7. **Sin tests automatizados.** Los archivos `backend/test_api.js`, `test_api_fetch.js`, `test_controller.js`, `test_mongoose.js` son scripts manuales de prueba (no Jest/Mocha), pensados para ejecutarse a mano con `node`, no una suite real.
8. **Scripts de refactor de un solo uso en `mobile-app/src/screens/`**: `fix_hooks.js`, `fix_imports.js`, `fix_privacy.js`, `fix_subcomponents.js`, `refactor_styles.js`, `update_add_debt.js`, `update_add_record.js`, `update_debt_detail.js`, `update_home_accounts.js`, `update_receivables.js`, `update_transactions_refresh.js`. Son scripts Node que reescribieron pantallas en algún momento del desarrollo; no forman parte de la app (nada los importa). Se pueden borrar con seguridad si ya cumplieron su propósito.
9. **Sin repo git.** No hay control de versiones en la raíz del proyecto — considerar `git init` para tener historial y poder revertir cambios.

## 7. Notas sobre `api-backend/`

Servidor Express mínimo (`server.js` con solo `/`, `/health` y manejo de 404/errores genérico), con modelos `Account`/`Transaction` y un controlador de transacciones sin autenticación. No tiene `authRoutes`, `debtRoutes` ni `reminderRoutes`. Todo indica que fue el punto de partida antes de que `backend/` se convirtiera en la API real y completa. Mantenido aquí solo como referencia histórica.

## 8. Despliegue en el iPhone físico

Modelo actual: **no hay backend en la nube**. El iPhone corre la app nativa (compilada e instalada desde Xcode) y le habla al backend Express que corre en el Mac, en la misma red Wi-Fi. Esto implica dos requisitos permanentes mientras no se despliegue el backend a un host real:
- El Mac tiene que estar encendido y con `backend/` corriendo (`npm run dev`, puerto 5005) para que la app funcione.
- El iPhone y el Mac tienen que estar en la misma red Wi-Fi (el hostname `.local` de la sección 4.4 no resuelve a través de redes distintas ni por datos móviles).

### 8.1 Proyecto nativo iOS
- `mobile-app/ios/` es un proyecto Xcode ya generado (`expo prebuild`), con CocoaPods instalado.
- Bundle ID: `com.stiven.finanzas`. Nombre del esquema/target: `Finanzas`.
- Firma ya configurada en el `.pbxproj`: `DEVELOPMENT_TEAM = ZLCWNMPT33`. Si Xcode pide reseleccionar el equipo de firma, es la misma cuenta Apple ya usada antes para generar `Finanzas.ipa`.
- El Mac (`Stivens-MacBook-Air`) ya tiene registrado el dispositivo "iPhone de Stiven" en Xcode (aparece en `xcrun xctrace list devices`, aunque puede figurar "Offline" si no está conectado en ese momento).
- Si una compilación falla con errores de tipo `module map file ... not found` / `no such module 'Expo'`, es un problema de caché de Xcode, no del código: borrar `~/Library/Developer/Xcode/DerivedData/Finanzas-*` y volver a compilar. Si persiste, correr `pod install` dentro de `mobile-app/ios/`.
- Con una cuenta Apple gratuita (sin Apple Developer Program pagado), las apps instaladas por cable vía Xcode expiran a los 7 días y hay que reinstalar (repetir Run desde Xcode). Con cuenta paga ($99/año) duran un año y se puede pasar a distribución por TestFlight sin cable.
- Carpetas `ios/build`, `ios/build_debug`, `ios/build_release`, `ios/Payload` y el archivo `Finanzas.ipa` en la raíz de `mobile-app/` son artefactos de compilaciones manuales anteriores; no son necesarios para compilar desde Xcode y se pueden borrar si se quiere limpiar espacio.
