-- Dos perímetros opcionales nuevos: gemelo y torso. Columnas nullable sin default, aditivas sobre
-- `revisions` (no tocan ninguna fila existente ni ninguna columna actual, no puede romper nada).
-- `calf_cm` es un PERÍMETRO (cm) y es distinto de `calf_fold_mm`, que ya existía como PLIEGUE
-- cutáneo (mm) de pantorrilla; son mediciones distintas, sin colisión de nombre real.

alter table public.revisions
  add column if not exists calf_cm numeric,
  add column if not exists torso_cm numeric;
