# TAREAS-PROPIETARIO.md — Acciones que solo puede hacer el dueño de la app

> Estas tareas salieron de la auditoría de agosto 2026 y **no son código**: son acciones sobre el proyecto de Supabase, el repositorio de GitHub o decisiones de producto. Ninguna se aplica sola — cada una queda a tu criterio. Las tareas de código viven en `PLAN.md`; las que allí aparecen como *(bloqueado)* se desbloquean al completar las de este documento.

---

## 1. Seguridad del repositorio — 🔴 URGENTE

### 1.1 Rotar la contraseña del usuario de dev-login
El fichero `.env` está versionado en el repo (público en GitHub) desde el commit `777e666` e incluye el email y la **contraseña real** de una cuenta de Supabase Auth (`EXPO_PUBLIC_DEV_LOGIN_EMAIL` / `EXPO_PUBLIC_DEV_LOGIN_PASSWORD`, líneas 4-5). Cualquiera que haya visto el repo puede iniciar sesión con esa cuenta.

**Pasos:**
1. Dashboard de Supabase → **Authentication → Users** → localizar el usuario con ese email.
2. Cambiar su contraseña (o eliminar la cuenta si era solo de pruebas).
3. Actualizar tu `.env` local con la nueva contraseña. **No volver a commitearlo nunca** (el `.gitignore` ya lo excluye; hay un `.env.example` como plantilla).

> Rotar es imprescindible **aunque** se borre el fichero o se limpie el historial: la clave ya pudo ser vista.

### 1.2 Sacar `.env` del control de versiones
El `.gitignore` ya está preparado; solo falta destrackear el fichero (el archivo local no se borra):

```bash
git rm --cached .env
git commit -m "Dejar de versionar .env"
```

### 1.3 (Recomendado) Limpiar el historial de git
La contraseña seguirá visible en los commits antiguos del repo público. Para borrarla del historial:

```bash
# Con git-filter-repo (https://github.com/newren/git-filter-repo):
git filter-repo --invert-paths --path .env
git push origin --force --all
```

⚠️ Reescribe el historial: cualquier otra copia clonada del repo deberá re-clonarse. Si te resulta demasiado invasivo, con la rotación del punto 1.1 el riesgo real queda cubierto.

---

## 2. Base de datos Supabase

### 2.1 Verificar que RLS está activo — 🔴 crítico
**Ninguna migración del repo define RLS ni policies**, y el código cliente confía por completo en que existen (varias consultas no filtran por dueño a propósito, p. ej. el acceso de atletas). Si RLS no está bien configurado, **cualquier usuario autenticado podría leer los datos de salud de los clientes de otros entrenadores**.

En el dashboard → **Database → Tables**, comprobar que estas tablas tienen *RLS enabled* y policies coherentes:

| Tabla | Lo que debe cumplirse |
|---|---|
| `clients` | El profesional (owner_id = su uid) tiene CRUD; el atleta vinculado (`athlete_user_id`) solo SELECT |
| `revisions` | Profesional CRUD; atleta SELECT vía su cliente |
| `client_photos` | Profesional CRUD; atleta SELECT vía su cliente |
| `client_payments` | Solo el profesional (los atletas NO ven pagos) |
| `events` / `event_occurrences` | Solo el profesional |
| `profiles` | Cada usuario solo lee su propia fila |
| `body_fat_formulas` | Lectura para cualquier usuario autenticado |
| Storage `client-images` | Owner gestiona su carpeta; atleta solo lee la de su cliente |

Si algo falta o no cuadra, en `supabase/pending/03_rls_draft.sql` hay un **borrador completo** con este modelo, listo para ajustar y aplicar.

### 2.2 Aplicar las migraciones pendientes
En `supabase/pending/` hay 3 scripts SQL **que no se aplican solos** (están fuera de `supabase/migrations/` a propósito). Ver su `README.md`. En orden de urgencia:

1. **`01_dedupe_event_occurrences_unique_index.sql`** — la BD probablemente tiene ocurrencias de eventos duplicadas (bug ya corregido en el código, pero los datos siguen ahí). El script las limpia y crea un índice único que impide que vuelva a pasar. ⚠️ **Borra filas**: ejecutar antes el SELECT de diagnóstico que va comentado en la cabecera.
2. **`03_rls_draft.sql`** — solo si el punto 2.1 reveló huecos. Revisar línea a línea antes.
3. **`02_reschedule_event_occurrence_rpc.sql`** — hace atómica la reprogramación de citas. Sin urgencia; al aplicarlo, avisar para adaptar el código.

Cómo aplicar: SQL Editor del dashboard, o mover el fichero a `supabase/migrations/` (con timestamp) y `supabase db push`.

---

## 3. Decisiones de producto

No hay que "hacer" nada técnico — solo decidir. Cada respuesta desbloquea trabajo ya identificado en `PLAN.md`:

### 3.1 Alta de atletas por PIN
Todo el flujo (pantallas, rutas, botón "PIN Atleta") existe pero está desconectado ("en mantenimiento"). Opciones:
- **A. Reactivarlo** → hay que construir el backend de PINs (tabla, generación, validación, caducidad).
- **B. Retirarlo** → se elimina la UI muerta y las rutas placeholder (`/register`, `/athlete-join`, `/athlete-register*`), y la vista de atleta queda pausada.

### 3.2 Actualizaciones OTA (over-the-air)
¿Quieres poder publicar arreglos de JS sin pasar por Google Play? Si sí → se instala `expo-updates` y se configura `runtimeVersion` (los builds actuales no lo soportan; solo aplicaría a builds nuevos).

### 3.3 RGPD / privacidad
La app guarda **datos de salud** (medidas corporales, fotos) de terceros que no son el titular de la cuenta. Para publicar en las stores hará falta:
- Una **política de privacidad** real (texto legal, con responsable de tratamiento y base jurídica).
- Decidir el flujo de **consentimiento del cliente final** (¿lo recoge el entrenador? ¿en papel o en la app?).
- Ofrecer **exportación y borrado** de datos/cuenta (el código se hará cuando esté decidido el alcance).

Para esto conviene apoyo legal; la parte técnica se implementará después según lo que decidas.

---

## 4. Al terminar

Avisa de qué has completado para: (a) marcar las tareas correspondientes, (b) desbloquear y ejecutar los cambios de código marcados *(bloqueado)* en `PLAN.md` (p. ej. adaptar el servicio de eventos al RPC nuevo, versionar el RLS definitivo, retirar o reconstruir el flujo de PIN).
