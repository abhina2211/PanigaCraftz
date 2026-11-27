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
  assert.ok(rules.checkHamper([{ id: 'c1', qty: 1 }, { id: 'c3', qty: 1 }], 1, []).ok);  // c3: no ready-made, but blank candle jars
  assert.ok(!rules.checkHamper([{ id: 'c1', qty: 1 }, { id: 'p9', qty: 1 }], 1, []).ok);  // p9 not counted
  assert.ok(!rules.checkHamper([{ id: 'c1', qty: 1 }, { id: 'p1', qty: 1 }], 1, []).ok); // p1 not a hamper piece
  assert.ok(!rules.checkHamper([{ id: 't2', qty: 4 }], 1, []).ok);                      // t2 stock 3, no base
});

test('REQ-H4: stock already held by hampers in the list counts', () => {
  const bag = [{ key: 'a', id: 'h8', qty: 1, opts: { items: [{ id: 't2', qty: 3 }] } }];
  assert.equal(rules.available('t2', bag), 0);
  assert.ok(!rules.checkHamper([{ id: 't2', qty: 1 }, { id: 'c1', qty: 1 }], 1, bag).ok);
  // raising the same hamper to 2 needs 4, only 3 exist
  assert.ok(!rules.checkLine({ ...bag[0], qty: 2, opts: { items: [{ id: 't2', qty: 2 }] } }, bag).ok);
});

test('REQ-H6: 2 to 8 pieces and a card message of up to 30 words', () => {
  assert.ok(!rules.checkHamper([{ id: 'c1', qty: 1 }], 1, []).ok);
  assert.ok(!rules.checkHamper([{ id: 'j2', qty: 9 }], 1, []).ok);
  assert.ok(!rules.checkHamper([{ id: 'c1', qty: 1 }, { id: 'j2', qty: 1 }], 1, [], null, words(31)).ok);
  assert.equal(rules.hamperPrice([{ id: 'c1', qty: 1 }, { id: 'j2', qty: 2 }]), 15 + 22 + 40);
});

test('REQ-B2: a design shows in stock, made to order (blanks on its base) or sold out', async () => {
  const { statusFor } = await import('../src/data/catalogue.js');
  const bases = [{ id: 'b', stock: 2 }, { id: 'empty', stock: 0 }];
  assert.equal(statusFor({ stock: 1, base: 'b' }, bases), 'in');
  assert.equal(statusFor({ stock: 0, base: 'b' }, bases), 'made');
  assert.equal(statusFor({ stock: 0, base: 'empty' }, bases), 'sold');
  assert.equal(statusFor({ stock: null }, bases), null);
  assert.equal(statusFor({ stock: 5, fixedStatus: 'made' }, bases), 'made');
});

test('REQ-B3/B4: hampers use ready-made first, then blanks shared between designs', async () => {
  const { PRODUCTS } = await import('../src/data/catalogue.js');
  const p11 = PRODUCTS.find(p => p.id === 'p11'), p12 = PRODUCTS.find(p => p.id === 'p12');
  const saved = [p11.hamper, p12.hamper, p11.price, p12.price]; p11.hamper = p12.hamper = true; p11.price = p12.price = 45; // hamper pieces need a price
  try {
    // p11: 1 ready-made, p12: 0 ready-made, shared base: 3 blanks
    assert.equal(rules.available('p11', []), 4);
    assert.equal(rules.available('p12', []), 3);
    const bag = [{ key: 'a', id: 'h8', qty: 1, opts: { items: [{ id: 'p11', qty: 2 }] } }]; // 1 ready + 1 blank
    assert.equal(rules.available('p12', bag), 2);
    assert.ok(rules.checkHamper([{ id: 'p12', qty: 2 }, { id: 'c1', qty: 1 }], 1, bag).ok);
    assert.ok(!rules.checkHamper([{ id: 'p12', qty: 3 }, { id: 'c1', qty: 1 }], 1, bag).ok);
    // two designs in one hamper draw on the same blanks
    assert.ok(!rules.checkHamper([{ id: 'p11', qty: 3 }, { id: 'p12', qty: 2 }], 1, []).ok);
  } finally { [p11.hamper, p12.hamper, p11.price, p12.price] = saved; }
});

test('REQ-H8: a ready-made hamper follows the stock of the pieces inside', () => {
  const xmas = p('h5'); // chocolate box j2, botanical candle c1, mini planter p8 (stock 3)
  assert.equal(xmas.status, 'in');
  assert.ok(rules.checkLine({ key: 'x', id: 'h5', qty: 3, opts: {} }, []).ok);
  assert.ok(!rules.checkLine({ key: 'x', id: 'h5', qty: 4, opts: {} }, []).ok);   // only 3 mini planters
  // a custom hamper already holding all 3 mini planters leaves none for the Christmas hamper
  const bag = [{ key: 'a', id: 'h8', qty: 1, opts: { items: [{ id: 'p8', qty: 3 }, { id: 'c1', qty: 1 }] } }];
  assert.ok(!rules.checkLine({ key: 'x', id: 'h5', qty: 1, opts: {} }, bag).ok);
  // and the other way round: Christmas hampers in the list hold their pieces for custom hampers
  const bag2 = [{ key: 'x', id: 'h5', qty: 3, opts: {} }];
  assert.equal(rules.available('p8', bag2), 0);
  // hampers without listed contents are not limited
  assert.ok(rules.checkLine({ key: 'y', id: 'h1', qty: 50, opts: {} }, []).ok);
});
