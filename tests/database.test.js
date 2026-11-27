// Runs supabase/schema.sql and supabase/seed.sql in an in-memory Postgres (PGlite)
// and checks the database rules: word limits, hamper stock, all-or-nothing enquiries.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { fromRow, fromBaseRow, applyHamperPieces } from '../src/lib/supabase.js';
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
  // Same order as the README: schema, seed, admin, bases, hampers, security. Each must be safe to run twice.
  for (const f of ['schema.sql', 'seed.sql', 'admin.sql', 'bases.sql', 'hampers.sql', 'security.sql',
                   'schema.sql', 'admin.sql', 'bases.sql', 'hampers.sql', 'security.sql']) await db.exec(sql(f));
  // The tests send many enquiries from one address; the rate limits get their own test below.
  await db.exec(`update enquiry_limits set per_email_per_hour = 1000, per_hour = 1000`);
});

test('seed loads every product', async () => {
  const { rows } = await db.query('select count(*)::int as n from products');
  assert.equal(rows[0].n, 35);
});

test('products read back from the database match the catalogue', async () => {
  const { rows } = await db.query('select * from products order by id');
  const bases = (await db.query('select * from bases')).rows.map(fromBaseRow);
  const lives = applyHamperPieces(rows.map(r => fromRow(r, bases)), (await db.query('select * from hamper_pieces')).rows, bases);
  const pick = p => ({ slug: p.slug, cat: p.cat, name: p.name, price: p.price, status: p.status, stock: p.stock, base: p.base, hamper: !!p.hamper, builder: !!p.builder, pers: p.pers ? JSON.stringify(p.pers) : false, img: p.img, occ: p.occ, size: p.size });
  for (const r of rows) {
    const local = PRODUCTS.find(p => p.id === r.id);
    const live = lives.find(p => p.id === r.id);
    assert.deepEqual(pick({ ...live, pers: live.pers }), pick({ ...local, pers: local.pers === true ? { label: 'Name to add', words: 5 } : local.pers }), r.id);
  }
});

test('REQ-P4: personalisation over the word limit is rejected', async () => {
  await submit([{ id: 'v3', qty: 1, opts: { text: words(50) } }]);
  await assert.rejects(submit([{ id: 'v3', qty: 1, opts: { text: words(51) } }]), /limited to 50 words/);
  await assert.rejects(submit([{ id: 'd1', qty: 1, opts: { text: 'Hello' } }]), /cannot be personalised/);
});

test('REQ-H4: a hamper holds stock and cannot take more than there is', async () => {
  assert.equal(await stock('t2'), 3); // wooden tea light holder: no shared base
  await submit([{ id: 'h8', qty: 1, opts: { items: [{ id: 't2', qty: 3 }, { id: 'c1', qty: 1 }] } }]);
  assert.equal(await stock('t2'), 0);
  assert.equal(await stock('c1'), 7);
  await assert.rejects(submit([{ id: 'h8', qty: 1, opts: { items: [{ id: 't2', qty: 1 }, { id: 'c1', qty: 1 }] } }]), /Not enough t2/);
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

/* ---------- ready-made hamper contents and saved prices (supabase/hampers.sql) ---------- */
const lines = async ref => (await db.query(
  `select ei.* from enquiry_items ei join enquiries e on e.id = ei.enquiry_id where e.ref = $1 order by ei.product_id`, [ref])).rows;

test('REQ-H10: an enquiry keeps the prices shown when it was sent', async () => {
  const { rows } = await submit([
    { id: 'c1', qty: 2, opts: {} },
    { id: 'h8', qty: 1, opts: { items: [{ id: 't1', qty: 1 }, { id: 'd2', qty: 1 }] } }
  ]);
  const ref = rows[0].ref;
  let [candle, hamper] = await lines(ref);
  assert.equal(candle.product_name, 'Botanical decoupage candle');
  assert.equal(candle.unit_price_cents, 2200);
  assert.equal(hamper.hamper_fee_cents, 1500);
  assert.equal(hamper.unit_price_cents, 1500 + 1800 + 2800, 'fee plus its pieces');
  const pieces = (await db.query('select product_id, unit_price_cents from enquiry_hamper_items where enquiry_item_id = $1 order by product_id', [hamper.id])).rows;
  assert.deepEqual(pieces.map(x => [x.product_id, x.unit_price_cents]), [['d2', 2800], ['t1', 1800]]);
  // a later price change doesn't change the enquiry
  await db.exec(`update products set price_cents = 9900 where id in ('c1', 't1')`);
  [candle, hamper] = await lines(ref);
  assert.equal(candle.unit_price_cents, 2200);
  assert.equal(hamper.unit_price_cents, 6100);
  await db.exec(`update products set price_cents = 2200 where id = 'c1'; update products set price_cents = 1800 where id = 't1';`);
  await db.query(`update enquiries set status = 'cancelled' where ref = $1`, [ref]);
});

test('REQ-H8: a ready-made hamper takes the stock of its pieces, and cancelling gives it back', async () => {
  const { rows: contents } = await db.query(`select piece_id, qty from hamper_pieces where hamper_id = 'h5' order by piece_id`);
  assert.deepEqual(contents.map(c => c.piece_id), ['c1', 'j2', 'p8']);
  const before = { c1: await stock('c1'), j2: await stock('j2'), p8: await stock('p8') };
  assert.equal(before.p8, 3);
  const { rows } = await submit([{ id: 'h5', qty: 3, opts: {} }]);
  assert.equal(await stock('p8'), 0);
  assert.equal(await stock('c1'), before.c1 - 3);
  assert.equal(await stock('j2'), before.j2 - 3);
  assert.equal((await lines(rows[0].ref))[0].unit_price_cents, 6000, 'the hamper keeps its own price');
  await assert.rejects(submit([{ id: 'h5', qty: 1, opts: {} }]), /Not enough p8/);
  await assert.rejects(submit([{ id: 'h5', qty: 1, opts: { items: [{ id: 'c1', qty: 1 }] } }]), /Only the build-your-own hamper/);
  await db.query(`update enquiries set status = 'cancelled' where ref = $1`, [rows[0].ref]);
  assert.deepEqual({ c1: await stock('c1'), j2: await stock('j2'), p8: await stock('p8') }, before);
});

test('REQ-H8: pieces whose stock is not counted do not limit a ready-made hamper', async () => {
  await db.exec(`insert into hamper_pieces (hamper_id, piece_id, qty) values ('h1', 'p1', 1)`); // p1: not counted
  await submit([{ id: 'h1', qty: 5, opts: {} }]);
  assert.equal(await stock('p1'), null);
  await db.exec(`delete from hamper_pieces where hamper_id = 'h1'`);
});

test('REQ-H8: running hampers.sql again keeps contents Neha has changed', async () => {
  await db.exec(`delete from hamper_pieces where hamper_id = 'h4' and piece_id = 'j2'`);
  await db.exec(sql('hampers.sql'));
  const { rows } = await db.query(`select piece_id from hamper_pieces where hamper_id = 'h4'`);
  assert.deepEqual(rows.map(r => r.piece_id), ['t3']);
});

/* ---------- limits against fake enquiries (supabase/security.sql) ---------- */
const submitAs = (email, lines) => db.query('select submit_enquiry($1) as ref', [JSON.stringify({ name: 'Test Buyer', email, postcode: '2000', lines })]);
const cancel = ref => db.query(`update enquiries set status = 'cancelled' where ref = $1`, [ref]);

test('REQ-X1: one enquiry can only hold so much', async () => {
  await db.exec(`update enquiry_limits set max_lines = 3, max_hamper_qty = 2, max_hamper_units = 5`);
  try {
    const before = { c1: await stock('c1'), j2: await stock('j2') };
    await assert.rejects(submit([1, 2, 3, 4].map(() => ({ id: 'd1', qty: 1, opts: {} }))), /at most 3 items/);
    await assert.rejects(submit([{ id: 'h8', qty: 3, opts: { items: [{ id: 'c1', qty: 1 }, { id: 'j2', qty: 1 }] } }]), /at most 2 at a time/);
    // 2 hampers x 2 pieces = 4 pieces: fine. Adding a second line of 2 more goes over 5.
    const { rows } = await submit([{ id: 'h8', qty: 2, opts: { items: [{ id: 'c1', qty: 1 }, { id: 'j2', qty: 1 }] } }]);
    await cancel(rows[0].ref);
    await assert.rejects(submit([
      { id: 'h8', qty: 2, opts: { items: [{ id: 'c1', qty: 1 }, { id: 'j2', qty: 1 }] } },
      { id: 'h8', qty: 1, opts: { items: [{ id: 'c1', qty: 1 }, { id: 'j2', qty: 1 }] } }
    ]), /at most 5 hamper pieces/);
    // a ready-made hamper counts its listed pieces too (h5 has 3)
    await assert.rejects(submit([{ id: 'h5', qty: 2, opts: {} }]), /at most 5 hamper pieces/);
    assert.deepEqual({ c1: await stock('c1'), j2: await stock('j2') }, before, 'refused enquiries hold nothing');
  } finally {
    await db.exec(`update enquiry_limits set max_lines = 20, max_hamper_qty = 10, max_hamper_units = 40`);
  }
});

test('REQ-X2: enquiries per email address and per hour are limited', async () => {
  await db.exec(`update enquiry_limits set per_email_per_hour = 2, per_hour = 1000`);
  try {
    await submitAs('Rate@Example.com', [{ id: 'd1', qty: 1, opts: {} }]);
    await submitAs('rate@example.com', [{ id: 'd1', qty: 1, opts: {} }]);
    await assert.rejects(submitAs('RATE@example.com', [{ id: 'd1', qty: 1, opts: {} }]), /Too many enquiries from this email/);
    const { rows } = await db.query(`select count(*)::int as n from enquiries where created_at > now() - interval '1 hour'`);
    await db.exec(`update enquiry_limits set per_email_per_hour = 1000, per_hour = ${rows[0].n}`);
    await assert.rejects(submitAs('someone.new@example.com', [{ id: 'd1', qty: 1, opts: {} }]), /a lot of enquiries in the last hour/);
  } finally {
    await db.exec(`update enquiry_limits set per_email_per_hour = 1000, per_hour = 1000`);
  }
});

test('REQ-X3: enquiries nobody confirmed are cancelled after hold_days and give their stock back', async () => {
  const before = await stock('c1');
  const old = await submit([{ id: 'h8', qty: 1, opts: { items: [{ id: 'c1', qty: 1 }, { id: 'j2', qty: 1 }] } }]);
  const confirmed = await submit([{ id: 'h8', qty: 1, opts: { items: [{ id: 'c1', qty: 1 }, { id: 'j2', qty: 1 }] } }]);
  const fresh = await submit([{ id: 'h8', qty: 1, opts: { items: [{ id: 'c1', qty: 1 }, { id: 'j2', qty: 1 }] } }]);
  await db.query(`update enquiries set created_at = now() - interval '8 days' where ref in ($1, $2)`, [old.rows[0].ref, confirmed.rows[0].ref]);
  await db.query(`update enquiries set status = 'confirmed' where ref = $1`, [confirmed.rows[0].ref]);
  assert.equal(await stock('c1'), before - 3);
  // cancel every other "new" enquiry older than 7 days left by earlier tests, then check ours
  await db.query('select expire_stale_enquiries()');
  const status = async ref => (await db.query('select status from enquiries where ref = $1', [ref])).rows[0].status;
  assert.equal(await status(old.rows[0].ref), 'cancelled');
  assert.equal(await status(confirmed.rows[0].ref), 'confirmed', 'confirmed enquiries are kept');
  assert.equal(await status(fresh.rows[0].ref), 'new', 'recent enquiries are kept');
  assert.equal(await stock('c1'), before - 2, 'the expired enquiry gave its piece back');
  await cancel(confirmed.rows[0].ref); await cancel(fresh.rows[0].ref);
});

test('REQ-X4: the website cannot read or change the limits, or run the expiry itself', async () => {
  const { rows } = await db.query(`select has_function_privilege('anon', 'expire_stale_enquiries()', 'execute') as run,
    (select relrowsecurity from pg_class where relname = 'enquiry_limits') as rls,
    (select count(*)::int from pg_policies where tablename = 'enquiry_limits') as policies`);
  assert.deepEqual(rows[0], { run: false, rls: true, policies: 0 });
});
