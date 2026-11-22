// Tests for the business rules in src/lib/rules.js. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as rules from '../src/lib/rules.js';

const p = id => rules.byId(id);
const words = n => Array(n).fill('word').join(' ');

test('word count treats runs of non-space characters as words', () => {
  assert.equal(rules.wordCount(''), 0);
  assert.equal(rules.wordCount('  Ms   Lee '), 2);
  assert.equal(rules.wordCount('Happy-Diwali!'), 1);
});

test('REQ-P2: each product has its own word limit', () => {
  assert.equal(rules.persOf(p('v3')).words, 50);   // bottle vase
  assert.equal(rules.persOf(p('c1')).words, 15);   // motif candle
  assert.equal(rules.persOf(p('p2')).words, 5);    // default
  assert.equal(rules.persOf(p('d1')), null);       // not personalisable
});

test('REQ-P3/P4: text over the limit or on a non-personalisable product is refused', () => {
  assert.ok(rules.checkPers(p('v3'), words(50)).ok);
  assert.ok(!rules.checkPers(p('v3'), words(51)).ok);
  assert.ok(!rules.checkPers(p('d1'), 'Hello').ok);
  assert.ok(rules.checkPers(p('d1'), '').ok);
});

test('REQ-H3: out-of-stock or non-hamper pieces cannot go in a hamper', () => {
  assert.ok(rules.checkHamper([{ id: 'c1', qty: 1 }, { id: 'j2', qty: 1 }], 1, []).ok);
  assert.ok(!rules.checkHamper([{ id: 'c1', qty: 1 }, { id: 'c3', qty: 1 }], 1, []).ok); // c3 stock 0
  assert.ok(!rules.checkHamper([{ id: 'c1', qty: 1 }, { id: 'p1', qty: 1 }], 1, []).ok); // p1 not a hamper piece
  assert.ok(!rules.checkHamper([{ id: 'j1', qty: 3 }], 1, []).ok);                      // j1 stock 2
});

test('REQ-H4: stock already held by hampers in the list counts', () => {
  const bag = [{ key: 'a', id: 'h8', qty: 1, opts: { items: [{ id: 'j1', qty: 2 }] } }];
  assert.equal(rules.available('j1', bag), 0);
  assert.ok(!rules.checkHamper([{ id: 'j1', qty: 1 }, { id: 'c1', qty: 1 }], 1, bag).ok);
  // raising the same hamper to 2 needs 4 jars, only 2 exist
  assert.ok(!rules.checkLine({ ...bag[0], qty: 2, opts: { items: [{ id: 'j1', qty: 2 }] } }, bag).ok);
});

test('REQ-H6: 2 to 8 pieces and a card message of up to 30 words', () => {
  assert.ok(!rules.checkHamper([{ id: 'c1', qty: 1 }], 1, []).ok);
  assert.ok(!rules.checkHamper([{ id: 'j2', qty: 9 }], 1, []).ok);
  assert.ok(!rules.checkHamper([{ id: 'c1', qty: 1 }, { id: 'j2', qty: 1 }], 1, [], null, words(31)).ok);
  assert.equal(rules.hamperPrice([{ id: 'c1', qty: 1 }, { id: 'j2', qty: 2 }]), 15 + 22 + 40);
});
