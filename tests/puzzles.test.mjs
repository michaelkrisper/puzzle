import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
require('../core/puzzles.js');
const P = globalThis.PH.puzzles;

// Keys of the store as IndexedDB orders them (strings by code unit).
const inSpan = (k, [from, to]) => k >= from && k < to;

test('data of a puzzle: keys under its number only', () => {
  assert.equal(P.prefix(3), '3/');
  assert.equal(P.metaKey(3), 'puzzle:3');
  const span = P.dataSpan(1);
  for (const k of ['1/ref', '1/feat', '1/round', '1/solved', '1/photo:12', '1/analysis:12'])
    assert.ok(inSpan(k, span), k);
  for (const k of ['10/ref', '11/photo:1', '2/ref', 'puzzle:1', 'attempts', 'ref', 'photo:1'])
    assert.ok(!inSpan(k, span), k);
  assert.ok(inSpan('10/ref', P.dataSpan(10)));
  assert.ok(!inSpan('1/ref', P.dataSpan(10)));
});

test('list entries: their own span, apart from the data', () => {
  assert.ok(inSpan('puzzle:1', P.META));
  assert.ok(inSpan('puzzle:120', P.META));
  for (const k of ['1/ref', 'attempts', 'photo:1', 'round']) assert.ok(!inSpan(k, P.META), k);
});

test('next number', () => {
  assert.equal(P.nextId([]), 1);
  assert.equal(P.nextId([1, 2, 5]), 6);
});

test('migration: the puzzle of the version before becomes one of the list', () => {
  const keys = ['analysis:1', 'attempts', 'feat', 'photo:1', 'photo:2', 'ref', 'round', 'solved'];
  const plan = P.migration(keys, []);
  assert.equal(plan.id, 1);
  assert.deepEqual(plan.moves, [
    ['analysis:1', '1/analysis:1'],
    ['feat', '1/feat'],
    ['photo:1', '1/photo:1'],
    ['photo:2', '1/photo:2'],
    ['ref', '1/ref'],
    ['round', '1/round'],
    ['solved', '1/solved'],
  ]);
  // Next to puzzles that exist already (an interrupted update).
  assert.equal(P.migration(['ref'], [1, 4]).id, 5);
});

test('migration: photos without a reference are dropped, new keys stay', () => {
  assert.deepEqual(P.migration(['photo:3', 'round', 'attempts'], []), { drop: ['photo:3', 'round'] });
  assert.equal(P.migration(['attempts', 'puzzle:1', '1/ref', '1/photo:1', '12/round'], [1]), null);
  assert.equal(P.migration([], []), null);
});

test('names', () => {
  assert.equal(P.defaultName(2), 'Puzzle 2');
  assert.equal(P.cleanName('  Jäger  im\n Schnee ', 'alt'), 'Jäger im Schnee');
  assert.equal(P.cleanName('   ', 'alt'), 'alt');
  assert.equal(P.cleanName('x'.repeat(100), 'alt').length, 60);
});

test('list: opened last first, label with count and date', () => {
  const list = [
    { id: 1, opened: 10 },
    { id: 2, opened: 30 },
    { id: 3, opened: 20 },
  ];
  assert.deepEqual(
    P.sorted(list).map((p) => p.id),
    [2, 3, 1],
  );
  assert.equal(list[0].id, 1);
  const created = new Date(2026, 10, 5, 12).getTime();
  assert.equal(P.label({ count: 1000, created }), '1000 Teile · angelegt 05.11.2026');
  assert.equal(P.label({ count: 0, created }), 'angelegt 05.11.2026');
});

test('sizes and the full storage', () => {
  assert.equal(P.size(3.44 * 2 ** 20), '3,4 MB');
  assert.equal(P.size(120.4 * 2 ** 20), '120 MB');
  assert.equal(P.size(2.5 * 2 ** 30), '2,5 GB');
  assert.ok(P.isQuota({ name: 'QuotaExceededError' }));
  assert.ok(!P.isQuota(new Error('other')));
  assert.ok(!P.isQuota(null));
});
