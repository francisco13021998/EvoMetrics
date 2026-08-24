# CLAUDE.md — Contexto de EvoMetrics

> **Regla de mantenimiento:** este fichero es la fuente de contexto de la app. **Cualquier cambio en el funcionamiento (features, flujos, esquema, rutas, lógica de negocio) debe reflejarse aquí en el mismo cambio.** El plan de trabajo pendiente vive en `PLAN.md`; al completar tareas de ese plan, actualizar ambos documentos.

## Qué es

App móvil (Android; salida web estática; sin config iOS) para **entrenadores personales y nutricionistas**: gestión de clientes con mediciones antropométricas y cálculo automático de composición corporal, seguimiento fotográfico, cobros recurrentes, agenda de citas con recurrencia y recordatorios locales. Toda la UI está en **español**.

## Stack

- **Expo SDK 55** + React Native 0.83 + React 19, TypeScript strict, `expo-router` (typed routes) y React Compiler activados (`app.json` → experiments).
- **Supabase**: Auth (email/password), Postgres, Storage (bucket `client-images`) y una edge function (`send-trainer-request`, envía emails vía Resend). Cliente en `src/lib/supabase.ts`, sesión persistida en AsyncStorage (con guard SSR: en el prerender del export web estático no hay `window` y la persistencia se desactiva). En `supabase/pending/` hay migraciones redactadas que NO se auto-aplican (ver su README).
- **EAS Build** (perfiles `preview` APK y `production` app-bundle). Flujo CNG/prebuild: `/android` e `/ios` no se versionan. Sin expo-updates (no hay OTA).
- Alias de imports: `@/*` → `./src`. La edge function (Deno) está excluida del typecheck (`tsconfig.json`).

## Comandos

```bash
npm run start      # expo start
npm run android    # expo start --android
npm run web        # expo start --web
npm run lint       # expo lint (limpio: 0 errores/avisos)
npm run typecheck  # tsc --noEmit (limpio: exit 0)
npm test           # jest (jest-expo) — 55 tests de src/utils/ en src/utils/__tests__/
# CI: .github/workflows/ci.yml (lint + typecheck + test en cada push/PR)
# Mantener los tres en verde; los tests son la red de regresión de la lógica pura.
```

Variables de entorno (`.env`, no debería estar versionado — ver PLAN.md Fase 0): `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, y `EXPO_PUBLIC_DEV_LOGIN_ALIAS/EMAIL/PASSWORD` (login rápido solo en `__DEV__`: escribir el alias como email autorrellena las credenciales, `src/services/auth.ts`).

## Estructura

```
src/
  app/          Rutas expo-router (ficheros finos: guard + montar pantalla)
  screens/      Pantallas reales (la lógica de UI vive aquí)
  services/     Acceso a Supabase (1 fichero por agregado)
  utils/        Lógica de negocio PURA (fórmulas, fechas, estados) — sin React ni Supabase
  components/   auth/ (guards), forms/, layout/, surface/, feedback/, ui/
  constants/    theme.ts, body-fat-formulas.ts (metadata + fichas), athlete-level.ts
  providers/    auth-provider.tsx (sesión + rol + notificaciones + deep links)
  types/        domain.ts (modelo de dominio completo)
supabase/
  migrations/   SOLO cambios incrementales — las tablas base y el RLS NO están versionados
  functions/    send-trainer-request (Deno)
```

## Roles y navegación

- Roles (`profiles.role`): `trainer | coach | nutritionist | owner` (profesionales) y `athlete`. El rol se carga async tras la sesión (`auth-provider.tsx: fetchRole`, default `trainer` si no hay fila).
- `/` redirige: sin sesión → `/login`; rol `athlete` → `/athlete`; resto → `/(tabs)`.
- Guards en `src/components/auth/auth-route.tsx`: `GuestRoute`, `ProtectedRoute` (solo sesión), `TrainerRoute` (sesión + rol profesional) y `AthleteRoute`. Las rutas de entrenador (5 pestañas, `clients/new`, `.../edit`, `.../payments`, `revisions/new`, `.../edit` y todo `/events/*`) usan `TrainerRoute`; las compartidas con atletas (ficha de cliente, fotos, métricas, detalle de revisión) usan `ProtectedRoute`. El login redirige a `/`, que enruta por rol.
- **5 pestañas** (`(tabs)/_layout.tsx`): Inicio (`ClientsScreen`, dashboard), Clientes (`ClientListScreen`), Agenda, Pagos, Más.
- Grupos `/clients/*`, `/revisions/*` y `/events/*` usan `PersistentTabShell`, una **barra de tabs falsa** paralela al Tabs real que navega con `router.replace` (deuda conocida; unificarla está en PLAN.md).
- Rutas principales: `/clients/[clientId]` (ficha), `.../metrics` + `.../metrics/[metricKey]` (análisis histórico), `.../payments`, `.../photos`, `/revisions/new?clientId=`, `/revisions/[revisionId]` (+ `/edit`), `/events/new`, `/events/[eventId]/edit`, `/events/occurrences/[occurrenceId]`, `/athlete` (vista atleta solo lectura).
- Rutas huérfanas/placeholder: `/register`, `/athlete-join`, `/athlete-register*` ("Soon"). El alta de atletas por PIN está **en mantenimiento**: `src/services/athlete-pins.ts` es un stub que siempre devuelve error.

## Modelo de dominio (tablas Supabase)

- `profiles`: id (= auth user), fullName, email, role.
- `clients`: owner_id, athlete_user_id (vínculo con cuenta atleta), name, sex (acepta `female/male` y `mujer/hombre` — normalización bilingüe en `services/clients.ts`), athlete_level, height_cm, `date_birth` (⚠️ el código usa `date_birth`; la migración creó `birth_date`, columna muerta), coaching_price, billing_frequency, force_payment_pending, `estado` (`activo|baja`), revision_frequency_value/unit.
- `revisions`: snapshot completo por medición — peso, 7 perímetros (cm), 7 pliegues (mm), % graso visual/pliegues/medio, masas grasa/magra + diffs, kcal mantenimiento/objetivo, ids de fórmula usados, fase, notas, reviewed_at. Ordenadas por `reviewed_at` desc (índice 0 = más reciente en toda la app).
- `client_payments`: amount, payment_date, due_date (permite **pagos adelantados**: pagas hoy un periodo que vence después). El alta se hace vía el RPC `create_client_payment` (security definer, valida `owner_id = auth.uid()`); update/remove filtran también por `owner_id`.
- `client_photos`: storage_path en bucket `client-images` (`ownerId/clientId/fichero`), revision_id opcional, captured_at. Se sirven con **signed URLs de 1 hora**.
- `events` + `event_occurrences`: definición de serie (kind, fecha/hora local, duración, recurrencia daily/weekly/monthly con intervalo, días de semana o día del mes, fin never/until/count) y ocurrencias materializadas on-demand por ventana de fechas (`syncOccurrencesForOwner`; 30 días en agenda, 90 en dashboard/notificaciones). Estados de ocurrencia: scheduled/completed/cancelled/rescheduled (reprogramar enlaza la nueva vía `rescheduled_from_occurrence_id`).
- `body_fat_formulas`: catálogo de fórmulas con cache en memoria y fallback a metadata local (`constants/body-fat-formulas.ts`).

## Lógica de negocio clave (en `src/utils/`, todo puro y testeable)

- **% graso por perímetros**: U.S. Navy (Hodgdon & Beckett 1984); hombre usa abdomen−cuello, mujer abdomen+glúteo−cuello (`calculations.ts`).
- **% graso por pliegues**: Durnin & Womersley 1974, 4 pliegues (bíceps, tríceps, subescapular, suprailíaco), constantes por sexo y tramo de edad, densidad → Siri (495/D−450). Solo el nivel `beginner` tiene protocolo activo; intermedio/avanzado son "Próximamente".
- **% graso final**: media aritmética de los métodos disponibles (visual + pliegues + perímetros, de 1 a 3 fuentes).
- **Kcal mantenimiento**: Mifflin-St Jeor × factor de actividad (7 valores cerrados 1.30–2.25, `activity.ts`).
- Las fichas informativas de fórmulas en pantalla se generan desde los mismos coeficientes del código, así documentación e implementación no divergen.
- **Estado de pago**: próxima fecha = dueDate del pago **con vencimiento más reciente** (no `payments[0]`) o paymentDate, o createdAt del cliente, + frecuencia (semanal +7d, quincenal +15d, mensual/trimestral/anual con recorte a fin de mes); pendiente si hoy ≥ próxima o `forcePaymentPending`. Ingreso mensual del dashboard = Σ coachingPrice × multiplicador (semanal 52/12, **quincenal 24/12 = 2/mes**, mensual 1, trimestral 1/3, anual 1/12).
- **Estado de revisión**: frecuencia valor+unidad (week/month); "sin frecuencia" se representa como null, 0 o el centinela 9999 (deuda conocida).
- **Comparaciones homogéneas**: el análisis histórico y los diffs buscan como referencia una revisión calculada con la **misma fórmula/firma**; si no existe, muestran "Sin homogénea" en vez de un delta engañoso (`revision-comparisons.ts`, `client-history.ts` — 5 modos de comparación).
- Convención de fechas date-only: **`src/utils/date-only.ts` es el módulo canónico** (parseo de 'YYYY-MM-DD' por componentes LOCALES; nunca `new Date('YYYY-MM-DD')` directo). Lo usan utils y servicios; los servicios guardan date-only como string 'YYYY-MM-DD'.

## Notificaciones (locales, no push)

`src/services/device-notifications.ts`: en cada sync se cancelan todas y se reprograman. Pagos/revisiones pendientes: a las 23:59, repetición cada 2 días, **horizonte 14 días**; los vencidos avisan en el próximo 23:59 (nunca un disparo inmediato). Eventos: **un único aviso 60 min antes** de la ocurrencia. **Tope global de 60 programadas** (límite iOS: 64), priorizando las más próximas. El badge del dashboard solo cuenta eventos a **7 días vista** (`EVENT_NOTIFICATION_WINDOW_DAYS`). Sync al iniciar sesión, en cada focus del dashboard y al recuperar red (`expo-network`); los datos se cargan en batch (`listByClients`). Deep links al tocar: kind `payment` → `/clients/{id}/payments`, `revision` → `/clients/{id}`, `event` → `/events/occurrences/{id}` (`auth-provider.tsx`). Desactivadas en Expo Go (`supportsDeviceNotifications`). Botón de prueba en pestaña Más.

## Fotos

Galería por cliente (`client-photos-screen.tsx`): subida múltiple (ImagePicker, calidad 0.9) con fecha y revisión opcional, edición/reemplazo/borrado, **comparador lado a lado** con zoom independiente 40–300% y exportación de la comparación a la galería del dispositivo (view-shot + media-library). Las signed URLs (1 h) se generan **en batch** (`createSignedUrls`, 1 llamada por listado) y la pantalla recarga en cada focus. Desde el formulario de revisión en modo crear, las fotos se suben con `revisionId: null` y se enlazan al guardar; **si se sale sin guardar, se borran automáticamente** (limpieza de huérfanas). `photosService.remove` borra primero la fila SQL y después el objeto de storage (best-effort).

## Convenciones y particularidades

- Pantallas grandes con estilos StyleSheet al pie del fichero; textos UI en español; `ThemedText` + tokens de `constants/theme.ts` (Accent, Spacing, Radius, Shadows).
- **Dark mode forzado a light** en nativo y web (`use-color-scheme.ts` / `.web.ts`); la paleta dark existe en theme.ts pero no está lista.
- La pestaña **Más** es en gran parte maqueta: sus 9 items muestran pill "Próximamente" (sin acción) y el badge "Plan Pro" es decorativo; solo funcionan el test de notificación y cerrar sesión.
- En la **agenda**, los cobros y revisiones son items **"Sin hora"** (etiqueta en vista día, franja propia sobre el timeline semanal); solo los eventos tienen hora real.
- Servicios: patrón `DbXxxRow` (snake_case) → map a tipo de dominio (camelCase); errores relanzados como `new Error(error.message)`. Batch por cliente con `listByClients` (pagos/revisiones) para evitar N+1.
- Carga de pantallas: `useFocusEffect` (que también se dispara al montar — no añadir un `useEffect` duplicado).
- Tests: Jest (preset jest-expo, `babel.config.js` propio que resuelve `babel-preset-expo` anidado); solo lógica pura de `src/utils/` por ahora. CI en GitHub Actions. `typecheck`, `lint` y `test` deben mantenerse en verde.

## Documentos relacionados

- `PLAN.md` — plan de mejora priorizado (solo trabajo de **código**), con checkboxes y registro de cambios. Mantenerlo al día junto con este fichero.
- `TAREAS-PROPIETARIO.md` — acciones manuales y decisiones que corresponden al dueño de la app (rotar credenciales, RLS/migraciones en Supabase, operaciones git, PIN/OTA/RGPD). Las tareas *(bloqueado)* de PLAN.md dependen de él.
