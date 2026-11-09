import { norm } from "./dictionaries";

/**
 * Кестедегі менеджер аттарының нұсқалары → бір адам (қолданушы 2026-11-09 растады:
 * «Назерке/Назерке2, Жанерке/Жанерке 2, Аружан/Аружан 2 — бір адам»).
 * Негізгі ат — қазір жұмыс істеп жүрген нұсқа (сайттағы аккаунттың аты).
 */
export const MANAGER_ALIASES: Record<string, string> = {
  "назерке2": "Назерке",
  "назерке 2": "Назерке",
  "жанерке": "Жанерке 2",
  "аружан": "Аружан 2",
};

export function canonicalManager(raw: unknown): string | null {
  const s = String(raw ?? "").trim().replace(/\s+/g, " ");
  if (!s) return null;
  return MANAGER_ALIASES[norm(s)] ?? s;
}
