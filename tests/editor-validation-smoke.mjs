import assert from 'node:assert/strict';
import { missingDocumentationFields, documentationHint } from '../dist/assets/editor-validation.js';

assert.deepEqual(missingDocumentationFields('', ''), ['category', 'description']);
assert.deepEqual(missingDocumentationFields('  ', '\n\t'), ['category', 'description']);
assert.deepEqual(missingDocumentationFields('Meeting', '  '), ['description']);
assert.deepEqual(missingDocumentationFields('', 'Sprintplanung'), ['category']);
assert.deepEqual(missingDocumentationFields('Meeting', 'Sprintplanung'), []);
assert.equal(documentationHint('', ''), 'Kategorie und Beschreibung fehlen');
assert.equal(documentationHint('Meeting', ''), 'Beschreibung fehlt');
assert.equal(documentationHint('', 'Sprintplanung'), 'Kategorie fehlt');
assert.equal(documentationHint('Meeting', 'Sprintplanung'), '');

const fs = await import('node:fs');
const script = fs.readFileSync(new URL('../dist/assets/main.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../dist/assets/styles.css', import.meta.url), 'utf8');
assert.match(script, /id="category-error"/, 'category inline error missing');
assert.match(script, /id="description-error"/, 'description inline error missing');
assert.match(script, /id="editor-requirements"/, 'footer documentation state missing');
assert.match(script, /Abschließen/, 'finish button missing');
assert.match(script, /focusDocumentationField\(descriptionField\)/, 'category selection should focus description');
assert.match(script, /attemptedCompletion = true/, 'completion must validate mandatory fields');
assert.match(css, /field-invalid/, 'invalid field styling missing');
assert.match(css, /#editor-dialog \.editor-footer \{[^}]*flex: 0 0 auto/, 'mobile editor footer must remain fixed');
console.log('PASS: required fields, footer hints, inline errors, category-to-description focus, fixed mobile footer');
