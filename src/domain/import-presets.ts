/**
 * Przykladowe nazwy kolumn dla neutralnego importu — nie sa parserami bankowymi.
 * Uzytkownik musi porownac naglowki w pliku i poprawic pola recznie.
 */
export type ImportMappingPresetId = "pl_common" | "mbank_csv_example" | "en_common";

export type ImportMappingPreset = {
  id: ImportMappingPresetId;
  label: string;
  hint: string;
  dateColumn: string;
  amountColumn: string;
  descriptionColumn: string;
  /** Puste = brak mapowania sklepu. */
  merchantColumn: string;
};

export const importMappingPresets: readonly ImportMappingPreset[] = [
  {
    id: "pl_common",
    label: "PL: Data / Kwota / Opis",
    hint: "Typowe polskie naglowki w prostym CSV.",
    dateColumn: "Data",
    amountColumn: "Kwota",
    descriptionColumn: "Opis",
    merchantColumn: "",
  },
  {
    id: "mbank_csv_example",
    label: "mBank (przykladowe nazwy)",
    hint: "Czesto spotykane w eksporcie mBank — sprawdz naglowki w pliku.",
    dateColumn: "Data operacji",
    amountColumn: "Kwota",
    descriptionColumn: "Opis operacji",
    merchantColumn: "Lokalizacja",
  },
  {
    id: "en_common",
    label: "EN: Date / Amount / Description",
    hint: "Eksporty z opisem angielskim (np. niektore fintechy).",
    dateColumn: "Date",
    amountColumn: "Amount",
    descriptionColumn: "Description",
    merchantColumn: "Merchant",
  },
] as const;

export function findImportMappingPreset(preset: string | undefined): ImportMappingPreset | undefined {
  if (!preset) {
    return undefined;
  }

  return importMappingPresets.find((p) => p.id === preset);
}
