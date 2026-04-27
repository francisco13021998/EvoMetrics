import { ClientSex } from '@/types/domain';

export type RevisionPerimeterFieldKey = 'neckCm' | 'armCm' | 'waistCm' | 'bellyCm' | 'pelvisCm' | 'gluteCm' | 'thighCm';

export function getPerimeterFieldKeysForSex(sex: ClientSex | null | undefined) {
  if (sex === 'female') {
    return {
      required: ['neckCm', 'bellyCm', 'gluteCm'] as const,
      optional: ['waistCm', 'pelvisCm', 'armCm', 'thighCm'] as const,
    };
  }

  return {
    required: ['neckCm', 'bellyCm'] as const,
    optional: ['waistCm', 'pelvisCm', 'gluteCm', 'armCm', 'thighCm'] as const,
  };
}