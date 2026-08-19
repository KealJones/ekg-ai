import test from 'node:test';
import assert from 'node:assert/strict';
import { levenshtein, bestFuzzyMatch } from '../dist/index.js';

test('levenshtein distance is correct for common cases', () => {
  assert.equal(levenshtein('', ''), 0);
  assert.equal(levenshtein('abc', 'abc'), 0);
  assert.equal(levenshtein('abc', 'abd'), 1);
  assert.equal(levenshtein('multiply', 'multipli'), 1);
  assert.equal(levenshtein('seven', 'sevn'), 1);
  assert.equal(levenshtein('three', 'thre'), 1);
  assert.equal(levenshtein('kitten', 'sitting'), 3);
  assert.equal(levenshtein('', 'abc'), 3);
  assert.equal(levenshtein('abc', ''), 3);
});

test('levenshtein handles Unicode correctly', () => {
  assert.equal(levenshtein('cafe', 'cafe'), 0);
  assert.equal(levenshtein('naif', 'naiv'), 1);
});

test('bestFuzzyMatch finds closest candidate within threshold', () => {
  const words = ['multiply', 'add', 'subtract', 'divide'];
  assert.deepEqual(bestFuzzyMatch('multipli', words), {candidate: 'multiply', distance: 1});
  assert.deepEqual(bestFuzzyMatch('multiply', words), {candidate: 'multiply', distance: 0});
  assert.equal(bestFuzzyMatch('xyz', words), undefined);
});

test('bestFuzzyMatch rejects short-word fuzzy matches that are too proportionally distant', () => {
  const words = ['to', 'go', 'do', 'no', 'at'];
  assert.equal(bestFuzzyMatch('xx', words), undefined); // distance 2 / length 2 = 1.0 > 0.3
  assert.equal(bestFuzzyMatch('too', ['to', 'go']), undefined); // 1/3 = 0.33 > 0.3 threshold
  assert.deepEqual(bestFuzzyMatch('multipli', ['multiply', 'add']), {candidate: 'multiply', distance: 1}); // 1/8 = 0.125 < 0.3
});
