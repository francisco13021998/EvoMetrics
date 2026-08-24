import {
  calculateBmi,
  calculateBodyFatAverage,
  calculateDurninWomersleyBodyFat,
  calculateFatMassDiffKg,
  calculateFemaleBodyFatFromPerimeters,
  calculateLeanMassDiffKg,
  calculateMaintenanceCalories,
  calculateMaleBodyFatFromPerimeters,
  getDurninWomersleyConstants,
} from '@/utils/calculations';

describe('% graso por perímetros (U.S. Navy, Hodgdon & Beckett 1984)', () => {
  it('hombre: abdomen 85, cuello 37, estatura 175 → ~17.7%', () => {
    const result = calculateMaleBodyFatFromPerimeters({ neckCm: 37, bellyCm: 85, gluteCm: null, heightCm: 175 });

    expect(result).not.toBeNull();
    expect(result!.baseCm).toBe(48);
    expect(result!.bodyFatPct).toBeCloseTo(17.71, 1);
  });

  it('mujer: abdomen 80, glúteo 95, cuello 33, estatura 165 → ~29.4%', () => {
    const result = calculateFemaleBodyFatFromPerimeters({ neckCm: 33, bellyCm: 80, gluteCm: 95, heightCm: 165 });

    expect(result).not.toBeNull();
    expect(result!.baseCm).toBe(142);
    expect(result!.bodyFatPct).toBeCloseTo(29.43, 1);
  });

  it('devuelve null si la base no es positiva o faltan medidas', () => {
    expect(calculateMaleBodyFatFromPerimeters({ neckCm: 90, bellyCm: 85, gluteCm: null, heightCm: 175 })).toBeNull();
    expect(calculateMaleBodyFatFromPerimeters({ neckCm: null, bellyCm: 85, gluteCm: null, heightCm: 175 })).toBeNull();
  });
});

describe('% graso por pliegues (Durnin & Womersley 1974)', () => {
  it('hombre de 25 años con suma de pliegues 50 mm → densidad ~1.0557 y ~18.9%', () => {
    const result = calculateDurninWomersleyBodyFat('male', 25, {
      bicepFoldMm: 10,
      tricepFoldMm: 12,
      subscapularFoldMm: 15,
      suprailiacFoldMm: 13,
    });

    expect(result).not.toBeNull();
    expect(result!.sumMm).toBe(50);
    expect(result!.bodyDensity).toBeCloseTo(1.0557, 3);
    expect(result!.bodyFatPct).toBeCloseTo(18.87, 1);
  });

  it('selecciona las constantes por tramo de edad', () => {
    expect(getDurninWomersleyConstants('male', 17)!.ageBracket).toBe('17-19');
    expect(getDurninWomersleyConstants('female', 35)!.ageBracket).toBe('30-39');
    expect(getDurninWomersleyConstants('male', 60)!.ageBracket).toBe('50+');
    expect(getDurninWomersleyConstants('male', null)).toBeNull();
  });

  it('devuelve null si falta algún pliegue', () => {
    expect(
      calculateDurninWomersleyBodyFat('male', 25, {
        bicepFoldMm: 10,
        tricepFoldMm: null,
        subscapularFoldMm: 15,
        suprailiacFoldMm: 13,
      })
    ).toBeNull();
  });
});

describe('% graso medio', () => {
  it('promedia las fuentes disponibles (1 a 3)', () => {
    expect(calculateBodyFatAverage({ visualBodyFatPct: 20, skinfoldBodyFatPct: 24, perimeterBodyFatPct: 22 })!.bodyFatPct).toBe(22);
    expect(calculateBodyFatAverage({ visualBodyFatPct: 18, skinfoldBodyFatPct: null, perimeterBodyFatPct: null })!.bodyFatPct).toBe(18);
    expect(calculateBodyFatAverage({ visualBodyFatPct: null, skinfoldBodyFatPct: null, perimeterBodyFatPct: null })).toBeNull();
  });
});

describe('kcal de mantenimiento (Mifflin-St Jeor × factor)', () => {
  it('hombre 80 kg / 180 cm / 30 años × 1.6 → 2848', () => {
    expect(calculateMaintenanceCalories({ sex: 'male', weightKg: 80, heightCm: 180, age: 30, activityFactor: 1.6 })).toBeCloseTo(2848, 0);
  });

  it('mujer 60 kg / 165 cm / 25 años × 1.3 → ~1748.8', () => {
    expect(calculateMaintenanceCalories({ sex: 'female', weightKg: 60, heightCm: 165, age: 25, activityFactor: 1.3 })).toBeCloseTo(1748.83, 1);
  });

  it('devuelve null con datos incompletos o inválidos', () => {
    expect(calculateMaintenanceCalories({ sex: null, weightKg: 80, heightCm: 180, age: 30, activityFactor: 1.6 })).toBeNull();
    expect(calculateMaintenanceCalories({ sex: 'male', weightKg: 0, heightCm: 180, age: 30, activityFactor: 1.6 })).toBeNull();
  });
});

describe('IMC', () => {
  it('80 kg / 180 cm → 24.69', () => {
    expect(calculateBmi(80, 180)).toBeCloseTo(24.69, 2);
  });
});

describe('diffs de masa grasa/magra: metodología homogénea', () => {
  it('el fallback del snapshot anterior usa el % MEDIO (bodyFatPct) si existe', () => {
    const previous = { weightKg: 80, bodyFatVisualPct: 30, bodyFatPct: 20 };

    // masa grasa anterior = 80 × 20% = 16 (no 80 × 30% = 24)
    expect(calculateFatMassDiffKg(15, previous)).toBeCloseTo(-1, 2);
    // masa magra anterior = 80 − 16 = 64
    expect(calculateLeanMassDiffKg(60, previous)).toBeCloseTo(-4, 2);
  });

  it('sin % medio cae al % visual (comportamiento histórico)', () => {
    const previous = { weightKg: 80, bodyFatVisualPct: 30 };

    expect(calculateFatMassDiffKg(15, previous)).toBeCloseTo(-9, 2);
  });
});
