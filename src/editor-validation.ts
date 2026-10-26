/** Validation for the mandatory documentation, independent of browser form rendering. */
export type DocumentationField = 'category' | 'description';

export function missingDocumentationFields(category: string, description: string): DocumentationField[] {
  const missing: DocumentationField[] = [];
  if (!category.trim()) missing.push('category');
  if (!description.trim()) missing.push('description');
  return missing;
}

export function documentationHint(category: string, description: string): string {
  const missing = missingDocumentationFields(category, description);
  if (missing.length === 2) return 'Kategorie und Beschreibung fehlen';
  if (missing[0] === 'category') return 'Kategorie fehlt';
  if (missing[0] === 'description') return 'Beschreibung fehlt';
  return '';
}
