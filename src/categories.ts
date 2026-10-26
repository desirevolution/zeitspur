import type { CategorySuggestion } from './types.js';

export function cleanCategory(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').normalize('NFC');
}

export function categoryKey(raw: string): string {
  return cleanCategory(raw).toLocaleLowerCase('de-DE');
}

/** A category remains in the list even when all of its sessions were deleted. */
export function useCategory(items: CategorySuggestion[], raw: string, at: number): { items: CategorySuggestion[]; name: string } {
  const name = cleanCategory(raw);
  if (!name || name.length > 90) throw new Error('Kategorie muss 1 bis 90 Zeichen lang sein.');
  const canonical = items.find(item => categoryKey(item.name) === categoryKey(name));
  const chosen = canonical?.name ?? name;
  return {
    name: chosen,
    items: [...items.filter(item => categoryKey(item.name) !== categoryKey(chosen)), { name: chosen, lastUsedAt: at }]
      .sort((a, b) => b.lastUsedAt - a.lastUsedAt || a.name.localeCompare(b.name, 'de-DE')),
  };
}

/** Only an explicit remove action deletes a suggestion. No session is touched. */
export function removeCategory(items: CategorySuggestion[], raw: string): CategorySuggestion[] {
  return items.filter(item => categoryKey(item.name) !== categoryKey(raw));
}

export function isCategoryList(raw: unknown): raw is CategorySuggestion[] {
  if (!Array.isArray(raw) || raw.length > 10000) return false;
  const seen = new Set<string>();
  return raw.every(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
    const candidate = item as Partial<CategorySuggestion>;
    if (typeof candidate.name !== 'string' || cleanCategory(candidate.name) !== candidate.name ||
      candidate.name.length < 1 || candidate.name.length > 90 ||
      typeof candidate.lastUsedAt !== 'number' || !Number.isSafeInteger(candidate.lastUsedAt) ||
      candidate.lastUsedAt < 0 || candidate.lastUsedAt > 8640000000000000) return false;
    const key = categoryKey(candidate.name);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Quick selection stays useful while typing: matching categories first, then recent ones. */
export function pickerCategories(items: CategorySuggestion[], draft: string, expanded: boolean, search = ''): string[] {
  const names = [...items]
    .sort((a, b) => b.lastUsedAt - a.lastUsedAt || a.name.localeCompare(b.name, 'de-DE'))
    .map(item => item.name);
  if (expanded) {
    const term = categoryKey(search);
    return term ? names.filter(name => categoryKey(name).includes(term)) : names;
  }
  const term = categoryKey(draft);
  if (!term) return names.slice(0, 5);
  const matches = names.filter(name => categoryKey(name).includes(term)).slice(0, 5);
  // Keep the familiar quick picks visible even for a completely new input.
  const recent = names.filter(name => !matches.includes(name)).slice(0, 5);
  return [...matches, ...recent];
}
