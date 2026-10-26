import assert from 'node:assert/strict';
import { categoryKey, pickerCategories, useCategory, removeCategory } from '../dist/assets/categories.js';
let list = [];
for (const [i, name] of ['Design', 'Support', 'Planung', 'Testing', 'Meeting', 'Entwicklung', 'Recherche'].entries()) {
  list = useCategory(list, name, 1000 + i).items;
}
assert.deepEqual(pickerCategories(list, '', false), ['Recherche','Entwicklung','Meeting','Testing','Planung']);
assert.deepEqual(pickerCategories(list, 'Neu', false), ['Recherche','Entwicklung','Meeting','Testing','Planung']);
const matching = pickerCategories(list, 'sup', false);
assert.equal(matching[0], 'Support');
assert(matching.includes('Recherche'));
assert.equal(pickerCategories(list, '', true).length, 7);
assert.deepEqual(pickerCategories(list, '', true, 'ent'), ['Entwicklung']);
assert.deepEqual(pickerCategories(list, '', true, 'never-match'), []);
list = removeCategory(list, 'entWICKlung');
assert(!pickerCategories(list, '', true).some(name => categoryKey(name) === 'entwicklung'));
list = useCategory(list, 'ENTWICKLUNG', 9000).items;
assert.equal(list[0].name, 'ENTWICKLUNG');
assert.equal(pickerCategories(list, '', false)[0], 'ENTWICKLUNG');
console.log('PASS: quick picks, input fallback, matching-first, expanded search, remove and re-add');
