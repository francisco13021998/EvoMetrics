import { getActiveSkinfoldProtocolForAthleteLevel } from '@/constants/athlete-level';
import { ClientSex } from '@/types/domain';
import {
    FEMALE_PERIMETER_BODY_FAT_COEFFICIENTS,
    getDurninWomersleyConstants,
    MALE_PERIMETER_BODY_FAT_COEFFICIENTS,
} from '@/utils/calculations';

export const BODY_FAT_FORMULA_CODES = {
  perimetersMaleNavyAbdomen: 'perimeters_male_navy_abdomen',
  perimetersFemaleNavyAbdomenGlute: 'perimeters_female_navy_abdomen_glute',
  skinfoldsDurninWomersley4Beginner: 'skinfolds_durnin_womersley_4_beginner',
} as const;

export type BodyFatFormulaCode = (typeof BODY_FAT_FORMULA_CODES)[keyof typeof BODY_FAT_FORMULA_CODES];
export type BodyFatFormulaCategory = 'perimeters' | 'skinfolds';

export type BodyFatFormulaMetadata = {
  code: BodyFatFormulaCode;
  category: BodyFatFormulaCategory;
  title: string;
  shortLabel: string;
  descriptionLines: readonly string[];
};

export type BodyFatFormulaInfoVariable = {
  name: string;
  description: string;
};

export type BodyFatFormulaInfoSection = {
  title: string;
  lines: readonly string[];
  tone?: 'default' | 'equation';
};

export type BodyFatFormulaInfoContent = {
  eyebrow: string;
  scientificName: string;
  categoryLabel: string;
  sections: readonly BodyFatFormulaInfoSection[];
};

type BuildBodyFatFormulaInfoOptions = {
  sex?: ClientSex | null;
  age?: number | null;
};

function formatCoefficient(value: number) {
  return value.toFixed(5).replace(/0+$/, '').replace(/\.$/, '');
}

function formatVariableLines(variables: readonly BodyFatFormulaInfoVariable[]) {
  return variables.map((variable) => `${variable.name} = ${variable.description}`);
}

export const BODY_FAT_FORMULA_METADATA_BY_CODE: Record<BodyFatFormulaCode, BodyFatFormulaMetadata> = {
  [BODY_FAT_FORMULA_CODES.perimetersMaleNavyAbdomen]: {
    code: BODY_FAT_FORMULA_CODES.perimetersMaleNavyAbdomen,
    category: 'perimeters',
    title: 'U.S. Navy Body Fat Formula (Hodgdon & Beckett, 1984)',
    shortLabel: 'Perímetros hombre',
    descriptionLines: [
      'Perímetros corporales · Hombre',
      'Estimación del % de grasa corporal a partir de perímetros y estatura.',
      '% grasa = 495 / (1.0324 - 0.19077 × log10(abdomen - cuello) + 0.15456 × log10(estatura)) - 450',
    ],
  },
  [BODY_FAT_FORMULA_CODES.perimetersFemaleNavyAbdomenGlute]: {
    code: BODY_FAT_FORMULA_CODES.perimetersFemaleNavyAbdomenGlute,
    category: 'perimeters',
    title: 'U.S. Navy Body Fat Formula (Hodgdon & Beckett, 1984)',
    shortLabel: 'Perímetros mujer',
    descriptionLines: [
      'Perímetros corporales · Mujer',
      'Estimación del % de grasa corporal a partir de perímetros y estatura.',
      '% grasa = 495 / (1.29579 - 0.35004 × log10(abdomen + glúteo - cuello) + 0.22100 × log10(estatura)) - 450',
    ],
  },
  [BODY_FAT_FORMULA_CODES.skinfoldsDurninWomersley4Beginner]: {
    code: BODY_FAT_FORMULA_CODES.skinfoldsDurninWomersley4Beginner,
    category: 'skinfolds',
    title: 'Durnin & Womersley (1974)',
    shortLabel: 'Durnin & Womersley (1974)',
    descriptionLines: [
      'Pliegues cutáneos · 4 pliegues',
      'Estimación de densidad corporal y conversión posterior a % de grasa corporal.',
      'Usa bíceps, tríceps, subescapular y suprailiaco con constantes por sexo y tramo de edad.',
    ],
  },
};

export function buildBodyFatFormulaInfoContent(
  code: BodyFatFormulaCode | string | null | undefined,
  options: BuildBodyFatFormulaInfoOptions = {}
): BodyFatFormulaInfoContent | null {
  if (!code) {
    return null;
  }

  if (code === BODY_FAT_FORMULA_CODES.perimetersMaleNavyAbdomen) {
    return {
      eyebrow: 'Fórmula',
      scientificName: 'U.S. Navy Body Fat Formula (Hodgdon & Beckett, 1984)',
      categoryLabel: 'Perímetros corporales · Hombre',
      sections: [
        {
          title: 'Qué calcula',
          lines: ['Estimación del % de grasa corporal a partir de perímetros y estatura.'],
        },
        {
          title: 'Ecuación',
          tone: 'equation',
          lines: [
            `% grasa = 495 / (${formatCoefficient(MALE_PERIMETER_BODY_FAT_COEFFICIENTS.densityBase)} - ${formatCoefficient(MALE_PERIMETER_BODY_FAT_COEFFICIENTS.baseLogFactor)} × log10(abdomen - cuello) + ${formatCoefficient(MALE_PERIMETER_BODY_FAT_COEFFICIENTS.heightLogFactor)} × log10(estatura)) - 450`,
          ],
        },
        {
          title: 'Variables usadas',
          lines: formatVariableLines([
            { name: 'abdomen', description: 'perímetro abdominal / barriga usado en la app' },
            { name: 'cuello', description: 'perímetro del cuello' },
            { name: 'estatura', description: 'altura del cliente' },
          ]),
        },
        {
          title: 'Notas',
          lines: [
            'En la app se usa la referencia de barriga/abdomen como medida principal del tronco.',
            'Las medidas se trabajan en cm.',
          ],
        },
      ],
    };
  }

  if (code === BODY_FAT_FORMULA_CODES.perimetersFemaleNavyAbdomenGlute) {
    return {
      eyebrow: 'Fórmula',
      scientificName: 'U.S. Navy Body Fat Formula (Hodgdon & Beckett, 1984)',
      categoryLabel: 'Perímetros corporales · Mujer',
      sections: [
        {
          title: 'Qué calcula',
          lines: ['Estimación del % de grasa corporal a partir de perímetros y estatura.'],
        },
        {
          title: 'Ecuación',
          tone: 'equation',
          lines: [
            `% grasa = 495 / (${formatCoefficient(FEMALE_PERIMETER_BODY_FAT_COEFFICIENTS.densityBase)} - ${formatCoefficient(FEMALE_PERIMETER_BODY_FAT_COEFFICIENTS.baseLogFactor)} × log10(abdomen + glúteo - cuello) + ${formatCoefficient(FEMALE_PERIMETER_BODY_FAT_COEFFICIENTS.heightLogFactor)} × log10(estatura)) - 450`,
          ],
        },
        {
          title: 'Variables usadas',
          lines: formatVariableLines([
            { name: 'abdomen', description: 'perímetro abdominal / barriga usado en la app' },
            { name: 'glúteo', description: 'perímetro de glúteo/cadera usado en la app' },
            { name: 'cuello', description: 'perímetro del cuello' },
            { name: 'estatura', description: 'altura del cliente' },
          ]),
        },
        {
          title: 'Notas',
          lines: [
            'En la app se usa abdomen/barriga + glúteo como base del cálculo.',
            'Las medidas se trabajan en cm.',
          ],
        },
      ],
    };
  }

  if (code === BODY_FAT_FORMULA_CODES.skinfoldsDurninWomersley4Beginner) {
    const constants = getDurninWomersleyConstants(
      options.sex === 'female' || options.sex === 'male' ? options.sex : null,
      options.age ?? null
    );
    const sexLabel = options.sex === 'female' ? 'mujer' : options.sex === 'male' ? 'hombre' : 'sexo no resuelto';

    return {
      eyebrow: 'Fórmula',
      scientificName: 'Durnin & Womersley (1974)',
      categoryLabel: 'Pliegues cutáneos · 4 pliegues',
      sections: [
        {
          title: 'Qué calcula',
          lines: ['Estimación de densidad corporal y conversión posterior a % de grasa corporal.'],
        },
        {
          title: 'Ecuación',
          tone: 'equation',
          lines: [
            'S = bíceps + tríceps + subescapular + suprailiaco',
            'densidad corporal = C - M × log10(S)',
            '% grasa = 495 / densidad corporal - 450',
          ],
        },
        {
          title: 'Variables usadas',
          lines: formatVariableLines([
            { name: 'bíceps', description: 'pliegue de bíceps en mm' },
            { name: 'tríceps', description: 'pliegue tricipital en mm' },
            { name: 'subescapular', description: 'pliegue subescapular en mm' },
            { name: 'suprailiaco', description: 'pliegue suprailiaco en mm' },
            { name: 'S', description: 'suma de los 4 pliegues' },
            { name: 'C', description: 'constante dependiente del sexo y del tramo de edad' },
            { name: 'M', description: 'constante dependiente del sexo y del tramo de edad' },
          ]),
        },
        {
          title: 'Notas',
          lines: constants
            ? [
                `Constantes activas para este cliente (${sexLabel}, ${constants.ageBracket}): C = ${formatCoefficient(constants.c)}, M = ${formatCoefficient(constants.m)}.`,
                'La fórmula cambia las constantes según sexo y tramo de edad.',
                'El cálculo mostrado coincide exactamente con la implementación real.',
              ]
            : [
                'La fórmula cambia las constantes según sexo y tramo de edad.',
                'El cálculo mostrado coincide exactamente con la implementación real cuando sexo y edad están disponibles.',
              ],
        },
      ],
    };
  }

  return null;
}

export function getPerimeterFormulaCodeForSex(sex: ClientSex | null | undefined) {
  if (sex === 'male') {
    return BODY_FAT_FORMULA_CODES.perimetersMaleNavyAbdomen;
  }

  if (sex === 'female') {
    return BODY_FAT_FORMULA_CODES.perimetersFemaleNavyAbdomenGlute;
  }

  return null;
}

export function getSkinfoldFormulaCodeForAthleteLevel(level: string | null | undefined) {
  return getActiveSkinfoldProtocolForAthleteLevel(level)?.formulaCode ?? null;
}

export function getBodyFatFormulaMetadataByCode(code: BodyFatFormulaCode | string | null | undefined) {
  if (!code) {
    return null;
  }

  return BODY_FAT_FORMULA_METADATA_BY_CODE[code as BodyFatFormulaCode] ?? null;
}