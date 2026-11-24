import personal from './generated/personal_oras.json';
import type { PersonalEntry } from './personalTable';

type PersonalEntry6 = Omit<PersonalEntry, 'callRate'> & { readonly escapeRate: number };

const table = personal as unknown as readonly PersonalEntry6[];

export function getPersonalEntry6(species: number, forme = 0): PersonalEntry6 {
  const base = table[species] ?? table[0]!;
  if (forme <= 0 || base.formStatsIndex <= 0 || forme > base.formeCount) return base;
  return table[base.formStatsIndex + forme - 1] ?? base;
}
