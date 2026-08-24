# Migraciones pendientes de revisión

Estos ficheros **NO se aplican automáticamente**: están fuera de `supabase/migrations/` a propósito.

Para aplicar una:
1. Revisarla contra el esquema real (el RLS base y las tablas originales no están versionados).
2. Probarla en un entorno que no sea producción.
3. Moverla a `supabase/migrations/` con timestamp actualizado y aplicarla (`supabase db push` o SQL editor).
4. Marcar la tarea en `PLAN.md` y reflejar el cambio en `CLAUDE.md` si altera el funcionamiento.

| Fichero | Qué hace | Riesgo |
|---|---|---|
| `01_dedupe_event_occurrences_unique_index.sql` | Borra ocurrencias duplicadas por el bug de dedupe y crea unique index | **Borra filas** — revisar el SELECT previo |
| `02_reschedule_event_occurrence_rpc.sql` | Reprogramación atómica (marca + inserta en una transacción) | Bajo; requiere cambiar el cliente para usar el RPC después |
| `03_rls_draft.sql` | Borrador de RLS/policies para todas las tablas | **Alto** — verificar contra las policies existentes en el dashboard antes de tocar nada |
