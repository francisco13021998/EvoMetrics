import {
  addDays,
  addMonths,
  endOfDay,
  formatDateOnly,
  parseDateOnly,
  startOfDay,
  toDateOnlyString,
  toLocalDate,
} from '@/utils/date-only';

describe('parseDateOnly', () => {
  it('parsea YYYY-MM-DD como medianoche LOCAL (no UTC)', () => {
    const parsed = parseDateOnly('2026-08-23');

    expect(parsed).not.toBeNull();
    expect(parsed!.getFullYear()).toBe(2026);
    expect(parsed!.getMonth()).toBe(7);
    expect(parsed!.getDate()).toBe(23);
    expect(parsed!.getHours()).toBe(0);
  });

  it('rechaza strings que no son date-only puros', () => {
    expect(parseDateOnly('2026-08-23T10:00:00Z')).toBeNull();
    expect(parseDateOnly('no es fecha')).toBeNull();
  });
});

describe('toLocalDate', () => {
  it('un date-only nunca se desplaza de día, sea cual sea la zona horaria', () => {
    const parsed = toLocalDate('2026-08-23');

    expect(parsed!.getDate()).toBe(23);
    expect(parsed!.getMonth()).toBe(7);
  });

  it('trunca instantes ISO y objetos Date a su medianoche local', () => {
    const instant = new Date(2026, 7, 23, 15, 30, 0, 0);

    expect(toLocalDate(instant)!.getHours()).toBe(0);
    expect(toLocalDate(instant)!.getDate()).toBe(23);
    expect(toLocalDate(instant.toISOString())!.getDate()).toBe(23);
  });

  it('devuelve null para valores vacíos o inválidos', () => {
    expect(toLocalDate(null)).toBeNull();
    expect(toLocalDate(undefined)).toBeNull();
    expect(toLocalDate('basura')).toBeNull();
  });
});

describe('formatDateOnly / toDateOnlyString', () => {
  it('formatea con componentes locales', () => {
    expect(formatDateOnly(new Date(2026, 7, 5))).toBe('2026-08-05');
  });

  it('el round-trip de un date-only conserva el día (regresión del bug -1 día)', () => {
    expect(toDateOnlyString('2026-08-23')).toBe('2026-08-23');
    expect(toDateOnlyString('2026-01-01')).toBe('2026-01-01');
  });

  it('devuelve null si la entrada no es una fecha', () => {
    expect(toDateOnlyString('basura')).toBeNull();
  });
});

describe('aritmética de fechas', () => {
  it('addMonths recorta al último día del mes', () => {
    expect(formatDateOnly(addMonths(new Date(2026, 0, 31), 1))).toBe('2026-02-28');
    expect(formatDateOnly(addMonths(new Date(2024, 0, 31), 1))).toBe('2024-02-29');
    expect(formatDateOnly(addMonths(new Date(2026, 2, 31), 1))).toBe('2026-04-30');
  });

  it('addDays cruza límites de mes', () => {
    expect(formatDateOnly(addDays(new Date(2026, 7, 30), 5))).toBe('2026-09-04');
  });

  it('startOfDay y endOfDay delimitan el día local', () => {
    const value = new Date(2026, 7, 23, 14, 45, 12, 345);

    expect(startOfDay(value).getHours()).toBe(0);
    expect(endOfDay(value).getHours()).toBe(23);
    expect(endOfDay(value).getMinutes()).toBe(59);
    expect(endOfDay(value).getMilliseconds()).toBe(999);
  });
});
