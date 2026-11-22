// Runs supabase/schema.sql and supabase/seed.sql in an in-memory Postgres (PGlite)
// and checks the database rules: word limits, hamper stock, all-or-nothing enquiries.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { fromRow } from '../src/lib/supabase.js';
import { PRODUCTS } from '../src/data/catalogue.js';

const sql = f => readFileSync(new URL(`../supabase/${f}`, import.meta.url), 'utf8');
const db = new PGlite();
const words = n => Array(n).fill('word').join(' ');
const submit = lines => db.query('select submit_enquiry($1) as ref', [JSON.stringify({ name: 'Test Buyer', email: 'test@example.com', postcode: '2000', lines })]);
const stock = async id => (await db.query('select stock_qty from products where id = $1', [id])).rows[0].stock_qty;

before(async () => {
  await db.exec(`create role anon; create role authenticated;`); // these exist in Supabase already
  await db.exec(sql('schema.sql'));
  await db.exec(sql('seed.sql'));
  await db.exec(sql('schema.sql')); // running it twice must be safe
});

test('seed loads every product', async () => {
  const { rows } = await db.query('select count(*)::int as n from products');
  assert.equal(rows[0].n, 35);
});

test('products read back from the database match the catalogue', async () => {
  const { rows } = await db.query('select * from products order by id');
  const pick = p => ({ slug: p.slug, cat: p.cat, name: p.name, price: p.price, status: p.status, stock: p.stock, hamper: !!p.hamper, builder: !!p.builder, pers: p.pers ? JSON.stringify(p.pers) : false, img: p.img, occ: p.occ, size: p.size });
  for (const r of rows) {
    const local = PRODUCTS.find(p => p.id === r.id);
    const live = fromRow(r);
    assert.deepEqual(pick({ ...live, pers: live.pers }), pick({ ...local, pers: local.pers === true ? { label: 'Name to add', words: 5 } : local.pers }), r.id);
  }
});

test('REQ-P4: personalisation over the word limit is rejected', async () => {
  await submit([{ id: 'v3', qty: 1, opts: { text: words(50) } }]);
  await assert.rejects(submit([{ id: 'v3', qty: 1, opts: { text: words(51) } }]), /limited to 50 words/);
  await assert.rejects(submit([{ id: 'd1', qty: 1, opts: { text: 'Hello' } }]), /cannot be personalised/);
});

test('REQ-H4: a hamper holds stock and cannot take more than there is', async () => {
  assert.equal(await stock('j1'), 2);
  await submit([{ id: 'h8', qty: 1, opts: { items: [{ id: 'j1', qty: 2 }, { id: 'c1', qty: 1 }] } }]);
  assert.equal(await stock('j1'), 0);
  assert.equal(await stock('c1'), 7);
  await assert.rejects(submit([{ id: 'h8', qty: 1, opts: { items: [{ id: 'j1', qty: 1 }, { id: 'c1', qty: 1 }] } }]), /Not enough j1/);
  assert.equal(await stock('c1'), 7, 'a failed enquiry changes nothing');
});

test('REQ-H3/H6: non-hamper pieces and wrong hamper sizes are rejected', async () => {
  await assert.rejects(submit([{ id: 'h8', qty: 1, opts: { items: [{ id: 'p1', qty: 1 }, { id: 'c1', qty: 1 }] } }]), /Not enough p1/);
  await assert.rejects(submit([{ id: 'h8', qty: 1, opts: { items: [{ id: 'c1', qty: 1 }] } }]), /2 to 8 pieces/);
  await assert.rejects(submit([{ id: 'c1', qty: 1, opts: { items: [{ id: 'j2', qty: 1 }] } }]), /Only the build-your-own hamper/);
});

test('REQ-H5: cancelling an enquiry returns its hamper stock', async () => {
  const before = await stock('j2');
  const { rows } = await submit([{ id: 'h8', qty: 2, opts: { items: [{ id: 'j2', qty: 1 }, { id: 't1', qty: 1 }] } }]);
  assert.equal(await stock('j2'), before - 2);
  await db.query(`update enquiries set status = 'cancelled' where ref = $1`, [rows[0].ref]);
  assert.equal(await stock('j2'), before);
});
