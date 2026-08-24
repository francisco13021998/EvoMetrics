# PLAN.md — Plan de mejora de EvoMetrics

> **Origen:** auditoría del código (agosto 2026) con verificación adversarial de cada hallazgo contra el código real. Todas las referencias `archivo:línea` fueron comprobadas.
>
> **Cómo usar este documento:** marcar `[x]` al completar cada tarea y anotar en el registro final. Si un cambio altera el funcionamiento de la app, **reflejarlo también en `CLAUDE.md`**. Si surgen problemas nuevos por el camino, añadirlos a la fase que corresponda.
>
> **Estado (23-08-2026):** las iteraciones 1 y 2 (rama `pruebas_felipe`, sin commit) aplicaron todo lo marcado `[x]`. Este documento contiene **solo trabajo de código**; las acciones manuales del dueño de la app (rotación de credenciales, operaciones git, panel de Supabase, decisiones de producto) viven en **`TAREAS-PROPIETARIO.md`** — las tareas de aquí marcadas *(bloqueado)* dependen de aquellas.

---

## Fase 0 — Seguridad crítica (antes que cualquier otra cosa)

### 0.1 Credenciales expuestas en el repo
> Rotar la contraseña, destrackear `.env` (`git rm --cached`) y limpiar el historial → **`TAREAS-PROPIETARIO.md` §1**.
- [x] Añadir `.env` (y `.lint-output.txt`) a `.gitignore`.
- [x] Crear `.env.example` con las claves vacías y documentarlo en el README.
- [ ] Revisar que el dev-login no llegue a producción: las variables `EXPO_PUBLIC_*` se **inlinean en el bundle JS de release** (`src/services/auth.ts:26`, fuera del guard `__DEV__`). Mover las lecturas dentro de una rama `__DEV__` para que el minificador las elimine del bundle de producción, y verificarlo grepeando un export.

### 0.2 Row Level Security (RLS)
> Verificar RLS en el dashboard y aplicar el borrador `supabase/pending/03_rls_draft.sql` → **`TAREAS-PROPIETARIO.md` §2**.
- [ ] *(bloqueado por §2)* Una vez aplicado el RLS definitivo, moverlo a `supabase/migrations/` para dejarlo versionado.

### 0.3 Defensa en profundidad: filtros por owner en cliente
- [x] `clientPaymentsService.update/remove` aceptan `ownerId` opcional y filtran por `owner_id` (las pantallas lo pasan).
- [x] `revisionsService.getById/listByClient/update/remove` ídem — opcional porque el rol atleta accede vía RLS sin ser owner.
- [x] `eventsService.listOccurrencesByEvent` ídem.

### 0.4 Edge function `send-trainer-request`
- [ ] Rate limiting (tabla de solicitudes con unique + ventana temporal) y/o captcha — requiere migración.
- [x] Inyección de HTML corregida: `escapeHtml` en todas las interpolaciones y `encodeURIComponent` en el `mailto:`; validación endurecida (longitud ≤ 254, rechazo de `<>`, comillas y espacios).
- [x] Solo `POST` (405 al resto), headers CORS unificados en todas las respuestas, y el catch ya no devuelve el error crudo de Resend (mensaje genérico + `console.error`).
- [ ] Registrar las solicitudes en una tabla en vez de depender solo del correo.

### 0.5 Control de acceso por rol en la app
- [x] `TrainerRoute` aplicado a las 4 pestañas de entrenador, `clients/new`, `clients/[clientId]/edit`, `clients/[clientId]/payments`, `revisions/new`, `revisions/[revisionId]/edit` y todo `/events/*` (vía su nuevo `_layout`). Las rutas compartidas con atletas (ficha, fotos, métricas, detalle de revisión) conservan `ProtectedRoute`.
- [x] La pestaña **Más** envuelta en `TrainerRoute` (no tenía guard alguno).
- [x] El login redirige a `/` (que enruta por rol) en vez de a `/(tabs)` incondicional.

---

## Fase 1 — Bugs confirmados

### Bloqueantes
- [x] **Botón "Salir" del dashboard crasheaba**: faltaba `signOut` en el destructuring de `useAuth()` (`clients-screen.tsx`).
- [x] **El sync de ocurrencias duplicaba filas en cada carga**: la deduplicación ahora compara epochs en vez de strings con formatos incompatibles (`services/events.ts`).
- [ ] *(bloqueado)* Tras aplicar `supabase/pending/01` (**`TAREAS-PROPIETARIO.md` §2.2** — limpia duplicados y crea el unique index), opcional: simplificar el insert de ocurrencias con `ON CONFLICT DO NOTHING` y eliminar el SELECT previo de dedupe.
- [x] **La recurrencia con fin "por cantidad" nunca terminaba**: el contador ahora avanza con cada ocurrencia teórica desde el inicio de la serie (`utils/events.ts`).
- [x] **Pagos sin `owner_id`**: `clientPaymentsService.create` ahora llama al RPC `create_client_payment` (security definer) con `ownerId` obligatorio.

### Lógica de negocio
- [x] `revisionsService.update` distingue `undefined` (no tocar) de `null` (borrar): ya se pueden vaciar medidas guardadas.
- [x] El estado de pago ya no confía en `payments[0]`: busca el pago con `dueDate` máxima (`utils/client-payments.ts`); ídem revisiones con `reviewedAt` máxima.
- [x] "Quincenal" alineado: multiplicador 24/12 (2 pagos/mes) coherente con próxima fecha +15 días. **Decisión documentada en el código.**
- [x] **Fechas date-only unificadas**: nuevo módulo `src/utils/date-only.ts` (parseo por componentes locales); migrados `utils/events|client-payments|client-revisions|client-age` y los `toDateOnlyIso` de `services/client-payments|revisions|photos`. Adiós al desfase de un día al oeste de UTC.
- [x] El diff de masa grasa/magra usa el **% medio** también en el fallback del snapshot anterior (`calculations.ts` + `getPreviousRevisionSnapshot` trae `body_fat_pct`).
- [ ] Persistir `body_fat_perimeters_pct` por revisión para que el histórico no se recalcule con sexo/altura actuales — requiere migración + cambio de código coordinado.
- [x] `generateEventOccurrenceDrafts` respeta el instante exacto de `rangeEnd` (ya no trunca a medianoche el último día).
- [x] DST: paridad semanal con `Math.round` en vez de `Math.floor`.
- [x] Recurrencia mensual en días 29–31 cae en el último día de los meses cortos (mismo criterio que `addMonths`).
- [ ] *(bloqueado)* `rescheduleOccurrence` atómico: tras aplicar `supabase/pending/02` (**`TAREAS-PROPIETARIO.md` §2.2**), cambiar `services/events.ts` para llamar al RPC.
- [x] "Pendientes" y "Próximos" de pagos ordenados ascendente (lo más urgente/próximo primero).
- [ ] Limpiar la columna muerta `birth_date` vs `date_birth` — requiere migración.

### Notificaciones
- [x] Badge del dashboard: los eventos solo cuentan a 7 días vista (`EVENT_NOTIFICATION_WINDOW_DAYS`).
- [x] Horizonte de programación 90 → 14 días y **tope global de 60** notificaciones (límite iOS 64), priorizando las más próximas.
- [x] Los items vencidos ya no disparan una notificación a 1 segundo en cada resync: primer aviso en el próximo 23:59.
- [x] Los eventos avisan **una sola vez, 60 min antes de empezar** (antes: 23:59 del día del evento + repetición posterior).
- [x] Eliminadas las funciones muertas `syncDeviceNotifications` y `resyncDeviceNotificationsIfNeeded`.

### UI y carga de datos
- [x] Agenda sin horas inventadas: cobros/revisiones son items **"Sin hora"** (etiqueta en vista día; franja propia encima del timeline semanal). Eliminado `getTimeByKind`.
- [x] Error de red en agenda: StatusBanner con botón "Reintentar" y **se conservan los datos ya cargados** (antes: Alert + pantalla vaciada).
- [x] Deps de hooks: `isAthlete` añadido en las 4 pantallas afectadas.
- [x] Doble carga inicial eliminada en dashboard y agenda (solo `useFocusEffect`).
- [x] Análisis histórico, detalle de métrica y galería recargan al volver a enfocarse (`useFocusEffect`).
- [x] Fotos huérfanas: al salir del formulario de revisión (crear) sin guardar, se borran las fotos pendientes subidas.
- [x] `photosService.remove` borra primero la fila y después el objeto de storage (best-effort).
- [x] Menores: sort de notificaciones NaN-safe; separador del historial sobre la lista recortada; Pressable anidado eliminado; etiqueta "Revisión pendiente"/"Revisión hoy"; cast inseguro sustituido por guard.

---

## Fase 2 — Rendimiento

- [x] **N+1 eliminado**: nuevos `clientPaymentsService.listByClients` y `revisionsService.listByClients` (2 consultas totales via `.in()`) usados por dashboard, listado de clientes, agenda, pagos y notificaciones; `syncOccurrencesForOwner` ya no hace un `getById` por evento.
- [x] **Signed URLs en batch**: `createSignedUrls` (1 llamada por listado en vez de 1 por foto).
- [ ] Capa de caché/estado servidor (React Query o SWR) — requiere dependencia nueva.
- [x] Carga del formulario de revisión paralelizada (fórmulas + revisiones + revisión a editar en un `Promise.all`).
- [x] `reviewedAtDate` memoizado (invalidaba 5 `useMemo` en cada render).

---

## Fase 3 — Calidad y mantenibilidad

### Tests y tooling
- [x] **Jest (jest-expo) instalado y 55 tests de `src/utils/`** en `src/utils/__tests__/`: fórmulas Navy/Durnin-Womersley/Mifflin con valores de referencia, fechas date-only (regresión del −1 día), estados de pago/revisión (backdated, quincenal, fin de mes), recurrencias de eventos (count, until, último día del rango, mensual 29-31, semanal con intervalo) y ventana de notificaciones. Script `npm test`. Los tests **cazaron y se corrigió un bug preexistente más**: las series semanales/mensuales se saltaban su primera ocurrencia (guarda comparaba medianoche vs hora exacta, `utils/events.ts`).
- [x] Script `typecheck` (`tsc --noEmit`) añadido; **el proyecto typechecka limpio por primera vez** (se corrigieron también los errores preexistentes: estilos inexistentes, prop `helper`→`hint`, narrowing de notificaciones, `tabBarSafeAreaInsets`, mapping de `@expo/vector-icons` en tsconfig).
- [x] CI creado: `.github/workflows/ci.yml` (npm ci + lint + typecheck + test) — se activará con el primer push.
- [x] Lint a cero: 0 errores, 0 warnings (antes: 1 error y 6 warnings tras typecheck, y 4 warnings históricos).
- [x] `babel.config.js` creado (resuelve `babel-preset-expo` aunque npm lo deje anidado) — requerido por jest-expo.
- [x] **Export web estático reparado**: el cliente Supabase rompía el prerender de `expo export` (AsyncStorage sin `window`); guard SSR en `src/lib/supabase.ts`. `npx expo export --platform web` genera ahora todas las rutas.

### Duplicación
- [x] Helpers de fecha unificados en `utils/date-only.ts`.
- [ ] Modal de subida de imagen + flujo ImagePicker duplicado en 3 pantallas → componente/hook compartido.
- [ ] Helpers de formato de métricas duplicados entre análisis histórico y detalle de métrica.
- [ ] `calculateAvailableBodyFatAverage` duplica `calculateBodyFatAverage`.

### Tamaño de pantallas
- [ ] Partir en hooks + componentes: `revision-form-screen.tsx` (~2.100 líneas), `revision-detail-screen.tsx` (~1.700), `client-photos-screen.tsx` (~1.580), `agenda-screen.tsx` (~1.470), `clients-screen.tsx` (~1.300).

### Código muerto
- [x] Eliminados: `src/mocks/demo-data.ts`, `MetricRow`, `SectionCard` (surface), `AthletePinModal`, `DisabledTabButton`, `isTrainer`/`isAthlete` de domain.ts, aliases muertos de `calculations.ts`, fallbacks `'client-1'`/`'revision-1'`, funciones de sync duplicadas de notificaciones.
- [ ] *(bloqueado por decisión — `TAREAS-PROPIETARIO.md` §3.1)* Rutas placeholder `/register` y `athlete-*`: eliminarlas o conectarlas según lo que se decida sobre el alta por PIN.
- [ ] Columna `revision_frequency_enabled` sin uso + triple representación de "sin frecuencia" (null / 0 / 9999) — requiere migración.
- [ ] Incoherencia `estado` (español) vs `is_active` (inglés) — requiere migración.

---

## Fase 4 — Producto y entrega

### UX / funcionalidad prometida
- [x] Pestaña Más: los 9 items muertos muestran pill **"Próximamente"**, sin chevron y atenuados (ya no simulan navegación).
- [ ] *(bloqueado por decisión — `TAREAS-PROPIETARIO.md` §3.1)* Alta de atletas por PIN: implementar la opción elegida (reconstruir backend de PINs, o retirar el stub y la UI).
- [ ] Unificar los dos sistemas de tabs (Tabs real + `PersistentTabShell`) y el dashboard montado en 2 rutas.
- [x] `/events/*` ya tiene `_layout` con `PersistentTabShell` (pestaña Agenda activa) — ya no pierde la barra.
- [x] Tema: la web también fuerza light (coherente con nativo) hasta que el dark mode esté listo.
- [x] `timezone` del evento: zona horaria real del dispositivo (`Intl`) con fallback `'UTC'`.

### Cumplimiento (bloqueante para publicar en stores)
- [ ] *(bloqueado por decisión — `TAREAS-PROPIETARIO.md` §3.3)* RGPD: implementar consentimiento, pantalla de política de privacidad, y exportación/borrado de datos y cuenta cuando el alcance esté decidido.

### Build y distribución
- [x] `autoIncrement: true` en el perfil production de `eas.json`.
- [ ] *(bloqueado por decisión — `TAREAS-PROPIETARIO.md` §3.2)* OTA: si se aprueba, instalar `expo-updates` y configurar `runtimeVersion`.
- [x] Perfil `development` (developmentClient) añadido a `eas.json`. (La sección `submit` queda pendiente de credenciales.)

### Higiene de repo
- [x] `README.md` reescrito describiendo EvoMetrics de verdad (setup, scripts, estructura, builds).
- [x] Eliminados `scripts/reset-project.js` (+ su script npm — podía **borrar `src/`**) y `.lint-output.txt`.
- [x] `TabLayout` → `RootLayout` en el layout raíz.

---

## Registro de cambios aplicados

| Fecha | Tarea | Commit | Notas |
|---|---|---|---|
| 23-08-2026 | Iteración 1: seguridad + bugs + rendimiento + limpieza (~35 ficheros) | commit 24-08-2026 en `pruebas_felipe` | `tsc --noEmit` exit 0 y `expo lint` sin avisos. |
| 23-08-2026 | Iteración 2: Jest + 55 tests (cazaron 1 bug más: primera ocurrencia semanal/mensual perdida), CI, migraciones pendientes redactadas (`supabase/pending/`), fix SSR de Supabase para el export web | commit 24-08-2026 en `pruebas_felipe` | Validado: `tsc` exit 0, lint 0 avisos, 55/55 tests, `expo export --platform web` completa todas las rutas. Falta probar en dispositivo/emulador con datos reales. |
| 24-08-2026 | Las tareas manuales y decisiones de producto se extraen a `TAREAS-PROPIETARIO.md`; este plan queda solo con trabajo de código | commit 24-08-2026 en `pruebas_felipe` | Las tareas *(bloqueado)* dependen de aquel documento. |
