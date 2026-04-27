import { getBodyFatFormulaMetadataByCode, type BodyFatFormulaCode } from '@/constants/body-fat-formulas';
import { supabase } from '@/lib/supabase';

export const BODY_FAT_FORMULAS_TABLE = 'body_fat_formulas';

type DbBodyFatFormulaRow = {
  id: string;
  code: string;
  title?: string | null;
  name?: string | null;
  description?: string | null;
  short_description?: string | null;
  category?: string | null;
  metadata?: {
    descriptionLines?: string[];
    shortLabel?: string;
  } | null;
};

export type BodyFatFormulaReference = {
  id: string | null;
  code: string;
  title: string;
  shortLabel: string;
  descriptionLines: string[];
  category: string;
};

const formulaCacheByCode = new Map<string, BodyFatFormulaReference>();
const formulaCacheById = new Map<string, BodyFatFormulaReference>();

function normalizeFormulaReference(row: DbBodyFatFormulaRow | null, requestedCode?: string): BodyFatFormulaReference | null {
  const code = row?.code ?? requestedCode ?? null;

  if (!code) {
    return null;
  }

  const fallback = getBodyFatFormulaMetadataByCode(code);
  const title = fallback?.title ?? row?.title ?? row?.name ?? code;
  const descriptionLines = fallback?.descriptionLines ?? row?.metadata?.descriptionLines ?? row?.description?.split('\n').map((line) => line.trim()).filter(Boolean) ?? [];
  const shortLabel = fallback?.shortLabel ?? row?.metadata?.shortLabel ?? row?.short_description ?? title;
  const category = fallback?.category ?? row?.category ?? 'other';

  return {
    id: row?.id ?? null,
    code,
    title,
    shortLabel,
    descriptionLines: [...descriptionLines],
    category,
  };
}

export const bodyFatFormulasService = {
  async getByCode(code: BodyFatFormulaCode | string | null | undefined) {
    if (!code) {
      return null;
    }

    const cached = formulaCacheByCode.get(code);

    if (cached) {
      return cached;
    }

    const { data, error } = await supabase
      .from(BODY_FAT_FORMULAS_TABLE)
      .select('*')
      .eq('code', code)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    const normalized = normalizeFormulaReference((data as DbBodyFatFormulaRow | null) ?? null, code);

    if (!normalized) {
      return null;
    }

    formulaCacheByCode.set(code, normalized);

    if (normalized.id) {
      formulaCacheById.set(normalized.id, normalized);
    }

    return normalized;
  },

  async getById(id: string | null | undefined) {
    if (!id) {
      return null;
    }

    const cached = formulaCacheById.get(id);

    if (cached) {
      return cached;
    }

    const { data, error } = await supabase
      .from(BODY_FAT_FORMULAS_TABLE)
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    const normalized = normalizeFormulaReference((data as DbBodyFatFormulaRow | null) ?? null);

    if (!normalized) {
      return null;
    }

    if (normalized.id) {
      formulaCacheById.set(normalized.id, normalized);
    }

    formulaCacheByCode.set(normalized.code, normalized);

    return normalized;
  },
};