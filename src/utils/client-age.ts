import { Client } from '@/types/domain';

function parseDateParts(value: string) {
  const [yearString, monthString, dayString] = value.trim().split('-');
  const year = Number(yearString);
  const month = Number(monthString);
  const day = Number(dayString);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }

  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

function normalizeDateInput(value: string | Date | null | undefined) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : new Date(value.getFullYear(), value.getMonth(), value.getDate(), 0, 0, 0, 0);
  }

  return parseDateParts(value);
}

export function formatDateOnly(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function parseDateOnly(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  return parseDateParts(value);
}

export function calculateAgeFromBirthDate(birthDate: string | Date | null | undefined, referenceDate = new Date()) {
  const normalizedBirthDate = normalizeDateInput(birthDate);

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