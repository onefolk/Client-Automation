require('./register.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { encodeCsv } = require('../src/lib/csv.ts');

test('CSV preserves quotes, commas, line breaks, Unicode and zero values', () => {
  assert.equal(encodeCsv([['A "quoted", name', '東京\nClinic', 0, null]]), '"A ""quoted"", name","東京\nClinic","0",""');
});

test('CSV treats formula prefixes and international phone numbers as text', () => {
  assert.equal(encodeCsv([['=1+1', '+971123', '@SUM(A1)', 'normal']]), '"\'=1+1","\'+971123","\'@SUM(A1)","normal"');
});
