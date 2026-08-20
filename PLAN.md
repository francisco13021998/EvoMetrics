# PLAN.md — Plan de mejora de EvoMetrics

> **Origen:** auditoría del código (agosto 2026) con verificación adversarial de cada hallazgo contra el código real. Todas las referencias `archivo:línea` fueron comprobadas.
>
> **Cómo usar este documento:** marcar `[x]` al completar cada tarea y anotar en el registro final. Si un cambio altera el funcionamiento de la app, **reflejarlo también en `CLAUDE.md`**. Si surgen problemas nuevos por el camino, añadirlos a la fase que corresponda.

---

## Fase 0 — Seguridad crítica (antes que cualquier otra cosa)

### 0.1 Credenciales expuestas en el repo
- [ ] **Rotar la contraseña del usuario de dev-login** (`.env:5`, `EXPO_PUBLIC_DEV_LOGIN_PASSWORD`). El repo tiene remote público en GitHub y el `.env` está trackeado desde el commit `777e666`: borrar el fichero no basta, la clave está en el historial.
- [ ] Sacar `.env` del repo: añadir `.env` a `.gitignore` (hoy solo cubre `.env*.local`, línea 34) y ejecutar `git rm --cached .env`.
- [ ] Crear `.env.example` con las claves vacías y documentarlo en el README.
- [ ] Revisar que el dev-login no llegue a producción: las variables `EXPO_PUBLIC_*` se **inlinean en el bundle JS de release** (la const se evalúa a nivel de módulo en `src/services/auth.ts:26`, fuera del guard `__DEV__`). Mover el preset a un mecanismo no versionado o excluirlo de builds de producción.
- [ ] Valorar limpiar el historial de git (filter-repo / BFG) si el repo se comparte.

### 0.2 Row Level Security (RLS)
- [ ] **Verificar en el dashboard de Supabase** que `clients`, `revisions`, `client_photos`, `client_payments`, `events`, `event_occurrences` y el bucket `client-images` tienen RLS activo con policies por `owner_id` (y `athlete_user_id` para el rol atleta). Ninguna migración del repo contiene `enable row level security` ni `create policy` (grep: 0 resultados), y el código confía explícitamente en RLS (`clients.ts:186`, `photos.ts:232`).
- [ ] **Versionar el RLS en migraciones** (tablas base + policies + storage), para que el esquema real sea reproducible y auditable. Hoy las tablas base (`clients`, `revisions`, `client_photos`, `body_fat_formulas`) ni siquiera aparecen en las migraciones.

### 0.3 Defensa en profundidad: filtros por owner en cliente
- [ ] `clientPaymentsService.update/remove` filtran solo por `id` (`src/services/client-payments.ts:105-110,120`) → añadir `.eq('owner_id', ...)`.
- [ ] `revisionsService.getById/update/remove` solo por `id` y `listByClient` solo por `client_id` (`src/services/revisions.ts:409-414,423-428,499,511`) → ídem.
- [ ] `eventsService.listOccurrencesByEvent` solo por `event_id` (`src/services/events.ts:304-309`) → ídem.

### 0.4 Edge function `send-trainer-request`
- [ ] Sin autenticación, sin rate limit y enviando correo al email arbitrario recibido → usable para email bombing (`supabase/functions/send-trainer-request/index.ts:38,64`). Añadir rate limiting (tabla de solicitudes con unique + ventana temporal) y/o captcha.
- [ ] Inyección de HTML: el email se interpola sin escapar en el correo al admin (`index.ts:55`) y el regex acepta `<`, `>` y comillas. Escapar o enviar como texto plano.
- [ ] Exigir `POST` (hoy no valida método), unificar headers CORS en todas las respuestas (el 400 no lleva `Access-Control-Allow-Origin`) y no devolver el error crudo de Resend al cliente (`index.ts:84-88`).
- [ ] Registrar las solicitudes en una tabla en vez de depender solo del correo.

### 0.5 Control de acceso por rol en la app
- [ ] `TrainerRoute` existe pero **no se usa en ningún sitio**: todas las pestañas de entrenador usan `ProtectedRoute` (solo comprueba sesión), así que un atleta autenticado puede entrar a dashboard, agenda y pagos. Sustituir `ProtectedRoute` por `TrainerRoute` en `(tabs)/index|clientes|agenda|pagos`, `/clients/*`, `/revisions/*` y `/events/*`.
- [ ] La pestaña **Más no tiene guard alguno** (`src/app/(tabs)/mas.tsx:47`) → envolver en guard.
- [ ] El login hace `router.replace('/(tabs)')` incondicional (`src/screens/auth/login-screen.tsx:48`) aunque el rol se resuelve async → redirigir según rol (o pasar por `/`, que ya lo hace).

---

## Fase 1 — Bugs confirmados

### Bloqueantes (arreglos pequeños, impacto alto)
- [ ] **El botón "Salir" del dashboard crashea**: `clients-screen.tsx:110` solo destructura `{ user }` de `useAuth()`, pero la línea 325 llama a `signOut()` → ReferenceError al pulsarlo. Añadir `signOut` al destructuring.
- [ ] **La sincronización de ocurrencias duplica filas en cada carga**: el dedupe compara `planned_start_at` de PostgREST (`...T08:00:00+00:00`) contra `Date.toISOString()` (`...T08:00:00.000Z`) — nunca coinciden (`src/services/events.ts:508-509`, `src/utils/events.ts:145`). Normalizar ambos lados a epoch **y** añadir unique index `(event_id, planned_start_at)` con `on conflict do nothing`.
- [ ] **La recurrencia con fin "por cantidad" nunca termina**: `generatedCount` solo cuenta ocurrencias dentro de la ventana consultada; con ventanas rodantes la serie se regenera indefinidamente (`src/utils/events.ts:128-151`). Contar desde el inicio de la serie.
- [ ] **`clientPaymentsService.create` inserta sin `owner_id`** aunque la columna es NOT NULL sin default; el RPC `create_client_payment` creado para esto no se llama desde ningún sitio (grep `rpc(` en src: 0 resultados). Usar el RPC o incluir `owner_id`; si el insert directo funciona hoy, el esquema real difiere de las migraciones → sincronizar.

### Lógica de negocio
- [ ] `revisionsService.update` fusiona con `??` (`revisions.ts:464-490`): pasar `null` explícito recupera el valor anterior — es imposible borrar una medida guardada, y el formulario de edición sí envía nulls. Distinguir `undefined` (no tocar) de `null` (borrar).
- [ ] El estado de pago asume `payments[0]` como último pago, pero el servicio ordena primero por `created_at` (`services/client-payments.ts:51-52`, `utils/client-payments.ts:119`): registrar tarde un pago antiguo marca al cliente como pendiente. Buscar el máximo `dueDate` dentro del array.
- [ ] "Quincenal" inconsistente: los ingresos asumen 26 pagos/año (`utils/client-payments.ts:39`) pero la próxima fecha suma 15 días (línea 73). Decidir semántica (14 o 15 días) y alinear.
- [ ] **Parseo de fechas `YYYY-MM-DD` inconsistente (UTC vs local)**: `new Date('YYYY-MM-DD')` es medianoche UTC y los getters locales la corren un día al oeste de UTC (`utils/events.ts:25`, `utils/client-payments.ts:96`, `utils/client-revisions.ts:40`, `toDateOnlyIso` duplicado en `services/client-payments.ts:28`, `revisions.ts:397`, `photos.ts:158`). Unificar en un único helper date-only local (existe `parseDateOnly` en `utils/client-age.ts`).
- [ ] El diff de masa grasa/magra mezcla metodologías: el valor actual usa el **% medio** pero el fallback del snapshot anterior usa el **% visual** (`utils/calculations.ts:296-316` vs `services/revisions.ts:262-271`; `getPreviousRevisionSnapshot` no trae `body_fat_pct`). Alinear ambos términos.
- [ ] El % por perímetros histórico se **recalcula con sexo/altura actuales** del cliente (`utils/client-history.ts:132-137`, `revision-comparisons.ts:140-161`): corregir la altura reescribe el histórico. Persistir `body_fat_perimeters_pct` en cada revisión (como ya se hace con pliegues).
- [ ] `generateEventOccurrenceDrafts` trunca `rangeEnd` a medianoche (`utils/events.ts:124`): las ocurrencias del último día del rango con hora ≠ 00:00 quedan fuera (la agenda pasa 23:59:59.999 a propósito). No truncar.
- [ ] El cambio de horario (DST) rompe la paridad de semanas en recurrencias con intervalo ≥ 2: `Math.floor` sobre diferencia de ms (`utils/events.ts:95-97`) → usar `Math.round` o componentes de calendario.
- [ ] La recurrencia mensual en días 29–31 se salta los meses cortos (`utils/events.ts:107`) mientras pagos/revisiones recortan al último día del mes. Unificar criterio.
- [ ] `rescheduleOccurrence` no es atómico: marca `rescheduled` y luego inserta la sucesora en llamada aparte (`services/events.ts:438-476`); si el insert falla, la instancia queda huérfana. Mover a un RPC transaccional.
- [ ] Listas "Próximos" y "Pendientes" de pagos ordenadas al revés (descendente: muestra los cobros más lejanos primero) (`payments-screen.tsx:354-370,712`).
- [ ] La migración añade `birth_date` pero todo el código usa `date_birth` (`migrations/20260624120000`, `clients.ts:17`): columna muerta y prueba de drift de esquema. Limpiar y versionar la definición real.

### Notificaciones
- [ ] Badge inflado: **cada** ocurrencia `scheduled` de los próximos 90 días cuenta como una notificación (`utils/event-notifications.ts:39-66` + sync a 90 días en `clients-screen.tsx:279-290`). Limitar a una ventana próxima (p. ej. 7 días) o agrupar.
- [ ] Sobreprogramación: hasta ~46 notificaciones locales por item (cada 2 días × 90 días) → supera el límite de 64 pendientes de iOS (`device-notifications.ts:14-15,159-163`). Reducir horizonte/repeticiones.
- [ ] Los items vencidos disparan una notificación a 1 segundo en **cada** resync, y el resync corre en cada focus del dashboard (`device-notifications.ts:153-154,192`; `clients-screen.tsx:300`). Deduplicar por contenido/día.
- [ ] El recordatorio de un evento salta a las **23:59 del día del evento** (ya pasado) y se repite cada 2 días después (`device-notifications.ts:125-129`). Avisar antes del evento.
- [ ] Código muerto: `syncDeviceNotifications` y `resyncDeviceNotificationsIfNeeded` son idénticas entre sí y nadie las importa (`device-notifications.ts:241-317`). Eliminar.

### UI y carga de datos
- [ ] Horas de agenda **simuladas**: para pagos/revisiones la hora se deriva de un hash del `client.id` sobre horas fijas (`agenda-screen.tsx:97-112`) y se pinta como si fuera real. Mostrar "todo el día" / "sin hora" o permitir configurarla.
- [ ] Error de red en agenda: `Alert.alert` + vacía todos los datos ya mostrados, sin botón de reintento (`agenda-screen.tsx:297-302`). Usar StatusBanner + conservar datos + retry (como ya hace Pagos).
- [ ] Deps de hooks incompletas: `isAthlete` ausente en 4 `useCallback` de carga (`revision-detail-screen.tsx:233`, `client-photos-screen.tsx:631`, `client-history-analysis-screen.tsx:257`, `client-history-metric-detail-screen.tsx:138`) → los atletas pueden quedarse en "no encontrado" hasta recargar. Son además los warnings que reporta el lint.
- [ ] Doble carga al montar el dashboard: `useEffect` + `useFocusEffect` disparan `loadClients` dos veces sin guard (`clients-screen.tsx:311-319`).
- [ ] Estado stale: el análisis histórico (y metric-detail y fotos) solo cargan con `useEffect`, sin `useFocusEffect` → tras crear la primera revisión y volver, siguen vacíos (`client-history-analysis-screen.tsx:259`).
- [ ] Fotos huérfanas: en modo crear, las imágenes se suben inmediatamente con `revisionId: null` y solo se enlazan al guardar; cancelar las deja huérfanas y visibles en la galería (`revision-form-screen.tsx:628-637`). Subir al guardar, o limpiar al cancelar.
- [ ] `photosService.remove` borra el objeto de storage **antes** que la fila SQL (`photos.ts:334-344`): invertir el orden (tolerar huérfanos de storage, nunca filas rotas).
- [ ] Menores: comparador de notificaciones da NaN si no hay fechas (`clients-screen.tsx:292`); separador del historial calculado sobre la lista sin recortar (`payments-screen.tsx:649`); Pressable anidado redundante (`client-list-screen.tsx:235,265`); label "revision" en minúscula que además ignora `isToday` (`client-list-screen.tsx:77`); cast `client as Client` antes del guard de null (`client-history-analysis-screen.tsx:209`).

---

## Fase 2 — Rendimiento

- [ ] **N+1 en dashboard y agenda**: 2 consultas por cliente (pagos + revisiones) en cada focus, más `syncOccurrencesForOwner` (1 `getById` por evento) y un `syncDeviceNotificationsForUser` fire-and-forget que **repite** todas esas consultas (`clients-screen.tsx:270-300`, `agenda-screen.tsx:261-316`, `events.ts:485,527`). Agrupar con `.in('client_id', ids)` (2 consultas totales) o crear una vista/RPC de resumen.
- [ ] **N+1 de signed URLs**: una llamada `createSignedUrl` por foto en cada listado (`photos.ts:112,128,229`); usar `createSignedUrls(paths, 3600)` en batch y regenerar al expirar (caducan en 1 h sin refresco).
- [ ] Introducir una capa de caché/estado servidor (React Query o SWR): elimina las recargas completas por focus, los `useState`/`useEffect` repetidos y los estados stale de la Fase 1.
- [ ] Carga en cascada del formulario de revisión: 3-5 awaits secuenciales evitables (`revision-form-screen.tsx:424-467`) → paralelizar.
- [ ] `useMemo` con dependencia inestable: `reviewedAtDate` se crea con `new Date()` en cada render y aparece en las deps de 5 memos (`revision-form-screen.tsx:655,721-818`).

---

## Fase 3 — Calidad y mantenibilidad

### Tests y tooling
- [ ] Añadir **Jest (jest-expo)** y tests de `src/utils/` — todo es lógica pura determinista: fórmulas Navy / Durnin-Womersley / Mifflin-St Jeor con valores de referencia publicados, multiplicadores de facturación, `calculateClientPaymentStatus`, expansión de recurrencias (bordes: fin de mes, count, until, DST). Los bugs de la Fase 1 son los primeros casos de test (red de regresión).
- [ ] Añadir scripts `test` y `typecheck` (`tsc --noEmit`) a `package.json` (hoy solo start/android/web/lint/reset-project).
- [ ] Montar CI (GitHub Actions): lint + typecheck + test en cada push. No existe `.github/`.
- [ ] Arreglar los 4 warnings de lint (ya cubiertos por las deps de hooks de la Fase 1).

### Duplicación
- [ ] Helpers de fecha (`startOfDay`, `addMonths`, `toLocalDate`/`toDateOnly`) copiados en 3-4 ficheros de utils y 3 servicios → módulo común `utils/date-only.ts` (prerrequisito del fix de zona horaria).
- [ ] Modal de subida de imagen + flujo ImagePicker duplicado en 3 pantallas (`client-photos-screen.tsx:651`, `revision-detail-screen.tsx:282`, `revision-form-screen.tsx:594`) → componente/hook compartido.
- [ ] Helpers de formato de métricas duplicados entre análisis histórico y detalle de métrica (`client-history-metric-detail-screen.tsx:38-94` ≈ `client-history-analysis-screen.tsx:145-201`).
- [ ] `calculateAvailableBodyFatAverage` (`client-history.ts:101-119`) duplica `calculateBodyFatAverage` solo para añadir el número de fuentes.

### Tamaño de pantallas
- [ ] Partir en hooks + componentes: `revision-form-screen.tsx` (2072 líneas), `revision-detail-screen.tsx` (1703), `client-photos-screen.tsx` (1575), `agenda-screen.tsx` (1424), `clients-screen.tsx` (1280). Candidatos claros: zoom/pan del comparador de fotos, cálculos en vivo del formulario, calendario del dashboard.

### Código muerto (eliminar o conectar)
- [ ] `src/mocks/demo-data.ts` (179 líneas, 0 imports) y los fallbacks `'client-1'`/`'revision-1'` en rutas dinámicas (`clients/[clientId].tsx:12`, `revisions/[revisionId].tsx:12`).
- [ ] `AthletePinModal`, `DisabledTabButton`, `MetricRow`, `SectionCard` (surface), `isTrainer`/`isAthlete` de domain.ts: sin ningún uso.
- [ ] Rutas huérfanas: `/register` (nada navega a ella) y las tres `athlete-*` placeholder "Soon".
- [ ] Aliases y wrappers no usados de `calculations.ts` (`body_fat_*_pct`, wrappers por sexo, `resolveUsedMaintenance`, `calculateCaloricBalance` — o conectarlos a la UI de kcal objetivo si eran features pendientes).
- [ ] Columna `revision_frequency_enabled` sin uso + triple representación de "sin frecuencia" (null / 0 / centinela 9999) → normalizar a una sola.
- [ ] La migración `add_is_active_to_clients` crea `estado` (nombre en español, con UPDATE muerto) mientras events usa `is_active` → unificar convención.

---

## Fase 4 — Producto y entrega

### UX / funcionalidad prometida
- [ ] Pestaña Más: 9 items de menú son `View` sin `onPress` pero con chevron (Perfil, Suscripción, Métodos de pago, Apariencia, Integraciones, Exportar datos, Ayuda, Privacidad, Términos) y el badge "Plan Pro" es decorativo (`mas.tsx:21-34,123-131,167-175`). Implementar, marcar "Próximamente" o eliminar.
- [ ] Decidir el destino del alta de atletas por PIN: `athletePinsService` es un stub en mantenimiento y el botón "PIN Atleta" está permanentemente disabled (`client-detail-screen.tsx:494`). Reactivar o retirar de la UI.
- [ ] Dashboard montado en 2 rutas (`/(tabs)/index` y `/clients/index`) con dos sistemas de tabs paralelos (Tabs de expo-router + `PersistentTabShell`, barra falsa que navega con `router.replace`): unificar navegación.
- [ ] Las pantallas de `/events` pierden la barra de tabs (no tienen `_layout` con shell, a diferencia de `/clients` y `/revisions`).
- [ ] Tema: nativo fuerza light pero la variante web devuelve el esquema real → la web puede renderizar la paleta dark a medias (`use-color-scheme.ts` vs `use-color-scheme.web.ts:16`). Alinear hasta que el dark mode esté listo.
- [ ] `timezone: 'UTC'` hardcodeada en el payload de eventos aunque todo se trata como hora local (`event-form-screen.tsx:300`).

### Cumplimiento (bloqueante para publicar en stores)
- [ ] RGPD: la app almacena datos de salud (medidas corporales, fotos) de terceros que no son el titular de la cuenta. Falta: consentimiento del cliente final, política de privacidad real, exportación y borrado de datos/cuenta. Apple y Google lo exigen en revisión.

### Build y distribución
- [ ] `versionCode` fijo en 1 + `appVersionSource: local` sin `autoIncrement` → Google Play rechazará el segundo build. Activar `autoIncrement` en el perfil production de `eas.json`.
- [ ] Sin OTA: `expo-updates` no está instalado y no hay `runtimeVersion`. Decidir si se quiere OTA y configurarlo.
- [ ] Añadir perfil `development` (developmentClient) y sección `submit` a `eas.json`.

### Higiene de repo
- [ ] Reescribir `README.md`: es la plantilla intacta de create-expo-app (recomienda `npm run reset-project`, que en este repo **borra `src/`** si respondes "n" — `scripts/reset-project.js:14,67`). Eliminar también el script.
- [ ] Borrar `.lint-output.txt` del repo (artefacto generado, con rutas de otra máquina).
- [ ] Renombrar `TabLayout` → `RootLayout` en `src/app/_layout.tsx:11` (es el Stack raíz, colisiona con `TabsLayout`).

---

## Registro de cambios aplicados

| Fecha | Tarea | Commit | Notas |
|---|---|---|---|
| — | — | — | — |
