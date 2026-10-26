import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const script = readFileSync(new URL('../dist/assets/main.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../dist/assets/styles.css', import.meta.url), 'utf8');
assert.match(script, /classList\.toggle\('category-picking', active\)/,
  'category interaction must toggle compact mobile action area');
assert.match(script, /form\.addEventListener\('focusin'/,
  'category mode must follow field focus');
assert.match(script, /scrollRegion\.scrollTop \+= input\.top - region\.top - 12/,
  'category must be positioned above the suggestions');
assert.match(css, /#editor-dialog\.category-picking \.editor-footer\s*\{ display: none;/,
  'mobile actions must yield space while selecting a category');
assert.match(css, /#editor-dialog\.category-picking \.category-options\s*\{[^}]*overflow-y: auto;/,
  'suggestions must remain scrollable');
assert.match(script, /setCategoryPicking\(false\);\s*focusDocumentationField\(descriptionField\)/,
  'actions must return when selecting a category and focusing the description');
console.log('PASS: category mode, scroll positioning, hidden/restored mobile actions');
