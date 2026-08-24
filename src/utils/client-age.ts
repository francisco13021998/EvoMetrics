import { Client } from '@/types/domain';
import { formatDateOnly as formatDateOnlyShared, parseDateOnly as parseDateOnlyShared, toLocalDate } from '@/utils/date-only';

export function formatDateOnly(value: Date) {
  return formatDateOnlyShared(value);
}

export function parseDateOnly(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  return parseDateOnlyShared(value);
}

export function calculateAgeFromBirthDate(birthDate: string | Date | null | undefined, referenceDate = new Date()) {
  const normalizedBirthDate = toLocalDate(birthDate);

  if (!normalizedBirthDate || Number.isNaN(referenceDate.getTime())) {
    return null;
  }

  let age = referenceDate.getFullYear() - normalizedBirthDate.getFullYear();
  const monthDifference = referenceDate.getMonth() - normalizedBirthDate.getMonth();
  const hasHadBirthdayThisYear = monthDifference > 0 || (monthDifference === 0 && referenceDate.getDate() >= normalizedBirthDate.getDate());

  if (!hasHadBirthdayThisYear) {
    age -= 1;
  }

  return age >= 0 ? age : null;
}

export function getClientAge(client: Pick<Client, 'birthDate'> | null | undefined, referenceDate = new Date()) {
  if (!client) {
    return null;
  }

  return calculateAgeFromBirthDate(client.birthDate, referenceDate);
}

export function formatClientAge(client: Pick<Client, 'birthDate'> | null | undefined, referenceDate = new Date()) {
  const age = getClientAge(client, referenceDate);

  return age === null ? '-' : `${age} años`;
}
