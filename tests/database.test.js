// Runs supabase/schema.sql and supabase/seed.sql in an in-memory Postgres (PGlite)
// and checks the database rules: word limits, hamper stock, all-or-nothing enquiries.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { fromRow, fromBaseRow } from '../src/lib/supabase.js';
import { PRODUCTS } from '../src/data/catalogue.js';

const sql = f => readFileSync(new URL(`../supabase/${f}`, import.meta.url), 'utf8');
const db = new PGlite();
const words = n => Array(n).fill('word').join(' ');
const submit = lines => db.query('select submit_enquiry($1) as ref', [JSON.stringify({ name: 'Test Buyer', email: 'test@example.com', postcode: '2000', lines })]);
const stock = async id => (await db.query('select stock_qty from products where id = $1', [id])).rows[0].stock_qty;

before(async () => {
  // Supabase already has these: roles, and the auth schema that admin.sql refers to.
  await db.exec(`create role anon; create role authenticated;
    create schema auth; create table auth.users (id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;`);
  // Same order as the README: schema, seed, admin, bases. Each must be safe to run twice.
  for (const f of ['schema.sql', 'seed.sql', 'admin.sql', 'bases.sql', 'schema.sql', 'admin.sql', 'bases.sql']) await db.exec(sql(f));
});

test('seed loads every product', async () => {
  const { rows } = await db.query('select count(*)::int as n from products');
  assert.equal(rows[0].n, 35);
});

test('products read back from the database match the catalogue', async () => {
  const { rows } = await db.query('select * from products order by id');
  const bases = (await db.query('select * from bases')).rows.map(fromBaseRow);
  const pick = p => ({ slug: p.slug, cat: p.cat, name: p.name, price: p.price, status: p.status, stock: p.stock, base: p.base, hamper: !!p.hamper, builder: !!p.builder, pers: p.pers ? JSON.stringify(p.pers) : false, img: p.img, occ: p.occ, size: p.size });
  for (const r of rows) {
    const local = PRODUCTS.find(p => p.id === r.id);
    const live = fromRow(r, bases);
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

/* ---------- shared blank bases (supabase/bases.sql) ---------- */
const blanks = async id => (await db.query('select stock_qty from bases where id = $1', [id])).rows[0].stock_qty;

test('REQ-B1: Bluebell and Aztec Stripe share the 21 cm base', async () => {
  const { rows } = await db.query(`select id from products where base_id = 'planter-21' order by id`);
  assert.deepEqual(rows.map(r => r.id), ['p11', 'p12']);
});

test('REQ-B3/B4: ready-made pieces are used first, then blanks, shared between designs', async () => {
  await db.exec(`update products set hamper_eligible = true where id in ('p11', 'p12');
                 update products set stock_qty = 1 where id = 'p11'; update products set stock_qty = 0 where id = 'p12';
                 update bases set stock_qty = 2 where id = 'planter-21';`);
  // 2 Bluebell: 1 ready-made + 1 blank
  const a = await submit([{ id: 'h8', qty: 1, opts: { items: [{ id: 'p11', qty: 2 }, { id: 'j2', qty: 1 }] } }]);
  assert.equal(await stock('p11'), 0);
  assert.equal(await blanks('planter-21'), 1);
  // 1 Aztec: no ready-made, takes the last blank
  await submit([{ id: 'h8', qty: 1, opts: { items: [{ id: 'p12', qty: 1 }, { id: 'j2', qty: 1 }] } }]);
  assert.equal(await blanks('planter-21'), 0);
  // nothing left for either design
  await assert.rejects(submit([{ id: 'h8', qty: 1, opts: { items: [{ id: 'p11', qty: 1 }, { id: 'j2', qty: 1 }] } }]), /Not enough p11/);
  // REQ-B5: cancelling the first gives back 1 ready-made Bluebell and 1 blank
  await db.query(`update enquiries set status = 'cancelled' where ref = $1`, [a.rows[0].ref]);
  assert.equal(await stock('p11'), 1);
  assert.equal(await blanks('planter-21'), 1);
});

test('REQ-B4: a hamper piece needs a stock count or a base', async () => {
  await assert.rejects(db.exec(`update products set hamper_eligible = true where id = 'p1'`), /hamper_piece_needs_stock_count/);
  await db.exec(`update products set stock_qty = null where id = 'p12'`); // Aztec: base only
  await db.exec(`update products set hamper_eligible = true where id = 'p12'`);
});
