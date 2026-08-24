// Helpers canónicos para valores de solo-fecha ('YYYY-MM-DD') interpretados en la zona horaria LOCAL del dispositivo.
// Nunca uses `new Date('YYYY-MM-DD')` directamente: JS lo parsea como medianoche UTC y los getters locales
// desplazan la fecha un día al oeste de UTC. Ver PLAN.md (Fase 1, fechas).

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 0, 0, 0, 0);
}

export function endOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 23, 59, 59, 999);
}

export function addDays(value: Date, days: number) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate() + days, 0, 0, 0, 0);
}

export function addMonths(value: Date, months: number) {
  const result = new Date(value);
  const targetDay = result.getDate();

  result.setDate(1);
  result.setMonth(result.getMonth() + months);

  const maxDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(targetDay, maxDay));

  return startOfDay(result);
}

export function parseDateOnly(value: string): Date | null {
  const match = DATE_ONLY_PATTERN.exec(value.trim());

  if (!match) {
    return null;
  }

  const parsed = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 0, 0, 0, 0);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function toLocalDate(value: string | Date | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : startOfDay(value);
  }

  const dateOnly = parseDateOnly(value);

  if (dateOnly) {
    return dateOnly;
  }

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime()) ? null : startOfDay(parsed);
}

export function formatDateOnly(value: Date) {
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');

  return `${value.getFullYear()}-${month}-${day}`;
}

export function toDateOnlyString(value: string | Date): string | null {
  const localDate = toLocalDate(value);

  return localDate ? formatDateOnly(localDate) : null;
}
