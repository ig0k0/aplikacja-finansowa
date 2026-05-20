import type { BankParserId, BankParserMatch } from "./types";

export function normalizeHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

export function findHeader(headers: string[], candidates: readonly string[]): string | undefined {
  const byNormalized = new Map(headers.map((header) => [normalizeHeader(header), header]));

  for (const candidate of candidates) {
    const exact = byNormalized.get(normalizeHeader(candidate));

    if (exact) {
      return exact;
    }
  }

  return undefined;
}

export function hasHeader(headers: string[], candidate: string): boolean {
  return findHeader(headers, [candidate]) !== undefined;
}

export function buildParserMatch(
  id: BankParserId,
  label: string,
  sourceInstitution: string,
  mapping: BankParserMatch["mapping"],
): BankParserMatch {
  return { id, label, sourceInstitution, mapping };
}
